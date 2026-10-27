import "server-only";

export interface FestivalPrize {
  /** e.g. "Cannes", "Venice", "Berlin". */
  festival: string;
  /** e.g. "Palme d'Or", "Golden Lion", "Golden Bear". */
  prize: string;
}

export interface AwardsSummary {
  oscarWins: number;
  oscarNominations: number;
  festivalPrizes: FestivalPrize[];
}

// Contract stub: the awards pipeline replaces this table with the generated file.
const AWARDS: Record<number, AwardsSummary> = {};

/** Awards for a curated film, or null when there is no data (the hover-card row is hidden then). */
export function awardsFor(tmdbId: number): AwardsSummary | null {
  return AWARDS[tmdbId] ?? null;
}
