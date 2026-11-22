/**
 * The montage's posters for `npm run portraits:cut` (cut.ts): `npm run portraits:cut -- --posters [ids]` refreshes them alone, without cutting anyone (the polygons are
 * not read, only `posters` is replaced), and a normal run uses it for the people it has just cut.
 *
 * For each person it reads their film credits from TMDB, keeps what the pair page counts as theirs (`normalizeMovieCredits`: not a minor credit, a cameo, a short; and
 * only released films), takes the most-voted `MAX_CANDIDATES` of them and reads each film's details for its collection (`belongs_to_collection`: credits lists do not carry
 * it; cached in .cache/movie-details.json, delete it to read them again) and runtime (a short is dropped), then hands the films to `arrangeBackdrop`
 * (src/lib/backdrop-posters.ts: at most two films of a collection, the first of each before any second, and no poster or collection on touching tiles).
 * The first nine of the list are the core (`posters` in portrait-cuts.json, what the cards and the pair pages draw), the next eighteen the extension the landing hero draws out to
 * the screen's edge (portrait-backdrops.json).
 *
 * Cost: a film's details are read once and kept in .cache/movie-details.json (gitignored), so only a cold cache is slow. For the 186 people that is 186 person reads and about 5,500 film
 * reads (`MAX_CANDIDATES` 50; it was 80, about 7,200 reads), 3 to 4 minutes at `CONCURRENCY` 6 (3m35s measured, 2026-11); a warm cache reads only a new person's and new films, a few seconds.
 * TMDB's 429 (and a 5xx) on a film is retried (tmdb.ts `fetchMovieDetails`: up to five attempts, each after the `Retry-After` the response names, else one second more than the last); a person's
 * read is not retried, and a film that still fails is named under "problems" (the run exits 1) and left out of the cache, so running again reads only it.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BACKDROP_POSTERS, CORE_POSTERS, arrangeBackdrop, type BackdropFilm, type Relaxation } from "../../src/lib/backdrop-posters";
import { PORTRAIT_IDS } from "../../src/lib/portrait-cuts";
import { mapLimited } from "../../src/lib/map-limited";
import { normalizeMovieCredits } from "../../src/lib/normalize";
import { isReleased, todayIso } from "../../src/lib/released";
import { SHORT_MAX_MINUTES } from "../../src/lib/short-film";
import { fetchMovieDetails, fetchPerson, type MovieDetails } from "./tmdb";

const here = dirname(fileURLToPath(import.meta.url));
const cacheFile = join(here, ".cache/movie-details.json");
export const backdropsFile = join(resolve(here, "../.."), "src/lib/portrait-backdrops.json");

/**
 * How many of a person's most-voted films are read for their collection and runtime: more than a list needs, so that a franchise's films (at most two of a collection count) and the
 * shorts (dropped) do not leave it short. A list is made of `BACKDROP_POSTERS` + the arrangement's spares (backdrop-posters.ts `ARRANGEMENT_SPARES`), 36 films; the person of the 186 who needs
 * the most candidates for the same list as with 80 needs their best 43 (a cap of 42 changes two people's lists), so 50 leaves some margin. The data is the same at 50, 60 and 80, so a new person who
 * comes out with fewer posters than their films should give is the cap's doing: raise it, read again, and check that nobody else's list changes.
 */
const MAX_CANDIDATES = 50;
/** TMDB allows about 40 requests a second; this many at once, each about 150ms, stays under it. */
const CONCURRENCY = 6;

interface CachedFilm {
  collection: number | null;
  runtime: number;
}

export interface PosterListing {
  /** The core's nine posters, row by row (`posters` in the cuts). */
  core: string[];
  /** The extension's eighteen, column by column from the core outward. */
  extension: string[];
  /** How many different posters the two hold: `BACKDROP_POSTERS` unless the person has fewer films to show. */
  distinct: number;
  relaxed: Relaxation;
  /** The person's films that counted (non-minor, released, a poster, not a short). */
  films: number;
}

export type Backdrops = Record<string, string[]>;

export function readBackdrops(): Backdrops {
  return existsSync(backdropsFile) ? (JSON.parse(readFileSync(backdropsFile, "utf8")) as Backdrops) : {};
}

/** Written in `PORTRAIT_IDS` order, a person to a line so that a change reads as a diff. */
export function writeBackdrops(backdrops: Backdrops): void {
  const lines = PORTRAIT_IDS.filter((id) => backdrops[id]).map((id) => `  "${id}": ${JSON.stringify(backdrops[id])}`);
  writeFileSync(backdropsFile, `{\n${lines.join(",\n")}\n}\n`);
}

function readCache(): Record<string, CachedFilm> {
  return existsSync(cacheFile) ? (JSON.parse(readFileSync(cacheFile, "utf8")) as Record<string, CachedFilm>) : {};
}

/** The posters lists of `ids` from TMDB; a person who could not be read, or has no film with a poster, is left out of the map (and named in `problems`). */
export async function posterLists(ids: readonly number[], log: (line: string) => void = console.log): Promise<{ lists: Map<number, PosterListing>; problems: string[] }> {
  const problems: string[] = [];
  const today = todayIso();
  const people = await mapLimited(ids, CONCURRENCY, (id) => fetchPerson(id));
  const candidates = new Map<number, ReturnType<typeof normalizeMovieCredits>>();
  ids.forEach((id, index) => {
    const result = people[index];
    if (result.status === "rejected") {
      problems.push(`${id}: ${(result.reason as Error).message}`);
      return;
    }
    const films = normalizeMovieCredits(result.value.movie_credits)
      .filter((film) => !film.minor && film.posterPath && isReleased(film.releaseDate, today))
      .sort((a, b) => b.voteCount - a.voteCount || a.id - b.id)
      .slice(0, MAX_CANDIDATES);
    candidates.set(id, films);
  });
  log(`${candidates.size} people read`);

  mkdirSync(dirname(cacheFile), { recursive: true });
  const cache = readCache();
  const wanted = [...new Set([...candidates.values()].flatMap((films) => films.map((film) => film.id)))].filter((id) => !cache[id]);
  log(`${wanted.length} films to read for their collection (${Object.keys(cache).length} cached)`);
  let done = 0;
  await mapLimited(wanted, CONCURRENCY, async (id) => {
    let details: MovieDetails;
    try {
      details = await fetchMovieDetails(id);
    } catch (error) {
      problems.push(`film ${id}: ${(error as Error).message}`);
      return;
    }
    cache[id] = { collection: details.belongs_to_collection?.id ?? null, runtime: details.runtime ?? 0 };
    if (++done % 400 === 0) {
      writeFileSync(cacheFile, JSON.stringify(cache));
      log(`  ${done}/${wanted.length}`);
    }
  });
  writeFileSync(cacheFile, JSON.stringify(cache));

  const lists = new Map<number, PosterListing>();
  for (const [id, films] of candidates) {
    const counted: BackdropFilm[] = films
      // A film whose details could not be read is kept as a standalone film (its collection unknown); a runtime of 0 is TMDB not knowing it.
      .filter((film) => !((cache[film.id]?.runtime ?? 0) > 0 && (cache[film.id]?.runtime ?? 0) <= SHORT_MAX_MINUTES))
      .map((film) => ({ id: film.id, poster: film.posterPath!, votes: film.voteCount, collection: cache[film.id]?.collection ?? null }));
    const arranged = arrangeBackdrop(counted);
    if (arranged.posters.length !== BACKDROP_POSTERS) {
      problems.push(`${id}: no film with a poster, posters left as they were`);
      continue;
    }
    lists.set(id, { core: arranged.posters.slice(0, CORE_POSTERS), extension: arranged.posters.slice(CORE_POSTERS), distinct: arranged.distinct, relaxed: arranged.relaxed, films: counted.length });
  }
  return { lists, problems };
}
