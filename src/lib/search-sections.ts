import type { ModeOption } from "@/lib/bacon-mode";
import { normalizeName, scoreName } from "@/lib/people-match";
import type { PairingSearchResult, PersonSearchResult } from "@/lib/types";

export type SearchResultOption = PersonSearchResult | PairingSearchResult | ModeOption;
export const SEARCH_CATEGORIES = ["all", "artists", "pairings"] as const;
export type SearchCategory = (typeof SEARCH_CATEGORIES)[number];

export interface SearchResultSection {
  key: "matches" | "mode" | "pairings" | "more-artists";
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
 *
 * `mode` is a mode the first result offers (Kevin Bacon mode, see `bacon-mode.ts`): under All its row comes straight after
 * that person, who then leads the list as an obvious match does, whether or not they have curated pairings.
 */
export function searchSections(
  query: string,
  results: readonly PersonSearchResult[],
  pairings: readonly PairingSearchResult[],
  category: SearchCategory = "all",
  mode: ModeOption | null = null,
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

  const offer = first && mode && category === "all" ? mode : null;
  // The first person stands alone at the top, and the others follow under More artists.
  const led = (obvious || offer !== null) && category === "all";

  const sections: Omit<SearchResultSection, "startIndex">[] = [];
  if (category !== "pairings" && results.length > 0) {
    sections.push({ key: "matches", label: null, options: led ? [first] : results });
  }
  if (offer) sections.push({ key: "mode", label: null, options: [offer] });
  const shownPairings = obvious || led ? related : pairings;
  if (category !== "artists" && shownPairings.length > 0) sections.push({ key: "pairings", label: "Related pairings", options: shownPairings });
  if (led && results.length > 1) sections.push({ key: "more-artists", label: "More artists", options: results.slice(1) });

  let startIndex = 0;
  return sections.map((section) => {
    const positioned = { ...section, startIndex };
    startIndex += section.options.length;
    return positioned;
  });
}
