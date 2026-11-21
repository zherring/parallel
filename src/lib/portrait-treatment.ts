/**
 * What the cut-paper treatment needs that both the app's `TreatedPortrait` and the preview cards (`og-portrait.ts`) use, with nothing of the browser in it:
 * the shape (a cut, else a tear), the montage's posters and the duotone.
 */

import cuts from "@/lib/portrait-cuts.json";
import testset from "@/lib/portrait-testset.json";
import type { CutPoint, PortraitCuts } from "@/lib/portrait-cuts";
import { TEAR_SIZE, tearFor, type PortraitTestArtist } from "@/lib/portrait-tears";
import type { Film } from "@/lib/types";

const CUTS = cuts as unknown as PortraitCuts;
/** The test set's posters (`npm run portraits:testset`), so a test artist's tear sits on their own montage. */
const TEST_POSTERS = new Map((testset as PortraitTestArtist[]).map((artist) => [artist.id, artist.posters]));

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
 * The widest tile (width / height) that shows the head whole: a little wider than a pair's tile (320 x 315 on the share cards). A wider (shorter) tile, a
 * group of three or four's, is cropped tight instead (`FACE_DROP`): the photo's width across, as a tear's strip has it, so the face reads as large as
 * the tears' faces do, and the top of the head and the shoulders are cut by the tile's edges.
 */
const HEAD_CROP_FULL_WIDTH_ASPECT = 1.03;
/** How much of the crop's height is left above the top of the cut (the crown), so the edge shows over the head. */
const HEAD_CROP_HEADROOM = 0.04;
/** The part of the cut, from its top, whose points say where the head is across. */
const HEAD_BAND = 0.3;
/**
 * How far below the top of the cut the middle of the face (from the eyes to the mouth) is, as a multiple of the head's width (the cut's points in
 * `HEAD_BAND`, hair and ears included). Not a measure of the face (the cuts carry none), a rule fitted by eye to the whole cut set: the face sits in
 * the middle of a short tile, the eyes in its upper half and the mouth in its lower.
 */
const FACE_DROP = 0.85;

/**
 * How far below the top of the cut the eyes are, as a multiple of the head's width: a little above the middle of the face (`FACE_DROP`, eyes to mouth). Fitted by eye
 * on the landing hero's tablet widths, where the figures are stood so that their eyes are on a line down the stage (`eyeLine`).
 */
const EYE_DROP = 0.65;

/**
 * Where the head of the cut `shape` is in its photo: its top (a share of the photo's height) and, across, its middle and its width (shares of the photo's width), by
 * the points of the cut's top `HEAD_BAND` (hair and ears included, as `headCrop` has it).
 */
export function headSpan(shape: TreatmentShape): { top: number; centre: number; width: number } {
  const ys = shape.points.map(([, y]) => y);
  const top = Math.min(...ys);
  const span = Math.max(...ys) - top;
  const head = shape.points.filter(([, y]) => y <= top + span * HEAD_BAND).map(([x]) => x);
  const left = Math.min(...head);
  const right = Math.max(...head);
  return { top, centre: (left + right) / 2, width: right - left };
}

/**
 * Where the eyes of the cut `shape` are, as a share (0 to 1) of the photo's height from its top: the head's top, plus `EYE_DROP` head-widths (the head, by the points of the
 * cut's top `HEAD_BAND`, as `headCrop` has it). Not a measure (the cuts carry no face), a rule: it lets the hero stand figures of any headroom with their eyes at one height.
 */
export function eyeLine(shape: TreatmentShape): number {
  const [w, h] = shape.size;
  const head = headSpan(shape);
  return head.top + EYE_DROP * head.width * (w / h);
}

/**
 * The crop of a tile of aspect `aspect` (width / height) on the head of `shape`, centred across on the points of the cut's top `HEAD_BAND` (the head,
 * not the shoulders), kept inside the photo. A tile no wider than `HEAD_CROP_FULL_WIDTH_ASPECT` takes `HEAD_CROP_WIDTH` of the photo's width, its top a
 * little above the cut's. A wider tile is cropped tight: the photo's whole width, whatever it is, and so a height of only the tile's shape, which is
 * centred down on the middle of the face (`FACE_DROP`): the crown and the chin are cut by the tile where they do not fit.
 */
export function headCrop(shape: TreatmentShape, aspect: number): PhotoCrop {
  const [w, h] = shape.size;
  const ys = shape.points.map(([, y]) => y);
  const top = Math.min(...ys);
  const span = Math.max(...ys) - top;
  const head = shape.points.filter(([, y]) => y <= top + span * HEAD_BAND).map(([x]) => x);
  const centre = ((Math.min(...head) + Math.max(...head)) / 2) * w;
  const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, Math.min(a, b)), Math.max(a, b));
  if (aspect > HEAD_CROP_FULL_WIDTH_ASPECT) {
    const cw = HEAD_CROP_WIDTH * w;
    const ch = cw / aspect;
    const face = top * h + FACE_DROP * (Math.max(...head) - Math.min(...head)) * w;
    return { x: clamp(centre - cw / 2, 0, w - cw), y: clamp(face - ch / 2, 0, h - ch), w: cw, h: ch };
  }
  const ch = Math.min(h, (HEAD_CROP_WIDTH * w) / aspect);
  const cw = ch * aspect;
  // Across, the crop stays inside the photo.
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
 * What a tile of aspect `aspect` (width / height) draws of `shape`. A cut shows the head (`headCrop`). A tear is the strip across the whole tile:
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
