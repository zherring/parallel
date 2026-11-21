import cuts from "@/lib/portrait-cuts.json" with { type: "json" };
import type { PortraitCuts } from "@/lib/portrait-cuts";
import { PROFILE_OVERRIDES } from "@/lib/profile-overrides";

// `with { type: "json" }`: Node (the refresh scripts run these modules unbundled) needs the attribute; the bundler and vitest accept it too.
const CUTS = cuts as unknown as PortraitCuts;

/**
 * The photo the app shows for a person: our override (`PROFILE_OVERRIDES`), else the photo their cut-out was made from, else TMDB's. TMDB's primary photo
 * changes over time, and a cut made from another photo does not fit the new one (`treatmentShape` draws a tear instead), so the app keeps showing the photo
 * of the cut until `npm run portraits:cut` makes a new one. Applied where TMDB's people are read (`normalizePerson`, the film's cast and crew, search, the
 * people index), so every avatar and cut-out of a person is the same photo.
 */
export function profilePathFor(personId: number, tmdbPath: string | null): string | null {
  return PROFILE_OVERRIDES[personId] ?? CUTS[String(personId)]?.profilePath ?? tmdbPath;
}
