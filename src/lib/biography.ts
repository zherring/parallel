/**
 * Pure text helpers for a person's TMDB biography: cleaning and capping what is stored,
 * a short teaser for the lane header, and paragraph splitting for the popout.
 *
 * TMDB biographies are community-contributed (many start as a Wikipedia summary), so
 * they arrive with `\r\n` line endings, stray whitespace and wildly different lengths.
 */

/** Longest biography kept on a `PersonSummary`; it travels in the page payload for every person. */
export const MAX_BIOGRAPHY_CHARS = 4000;
/** Default teaser length: about two to four lines in the narrow lane header. */
export const DEFAULT_SNIPPET_CHARS = 150;

const ELLIPSIS = "…";
/** A cut must keep at least this share of the limit, or it is not worth cutting there. */
const MIN_KEPT_SHARE = 0.5;

/** Words that end in a period without ending the sentence ("Dr. Smith"). */
const ABBREVIATIONS = new Set([
  "mr", "mrs", "ms", "dr", "jr", "sr", "st", "mt", "prof", "rev", "gen", "col", "capt", "lt", "sgt", "vs", "bros", "vol",
]);

/**
 * Sentence ends: . ! or ? (plus any closing quote or bracket), whitespace, then something that
 * starts a sentence. Digits do not count as a start ("born Jan. 5, 1950").
 */
const SENTENCE_BREAK = /[.!?]["'”’)\]]*(?=\s+["'“‘(\[]*\p{Lu})/gu;

function isRealSentenceEnd(text: string, endIndex: number): boolean {
  // The period belongs to the word right before it; look at that word.
  const before = text.slice(0, endIndex).replace(/["'”’)\]]+$/, "");
  if (!before.endsWith(".")) return true;
  const word = /([\p{L}\p{N}]+)\.$/u.exec(before)?.[1];
  if (!word) return true;
  if (word.length === 1 && /\p{Lu}/u.test(word)) return false; // an initial: "J. R. R. Tolkien"
  return !ABBREVIATIONS.has(word.toLowerCase());
}

/** Index just after each real sentence end in `text`, ascending. */
function sentenceEnds(text: string): number[] {
  const ends: number[] = [];
  for (const match of text.matchAll(SENTENCE_BREAK)) {
    const end = match.index + match[0].length;
    if (isRealSentenceEnd(text, end)) ends.push(end);
  }
  return ends;
}

/** Drops punctuation and spaces that read badly right before an ellipsis. */
function trimTrailingPunctuation(text: string): string {
  return text.replace(/[\s,;:\-–—(\["“'‘]+$/u, "");
}

/** Cuts at the last whitespace of `text.slice(0, limit)`; mid-word only when there is no whitespace at all. */
function cutAtWord(text: string, limit: number): string {
  const slice = text.slice(0, limit);
  if (limit >= text.length || /\s/.test(text.charAt(limit))) return slice;
  const lastSpace = slice.search(/\s\S*$/);
  return lastSpace > 0 ? slice.slice(0, lastSpace) : slice;
}

/**
 * Shortens `text` to at most `maxChars`, keeping whole paragraphs where it can, else whole
 * sentences, else whole words, and ends with an ellipsis when anything was cut.
 * Text that already fits comes back untouched.
 */
export function capBiography(text: string, maxChars: number = MAX_BIOGRAPHY_CHARS): string {
  if (text.length <= maxChars) return text;

  // Leave room for the " …" that marks the cut.
  const head = text.slice(0, Math.max(0, maxChars - 2));
  const minKept = Math.floor(maxChars * MIN_KEPT_SHARE);

  const paragraphEnd = head.lastIndexOf("\n\n");
  if (paragraphEnd >= minKept) return `${head.slice(0, paragraphEnd).trimEnd()} ${ELLIPSIS}`;

  // The window may end mid-sentence, so a sentence end is only usable if more text follows it.
  const sentenceEnd = sentenceEnds(text)
    .filter((end) => end <= head.length)
    .at(-1);
  if (sentenceEnd !== undefined && sentenceEnd >= minKept) {
    return `${head.slice(0, sentenceEnd).trimEnd()} ${ELLIPSIS}`;
  }

  return `${trimTrailingPunctuation(cutAtWord(text, head.length))}${ELLIPSIS}`;
}

/**
 * Cleans a raw TMDB biography for storage: `\n` line endings, trimmed lines, no more than one
 * blank line in a row, capped at `maxChars`. Empty or whitespace-only text is null.
 */
export function normalizeBiography(raw: string | null | undefined, maxChars: number = MAX_BIOGRAPHY_CHARS): string | null {
  if (typeof raw !== "string") return null;
  const text = raw
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text ? capBiography(text, maxChars) : null;
}

/**
 * A teaser: the first sentence, plus following ones while they fit in `maxChars`. When even the
 * first sentence is too long it is cut at a word boundary and ends with an ellipsis. Whitespace
 * (including paragraph breaks) is flattened to single spaces, so the result is one line of text.
 */
export function bioSnippet(text: string, maxChars: number = DEFAULT_SNIPPET_CHARS): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= maxChars) return flat;

  const fitting = sentenceEnds(flat).filter((end) => end <= maxChars);
  const last = fitting.at(-1);
  if (last !== undefined) return flat.slice(0, last).trimEnd();

  // No sentence fits: cut at a word, leaving room for the ellipsis.
  const words = trimTrailingPunctuation(cutAtWord(flat, Math.max(1, maxChars - 1)));
  return `${words}${ELLIPSIS}`;
}

/** The paragraphs of a stored biography (separated by blank lines), trimmed, none empty. */
export function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "1962-08-28" to "August 28, 1962"; just the year when only that can be read; null otherwise. */
export function formatLifeDate(date: string | null | undefined): string | null {
  if (!date) return null;
  const full = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (full) {
    const month = MONTHS[Number(full[2]) - 1];
    if (month) return `${month} ${Number(full[3])}, ${full[1]}`;
  }
  return /^(\d{4})/.exec(date)?.[1] ?? null;
}

/** "Born March 23, 1910 · Died September 6, 1998"; empty when neither date is known. */
export function lifeLine(person: { birthday: string | null; deathday: string | null }): string {
  const born = formatLifeDate(person.birthday);
  const died = formatLifeDate(person.deathday);
  return [born && `Born ${born}`, died && `Died ${died}`].filter(Boolean).join(" · ");
}
