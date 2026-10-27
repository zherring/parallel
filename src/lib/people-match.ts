import type { PersonSearchResult } from "@/lib/types";

/**
 * Type-ahead matching of a half-typed or misspelled name against a list of people, ranked by
 * how well the name matches and how notable the person is. Pure and synchronous: it knows nothing
 * about TMDB or where the list came from (see people-index.ts).
 *
 * TMDB's own person search matches whole words only and ranks by text relevance, so "speil" never
 * finds Steven Spielberg and "spiel" buries him under five obscure people named Spiel. This
 * matcher accepts:
 *
 * - the start of the full name ("steven spie"),
 * - the start of each word, in any order ("spiel ste", "day lew"),
 * - a typo in a word, within a small edit distance (Damerau-Levenshtein: "scorcese",
 *   "tarantno", and "speil", which is a transposition inside the start of "spielberg").
 *
 * The LAST word of the query is treated as still being typed, so it matches as a prefix; earlier
 * words are finished, so they match whole words (a prefix of one is allowed but scores lower).
 */

export interface MatchablePerson extends PersonSearchResult {
  /** TMDB's popularity score: a trending signal that swings from week to week. */
  popularity: number;
  /** How many of the most notable films the person is credited on: a steadier fame signal. */
  credits: number;
}

/**
 * How a result matched, best first. `exact` and `prefix` look at the whole name; `token` matched
 * every query word to a distinct word of the name; `fuzzy` needed at least one typo correction.
 */
export type MatchKind = "exact" | "prefix" | "token" | "fuzzy";

export interface PersonMatch {
  person: MatchablePerson;
  /** Higher is better. Only comparable between results of the same query. */
  score: number;
  kind: MatchKind;
}

interface Entry {
  person: MatchablePerson;
  /** Normalized name, words joined by single spaces. */
  full: string;
  /** Normalized words, plus the joined form of any run of initials ("j j" adds "jj"). */
  tokens: string[];
  notability: number;
}

export interface MatchIndex {
  entries: readonly Entry[];
}

export interface ScoredName {
  score: number;
  kind: MatchKind;
}

/** Queries shorter than this (after normalizing) match nothing. */
export const MIN_QUERY_LENGTH = 2;
export const DEFAULT_LIMIT = 8;

/** Each query word beyond these is ignored; each name word beyond MAX_NAME_TOKENS cannot match. */
const MAX_QUERY_TOKENS = 6;
const MAX_NAME_TOKENS = 10;
/** Words longer than this are never fuzzy-matched (and fit the scratch matrix below). */
const MAX_FUZZY_LENGTH = 24;

/**
 * Base score of each way of matching, before word quality and notability are applied. An exact
 * full name is far enough ahead that no notability multiplier (at most about 10) can lift a
 * lesser match over it: someone who typed a whole name wants that name.
 */
const BASE_EXACT = 1000;
const BASE_PREFIX = 90;
const BASE_TOKENS = 70;
/** Query words in a different order than the name's. */
const UNORDERED_FACTOR = 0.9;
/** A typo-corrected result scoring under this share of the best result is left out. */
const FUZZY_CUTOFF = 0.5;

/** How well one query word matches one name word (0 = not at all). */
const Q_EXACT = 1;
const Q_PREFIX_TYPING = 0.92;
const Q_PREFIX_FINISHED = 0.78;
const Q_TYPO_ONE = 0.55;
const Q_TYPO_TWO = 0.42;

const FOLD: Record<string, string> = {
  ø: "o",
  æ: "ae",
  œ: "oe",
  ß: "ss",
  đ: "d",
  ð: "d",
  ł: "l",
  þ: "th",
  ı: "i",
  ħ: "h",
};

/**
 * Lowercases, strips diacritics ("Penélope" -> "penelope"), folds a few letters that do not
 * decompose ("Øyvind" -> "oyvind"), drops apostrophes ("O'Brien" -> "obrien") and turns every
 * other run of punctuation into one space ("Day-Lewis" -> "day lewis").
 */
export function normalizeName(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .normalize("NFC") // puts decomposed Hangul and the like back together
    .replace(/[øæœßđðłþıħ]/g, (c) => FOLD[c])
    .replace(/['‘’`´]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** A run of two or more single-letter words ("J. J. Abrams") also matches as one word ("jj"). */
function nameTokens(normalized: string): string[] {
  const words = normalized.split(" ").filter(Boolean).slice(0, MAX_NAME_TOKENS);
  const tokens = [...words];
  let run = "";
  let runLength = 0;
  for (const word of [...words, ""]) {
    if (word.length === 1) {
      run += word;
      runLength++;
      continue;
    }
    if (runLength >= 2) tokens.push(run);
    run = "";
    runLength = 0;
  }
  return tokens;
}

/** How much each log-scaled fame signal adds to the notability multiplier. */
const POPULARITY_WEIGHT = 1;
const CREDITS_WEIGHT = 0.8;

/**
 * Notability multiplier: 1 for an unknown, growing slowly (log) with TMDB popularity and with the
 * number of notable films the person is credited on. Popularity alone is a trending score that
 * puts last month's breakout actor above the director of Jaws, so credits steady it.
 */
function notabilityOf({ popularity, credits }: MatchablePerson): number {
  return (
    1 +
    POPULARITY_WEIGHT * Math.log(1 + Math.max(0, popularity)) +
    CREDITS_WEIGHT * Math.log(1 + Math.max(0, credits))
  );
}

function toEntry(person: MatchablePerson): Entry {
  const full = normalizeName(person.name);
  return { person, full, tokens: nameTokens(full), notability: notabilityOf(person) };
}

export function buildMatchIndex(people: readonly MatchablePerson[]): MatchIndex {
  return { entries: people.map(toEntry) };
}

interface PreparedQuery {
  full: string;
  tokens: string[];
}

function prepareQuery(query: string): PreparedQuery | null {
  const full = normalizeName(query);
  if (full.length < MIN_QUERY_LENGTH) return null;
  const tokens = full.split(" ").slice(0, MAX_QUERY_TOKENS);
  return { full: tokens.join(" "), tokens };
}

/** Edits allowed in a word of this length: none under 4 letters, one up to 6, two from 7. */
function allowedEdits(length: number): number {
  if (length >= 7) return 2;
  if (length >= 4) return 1;
  return 0;
}

const SCRATCH_COLS = MAX_FUZZY_LENGTH + 3;
const scratch = new Int32Array((MAX_FUZZY_LENGTH + 1) * SCRATCH_COLS);

/** People rarely fumble how a name starts, so an edit in its first letters counts double. */
const EARLY_POSITIONS = 2;
const early = (position: number) => (position <= EARLY_POSITIONS ? 2 : 1);

/**
 * Damerau-Levenshtein distance (optimal string alignment: insert, delete, substitute or swap
 * two neighbours) between `query` and the closest of the prefixes of `name` that are `slack`
 * characters shorter or longer than `query`. With `wholeWord`, only the full name word counts.
 * An edit in the first two letters costs 2 instead of 1, which keeps "speil" from matching
 * "Sheila" while it still matches "Spielberg" (a swap further in).
 */
function editDistance(query: string, name: string, slack: number, wholeWord: boolean): number {
  const rows = query.length;
  const lo = wholeWord ? name.length : Math.max(1, rows - slack);
  const hi = wholeWord ? name.length : Math.min(name.length, rows + slack);
  if (lo > hi) return Infinity;
  const at = (i: number, j: number) => i * SCRATCH_COLS + j;

  scratch[at(0, 0)] = 0;
  for (let j = 1; j <= hi; j++) scratch[at(0, j)] = scratch[at(0, j - 1)] + early(j);
  for (let i = 1; i <= rows; i++) {
    scratch[at(i, 0)] = scratch[at(i - 1, 0)] + early(i);
    const qc = query.charCodeAt(i - 1);
    for (let j = 1; j <= hi; j++) {
      const nc = name.charCodeAt(j - 1);
      let d = Math.min(
        scratch[at(i - 1, j)] + early(i),
        scratch[at(i, j - 1)] + early(j),
        scratch[at(i - 1, j - 1)] + (qc === nc ? 0 : Math.max(early(i), early(j))),
      );
      if (
        i > 1 &&
        j > 1 &&
        qc === name.charCodeAt(j - 2) &&
        query.charCodeAt(i - 2) === nc
      ) {
        d = Math.min(d, scratch[at(i - 2, j - 2)] + early(i - 1));
      }
      scratch[at(i, j)] = d;
    }
  }
  let best = Infinity;
  for (let j = lo; j <= hi; j++) best = Math.min(best, scratch[at(rows, j)]);
  return best;
}

/** How well query word `q` matches name word `n`; `typing` is true for the query's last word. */
function wordQuality(q: string, n: string, typing: boolean): number {
  if (q === n) return Q_EXACT;
  if (n.startsWith(q)) return typing ? Q_PREFIX_TYPING : Q_PREFIX_FINISHED;

  const edits = allowedEdits(q.length);
  if (edits === 0 || q.length > MAX_FUZZY_LENGTH || n.length > MAX_FUZZY_LENGTH) return 0;
  // Nobody mistypes the first letter often; skipping those keeps the scan cheap.
  if (q.charCodeAt(0) !== n.charCodeAt(0)) return 0;
  if (typing ? n.length < q.length - edits : Math.abs(n.length - q.length) > edits) return 0;

  const distance = editDistance(q, n, edits, !typing);
  if (distance === 0 || distance > edits) return 0;
  return distance === 1 ? Q_TYPO_ONE : Q_TYPO_TWO;
}

interface TokenMatch {
  quality: number;
  ordered: boolean;
  typo: boolean;
}

/**
 * Pairs every query word with a different name word so that the total quality is highest, or
 * returns null when some query word matches nothing (or the words cannot all be paired).
 */
function matchTokens(query: string[], name: string[]): TokenMatch | null {
  if (query.length > name.length) return null;
  const last = query.length - 1;

  const quality: number[][] = [];
  for (let i = 0; i < query.length; i++) {
    const row = name.map((n) => wordQuality(query[i], n, i === last));
    if (!row.some((value) => value > 0)) return null;
    quality.push(row);
  }

  let best: TokenMatch | null = null;
  let bestTotal = 0;
  const picked: number[] = [];
  const search = (i: number, used: number, total: number) => {
    if (i === query.length) {
      if (total <= bestTotal) return;
      bestTotal = total;
      best = {
        quality: total / query.length,
        ordered: picked.every((column, k) => k === 0 || column > picked[k - 1]),
        typo: picked.some((column, k) => quality[k][column] < Q_PREFIX_FINISHED),
      };
      return;
    }
    for (let j = 0; j < name.length; j++) {
      const q = quality[i][j];
      if (q === 0 || used & (1 << j)) continue;
      picked[i] = j;
      search(i + 1, used | (1 << j), total + q);
    }
  };
  search(0, 0, 0);
  return best;
}

function matchEntry(entry: Entry, query: PreparedQuery): ScoredName | null {
  if (entry.full === query.full) {
    return { score: BASE_EXACT * entry.notability, kind: "exact" };
  }
  if (entry.full.startsWith(query.full)) {
    return { score: BASE_PREFIX * entry.notability, kind: "prefix" };
  }
  const tokens = matchTokens(query.tokens, entry.tokens);
  if (!tokens) return null;
  const base = BASE_TOKENS * tokens.quality * (tokens.ordered ? 1 : UNORDERED_FACTOR);
  return { score: base * entry.notability, kind: tokens.typo ? "fuzzy" : "token" };
}

/** Scores one name against a query without an index (null: no match, or the query is too short). */
export function scoreName(
  name: string,
  popularity: number,
  query: string,
  credits = 0,
): ScoredName | null {
  const prepared = prepareQuery(query);
  if (!prepared) return null;
  return matchEntry(
    toEntry({ id: 0, name, profilePath: null, knownFor: null, knownForTitles: [], popularity, credits }),
    prepared,
  );
}

/** Best first: score, then more popular, then lower id, so equal scores never reorder. */
function compareMatches(a: PersonMatch, b: PersonMatch): number {
  return (
    b.score - a.score ||
    b.person.popularity - a.person.popularity ||
    a.person.id - b.person.id
  );
}

/** The `limit` best matches for a query, best first; empty for a query under two characters. */
export function searchIndex(index: MatchIndex, query: string, limit = DEFAULT_LIMIT): PersonMatch[] {
  const prepared = prepareQuery(query);
  if (!prepared || limit < 1) return [];

  const top: PersonMatch[] = [];
  for (const entry of index.entries) {
    const scored = matchEntry(entry, prepared);
    if (!scored) continue;
    const match: PersonMatch = { person: entry.person, ...scored };
    if (top.length === limit && compareMatches(match, top[limit - 1]) >= 0) continue;

    let at = top.length;
    while (at > 0 && compareMatches(match, top[at - 1]) < 0) at--;
    top.splice(at, 0, match);
    if (top.length > limit) top.pop();
  }
  // Typo corrections are guesses; once there is a clear winner, far weaker guesses are noise.
  const floor = top.length > 0 ? top[0].score * FUZZY_CUTOFF : 0;
  return top.filter((match) => match.kind !== "fuzzy" || match.score >= floor);
}
