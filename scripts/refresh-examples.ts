// Checks every pairing in src/lib/examples.ts against live TMDB and writes what the landing page
// renders from (canonical names, photos, shared-film counts) to src/lib/examples.generated.json.
//
//   npm run examples:refresh
//
// It fails, and writes nothing, when a person id does not resolve, a name differs from TMDB's
// (the slug would redirect), a pairing shares fewer than MIN_SHARED_FILMS films, a person has no
// photo, a pairing has fewer than HERO_POSTER_COUNT shared films with a poster, or a pairing is
// listed twice. The count comes from the same code the pair page uses (getPersonMovieCredits,
// then sharedFilms with the default non-minor rules), so a card's number always matches its page.
// The hero's posters are the most-voted of those same shared films.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  EXAMPLE_PAIRINGS,
  GENRES,
  HERO_POSTER_COUNT,
  MIN_SHARED_FILMS,
  pairingKey,
  type GeneratedExamples,
  type GeneratedPoster,
} from "../src/lib/examples";
import { joinNames } from "../src/lib/format";
import { MAX_PEOPLE } from "../src/lib/people-nav";
import { sharedFilms } from "../src/lib/shared";
import { TmdbError, getPersonMovieCredits } from "../src/lib/tmdb";
import type { PersonTimeline, SharedFilm } from "../src/lib/types";

const OUTPUT = fileURLToPath(new URL("../src/lib/examples.generated.json", import.meta.url));
/** TMDB asks clients to stay well under its rate limit; this keeps a run polite and quick. */
const MAX_IN_FLIGHT = 8;

/** Caps concurrent TMDB requests across everything the shared client does for each person. */
function limitFetch(): void {
  const realFetch = globalThis.fetch;
  let active = 0;
  const waiting: (() => void)[] = [];
  globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
    while (active >= MAX_IN_FLIGHT) await new Promise<void>((resolve) => waiting.push(resolve));
    active++;
    try {
      return await realFetch(...args);
    } finally {
      active--;
      waiting.shift()?.();
    }
  }) as typeof fetch;
}

function describeFailure(id: number, name: string, error: unknown): string {
  const who = `person ${id} (${name})`;
  if (error instanceof TmdbError && error.status === 404) return `${who} does not exist on TMDB`;
  return `${who} could not be loaded: ${error instanceof Error ? error.message : String(error)}`;
}

/**
 * Posters of the `count` most-voted shared films that have one (ties: older, then lower id),
 * returned oldest first. Fewer than `count` when there are not enough films with a poster.
 */
function topPosters(shared: SharedFilm[], timelines: PersonTimeline[], count: number): GeneratedPoster[] {
  const votes = new Map<number, number>();
  for (const { films } of timelines) {
    for (const film of films) votes.set(film.id, Math.max(votes.get(film.id) ?? 0, film.voteCount));
  }
  const oldestFirst = (a: SharedFilm, b: SharedFilm) =>
    a.releaseDate.localeCompare(b.releaseDate) || a.id - b.id;
  return shared
    .filter((film): film is SharedFilm & { posterPath: string } => Boolean(film.posterPath))
    .sort((a, b) => (votes.get(b.id) ?? 0) - (votes.get(a.id) ?? 0) || oldestFirst(a, b))
    .slice(0, count)
    .sort(oldestFirst)
    .map((film) => ({ path: film.posterPath, title: film.title, year: film.year }));
}

function fail(problems: string[]): void {
  console.error(`examples:refresh failed. Nothing was written.\n`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exitCode = 1;
}

function checkListing(): string[] {
  const problems: string[] = [];
  const genreIds = new Set<string>(GENRES.map((genre) => genre.id));
  const firstSeen = new Map<string, string>();

  for (const pairing of EXAMPLE_PAIRINGS) {
    const label = `[${pairing.genre}] ${joinNames(pairing.people.map((p) => p.name))}`;
    const ids = pairing.people.map((p) => p.id);

    if (!genreIds.has(pairing.genre)) problems.push(`${label}: unknown genre "${pairing.genre}"`);
    if (ids.length < 2 || ids.length > MAX_PEOPLE) {
      problems.push(`${label}: needs 2 to ${MAX_PEOPLE} people, has ${ids.length}`);
    }
    if (new Set(ids).size !== ids.length) problems.push(`${label}: lists the same person twice`);

    const key = pairingKey(pairing);
    const earlier = firstSeen.get(key);
    if (earlier) problems.push(`${label}: appears twice (also ${earlier})`);
    else firstSeen.set(key, label);
  }
  return problems;
}

async function main(): Promise<void> {
  if (!process.env.TMDB_READ_ACCESS_TOKEN) {
    return fail(["TMDB_READ_ACCESS_TOKEN is not set. Add it to .env (see the README)."]);
  }
  const listingProblems = checkListing();
  if (listingProblems.length > 0) return fail(listingProblems);

  limitFetch();

  const names = new Map<number, string>();
  for (const pairing of EXAMPLE_PAIRINGS) {
    for (const person of pairing.people) names.set(person.id, person.name);
  }
  const ids = [...names.keys()];
  console.log(`Checking ${EXAMPLE_PAIRINGS.length} pairings (${ids.length} people) against TMDB...`);

  const settled = await Promise.allSettled(ids.map((id) => getPersonMovieCredits(id)));
  const timelines = new Map<number, PersonTimeline>();
  const problems: string[] = [];
  settled.forEach((result, i) => {
    if (result.status === "fulfilled") timelines.set(ids[i], result.value);
    else problems.push(describeFailure(ids[i], names.get(ids[i])!, result.reason));
  });

  const generated: GeneratedExamples = {};
  const rows: { genre: string; pair: string; sharedCount: number; posters: string }[] = [];
  const genreLabels = new Map<string, string>(GENRES.map((genre) => [genre.id, genre.label]));

  for (const pairing of EXAMPLE_PAIRINGS) {
    const label = `[${pairing.genre}] ${joinNames(pairing.people.map((p) => p.name))}`;
    const loaded = pairing.people.map((p) => timelines.get(p.id));
    if (!loaded.every((t): t is PersonTimeline => t !== undefined)) continue; // reported above

    const people: GeneratedExamples[string]["people"] = [];
    let ok = true;
    pairing.people.forEach((expected, i) => {
      const { person } = loaded[i]!;
      if (person.name !== expected.name) {
        problems.push(`${label}: person ${expected.id} is "${person.name}" on TMDB, not "${expected.name}"`);
        ok = false;
      }
      if (!person.profilePath) {
        problems.push(`${label}: ${person.name} (${expected.id}) has no profile photo on TMDB`);
        ok = false;
      }
      people.push({ id: expected.id, name: person.name, profilePath: person.profilePath ?? "" });
    });

    const shared = sharedFilms(loaded as PersonTimeline[], { includeMinor: false });
    const sharedCount = shared.length;
    if (sharedCount < MIN_SHARED_FILMS) {
      problems.push(`${label}: shares ${sharedCount} film(s), needs at least ${MIN_SHARED_FILMS}`);
      ok = false;
    }

    const posters = topPosters(shared, loaded as PersonTimeline[], HERO_POSTER_COUNT);
    if (posters.length < HERO_POSTER_COUNT) {
      problems.push(
        `${label}: only ${posters.length} shared film(s) have a poster, needs at least ${HERO_POSTER_COUNT}`,
      );
      ok = false;
    }

    if (ok) {
      generated[pairingKey(pairing)] = { sharedCount, people, posters };
      rows.push({
        genre: genreLabels.get(pairing.genre) ?? pairing.genre,
        pair: joinNames(people.map((p) => p.name)),
        sharedCount,
        posters: posters.map((poster) => poster.title).join(" / "),
      });
    }
  }

  if (problems.length > 0) return fail(problems);

  writeFileSync(OUTPUT, `${JSON.stringify(generated, null, 2)}\n`);

  const genreWidth = Math.max(5, ...rows.map((row) => row.genre.length));
  const pairWidth = Math.max(4, ...rows.map((row) => row.pair.length));
  console.log(`\n${"Genre".padEnd(genreWidth)}  ${"Pair".padEnd(pairWidth)}  Films  Hero posters`);
  for (const row of rows) {
    console.log(
      `${row.genre.padEnd(genreWidth)}  ${row.pair.padEnd(pairWidth)}  ${String(row.sharedCount).padStart(5)}  ${row.posters}`,
    );
  }
  console.log(`\nWrote ${rows.length} pairings to src/lib/examples.generated.json.`);
}

await main();
