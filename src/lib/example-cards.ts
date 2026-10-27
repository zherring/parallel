import { EXAMPLE_PAIRINGS, pairingHref, type ExamplePairing } from "@/lib/examples";
import { sharedFilms } from "@/lib/shared";
import type { PersonTimeline } from "@/lib/types";

export interface ExampleCardData {
  href: string;
  blurb: string;
  people: {
    id: number;
    name: string;
    /** TMDB profile path; null when unknown or TMDB could not be reached. */
    profilePath: string | null;
  }[];
  /** Films all people share (non-minor credits); null when TMDB could not be reached. */
  filmsTogether: number | null;
}

/**
 * Cards for the landing page. `timelines` maps person id to a loaded timeline; missing entries
 * (TMDB failures) leave that card without photos for them and without a count.
 */
export function buildExampleCards(
  timelines: ReadonlyMap<number, PersonTimeline>,
  pairings: readonly ExamplePairing[] = EXAMPLE_PAIRINGS,
): ExampleCardData[] {
  return pairings.map((pairing) => {
    const loaded = pairing.people.map((p) => timelines.get(p.id));
    const complete = loaded.every((t): t is PersonTimeline => t !== undefined);
    return {
      href: pairingHref(pairing),
      blurb: pairing.blurb,
      people: pairing.people.map((p, i) => ({
        id: p.id,
        name: p.name,
        profilePath: loaded[i]?.person.profilePath ?? null,
      })),
      filmsTogether: complete ? sharedFilms(loaded, { includeMinor: false }).length : null,
    };
  });
}
