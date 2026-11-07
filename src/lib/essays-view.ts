/**
 * What the Clippings tab's "Further reading" does with a pair's essays: the words of an essay's kind and the
 * parts of its byline. Pure, and free of the JSON itself (see `essays.ts`), so that client components can import it.
 */

import { dateYear } from "@/lib/clippings-view";
import type { Essay } from "@/lib/essays";

/** The small label an essay's kind gets ("Book chapter"); a kind this does not know is capitalised as it is written. */
export function essayKindLabel(kind: string): string {
  const text = kind.trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The year an essay was published, from its "YYYY", "YYYY-MM" or "YYYY-MM-DD" date; null for anything else. */
export function essayYear(essay: Pick<Essay, "date">): number | null {
  return dateYear(essay.date);
}

/**
 * The parts of an essay's byline, in the order they are read: the author, the publication and the year, each left
 * out when it is missing. Under it come `via` and the kind, which the caller sets apart.
 */
export function essayByline(essay: Pick<Essay, "author" | "publication" | "date">): string[] {
  const year = essayYear(essay);
  return [essay.author?.trim(), essay.publication.trim(), year === null ? "" : String(year)].filter(
    (part): part is string => !!part,
  );
}
