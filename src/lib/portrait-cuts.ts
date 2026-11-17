/**
 * "Cut-paper" polygons around TMDB portraits: what the app's portraits (`TreatedPortrait`) and the preview cards (`og-portrait.ts`) are cut along, and what the
 * /dev/portraits labs show. portrait-cuts.json is written by `npm run portraits:cut` (scripts/portraits/cut.ts).
 */

import { EXAMPLE_PAIRINGS } from "@/lib/examples";

/**
 * The spike's first artists, each picked to stress the cut (see the spike's report). The contact sheet now shows every artist; this list
 * still sets the head of `PORTRAIT_IDS`, i.e. the order of the cut script's file, the grid and the contact sheet.
 */
export const CONTACT_SHEET_IDS: readonly number[] = [
  1032, // Martin Scorsese: glasses, dark background (required)
  5026, // Akira Kurosawa: hat and dark glasses, black-and-white, busy striped shirt
  4385, // Sergio Leone: big beard, glasses, black-and-white, light background
  510, // Tim Burton: wild hair against a dark background
  3460, // Gene Wilder: wild hair, black-and-white, light background
  280, // Terry Gilliam: beard, busy saturated yellow/blue background
  1231, // Julianne Moore: long hair, light background
  1146, // Julie Delpy: long blonde hair, dark busy background
  643, // Gong Li: long hair, bare shoulders, busy event background
  12453, // Wong Kar-wai: sunglasses, angled, light background
  2636, // Alfred Hitchcock: profile, black-and-white
  7450, // Toshirō Mifune: tight face-only crop, black-and-white, light background
];

/**
 * Every artist `npm run portraits:cut` cuts and the grid shows: Scorsese first (required), then every person in the curated pairs
 * (`EXAMPLE_PAIRINGS`, the superset of the pairs with a description), in the order they appear there, so a new pair is picked up on the next run.
 */
export const PORTRAIT_IDS: readonly number[] = [
  ...new Set([1032, ...CONTACT_SHEET_IDS, ...EXAMPLE_PAIRINGS.flatMap((pairing) => pairing.people.map((person) => person.id))]),
];

export const VERTEX_COUNTS = ["12", "20", "32"] as const;
export type VertexCount = (typeof VERTEX_COUNTS)[number];

/** A point normalized to 0-1 of the image; 0 and 1 exactly mean "on the frame's edge". */
export type CutPoint = [x: number, y: number];

export interface PortraitCut {
  name: string;
  /** TMDB's profile_path the points were computed from: a changed photo means the entry is stale. */
  profilePath: string;
  /** The segmentation model that ran (birefnet-portrait, or the isnet-general-use fallback). */
  model: string;
  /** Pixel size of the w500 image the points were computed on. */
  size: [w: number, h: number];
  /** Share of the frame the raw mask covers, a rough failure signal. */
  coverage: number;
  /** Set when birefnet-portrait's mask fell under 5% and the isnet-general-use fallback's result was kept as is (the owner likes the look). */
  flagged?: true;
  flagReason?: string;
  variants: Record<VertexCount, CutPoint[]>;
  /** Poster paths of the artist's most-voted films, for the montage background. */
  posters: string[];
}

export type PortraitCuts = Record<string, PortraitCut>;

/**
 * The cut edge's width: proportional on small portraits, capped on large ones, i.e. min(`STROKE_MAX_PX`, `STROKE_PER_WIDTH` × the portrait's
 * rendered width). The owner's picks in /dev/portraits/stroke: 1.8px at 56, 2.5px at 76 (the pair hero), 3.3px from about 100px up. The hero's
 * ring (gap and band) uses the same width.
 */
export const STROKE_MAX_PX = 3.3;
export const STROKE_PER_WIDTH = 0.033;

/** The rule as a number, for a portrait `width` px wide (the tuner's reference column). */
export function strokeForWidth(width: number): number {
  return Math.round(Math.min(STROKE_MAX_PX, STROKE_PER_WIDTH * width) * 100) / 100;
}

/**
 * The rule as CSS, measured nowhere: `cqw` resolves against the nearest size container (`container-type: inline-size`), which must be the
 * portrait's own box, so 1cqw is 1% of its rendered width.
 */
export const STROKE_CSS = `min(${STROKE_MAX_PX}px, ${Math.round(STROKE_PER_WIDTH * 1e5) / 1e3}cqw)`;

/** The pair hero card's corner radius as a share of its width: the app's 6px (`--bar-radius`) at 150px, scaling with the card. */
export const CARD_RADIUS_RATIO = 6 / 150;

export const CUT_STROKE_WHITE = "#fff";

/**
 * Seven saturated, screen-print-poster colors that sit well together on a near-black page (the dev grid's, the landing page's, and the pair
 * pages'). No green: the app's green means "together" (the films they share, the logo, the hover ring), never one person.
 */
export const PORTRAIT_PALETTE: readonly string[] = ["#E63B2E", "#F2C230", "#2E5EAA", "#F28C28", "#1F9E89", "#E5487D", "#6B4BA1"];

/** A person's palette index: the top bits of a multiplicative (Fibonacci) hash of their TMDB id, so neighbouring ids spread. */
function paletteIndex(personId: number): number {
  return Math.floor(((Math.imul(personId, 0x9e3779b1) >>> 0) / 2 ** 32) * PORTRAIT_PALETTE.length);
}

/**
 * The landing page's colours for a pair, in the order given: each person's own (`paletteIndex`), except that when the two match, the one with
 * the higher id steps to the next entry, so they never share one, whichever order the pair comes in. The hero and the pairing cards both use it.
 */
export function pairPortraitColors(firstId: number, secondId: number): [string, string] {
  const first = paletteIndex(firstId);
  const second = paletteIndex(secondId);
  if (first !== second) return [PORTRAIT_PALETTE[first], PORTRAIT_PALETTE[second]];
  const stepped = PORTRAIT_PALETTE[(first + 1) % PORTRAIT_PALETTE.length];
  return firstId <= secondId ? [PORTRAIT_PALETTE[first], stepped] : [stepped, PORTRAIT_PALETTE[second]];
}

/**
 * The person colours of a page, by slot (the URL order): a pair's `pairPortraitColors`, so the pair page, its embeds and its preview cards match the
 * landing page. Null for one person or three and more, who keep `PERSON_COLORS` and, with them, the app's green for the films made together. From the
 * ids alone, so the server and the hydrating render agree.
 */
export function portraitPersonHexes(personIds: readonly number[]): readonly [string, string] | null {
  return personIds.length === 2 ? pairPortraitColors(personIds[0], personIds[1]) : null;
}

/**
 * Where the cut edge's line sits against the polygon: straddling it (`center`, a plain SVG stroke), all inside the cut-out, or all outside it.
 * The visible line is the rule's width in every mode: inside and outside draw twice the width and hide half of it, inside by clipping the
 * stroke to the polygon, outside by drawing it under the clipped photo (see `CutPortraitImage`).
 */
export const EDGE_POSITIONS = ["inside", "center", "outside"] as const;
export type EdgePosition = (typeof EDGE_POSITIONS)[number];

export function parseEdgePosition(value: string | null | undefined): EdgePosition | null {
  return EDGE_POSITIONS.find((position) => position === value) ?? null;
}

/**
 * The cut edge path's presentation props. The width is set through `style` (an attribute can't hold `min()` or `cqw`) with
 * `vector-effect: non-scaling-stroke`, so it is in screen px whatever the viewBox; `widthPx` overrides the rule (the tuner). The path must sit
 * inside a size container that is the portrait's box (see `STROKE_CSS`). Inside and outside double the stroke, as half of it is hidden. `widthPx` is a number
 * of px, or a CSS length (a card drawn at the frame's scale sets its own: `calc(3.3 * var(--px))`).
 */
export function cutEdgeStroke(strokeColor: string = CUT_STROKE_WHITE, widthPx?: number | string, edgePosition: EdgePosition = "center") {
  const width = widthPx === undefined ? STROKE_CSS : typeof widthPx === "number" ? `${widthPx}px` : widthPx;
  return {
    fill: "none",
    stroke: strokeColor,
    strokeLinejoin: "miter",
    strokeLinecap: "square",
    style: {
      strokeWidth: edgePosition === "center" ? width : `calc(2 * ${width})`,
      vectorEffect: "non-scaling-stroke",
    },
  } as const;
}

/** The polygon's `points` attribute, scaled to a w × h viewBox. */
export function polygonPoints(points: readonly CutPoint[], w: number, h: number): string {
  return points.map(([x, y]) => `${round(x * w)},${round(y * h)}`).join(" ");
}

/**
 * The SVG path for the white cut edge: the polygon's outline without the segments that run along the frame's edge, so the shape reads
 * as bleeding off the frame (at the shoulders) rather than being closed along the bottom.
 */
export function cutEdgePath(points: readonly CutPoint[], w: number, h: number): string {
  const onSameEdge = (a: CutPoint, b: CutPoint) =>
    (a[0] === 0 && b[0] === 0) || (a[0] === 1 && b[0] === 1) || (a[1] === 0 && b[1] === 0) || (a[1] === 1 && b[1] === 1);
  const n = points.length;
  // Start right after an edge segment if there is one, so a run is never split across the array's end.
  const start = points.findIndex((p, i) => onSameEdge(points[(i - 1 + n) % n], p));
  const from = start === -1 ? 0 : start;
  let d = "";
  let open = false;
  for (let k = 0; k <= n; k++) {
    const a = points[(from + k - 1 + n) % n];
    const b = points[(from + k) % n];
    if (k === 0 || onSameEdge(a, b)) {
      open = false;
      if (k === n) break;
      continue;
    }
    if (!open) d += `M${round(a[0] * w)},${round(a[1] * h)}`;
    d += `L${round(b[0] * w)},${round(b[1] * h)}`;
    open = true;
  }
  return start === -1 ? `${d}Z` : d;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
