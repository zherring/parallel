/**
 * What the Clippings tab does with a pair's clippings: which of the two people said each one, the
 * direction filter ("All", "A on B", "B on A") and the way an article's date is written. Pure, and
 * free of the JSON itself (see `clippings.ts`), so that client components can import it.
 */

import type { Clipping, ClippingsPerson } from "@/lib/clippings";
import { headingNames } from "@/lib/short-name";

/** "all", or the clippings the first / the second person of the pair said about the other. */
export type ClippingsFilter = "all" | "first" | "second";

export interface FilterOption {
  id: ClippingsFilter;
  /** The button's text: "All", "Spielberg on Williams". */
  label: string;
  /** The full wording, for a tooltip and screen readers: "Steven Spielberg on John Williams". */
  title: string;
  /** How many clippings the option shows. */
  count: number;
}

type Pair = readonly [ClippingsPerson, ClippingsPerson];

function normalized(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** 0 or 1 for the person of the pair who said the clipping (`speaker` compared with the pair's names), null if it is neither. */
export function speakerIndex(clipping: Pick<Clipping, "speaker">, people: Pair): 0 | 1 | null {
  const speaker = normalized(clipping.speaker);
  if (speaker === normalized(people[0].name)) return 0;
  if (speaker === normalized(people[1].name)) return 1;
  return null;
}

/** The clippings a filter shows, in their order. Those whose speaker is neither of the pair show under "all" only. */
export function filterClippings(
  clippings: readonly Clipping[],
  people: Pair,
  filter: ClippingsFilter,
): Clipping[] {
  if (filter === "all") return [...clippings];
  const wanted = filter === "first" ? 0 : 1;
  return clippings.filter((clipping) => speakerIndex(clipping, people) === wanted);
}

/**
 * The options of the direction filter: "All" and each direction that has clippings. Empty when
 * fewer than two directions do, since a filter between "all" and the only direction would do
 * nothing; the tab then shows no filter.
 */
export function filterOptions(clippings: readonly Clipping[], people: Pair): FilterOption[] {
  const counts = [0, 0];
  for (const clipping of clippings) {
    const index = speakerIndex(clipping, people);
    if (index !== null) counts[index] += 1;
  }
  if (counts.filter((count) => count > 0).length < 2) return [];

  // Family names for the buttons (the full names would wrap on a phone), the full names when the two share one.
  const short = headingNames(people, true);
  const direction = (index: 0 | 1): Omit<FilterOption, "id"> => ({
    label: `${short[index]} on ${short[1 - index]}`,
    title: `${people[index].name} on ${people[1 - index].name}`,
    count: counts[index],
  });
  return [
    { id: "all", label: "All", title: "All clippings", count: clippings.length },
    { id: "first", ...direction(0) },
    { id: "second", ...direction(1) },
  ];
}

/** What a polite live region says after the filter is changed: "Showing 3 clippings". */
export function clippingsCountMessage(count: number): string {
  return `Showing ${count} ${count === 1 ? "clipping" : "clippings"}`;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * An article's date as the link to it reads: "2012-05-01" is "May 1, 2012", "2012-05" is "May 2012",
 * "2012" stays "2012". Anything else (or a month or day out of range) is cut back to what is valid,
 * and a string that is not a date at all is returned as it is.
 */
export function formatClippingDate(date: string): string {
  const match = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(date.trim());
  if (!match) return date;
  const [, year, month, day] = match;
  const m = month ? Number(month) : 0;
  if (m < 1 || m > 12) return year;
  const d = day ? Number(day) : 0;
  if (d < 1 || d > 31) return `${MONTHS[m - 1]} ${year}`;
  return `${MONTHS[m - 1]} ${d}, ${year}`;
}
