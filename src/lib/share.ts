import { headingNames, pageHeading, type HeadingPerson } from "@/lib/short-name";

/** A post on X may weigh at most 280; any link in it counts as 23 whatever its real length. */
export const X_POST_LIMIT = 280;
export const X_URL_LENGTH = 23;
/** Bluesky counts 300 graphemes and counts a link at its full length. */
export const BLUESKY_POST_LIMIT = 300;
/** What the text may weigh on X once a space and the link are added: 280 - 1 - 23. */
export const X_TEXT_BUDGET = X_POST_LIMIT - 1 - X_URL_LENGTH;

/**
 * Weight of `text` on X (twitter-text v3 rules): characters in U+0000-U+10FF, the general
 * punctuation spaces and quotes count 1, everything else (CJK, emoji, ...) counts 2. This is also
 * a safe upper bound for Bluesky's grapheme count.
 */
export function xLength(text: string): number {
  let weight = 0;
  for (const char of text.normalize("NFC")) {
    const code = char.codePointAt(0) as number;
    const light =
      code <= 0x10ff ||
      (code >= 0x2000 && code <= 0x200d) ||
      (code >= 0x2010 && code <= 0x201f) ||
      (code >= 0x2032 && code <= 0x2037);
    weight += light ? 1 : 2;
  }
  return weight;
}

/** How much a post made of `text`, a space and a link weighs on X. */
export function xPostLength(text: string): number {
  return xLength(text) + 1 + X_URL_LENGTH;
}

/** Text budget on Bluesky for a post of `text`, a space and the link `url`. */
export function blueskyTextBudget(url: string): number {
  // Never squeeze the text to nothing for a very long link; the compose box lets the visitor edit it.
  return Math.max(60, BLUESKY_POST_LIMIT - 1 - Array.from(url).length);
}

export interface ShareInput {
  people: readonly HeadingPerson[];
  /**
   * Films the people made together (two or more people), or films on the timeline (one person),
   * as the page shows them by default.
   */
  count: number;
}

const filmWord = (count: number) => (count === 1 ? "film" : "films");

function pairSentence(names: string, count: number): string {
  return count > 0
    ? `My favorite film collaborations: ${names}, ${count} ${filmWord(count)} together`
    : `Film careers side by side: ${names}`;
}

function soloSentence(name: string, count: number): string {
  return count > 0 ? `${name}: a career in film, ${count} ${filmWord(count)} on a timeline` : `${name}: a career in film`;
}

/**
 * The text offered in the compose box of X, Bluesky and the native share sheet. The visitor can
 * edit it before posting. It weighs at most `budget` (see `xLength`), which by default is what is
 * left on X after the link:
 *
 *  1. the names as the page heading shows them (full names for two people, family names for three
 *     or more),
 *  2. family names, for two people,
 *  3. "{first}, {second} & {k} more", for three or more,
 *  4. the same, cut short with an ellipsis (only for absurdly long names).
 *
 * No hashtags, emoji or pronouns about the people.
 */
export function shareText(input: ShareInput, budget: number = X_TEXT_BUDGET): string {
  const { people, count } = input;
  if (people.length === 0) return "";

  const solo = people.length === 1;
  const build = (names: string) => (solo ? soloSentence(names, count) : pairSentence(names, count));
  const fits = (text: string) => xLength(text) <= budget;

  const candidates = [pageHeading(people).text];
  if (people.length === 2) candidates.push(pageHeading(people, { short: true }).text);
  if (people.length >= 3) {
    const family = headingNames(people, true);
    candidates.push(`${family[0]}, ${family[1]} & ${people.length - 2} more`);
  }

  for (const names of candidates) {
    const text = build(names);
    if (fits(text)) return text;
  }

  // Cut the shortest candidate down until it fits.
  const chars = Array.from(candidates[candidates.length - 1]);
  while (chars.length > 1) {
    chars.pop();
    const text = build(`${chars.join("").trimEnd()}…`);
    if (fits(text)) return text;
  }
  return build("…");
}

/** `text` and `url` are percent-encoded; X shortens `url` itself and puts it after the text. */
export function xIntentUrl(text: string, url: string): string {
  return `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
}

/** Bluesky has no separate link parameter: the link goes at the end of the text. */
export function blueskyIntentUrl(text: string, url: string): string {
  return `https://bsky.app/intent/compose?text=${encodeURIComponent(`${text} ${url}`)}`;
}

export interface ShareLinks {
  /** The text for the native share sheet and X (the X budget). */
  text: string;
  x: string;
  bluesky: string;
}

/** Everything the share menu needs for the page at `url`. */
export function shareLinks(input: ShareInput, url: string): ShareLinks {
  const text = shareText(input);
  const blueskyText = shareText(input, blueskyTextBudget(url));
  return { text, x: xIntentUrl(text, url), bluesky: blueskyIntentUrl(blueskyText, url) };
}
