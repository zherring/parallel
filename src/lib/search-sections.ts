import { normalizeName, scoreName } from "@/lib/people-match";
import type { PairingSearchResult, PersonSearchResult } from "@/lib/types";

export type SearchResultOption = PersonSearchResult | PairingSearchResult;
export const SEARCH_CATEGORIES = ["all", "artists", "pairings"] as const;
export type SearchCategory = (typeof SEARCH_CATEGORIES)[number];

export interface SearchResultSection {
  key: "matches" | "pairings" | "more-artists";
  label: string | null;
  options: readonly SearchResultOption[];
  /** Index in the flattened keyboard list, not a separate index within each group. */
  startIndex: number;
}

/** A full/partial multi-word name or a distinctive surname, not a short prefix or first name. */
function strongNameMatch(name: string, query: string): boolean {
  const full = normalizeName(name);
  if (full === query) return true;
  if (query.length < 4) return false;
  if (!query.includes(" ")) return full.split(" ").slice(1).some((word) => word.startsWith(query));
  const match = scoreName(name, 0, query);
  return match !== null && match.kind !== "fuzzy";
}

/**
 * For an obvious top match: that person, only their pairings, then More artists. The server's
 * ranking already resolves namesakes. A surname shared by multiple curated artists is still
 * ambiguous, so broad searches keep all people first and all related pairings below them.
 */
export function searchSections(
  query: string,
  results: readonly PersonSearchResult[],
  pairings: readonly PairingSearchResult[],
  category: SearchCategory = "all",
): SearchResultSection[] {
  const first = results[0];
  const q = normalizeName(query);
  const related = first ? pairings.filter((pair) => pair.people.some((person) => person.id === first.id)) : [];
  const curatedIds = new Set(pairings.flatMap((pair) => pair.people.map((person) => person.id)));
  const obvious = first && related.length > 0 && strongNameMatch(first.name, q) && (
    normalizeName(first.name) === q || !results.slice(1).some((person) =>
      curatedIds.has(person.id) && normalizeName(person.name) !== normalizeName(first.name) && strongNameMatch(person.name, q),
    )
  );

  const sections: Omit<SearchResultSection, "startIndex">[] = [];
  if (category !== "pairings" && results.length > 0) {
    sections.push({ key: "matches", label: null, options: obvious && category === "all" ? [first] : results });
  }
  const shownPairings = obvious ? related : pairings;
  if (category !== "artists" && shownPairings.length > 0) sections.push({ key: "pairings", label: "Related pairings", options: shownPairings });
  if (category === "all" && obvious && results.length > 1) sections.push({ key: "more-artists", label: "More artists", options: results.slice(1) });

  let startIndex = 0;
  return sections.map((section) => {
    const positioned = { ...section, startIndex };
    startIndex += section.options.length;
    return positioned;
  });
}
