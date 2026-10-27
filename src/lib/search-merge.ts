import { scoreName, type PersonMatch } from "@/lib/people-match";
import type { PersonSearchResult } from "@/lib/types";

/** A person search hit from TMDB's own search, with its popularity. */
export type TmdbHit = PersonSearchResult & { popularity: number };

export const MAX_SEARCH_RESULTS = 8;

interface Ranked {
  result: PersonSearchResult;
  score: number;
  popularity: number;
}

const toResult = ({ id, name, profilePath, knownFor, knownForTitles }: PersonSearchResult): PersonSearchResult => ({
  id,
  name,
  profilePath,
  knownFor,
  knownForTitles,
});

/**
 * Combines the local matcher's results with TMDB's own search into one list of at most `limit`
 * people, one entry per id.
 *
 * 1. The strong group comes first, best score first: every local match, plus any TMDB hit that
 *    the matcher also accepts by name without a typo correction (so an obscure person typed in
 *    full, who is not in the local index, still ranks where the name says). They are scored
 *    alike, so a famous local typo-correction ("speil" -> Spielberg) still outranks an obscure
 *    exact word from TMDB, while a name typed in full wins over a lesser match.
 * 2. The rest of TMDB's hits follow, most popular first.
 *
 * A person found by both keeps the local entry, except that TMDB's known-for titles fill in when
 * the index has none.
 */
export function mergeSearchResults(
  query: string,
  local: readonly PersonMatch[],
  tmdb: readonly TmdbHit[],
  limit = MAX_SEARCH_RESULTS,
): PersonSearchResult[] {
  const tmdbById = new Map(tmdb.map((hit) => [hit.id, hit]));
  const strong: Ranked[] = [];
  const seen = new Set<number>();

  for (const { person, score } of local) {
    if (seen.has(person.id)) continue;
    seen.add(person.id);
    const titles = person.knownForTitles.length > 0 ? person.knownForTitles : (tmdbById.get(person.id)?.knownForTitles ?? []);
    strong.push({
      result: toResult({ ...person, knownForTitles: titles }),
      score,
      popularity: person.popularity,
    });
  }

  const rest: TmdbHit[] = [];
  for (const hit of tmdb) {
    if (seen.has(hit.id)) continue;
    seen.add(hit.id);
    const scored = scoreName(hit.name, hit.popularity, query);
    if (scored && scored.kind !== "fuzzy") {
      strong.push({ result: toResult(hit), score: scored.score, popularity: hit.popularity });
    } else {
      rest.push(hit);
    }
  }

  strong.sort((a, b) => b.score - a.score || b.popularity - a.popularity || a.result.id - b.result.id);
  rest.sort((a, b) => b.popularity - a.popularity || a.id - b.id);

  return [...strong.map((s) => s.result), ...rest.map(toResult)].slice(0, limit);
}
