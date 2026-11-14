/**
 * What the Clippings tab does with a pair's critics (see `critics.ts`): the name a critic's quote is attributed to,
 * who it is "on", the avatar name and year, the quote's lookup by id, where their quotes
 * go among the artists' own, and the byline of a piece in "More reading". Pure, and free of the JSON itself, so that
 * client components can import it.
 */

import type { Clipping } from "@/lib/clippings";
import type { Critic, ReadingItem } from "@/lib/critics";
import { clippingYear, dateYear, isCriticId } from "@/lib/clippings-view";
import { headingNames, type HeadingPerson } from "@/lib/short-name";

/**
 * The critic who gets a quote's credit: the writer, or the publication when the piece is not signed (an unsigned
 * review is the paper's).
 */
export function criticName(critic: Pick<Critic, "critic" | "publication">): string {
  return critic.critic?.trim() || critic.publication.trim();
}

/**
 * "Spielberg & Williams": who a critic's quote is about, in family names (the full
 * names when the two share one), in the order `people` has them.
 */
export function criticAbout(people: readonly HeadingPerson[]): string {
  return headingNames(people, true).join(" & ");
}

/**
 * The name `PersonAvatar` takes its initials from, for a critic who has no photo: the first of the writers ("K. J.
 * Donnelly and Steven Rawle" is "K. J. Donnelly", whose letters are KD), or the first letter of the publication when
 * the piece is unsigned ("Kirkus Reviews" is K, not a person's two letters).
 */
export function criticAvatarName(critic: Pick<Critic, "critic" | "publication">): string {
  const writer = critic.critic?.trim();
  if (!writer) return Array.from(critic.publication.trim())[0] ?? "?";
  return writer.split(/\s+(?:and|&)\s+|\s*,\s*/i)[0] || writer;
}

/** The year a critic's piece was published, from its "YYYY", "YYYY-MM" or "YYYY-MM-DD" date; null for anything else. */
export function criticYear(item: Pick<Critic | ReadingItem, "date">): number | null {
  return dateYear(item.date);
}

/** The critic with this id among a pair's critics, or null: no id, one the pair does not have, or an artist's (an id that does not start with "critic-"). */
export function criticById<T extends Pick<Critic, "id">>(critics: readonly T[], id: string | null | undefined): T | null {
  if (!id || !isCriticId(id)) return null;
  return critics.find((critic) => critic.id === id) ?? null;
}

/** One quote of the Clippings tab's single list: an artist's or a critic's. */
export type QuoteEntry = { kind: "clipping"; clipping: Clipping } | { kind: "critic"; critic: Critic };

/**
 * The artists' quotes and the critics' as one list, oldest first by the year each goes under: `clippingYear` for an
 * artist's (the older of the year it was said and the year of the original) and the year of the piece's date for a
 * critic's. A quote with no year goes last. Where the years are the same an artist's comes before a critic's, and
 * quotes of the same kind and year keep the order they were given in. A copy; the arguments are left as they were.
 */
export function interleaveQuotes(clippings: readonly Clipping[], critics: readonly Critic[]): QuoteEntry[] {
  const entries = [
    ...clippings.map((clipping) => ({ entry: { kind: "clipping", clipping } as QuoteEntry, year: clippingYear(clipping), rank: 0 })),
    ...critics.map((critic) => ({ entry: { kind: "critic", critic } as QuoteEntry, year: criticYear(critic), rank: 1 })),
  ].map((item, index) => ({ ...item, index }));
  entries.sort((a, b) => {
    if (a.year !== b.year) {
      if (a.year === null) return 1;
      if (b.year === null) return -1;
      return a.year - b.year;
    }
    return a.rank - b.rank || a.index - b.index;
  });
  return entries.map((item) => item.entry);
}

/**
 * The parts of a piece's byline in "More reading", in the order they are read: the author, the publication and
 * the year, each left out when it is missing.
 */
export function readingByline(item: Pick<ReadingItem, "author" | "publication" | "date">): string[] {
  const year = criticYear(item);
  return [item.author?.trim(), item.publication.trim(), year === null ? "" : String(year)].filter(
    (part): part is string => !!part,
  );
}
