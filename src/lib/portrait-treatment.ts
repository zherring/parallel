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

/** A box of the photo, in its own units (`TreatmentShape.size`): what a tile shows of it. */
export interface PhotoCrop {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Of a photo `w` wide, the share a tile's crop takes: the head, with a little of the cut and the montage around it. */
const HEAD_CROP_WIDTH = 1;
/**
 * The widest tile (width / height) for which the crop is `HEAD_CROP_WIDTH` of the photo's width: a little wider than a pair's tile (320 x 313 on the share cards).
 * A wider tile (a group of three or four, whose tiles are shorter) shows the same height of the photo, the head and the shoulders, and so more across than
 * the photo has: the montage fills the sides, and the head stays whole and in the middle, rather than cut at the eyes.
 */
const HEAD_CROP_FULL_WIDTH_ASPECT = 1.03;
/** How much of the crop's height is left above the top of the cut (the crown), so the edge shows over the head. */
const HEAD_CROP_HEADROOM = 0.04;
/** The part of the cut, from its top, whose points say where the head is across. */
const HEAD_BAND = 0.3;

/**
 * Spike: the crop of a tile of aspect `aspect` (width / height) on the head of `shape`: `HEAD_CROP_WIDTH` of the photo's width (or, for a tile wider than
 * `HEAD_CROP_FULL_WIDTH_ASPECT`, as much height as that, and the width its aspect asks for, which is past the photo's), centred across on the points of the
 * cut's top `HEAD_BAND` (the head, not the shoulders), its top a little above the cut's, kept inside the photo (across, a crop wider than the photo is kept
 * round it instead).
 */
export function headCrop(shape: TreatmentShape, aspect: number): PhotoCrop {
  const [w, h] = shape.size;
  const ys = shape.points.map(([, y]) => y);
  const top = Math.min(...ys);
  const span = Math.max(...ys) - top;
  const head = shape.points.filter(([, y]) => y <= top + span * HEAD_BAND).map(([x]) => x);
  const centre = ((Math.min(...head) + Math.max(...head)) / 2) * w;
  const ch = Math.min(h, (HEAD_CROP_WIDTH * w) / Math.min(aspect, HEAD_CROP_FULL_WIDTH_ASPECT));
  const cw = ch * aspect;
  const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, Math.min(a, b)), Math.max(a, b));
  // Across, the crop stays inside the photo, or, when it is wider than the photo, has the whole photo inside it.
  return { x: clamp(centre - cw / 2, 0, w - cw), y: clamp(top * h - HEAD_CROP_HEADROOM * ch, 0, h - ch), w: cw, h: ch };
}
