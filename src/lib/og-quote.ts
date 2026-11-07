/**
 * The layout of a quote's preview card (`/p/<people>/og?quote=<id>`): how much of a quote the card
 * shows and how large it sets it. Pure, so the sizes can be tested; the drawing is in `og-quote-render.tsx`.
 *
 * The renderer cannot measure text, so the size is chosen by laying the quote out on paper with a
 * generous width for an average character of the serif face. A long quote ends up a step smaller than
 * it strictly needs, never overflowing into the attribution.
 */

/** A quote longer than this is cut (see `truncateQuote`); the card is a pull quote, not an article. */
export const QUOTE_CARD_MAX_CHARS = 300;

/** The text column: the card's width less its side padding, and the height left for the quote under the opening mark. */
export const QUOTE_TEXT_WIDTH = 1040;
export const QUOTE_TEXT_HEIGHT = 340;

/** Font sizes tried from the largest down, and the line height as a multiple of the size. */
export const QUOTE_FONT_SIZES = [72, 64, 56, 50, 45, 41, 37] as const;
export const QUOTE_LINE_HEIGHT = 1.24;

/** Width of an average character of Newsreader as a multiple of its size, rounded up so that a line never runs longer than predicted. */
const CHAR_WIDTH = 0.5;

/** How many lines `text` takes in a column `width` wide at `fontSize`, breaking only between words. */
export function quoteLineCount(text: string, fontSize: number, width: number = QUOTE_TEXT_WIDTH): number {
  const perLine = Math.floor(width / (CHAR_WIDTH * fontSize));
  let lines = 1;
  let used = 0;
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const length = Array.from(word).length;
    // A word longer than a whole line is broken by the renderer: it starts a line and fills as many as it needs.
    if (length > perLine) {
      if (used > 0) lines += 1;
      lines += Math.ceil(length / perLine) - 1;
      used = length % perLine || perLine;
      continue;
    }
    if (used === 0) used = length;
    else if (used + 1 + length <= perLine) used += 1 + length;
    else {
      lines += 1;
      used = length;
    }
  }
  return lines;
}

export interface QuoteCardType {
  fontSize: number;
  lineHeight: number;
}

/** The largest size at which `text` fits the text column; the smallest size when none does. */
export function quoteCardType(text: string): QuoteCardType {
  for (const fontSize of QUOTE_FONT_SIZES) {
    const height = quoteLineCount(text, fontSize) * fontSize * QUOTE_LINE_HEIGHT;
    if (height <= QUOTE_TEXT_HEIGHT) return { fontSize, lineHeight: QUOTE_LINE_HEIGHT };
  }
  return { fontSize: QUOTE_FONT_SIZES[QUOTE_FONT_SIZES.length - 1], lineHeight: QUOTE_LINE_HEIGHT };
}

/**
 * `text` as the words that flow freely and the tail that stays together: the last `tailWords` words, which the card
 * sets in one piece with the closing mark, so that the mark never starts a line of its own and a short last line has
 * at least a couple of words. The renderer cannot colour part of a wrapping line (nested text becomes separate boxes),
 * so the card sets its quote word by word, and the closing mark in the speaker's colour needs a word to sit beside.
 */
export function splitQuoteTail(text: string, tailWords = 2): { words: string[]; tail: string } {
  const all = text.split(/\s+/).filter(Boolean);
  const keep = Math.max(0, all.length - Math.max(1, tailWords));
  return { words: all.slice(0, keep), tail: all.slice(keep).join(" ") };
}
