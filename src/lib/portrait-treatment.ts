/**
 * Spike (zherring/spike-portraits): what the cut-paper treatment needs that both the app's `TreatedPortrait` and the preview cards (`og-portrait.ts`)
 * use, with nothing of the browser in it: the shape (a cut, else a tear), the montage's posters, the duotone, and the cookie the flag sets for the cards.
 */

import cuts from "@/lib/portrait-cuts.json";
import testset from "@/lib/portrait-testset.json";
import type { CutPoint, PortraitCuts } from "@/lib/portrait-cuts";
import { TEAR_SIZE, tearFor, type PortraitTestArtist } from "@/lib/portrait-tears";
import type { Film } from "@/lib/types";

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
  /** Set for a tear (the fallback for a person with no cut): a tile draws it edge to edge (`tileView`), not as the head of a cut. */
  tear?: true;
}

/** How many posters the montage takes (its 3 x 3 cells). */
export const MONTAGE_POSTERS = 9;

/**
 * The posters of the person's best-known films, for the montage behind a tear (a cut carries its own, `PortraitCut.posters`, from the same rule): the
 * films with a poster, most-voted first (the film's id breaks a tie, so the pick is the same on every render), `count` of them.
 */
export function montagePosters(films: readonly Pick<Film, "id" | "posterPath" | "voteCount">[], count: number = MONTAGE_POSTERS): string[] {
  return films
    .filter((film) => film.posterPath)
    .sort((a, b) => b.voteCount - a.voteCount || a.id - b.id)
    .slice(0, count)
    .map((film) => film.posterPath!);
}

/**
 * The polygon, its viewBox and the montage's posters: the person's cut when it was made from this photo, else their tear (`tearFor`). A tear's montage is
 * of the person's own films (`filmPosters`, `montagePosters`), else, for a person in the cut file or the test set, the posters they carry; with none, flat.
 */
export function treatmentShape(personId: number, profilePath: string, filmPosters: readonly string[] = []): TreatmentShape {
  const cut = CUTS[String(personId)];
  if (cut && cut.profilePath === profilePath) return { points: cut.variants["20"], size: cut.size, posters: cut.posters };
  const posters = filmPosters.length > 0 ? [...filmPosters] : (cut?.posters ?? TEST_POSTERS.get(personId) ?? []);
  return { points: tearFor(personId), size: TEAR_SIZE, posters, tear: true };
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

/**
 * The widest share of a tile's height a tear's strip takes (its torn edges' extremes, tilt included), so the montage shows above and below it: a strip
 * of the photo's own thickness fills a group's short tile and loses its torn edges to the tile's.
 */
const TEAR_TILE_MAX_SHARE = 0.84;

/** The steps of the tear's tilt a tile tries, from all of it down to none, before it squeezes the strip. */
const TEAR_TILT_STEPS = [1, 0.75, 0.5, 0.25, 0] as const;

/** What a tile draws of a person: the shape (a tear's strip fitted to the tile, see `tileView`) and the box of the photo it shows. */
export interface TileView {
  shape: TreatmentShape;
  crop: PhotoCrop;
}

/**
 * Spike: what a tile of aspect `aspect` (width / height) draws of `shape`. A cut shows the head (`headCrop`). A tear is the strip across the whole tile:
 * the photo's width fills the tile (a tile narrower than the photo is cropped across instead), the strip's middle (the eyes to the mouth, where the
 * tear's band is) on the tile's middle, so the strip runs edge to edge, centred, with the montage above and below it. A short tile (a group's) cannot
 * take the strip's thickness and its tilt: the tilt is eased (down to none) until the torn edges' extremes fit `TEAR_TILE_MAX_SHARE` of the tile's
 * height, and the strip is squeezed about its middle only if they still do not.
 */
export function tileView(shape: TreatmentShape, aspect: number): TileView {
  if (!shape.tear) return { shape, crop: headCrop(shape, aspect) };
  const [w, h] = shape.size;
  const cw = Math.min(w, h * aspect);
  const ch = cw / aspect;
  const room = TEAR_TILE_MAX_SHARE * (ch / h);

  // The tilt: the least-squares slope of the points' y over x, which the steps below take out of them a share at a time.
  const n = shape.points.length;
  const meanX = shape.points.reduce((sum, [x]) => sum + x, 0) / n;
  const meanY = shape.points.reduce((sum, [, y]) => sum + y, 0) / n;
  const slope = shape.points.reduce((sum, [x, y]) => sum + (x - meanX) * (y - meanY), 0) / shape.points.reduce((sum, [x]) => sum + (x - meanX) ** 2, 0);
  const eased = (keep: number) => shape.points.map(([x, y]): CutPoint => [x, y - (1 - keep) * slope * (x - 0.5)]);
  const extent = (points: readonly CutPoint[]) => {
    const ys = points.map(([, y]) => y);
    return Math.max(...ys) - Math.min(...ys);
  };
  const keep = TEAR_TILT_STEPS.find((step) => extent(eased(step)) <= room) ?? 0;
  const flat = eased(keep);

  const ys = flat.map(([, y]) => y);
  const middle = (Math.min(...ys) + Math.max(...ys)) / 2;
  const squeeze = Math.min(1, room / extent(flat));
  const points = flat.map(([x, y]): CutPoint => [x, Math.round((middle + (y - middle) * squeeze) * 1e4) / 1e4]);
  return { shape: { ...shape, points }, crop: { x: (w - cw) / 2, y: middle * h - ch / 2, w: cw, h: ch } };
}
