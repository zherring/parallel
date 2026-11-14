import type { ClippingsPerson, ClippingsVoice, VoicedClippings } from "./clippings";
import { clippingVoices } from "./clippings-view";
import type { PairCritics } from "./critics";
import type { PersonSummary } from "./types";

/** Critics-only and reading-only pairs use the same page portraits and palette slots as artists' quotes. */
export function quoteExhibitPeople(
  pair: VoicedClippings | null,
  critics: PairCritics | null,
  page: readonly Pick<PersonSummary, "id" | "profilePath">[],
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

/** Whether a focused text pane still has room to scroll in the direction of Space / Shift+Space. */
export function quotePaneCanScroll(pane: { scrollTop: number; scrollHeight: number; clientHeight: number }, backwards: boolean): boolean {
  return backwards ? pane.scrollTop > 1 : pane.scrollHeight - pane.clientHeight - pane.scrollTop > 1;
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
