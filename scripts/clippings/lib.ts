// Pure helpers for the Clippings pipeline (no file or network access): turn a researcher's raw output into
// the entries of src/lib/clippings.json and src/lib/essays.json, and say what is wrong with it when it is.
// `merge.ts` does the reading and writing; keeping this module free of I/O is what lets the tests import it.
import type { Clipping, ClippingsEntry } from "../../src/lib/clippings";
import type { Critic, CriticKind, CriticsEntry, ReadingItem } from "../../src/lib/critics";
import { pairingKey } from "../../src/lib/examples";

/** Who a pairing is, as `examples.generated.json` records it: the source of truth for names and TMDB ids. */
export interface KnownPerson {
  id: number;
  name: string;
}

/** `examples.generated.json`, reduced to what validation needs: pairingKey to the pair's people. */
export type KnownPairings = Record<string, { people: readonly KnownPerson[] }>;

/** The shape the research agents were asked for (briefs/BRIEF.md), as far as it is loose JSON. */
export interface RawQuotesFile {
  pair: string[];
  tmdb_ids: number[];
  clippings: Record<string, unknown>[];
  notes?: string;
}

/** The shape of briefs/CRITICS_BRIEF.md. */
export interface RawCriticsFile {
  pair: string[];
  tmdb_ids: number[];
  critics: Record<string, unknown>[];
  reading: Record<string, unknown>[];
  notes?: string;
}

/** The fields of a clipping that reach clippings.json, in the order the file writes them. */
export const CLIPPING_FIELDS = [
  "speaker",
  "about",
  "quote",
  "film",
  "said_year",
  "publication",
  "via",
  "title",
  "date",
  "url",
  "context",
  "secondhand",
] as const;

export const CRITIC_FIELDS = ["critic", "publication", "via", "title", "date", "url", "kind"] as const;
export const READING_FIELDS = ["title", "author", "publication", "date", "url", "paywalled"] as const;

export const CRITIC_KINDS: readonly CriticKind[] = ["essay", "feature", "academic", "book chapter", "review", "video essay"];

/** Every critic id starts with this, which is what keeps the ids of the two files from colliding. */
export const CRITIC_ID_PREFIX = "critic-";

const DATE_RE = /^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$/;
const KEY_RE = /^\d+\+\d+$/;

/** The key of the pair with these TMDB ids, same as the app's `pairingKey` (ids sorted, joined with "+"). */
export function keyFromIds(ids: readonly number[]): string {
  return pairingKey({ people: ids.map((id) => ({ id, name: "" })) });
}

export function isPairingKey(s: string): boolean {
  return KEY_RE.test(s);
}

/**
 * The first `words` words of `s` as a lowercase ASCII slug: apostrophes dropped, accents stripped, anything
 * else non-alphanumeric a word break. The basis of a quote's stable id.
 */
export function slug(s: string, words = 6): string {
  const ascii = s
    .replaceAll("’", "")
    .replaceAll("'", "")
    .normalize("NFKD")
    .replace(/[^\x00-\x7f]/g, "")
    .toLowerCase();
  return (ascii.match(/[a-z0-9]+/g) ?? []).slice(0, words).join("-");
}

/**
 * Quoted speech inside a quote becomes paired curly single quotes (the nested-quote convention the site
 * sets its pull quotes in): curly doubles map straight across, straight doubles alternate open/close.
 * An odd number of straight doubles leaves the last one open.
 */
export function nestQuotes(q: string): string {
  const parts = q.replaceAll("“", "‘").replaceAll("”", "’").split('"');
  let out = parts[0];
  for (let i = 1; i < parts.length; i++) out += (i % 2 === 1 ? "‘" : "’") + parts[i];
  return out;
}

/** True when `q` has an odd number of straight double quotes, so nesting them would leave one open. */
export function hasUnbalancedStraightQuotes(q: string): boolean {
  return (q.match(/"/g) ?? []).length % 2 === 1;
}

/** `base`, or `base-2`, `base-2-2`, ... the first one not in `seen`; adds the result to `seen`. */
export function uniqueId(base: string, seen: Set<string>): string {
  let id = base;
  while (seen.has(id)) id += "-2";
  seen.add(id);
  return id;
}

/**
 * Sites already cited that only serve plain http, so their links cannot be https. Anything else must be https:
 * a new source on plain http is almost always a sign the agent typed the URL instead of copying the page's.
 */
export const HTTP_ONLY_HOSTS: readonly string[] = ["bernardherrmann.org", "shadows.wall.net"];

const str = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";
/** An https URL, or an http one on a host in `HTTP_ONLY_HOSTS`. */
export const isHttps = (v: unknown): boolean => {
  if (typeof v !== "string") return false;
  try {
    const url = new URL(v);
    if (url.protocol === "https:") return true;
    return url.protocol === "http:" && HTTP_ONLY_HOSTS.includes(url.hostname.replace(/^www\./, ""));
  } catch {
    return false;
  }
};

/** Problems with the pair/tmdb_ids header of a staged file (shared by both kinds). */
function validateHeader(src: Record<string, unknown>, key: string, known: KnownPairings, errors: string[]): string[] | null {
  const { pair, tmdb_ids: ids } = src;
  if (!Array.isArray(pair) || pair.length !== 2 || !pair.every(str)) {
    errors.push(`"pair" must be exactly two names`);
    return null;
  }
  if (!Array.isArray(ids) || ids.length !== 2 || !ids.every((n) => Number.isInteger(n) && (n as number) > 0)) {
    errors.push(`"tmdb_ids" must be exactly two TMDB ids`);
    return null;
  }
  const derived = keyFromIds(ids as number[]);
  if (derived !== key) errors.push(`tmdb_ids [${ids.join(", ")}] make the key ${derived}, not ${key} (wrong file name?)`);
  const entry = Object.hasOwn(known, derived) ? known[derived] : undefined;
  if (!entry) {
    errors.push(`${derived} is not a pairing in examples.generated.json (add it to src/lib/examples.ts and run \`npm run examples:refresh\`)`);
    return pair as string[];
  }
  (ids as number[]).forEach((id, i) => {
    const person = entry.people.find((p) => p.id === id);
    if (!person) errors.push(`tmdb id ${id} is not one of the pairing's people`);
    else if (person.name !== pair[i]) errors.push(`pair[${i}] is "${pair[i]}" but TMDB id ${id} is "${person.name}" in examples.generated.json`);
  });
  return pair as string[];
}

/** Everything wrong with a staged artist-quotes file: empty when it is fit to merge. */
export function validateQuotesFile(src: unknown, key: string, known: KnownPairings): string[] {
  const errors: string[] = [];
  if (typeof src !== "object" || src === null) return ["not a JSON object"];
  const file = src as Record<string, unknown>;
  const pair = validateHeader(file, key, known, errors);
  if (!Array.isArray(file.clippings) || file.clippings.length === 0) {
    errors.push(`"clippings" must be a non-empty array`);
    return errors;
  }
  file.clippings.forEach((raw: unknown, i) => {
    const where = `clippings[${i}]`;
    if (typeof raw !== "object" || raw === null) return void errors.push(`${where}: not an object`);
    const c = raw as Record<string, unknown>;
    if (pair) {
      if (!pair.includes(c.speaker as string)) errors.push(`${where}: speaker "${String(c.speaker)}" is not in the pair`);
      if (!pair.includes(c.about as string)) errors.push(`${where}: about "${String(c.about)}" is not in the pair`);
      if (c.speaker === c.about) errors.push(`${where}: speaker and about are the same person`);
    }
    for (const f of ["quote", "publication", "title", "context"] as const) {
      if (!str(c[f])) errors.push(`${where}: "${f}" is missing or empty`);
    }
    if (str(c.quote) && hasUnbalancedStraightQuotes(c.quote)) errors.push(`${where}: quote has an odd number of straight double quotes`);
    if (c.film != null && !str(c.film)) errors.push(`${where}: "film" must be a title or null`);
    if (c.said_year != null && !(Number.isInteger(c.said_year) && (c.said_year as number) > 1800 && (c.said_year as number) < 2200)) {
      errors.push(`${where}: "said_year" must be a year or null`);
    }
    if (c.via != null && !str(c.via)) errors.push(`${where}: "via" must be a site name or null`);
    if (typeof c.date !== "string" || !DATE_RE.test(c.date)) errors.push(`${where}: date "${String(c.date)}" is not YYYY, YYYY-MM or YYYY-MM-DD`);
    if (!isHttps(c.url)) errors.push(`${where}: url "${String(c.url)}" is not an https URL`);
    if (c.secondhand != null && typeof c.secondhand !== "boolean") errors.push(`${where}: "secondhand" must be true or false`);
  });
  return errors;
}

/** Everything wrong with a staged critics file: empty when it is fit to merge. */
export function validateCriticsFile(src: unknown, key: string, known: KnownPairings): string[] {
  const errors: string[] = [];
  if (typeof src !== "object" || src === null) return ["not a JSON object"];
  const file = src as Record<string, unknown>;
  validateHeader(file, key, known, errors);
  const critics = file.critics;
  const reading = file.reading;
  if (!Array.isArray(critics)) errors.push(`"critics" must be an array`);
  if (!Array.isArray(reading)) errors.push(`"reading" must be an array`);
  if (!Array.isArray(critics) || !Array.isArray(reading)) return errors;
  if (critics.length === 0 && reading.length === 0) errors.push(`"critics" and "reading" are both empty`);
  critics.forEach((raw: unknown, i) => {
    const where = `critics[${i}]`;
    if (typeof raw !== "object" || raw === null) return void errors.push(`${where}: not an object`);
    const c = raw as Record<string, unknown>;
    for (const f of ["publication", "title", "quote"] as const) {
      if (!str(c[f])) errors.push(`${where}: "${f}" is missing or empty`);
    }
    if (c.critic != null && !str(c.critic)) errors.push(`${where}: "critic" must be a name or null`);
    if (c.via != null && !str(c.via)) errors.push(`${where}: "via" must be a site name or null`);
    if (typeof c.date !== "string" || !DATE_RE.test(c.date)) errors.push(`${where}: date "${String(c.date)}" is not YYYY, YYYY-MM or YYYY-MM-DD`);
    if (!isHttps(c.url)) errors.push(`${where}: url "${String(c.url)}" is not an https URL`);
    if (!CRITIC_KINDS.includes(c.kind as CriticKind)) errors.push(`${where}: kind "${String(c.kind)}" is not one of ${CRITIC_KINDS.join(", ")}`);
    if (str(c.quote) && hasUnbalancedStraightQuotes(c.quote)) errors.push(`${where}: quote has an odd number of straight double quotes`);
  });
  reading.forEach((raw: unknown, i) => {
    const where = `reading[${i}]`;
    if (typeof raw !== "object" || raw === null) return void errors.push(`${where}: not an object`);
    const r = raw as Record<string, unknown>;
    for (const f of ["title", "publication"] as const) {
      if (!str(r[f])) errors.push(`${where}: "${f}" is missing or empty`);
    }
    if (r.author != null && !str(r.author)) errors.push(`${where}: "author" must be a name or null`);
    if (typeof r.date !== "string" || !DATE_RE.test(r.date)) errors.push(`${where}: date "${String(r.date)}" is not YYYY, YYYY-MM or YYYY-MM-DD`);
    if (!isHttps(r.url)) errors.push(`${where}: url "${String(r.url)}" is not an https URL`);
    if (typeof r.paywalled !== "boolean") errors.push(`${where}: "paywalled" must be true or false`);
  });
  return errors;
}

/**
 * A validated staged quotes file as its entry of clippings.json: the field whitelist, inner double quotes
 * nested, a stable id from the first six words of each quote (`-2` on a repeat), missing fields null.
 */
export function buildQuotesEntry(src: RawQuotesFile): ClippingsEntry {
  const seen = new Set<string>();
  const clippings = src.clippings.map((raw) => {
    const quote = nestQuotes(raw.quote as string);
    const fields = Object.fromEntries(CLIPPING_FIELDS.map((k) => [k, raw[k] ?? null]));
    return { id: uniqueId(slug(quote), seen), ...fields, quote, secondhand: Boolean(raw.secondhand) } as unknown as Clipping;
  });
  return { pair: src.pair, tmdb_ids: src.tmdb_ids, clippings };
}

/** A validated staged critics file as its entry of essays.json: ids prefixed `critic-`, the same nesting. */
export function buildCriticsEntry(src: RawCriticsFile): CriticsEntry {
  const seen = new Set<string>();
  const critics = src.critics.map((raw) => {
    const quote = nestQuotes(raw.quote as string);
    const fields = Object.fromEntries(CRITIC_FIELDS.map((k) => [k, raw[k] ?? null]));
    return { id: uniqueId(CRITIC_ID_PREFIX + slug(quote), seen), ...fields, quote } as unknown as Critic;
  });
  const reading = src.reading.map((raw) => Object.fromEntries(READING_FIELDS.map((k) => [k, raw[k] ?? null])) as unknown as ReadingItem);
  return { pair: src.pair, tmdb_ids: src.tmdb_ids, critics, reading };
}

/**
 * Problems that span the whole app JSON rather than one staged file: clipping ids repeated within a pair,
 * critic ids repeated anywhere or missing their prefix, a clipping id that could collide with a critic's.
 */
export function validateIds(
  clippings: Record<string, { clippings: readonly { id: string }[] }>,
  critics: Record<string, { critics: readonly { id: string }[] }>,
): string[] {
  const errors: string[] = [];
  for (const [key, entry] of Object.entries(clippings)) {
    const seen = new Set<string>();
    for (const c of entry.clippings) {
      if (seen.has(c.id)) errors.push(`clippings.json ${key}: duplicate id "${c.id}"`);
      seen.add(c.id);
      if (c.id.startsWith(CRITIC_ID_PREFIX)) errors.push(`clippings.json ${key}: id "${c.id}" uses the critic- prefix`);
    }
  }
  const seenCritic = new Set<string>();
  for (const [key, entry] of Object.entries(critics)) {
    for (const c of entry.critics) {
      if (!c.id.startsWith(CRITIC_ID_PREFIX)) errors.push(`essays.json ${key}: id "${c.id}" must start with "${CRITIC_ID_PREFIX}"`);
      if (seenCritic.has(c.id)) errors.push(`essays.json ${key}: duplicate id "${c.id}"`);
      seenCritic.add(c.id);
    }
  }
  return errors;
}

/** Judgement calls a human should look at before committing: not errors, so they never block a merge. */
export function quotesFlags(entry: ClippingsEntry): string[] {
  const flags: string[] = [];
  const [a, b] = entry.pair;
  const by = (speaker: string) => entry.clippings.filter((c) => c.speaker === speaker).length;
  const counts = { a: by(a), b: by(b) };
  if (entry.clippings.length < 4) flags.push(`only ${entry.clippings.length} quotes`);
  if (counts.a === 0 || counts.b === 0) flags.push(`nothing from ${counts.a === 0 ? a : b}`);
  const second = entry.clippings.filter((c) => c.secondhand).length;
  if (second > 0) flags.push(`${second} secondhand`);
  const long = entry.clippings.filter((c) => c.quote.split(/\s+/).length > 90).length;
  if (long > 0) flags.push(`${long} over 90 words`);
  return flags;
}

export function criticsFlags(entry: CriticsEntry): string[] {
  const flags: string[] = [];
  if (entry.critics.length === 0) flags.push("no critic quotes, links only");
  const off = entry.critics.filter((c) => {
    const n = c.quote.split(/\s+/).length;
    return n < 15 || n > 80;
  }).length;
  if (off > 0) flags.push(`${off} quotes outside 15-80 words`);
  const piece = new Map<string, number>();
  for (const c of entry.critics) piece.set(c.url, (piece.get(c.url) ?? 0) + 1);
  const twice = [...piece.values()].filter((n) => n > 2).length;
  if (twice > 0) flags.push(`${twice} pieces quoted more than twice`);
  return flags;
}

/** The text of a JSON data file: 2-space indent, non-ASCII left as written, one trailing newline. */
export function stringifyData(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
