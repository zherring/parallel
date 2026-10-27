// The films awards:refresh looks up: every film in the default (non-minor) shared-film list of
// every pairing in src/lib/examples.ts, found with the code the pair page itself uses
// (getPersonMovieCredits, then sharedFilms), de-duplicated by TMDB movie id. The corpus therefore
// grows by itself when a pairing is added.
//
// TMDB responses are cached on disk (set AWARDS_CACHE_DIR to move the folder, pass --no-cache for
// a fresh crawl) so reruns cost nothing, and at most MAX_IN_FLIGHT requests run at once. Only the
// responses are cached, never the request headers, so the token does not end up on disk.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EXAMPLE_PAIRINGS } from "../src/lib/examples";
import { sharedFilms } from "../src/lib/shared";
import { getPersonMovieCredits } from "../src/lib/tmdb";
import type { PersonTimeline } from "../src/lib/types";

/** TMDB asks clients to stay well under its rate limit; this keeps a run polite and quick. */
const MAX_IN_FLIGHT = 8;
const MAX_ATTEMPTS = 5;

export interface CorpusFilm {
  id: number;
  title: string;
  year: number;
}

export interface Corpus {
  films: CorpusFilm[];
  pairings: number;
  people: number;
  /** Shared-film slots over all pairings (a film shared by two pairings counts twice). */
  slots: number;
  tmdb: { network: number; cached: number; retried: number };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Caches and rate-limits every request the shared TMDB client makes. */
function installTmdbFetch(cacheDir: string, useCache: boolean, stats: Corpus["tmdb"]): void {
  const realFetch = globalThis.fetch;
  let active = 0;
  const waiting: (() => void)[] = [];

  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    if (url.hostname !== "api.themoviedb.org") return realFetch(input, init);

    const file = join(cacheDir, `${createHash("sha1").update(url.toString()).digest("hex")}.json`);
    if (useCache && existsSync(file)) {
      stats.cached++;
      return new Response(readFileSync(file, "utf8"), { status: 200, headers: { "content-type": "application/json" } });
    }

    while (active >= MAX_IN_FLIGHT) await new Promise<void>((resolve) => waiting.push(resolve));
    active++;
    try {
      for (let attempt = 1; ; attempt++) {
        stats.network++;
        let res: Response | undefined;
        try {
          res = await realFetch(input, init);
        } catch (error) {
          if (attempt >= MAX_ATTEMPTS) throw error;
        }
        if (res?.ok) {
          const text = await res.text();
          mkdirSync(cacheDir, { recursive: true });
          writeFileSync(file, text);
          return new Response(text, { status: 200, headers: { "content-type": "application/json" } });
        }
        const retryable = !res || res.status === 429 || res.status >= 500;
        if (res && (!retryable || attempt >= MAX_ATTEMPTS)) return res;
        stats.retried++;
        const retryAfterMs = Number(res?.headers.get("retry-after")) * 1000 || 0;
        await sleep(Math.max(retryAfterMs, 500 * 2 ** (attempt - 1)) + Math.random() * 250);
      }
    } finally {
      active--;
      waiting.shift()?.();
    }
  }) as typeof fetch;
}

export async function buildCorpus(cacheDir: string, useCache: boolean): Promise<Corpus> {
  if (!process.env.TMDB_READ_ACCESS_TOKEN) {
    throw new Error("TMDB_READ_ACCESS_TOKEN is not set. Add it to .env (see the README).");
  }
  const tmdb = { network: 0, cached: 0, retried: 0 };
  installTmdbFetch(cacheDir, useCache, tmdb);

  const ids = [...new Set(EXAMPLE_PAIRINGS.flatMap((pairing) => pairing.people.map((person) => person.id)))];
  const settled = await Promise.allSettled(ids.map((id) => getPersonMovieCredits(id)));
  const timelines = new Map<number, PersonTimeline>();
  const failures: string[] = [];
  settled.forEach((result, i) => {
    if (result.status === "fulfilled") timelines.set(ids[i], result.value);
    else {
      const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
      failures.push(`person ${ids[i]}: ${reason}`);
    }
  });
  if (failures.length > 0) throw new Error(`TMDB credits could not be loaded:\n  - ${failures.join("\n  - ")}`);

  const films = new Map<number, CorpusFilm>();
  let slots = 0;
  for (const pairing of EXAMPLE_PAIRINGS) {
    const shared = sharedFilms(
      pairing.people.map((person) => timelines.get(person.id)!),
      { includeMinor: false },
    );
    slots += shared.length;
    for (const film of shared) films.set(film.id, { id: film.id, title: film.title, year: film.year });
  }

  return {
    films: [...films.values()].sort((a, b) => a.year - b.year || a.id - b.id),
    pairings: EXAMPLE_PAIRINGS.length,
    people: ids.length,
    slots,
    tmdb,
  };
}
