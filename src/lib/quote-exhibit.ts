import type { ClippingsPerson, ClippingsVoice, VoicedClippings } from "./clippings";
import { clippingVoices, type PageVoice } from "./clippings-view";
import type { PairCritics } from "./critics";

/** Critics-only and reading-only pairs use the same page portraits and palette slots as artists' quotes. */
export function quoteExhibitPeople(
  pair: VoicedClippings | null,
  critics: PairCritics | null,
  page: readonly PageVoice[],
): readonly [ClippingsVoice, ClippingsVoice] | null {
  return pair?.people ?? (critics ? clippingVoices(critics.people, page) : null);
}

/** Keep period and page settings while changing quotes, dropping the retired layout-study flag. */
export function quoteExhibitQuoteSearch(search: string, id: string): string {
  const params = new URLSearchParams(search);
  params.set("view", "clippings");
  params.set("quote", id);
  params.delete("exhibit");
  return `?${params.toString()}`;
}

export function nextExhibitIndex(index: number, count: number, direction: 1 | -1): number {
  return count > 0 ? ((index + direction) % count + count) % count : 0;
}

/**
 * Newsreader's advance widths in em by kind of character, fitted to the face over every quote and rounded up: the width of any
 * quote comes out within about 7% of the real one (a capital is half as wide again as a lowercase letter, so a line of capitals
 * is not set like a line of prose).
 */
const QUOTE_EM = { lower: 0.45, upper: 0.68, digit: 0.62, space: 0.31, other: 0.22 } as const;

/** How wide `text` is on one line, in em of the quote's face. */
export function quoteEm(text: string): number {
  let width = 0;
  for (const char of text) {
    width += /\p{Ll}/u.test(char) ? QUOTE_EM.lower
      : /\p{Lu}/u.test(char) ? QUOTE_EM.upper
      : /\p{N}/u.test(char) ? QUOTE_EM.digit
      : /\s/u.test(char) ? QUOTE_EM.space
      : QUOTE_EM.other;
  }
  return width;
}

/** A word the browser will not break: the text between spaces, dashes, and hyphens before a letter. */
const UNBREAKABLE_BREAKS = /[\s\u2013\u2014]+|-(?=\p{L})/u;

/** What a quote's type is fitted from (see `.quote-exhibit-words`): lengths of its text, none of them measured in a browser. */
export interface QuoteFit {
  /** The quote with its marks, on one line, in em. */
  em: number;
  /** Its longest word, in em. */
  word: number;
  /** The line under it, in characters. */
  context: number;
  /** The source line under that, in characters. */
  source: number;
}

export function quoteFit(quote: string, contextChars = 0, sourceChars = 0): QuoteFit {
  const marked = `\u201C${quote}\u201D`;
  const hundredths = (value: number) => Math.round(value * 100) / 100;
  return {
    em: hundredths(quoteEm(marked)),
    word: hundredths(Math.max(0, ...marked.split(UNBREAKABLE_BREAKS).map(quoteEm))),
    context: contextChars,
    source: sourceChars,
  };
}

/** Whether a focused text pane still has room to scroll in the direction of Space / Shift+Space. */
export function quotePaneCanScroll(pane: { scrollTop: number; scrollHeight: number; clientHeight: number }, backwards: boolean): boolean {
  return backwards ? pane.scrollTop > 1 : pane.scrollHeight - pane.clientHeight - pane.scrollTop > 1;
}

/** How much further than its text pane could scroll a finger has to go for the swipe to move the deck on. */
export const PANE_SWIPE_LEFTOVER = 48;

/**
 * A finger swiped a quote's text pane that had room to scroll: the browser gives that whole touch to the pane, so the deck does not
 * move however far the finger goes, and a pane with a few pixels of room would swallow every swipe that starts on it. This says
 * what the deck should do when the finger lifts: 1 for the next quote, -1 for the one before, 0 to stay. `travel` is how far the
 * finger went (px, positive upwards: the way that shows what is below) and the pane is as it was when the touch began. The swipe
 * moves the deck when it went 48px further than the pane had left to scroll that way; less is reading the pane.
 */
export function paneSwipeAdvance(travel: number, pane: { scrollTop: number; scrollHeight: number; clientHeight: number }): -1 | 0 | 1 {
  if (travel === 0) return 0;
  const room = travel > 0 ? Math.max(0, pane.scrollHeight - pane.clientHeight - pane.scrollTop) : Math.max(0, pane.scrollTop);
  if (Math.abs(travel) - room < PANE_SWIPE_LEFTOVER) return 0;
  return travel > 0 ? 1 : -1;
}

interface ExhibitKey {
  key: string;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  repeat?: boolean;
  isComposing?: boolean;
  defaultPrevented?: boolean;
}

/** Space advances, Shift+Space goes back; fields, controls, dialogs and IMEs keep their own keys. */
export function exhibitSpaceAction(event: ExhibitKey, interactive: boolean): "next" | "previous" | "swallow" | null {
  if (event.key !== " " || interactive || event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return null;
  if (event.repeat) return "swallow";
  return event.shiftKey ? "previous" : "next";
}

export interface QuoteContextPart {
  text: string;
  person: ClippingsPerson | null;
}

/** Keep attribution in the prose, adding a quiet lead-in only when the speaker is not already named. */
export function quoteExhibitAttributedContext(text: string, speaker: ClippingsPerson, people: readonly ClippingsPerson[]): string {
  const named = quoteExhibitContextParts(text, people).some((part) => part.person?.id === speaker.id);
  return named ? text : text.trim() ? `${speaker.name} — ${text}` : speaker.name;
}

/** Link names already in the prose, preserving its wording and possessives. Never guess an ambiguous short name. */
export function quoteExhibitContextParts(text: string, people: readonly ClippingsPerson[]): QuoteContextPart[] {
  const aliases = new Map<string, ClippingsPerson | null>();
  for (const person of people) {
    const words = person.name.trim().split(/\s+/);
    for (const name of new Set([person.name, words[0], words[words.length - 1]])) {
      if (!name) continue;
      const previous = aliases.get(name);
      aliases.set(name, previous === undefined || previous?.id === person.id ? person : null);
    }
  }
  const names = [...aliases.keys()].filter((name) => aliases.get(name)).sort((a, b) => b.length - a.length);
  if (names.length === 0) return [{ text, person: null }];
  const escaped = names.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`(?<![\\p{L}\\p{M}\\p{N}])(?:${escaped.join("|")})(?![\\p{L}\\p{M}\\p{N}])`, "gu");
  const parts: QuoteContextPart[] = [];
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > cursor) parts.push({ text: text.slice(cursor, match.index), person: null });
    parts.push({ text: match[0], person: aliases.get(match[0]) ?? null });
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), person: null });
  return parts;
}
