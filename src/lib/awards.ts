import "server-only";
import { decodeAwards } from "@/lib/awards-format";

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

/**
 * The curated films' awards, decoded once from src/lib/awards.generated.json (written by
 * `npm run awards:refresh`; see "Awards data" in the README) and kept for the life of the server
 * process. The dynamic import keeps the file out of the client bundle and out of every route that
 * does not ask for awards, and the module is only evaluated the first time a route imports it.
 * A file that cannot be loaded leaves the table empty (no row anywhere) rather than failing pages.
 */
const AWARDS: ReadonlyMap<number, AwardsSummary> = await import("@/lib/awards.generated.json").then(
  (module) => decodeAwards(module.default),
  (error: unknown) => {
    console.error("awards: could not load src/lib/awards.generated.json, showing no awards", error);
    return new Map<number, AwardsSummary>();
  },
);

/** Awards for a curated film, or null when there is no data (the hover-card row is hidden then). */
export function awardsFor(tmdbId: number): AwardsSummary | null {
  return AWARDS.get(tmdbId) ?? null;
}
