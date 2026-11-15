/**
 * Spike (zherring/spike-portraits): what the cut-paper treatment needs that both the app's `TreatedPortrait` and the preview cards (`og-portrait.ts`)
 * use, with nothing of the browser in it: the shape (a cut, else a tear), the montage's posters, the duotone, and the cookie the flag sets for the cards.
 */

import cuts from "@/lib/portrait-cuts.json";
import testset from "@/lib/portrait-testset.json";
import type { CutPoint, PortraitCuts } from "@/lib/portrait-cuts";
import { TEAR_SIZE, tearFor, type PortraitTestArtist } from "@/lib/portrait-tears";

const CUTS = cuts as unknown as PortraitCuts;
/** The test set's posters (`npm run portraits:testset`), so a test artist's tear sits on their own montage. */
const TEST_POSTERS = new Map((testset as PortraitTestArtist[]).map((artist) => [artist.id, artist.posters]));

/**
 * The cookie `usePortraitMode` sets alongside its tab memory, so the preview cards (drawn on the server, which cannot read the URL flag) follow it.
 * Read only outside production (see `og-portrait.ts`); `PORTRAIT_TREATMENT=1` turns the cards' treatment on anywhere.
 */
export const PORTRAIT_COOKIE = "spike-portrait";

export interface TreatmentShape {
  points: readonly CutPoint[];
  size: readonly [number, number];
  posters: string[];
}

/** The polygon, its viewBox and the montage's posters: the person's cut when it was made from this photo, else their tear (`tearFor`). */
export function treatmentShape(personId: number, profilePath: string): TreatmentShape {
  const cut = CUTS[String(personId)];
  if (cut && cut.profilePath === profilePath) return { points: cut.variants["20"], size: cut.size, posters: cut.posters };
  return { points: tearFor(personId), size: TEAR_SIZE, posters: cut?.posters ?? TEST_POSTERS.get(personId) ?? [] };
}

/** The `feColorMatrix` values of the montage's duotone: near-black to a dark version of the person's colour, by luminance. */
export function duotoneMatrix(tint: string): string {
  const dark = [0.05, 0.05, 0.06];
  const light = [1, 3, 5].map((at) => (parseInt(tint.slice(at, at + 2), 16) / 255) * 0.7);
  const row = (c: number) => {
    const span = light[c] - dark[c];
    return `${0.2126 * span} ${0.7152 * span} ${0.0722 * span} 0 ${dark[c]}`;
  };
  return `${row(0)} ${row(1)} ${row(2)} 0 0 0 1 0`;
}
