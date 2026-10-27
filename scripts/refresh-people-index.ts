// Builds the local people index behind the search box (src/lib/people-index.generated.json).
//
//   npm run people:refresh
//
// TMDB's own person search matches whole words only and ranks by relevance, so type-ahead ("speil",
// "georg") needs a local index to match prefixes and typos against, ranked by how well known
// someone is (see src/lib/people-match.ts). The index holds the people a film lover searches for:
//
//   a. the most popular people (/person/popular, mostly actors);
//   b. the key crew and top-billed cast of the most notable films (/movie/top_rated and
//      /movie/popular, then /movie/{id}/credits for each film);
//   c. every person that src/lib/examples.ts mentions, so the curated pairings are always findable.
//
// Every TMDB response is cached on disk so reruns are cheap; delete the cache folder (or pass
// --no-cache) for a fresh crawl. The folder defaults to node_modules/.cache/parallel-people-index
// and can be moved with PEOPLE_INDEX_CACHE_DIR. Nothing secret goes into the cache or the output.
//
// TMDB's terms limit how long cached TMDB data may be kept (six months), so rerun this at least
// that often and commit the result. See "People search index" in the README.
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { EXAMPLE_PAIRINGS } from "../src/lib/examples";
import { encodePeopleIndex } from "../src/lib/people-index-format";
import type { MatchablePerson } from "../src/lib/people-match";

const OUTPUT = fileURLToPath(new URL("../src/lib/people-index.generated.json", import.meta.url));
const CACHE_DIR =
  process.env.PEOPLE_INDEX_CACHE_DIR ??
  fileURLToPath(new URL("../node_modules/.cache/parallel-people-index/", import.meta.url));
const USE_CACHE = !process.argv.includes("--no-cache");

const BASE_URL = "https://api.themoviedb.org/3";
/** TMDB asks clients to stay well under its rate limit; this keeps a run polite and quick. */
const MAX_IN_FLIGHT = 8;
const MAX_ATTEMPTS = 6;

const POPULAR_PEOPLE_PAGES = 150;
const TOP_RATED_PAGES = 75;
const POPULAR_MOVIE_PAGES = 25;

/** Crew jobs worth finding someone by. */
const KEY_CREW_JOBS = new Set([
  "Director",
  "Writer",
  "Screenplay",
  "Director of Photography",
  "Editor",
  "Original Music Composer",
  "Production Design",
  "Costume Design",
]);
const TOP_BILLED = 12;
const MAX_KNOWN_FOR_TITLES = 3;
/** Someone without a profile photo is kept only when this popular. */
const NO_PHOTO_MIN_POPULARITY = 10;

interface Person {
  id: number;
  name: string;
  profilePath: string | null;
  department: string | null;
  popularity: number;
  /** TMDB's own known_for list; only people from /person/popular have one. */
  knownForTitles: string[];
  /** The best-voted crawled films the person appears in, best first. */
  films: { id: number; title: string; votes: number }[];
  /** How many crawled films the person appears in (key crew or top-billed): a steadier fame signal than popularity. */
  credits: number;
  pinned: boolean;
}

interface RawListedPerson {
  id: number;
  name?: string;
  adult?: boolean;
  profile_path?: string | null;
  known_for_department?: string | null;
  popularity?: number;
  known_for?: { title?: string; name?: string }[];
  order?: number;
  job?: string;
}

interface RawListedMovie {
  id: number;
  title?: string;
  vote_count?: number;
}

const stats = { network: 0, cached: 0, retried: 0, missing: 0 };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Runs `task` for each item with at most `MAX_IN_FLIGHT` at once; results keep the input order. */
async function mapLimited<T, R>(items: readonly T[], task: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await task(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(MAX_IN_FLIGHT, items.length) }, worker));
  return results;
}

/**
 * GET a TMDB path, answering from the disk cache when it can. Retries 429 and 5xx (and network
 * errors) with backoff. Returns null for a 404 (a movie that was deleted since it was listed).
 */
async function tmdb<T>(path: string, params: Record<string, string> = {}): Promise<T | null> {
  const query = new URLSearchParams(params).toString();
  const file = join(CACHE_DIR, `${`${path}${query ? `?${query}` : ""}`.replace(/[^a-zA-Z0-9=&.-]+/g, "_")}.json`);
  if (USE_CACHE && existsSync(file)) {
    stats.cached++;
    return JSON.parse(readFileSync(file, "utf8")) as T;
  }

  const token = process.env.TMDB_READ_ACCESS_TOKEN;
  const url = `${BASE_URL}${path}${query ? `?${query}` : ""}`;
  for (let attempt = 1; ; attempt++) {
    let status = 0;
    let retryAfterMs = 0;
    try {
      stats.network++;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      status = res.status;
      if (res.ok) {
        const text = await res.text();
        mkdirSync(CACHE_DIR, { recursive: true });
        writeFileSync(file, text);
        return JSON.parse(text) as T;
      }
      if (status === 404) {
        stats.missing++;
        return null;
      }
      retryAfterMs = Number(res.headers.get("retry-after")) * 1000 || 0;
    } catch {
      // Network error: treated like a 5xx below.
    }
    if (attempt >= MAX_ATTEMPTS || (status !== 0 && status !== 429 && status < 500)) {
      throw new Error(`TMDB ${path} failed (${status || "network error"}) after ${attempt} attempt(s)`);
    }
    stats.retried++;
    await sleep(Math.max(retryAfterMs, 500 * 2 ** (attempt - 1)) + Math.random() * 250);
  }
}

const people = new Map<number, Person>();

/** Adds or merges a person; popularity keeps the highest value seen. */
function upsert(raw: RawListedPerson, extra: Partial<Person> = {}): Person | null {
  if (raw.adult || !raw.name?.trim()) return null;
  let person = people.get(raw.id);
  if (!person) {
    person = {
      id: raw.id,
      name: raw.name.trim(),
      profilePath: null,
      department: null,
      popularity: 0,
      knownForTitles: [],
      films: [],
      credits: 0,
      pinned: false,
    };
    people.set(raw.id, person);
  }
  person.profilePath ||= raw.profile_path || null;
  person.department ||= raw.known_for_department || null;
  person.popularity = Math.max(person.popularity, raw.popularity ?? 0);
  Object.assign(person, extra);
  return person;
}

/** Films seen so far per person, so a person with several key jobs on one film counts once. */
const seenCredits = new Map<number, Set<number>>();

/**
 * Records a film for a person: it counts toward `credits` and may become a "known for" title.
 * With `counted: false` (an example person's own filmography, fetched because the crawl missed
 * them) it can still become a title but does not count as a notable-film credit.
 */
function noteFilm(person: Person, film: { id: number; title: string; votes: number }, counted = true): void {
  if (counted) {
    let seen = seenCredits.get(person.id);
    if (!seen) seenCredits.set(person.id, (seen = new Set()));
    if (seen.has(film.id)) return;
    seen.add(film.id);
    person.credits++;
  }
  if (person.films.some((f) => f.id === film.id)) return;
  person.films.push(film);
  person.films.sort((a, b) => b.votes - a.votes || a.id - b.id);
  person.films.length = Math.min(person.films.length, MAX_KNOWN_FOR_TITLES);
}

const pages = (count: number) => Array.from({ length: count }, (_, i) => String(i + 1));

async function crawlPopularPeople(): Promise<void> {
  const results = await mapLimited(pages(POPULAR_PEOPLE_PAGES), (page) =>
    tmdb<{ results: RawListedPerson[] }>("/person/popular", { page }),
  );
  for (const listing of results) {
    for (const raw of listing?.results ?? []) {
      const person = upsert(raw);
      const titles = (raw.known_for ?? []).map((k) => k.title ?? k.name).filter((t): t is string => Boolean(t));
      if (person && titles.length > 0) person.knownForTitles = titles.slice(0, MAX_KNOWN_FOR_TITLES);
    }
  }
}

async function crawlFilms(): Promise<Map<number, { id: number; title: string; votes: number }>> {
  const listings = await mapLimited(
    [
      ...pages(TOP_RATED_PAGES).map((page) => ["/movie/top_rated", page] as const),
      ...pages(POPULAR_MOVIE_PAGES).map((page) => ["/movie/popular", page] as const),
    ],
    ([path, page]) => tmdb<{ results: RawListedMovie[] }>(path, { page }),
  );
  const films = new Map<number, { id: number; title: string; votes: number }>();
  for (const listing of listings) {
    for (const movie of listing?.results ?? []) {
      if (movie.title) films.set(movie.id, { id: movie.id, title: movie.title, votes: movie.vote_count ?? 0 });
    }
  }
  return films;
}

async function crawlCredits(films: ReadonlyMap<number, { id: number; title: string; votes: number }>): Promise<void> {
  const list = [...films.values()];
  let done = 0;
  await mapLimited(list, async (film) => {
    const credits = await tmdb<{ cast?: RawListedPerson[]; crew?: RawListedPerson[] }>(
      `/movie/${film.id}/credits`,
    );
    for (const raw of (credits?.cast ?? []).filter((c) => (c.order ?? 0) < TOP_BILLED).slice(0, TOP_BILLED)) {
      const person = upsert(raw);
      if (person) noteFilm(person, film);
    }
    for (const raw of credits?.crew ?? []) {
      if (!raw.job || !KEY_CREW_JOBS.has(raw.job)) continue;
      const person = upsert(raw);
      if (person) noteFilm(person, film);
    }
    if (++done % 250 === 0) console.log(`  credits: ${done}/${list.length} films`);
  });
}

interface RawPersonDetails extends RawListedPerson {
  movie_credits?: {
    cast?: { id: number; title?: string; vote_count?: number; video?: boolean }[];
    crew?: { id: number; title?: string; vote_count?: number; video?: boolean }[];
  };
}

/** Makes sure every person the curated pairings mention is in, whatever the crawl found. */
async function ensureExamplePeople(): Promise<string[]> {
  const problems: string[] = [];
  const expected = new Map<number, string>();
  for (const pairing of EXAMPLE_PAIRINGS) for (const p of pairing.people) expected.set(p.id, p.name);

  await mapLimited([...expected], async ([id, name]) => {
    const known = people.get(id);
    if (known) {
      known.pinned = true;
      if (known.films.length > 0 || known.knownForTitles.length > 0) return;
    }
    const details = await tmdb<RawPersonDetails>(`/person/${id}`, { append_to_response: "movie_credits" });
    if (!details) {
      problems.push(`example person ${id} (${name}) does not exist on TMDB`);
      return;
    }
    const person = upsert(details, { pinned: true });
    if (!person) {
      problems.push(`example person ${id} (${name}) was dropped (adult or unnamed)`);
      return;
    }
    const credits = [...(details.movie_credits?.cast ?? []), ...(details.movie_credits?.crew ?? [])];
    for (const credit of credits) {
      if (credit.title && !credit.video) noteFilm(person, { id: credit.id, title: credit.title, votes: credit.vote_count ?? 0 }, false);
    }
    if (person.name !== name) problems.push(`example person ${id} is "${person.name}" on TMDB, not "${name}"`);
  });
  return problems;
}

function finish(): MatchablePerson[] {
  const kept: MatchablePerson[] = [];
  for (const person of people.values()) {
    if (!person.profilePath && person.popularity < NO_PHOTO_MIN_POPULARITY && !person.pinned) continue;
    const titles = person.knownForTitles.length > 0 ? person.knownForTitles : person.films.map((f) => f.title);
    kept.push({
      id: person.id,
      name: person.name,
      profilePath: person.profilePath,
      knownFor: person.department,
      knownForTitles: [...new Set(titles)].slice(0, MAX_KNOWN_FOR_TITLES),
      popularity: person.popularity,
      credits: person.credits,
    });
  }
  return kept.sort((a, b) => b.popularity - a.popularity || a.id - b.id);
}

async function main(): Promise<void> {
  if (!process.env.TMDB_READ_ACCESS_TOKEN) {
    console.error("TMDB_READ_ACCESS_TOKEN is not set. Add it to .env (see the README).");
    process.exitCode = 1;
    return;
  }
  const started = Date.now();
  console.log(`Cache: ${USE_CACHE ? CACHE_DIR : "off (--no-cache)"}`);

  console.log(`Popular people (${POPULAR_PEOPLE_PAGES} pages)...`);
  await crawlPopularPeople();
  console.log(`  ${people.size} people`);

  console.log(`Notable films (${TOP_RATED_PAGES} top-rated + ${POPULAR_MOVIE_PAGES} popular pages)...`);
  const films = await crawlFilms();
  console.log(`  ${films.size} films; fetching their credits...`);
  await crawlCredits(films);
  console.log(`  ${people.size} people so far`);

  console.log("Example people...");
  const problems = await ensureExamplePeople();
  if (problems.length > 0) {
    console.error(`people:refresh failed. Nothing was written.\n`);
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exitCode = 1;
    return;
  }

  const index = finish();
  const missing = [...new Set(EXAMPLE_PAIRINGS.flatMap((p) => p.people.map((x) => x.id)))].filter(
    (id) => !index.some((p) => p.id === id),
  );
  if (missing.length > 0) {
    console.error(`people:refresh failed: example people missing from the index: ${missing.join(", ")}`);
    process.exitCode = 1;
    return;
  }

  const file = encodePeopleIndex(index, new Date().toISOString());
  writeFileSync(OUTPUT, `${JSON.stringify(file)}\n`);

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(
    `\nWrote ${index.length} people to src/lib/people-index.generated.json ` +
      `(${(statSync(OUTPUT).size / 1024 / 1024).toFixed(2)} MB, ${file.titles.length} titles).`,
  );
  console.log(
    `TMDB calls: ${stats.network} over the network (${stats.retried} retried, ${stats.missing} not found), ` +
      `${stats.cached} from cache. ${seconds}s.`,
  );
}

await main();
