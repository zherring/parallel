/**
 * Spike (zherring/spike-portraits): "cut-paper" polygons around TMDB portraits, for the /dev/portraits contact sheet only.
 * portrait-cuts.json is written by `npm run portraits:cut` (scripts/portraits/cut.ts); nothing in the real pages reads it.
 */

/** The artists on the contact sheet, each picked to stress the cut (see the spike's report). */
export const PORTRAIT_IDS: readonly number[] = [
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
  // The grid page's 20 more, all from pairs in pair-descriptions.ts, picked for a spread of roles, eras, genders and photo styles.
  6598, // Katharine Hepburn: classic-era actress
  16757, // Sophia Loren: Italian actress, big hair
  10205, // Sigourney Weaver: actress, 1980s-on
  7570, // Lauren Bacall: classic-era actress
  139, // Uma Thurman: actress, 1990s-on
  9340, // Lana Wachowski: director
  9248, // Nora Ephron: writer-director
  6648, // Ingmar Bergman: Swedish director, mid-century
  4415, // Federico Fellini: Italian director, mid-century
  92784, // Barry Jenkins: director, contemporary
  10099, // Park Chan-wook: Korean director
  309, // Pedro Almodóvar: Spanish director, white hair
  5292, // Denzel Washington: actor
  20738, // Song Kang-ho: Korean actor
  5676, // Marcello Mastroianni: Italian actor, mid-century
  4110, // Humphrey Bogart: classic-era actor
  9309, // Richard Pryor: comedian-actor, 1970s-80s
  1337, // Tony Leung Chiu-wai: Hong Kong actor
  8500, // John Ford: silent-era-onward director, eyepatch and hat
  10828, // Guillermo del Toro: Mexican director, beard and glasses
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
