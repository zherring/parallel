/**
 * Pure geometry for the timeline: one shared time axis, collision packing of poster
 * cards into sub-rows, connector lines between lanes, and zoom/scroll math.
 *
 * Nothing here touches the DOM. Every pixel the UI draws (card positions, lane
 * heights, connector endpoints) is derived from these functions, so a film shared
 * by two lanes lands at the identical x in both and the SVG overlay lines up
 * without measuring anything.
 */

// ---- Dimensions (px) -------------------------------------------------------

export const CARD_WIDTH = 64;
export const POSTER_HEIGHT = 96;
/** Title (2 lines) + year under the poster. */
export const CAPTION_HEIGHT = 44;
export const CARD_HEIGHT = POSTER_HEIGHT + CAPTION_HEIGHT;
export const CARD_GAP = 8;
/** Vertical gap between sub-rows inside a lane. */
export const ROW_GAP = 10;
/** y of the lane's track line, from the top of the lane. */
export const LINE_Y = 14;
/** y of the first row of cards, from the top of the lane. */
export const CARD_TOP = 30;
export const LANE_PAD_BOTTOM = 18;
export const AXIS_HEIGHT = 44;
/** Empty space before the first and after the last year so edge cards are not clipped. */
export const TRACK_PAD = CARD_WIDTH / 2 + CARD_GAP;

// ---- Time ------------------------------------------------------------------

const MS_PER_DAY = 86_400_000;

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * `yyyy-mm-dd` to a fractional year: 1999-01-01 is 1999, 1999-07-02 is about 1999.5.
 * Falls back to mid-year when only the year can be read, and NaN when not even that.
 */
export function yearFraction(isoDate: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!match) {
    const year = Number.parseInt(isoDate.slice(0, 4), 10);
    return Number.isFinite(year) ? year + 0.5 : Number.NaN;
  }
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const dayOfYear = (Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 1)) / MS_PER_DAY;
  return year + dayOfYear / (isLeapYear(year) ? 366 : 365);
}

export interface AxisRange {
  startYear: number;
  endYear: number;
}

/** Earliest year - 1 to latest year + 1. With no films it brackets `fallbackYear`. */
export function axisRange(years: number[], fallbackYear: number): AxisRange {
  const finite = years.filter(Number.isFinite);
  if (finite.length === 0) return { startYear: fallbackYear - 1, endYear: fallbackYear + 1 };
  return { startYear: Math.min(...finite) - 1, endYear: Math.max(...finite) + 1 };
}

export interface Scale {
  pxPerYear: number;
  /** Integer year at the left of the axis. */
  axisStartYear: number;
  /** Integer year at the right of the axis. */
  axisEndYear: number;
  /** Padding inside the track on both sides. */
  pad: number;
}

export function makeScale(range: AxisRange, pxPerYear: number, pad: number = TRACK_PAD): Scale {
  return { pxPerYear, axisStartYear: range.startYear, axisEndYear: range.endYear, pad };
}

/** x of a fractional year inside the track (0 is the track's left edge). */
export function xForYear(scale: Pick<Scale, "pxPerYear" | "axisStartYear" | "pad">, fractionalYear: number): number {
  return scale.pad + (fractionalYear - scale.axisStartYear) * scale.pxPerYear;
}

export function xForDate(scale: Pick<Scale, "pxPerYear" | "axisStartYear" | "pad">, isoDate: string): number {
  return xForYear(scale, yearFraction(isoDate));
}

export function trackWidth(scale: Scale): number {
  return Math.round(scale.pad * 2 + (scale.axisEndYear - scale.axisStartYear) * scale.pxPerYear);
}

export interface AxisTick {
  year: number;
  x: number;
  kind: "decade" | "year";
  /** Text to print at the tick, if any. Decades are always labelled. */
  label: string | null;
}

/** How often plain years get a label at this zoom: every year, every 5, or only decades. */
export function labelStep(pxPerYear: number): 1 | 5 | 10 {
  if (pxPerYear >= 56) return 1;
  if (pxPerYear >= 28) return 5;
  return 10;
}

export function axisTicks(scale: Scale): AxisTick[] {
  const step = labelStep(scale.pxPerYear);
  const ticks: AxisTick[] = [];
  for (let year = scale.axisStartYear; year <= scale.axisEndYear; year++) {
    const decade = year % 10 === 0;
    ticks.push({
      year,
      x: xForYear(scale, year),
      kind: decade ? "decade" : "year",
      label: decade || year % step === 0 ? String(year) : null,
    });
  }
  return ticks;
}

// ---- Packing ---------------------------------------------------------------

export interface PackableFilm {
  id: number;
  releaseDate: string;
}

export interface PackedFilm<F extends PackableFilm = PackableFilm> {
  film: F;
  /** Centre of the card, in track coordinates. */
  x: number;
  row: number;
}

export interface PackOptions {
  pxPerYear: number;
  axisStartYear: number;
  pad?: number;
  cardWidth?: number;
  gap?: number;
  /** Films placed first, so they claim the lowest rows (shared films line up on row 0). */
  priorityIds?: ReadonlySet<number>;
}

/**
 * Places each film at the x of its release date and bumps cards that would overlap
 * (closer than cardWidth + gap) into the lowest free sub-row. Output is ordered by
 * x then id, which is also the sensible tab order.
 */
export function packFilms<F extends PackableFilm>(films: readonly F[], options: PackOptions): PackedFilm<F>[] {
  const { cardWidth = CARD_WIDTH, gap = CARD_GAP, pad = TRACK_PAD, priorityIds } = options;
  const minDistance = cardWidth + gap;
  const scale = { pxPerYear: options.pxPerYear, axisStartYear: options.axisStartYear, pad };

  const placed = films
    .map((film) => ({ film, x: xForDate(scale, film.releaseDate) }))
    .sort((a, b) => a.x - b.x || a.film.id - b.film.id);

  // Priority films go first so they win row 0; the rest follow left to right, which
  // makes the greedy first-fit use the fewest rows possible.
  const order = priorityIds
    ? [...placed.filter((p) => priorityIds.has(p.film.id)), ...placed.filter((p) => !priorityIds.has(p.film.id))]
    : placed;

  const rows: number[][] = [];
  const rowOf = new Map<number, number>();
  for (const { film, x } of order) {
    let row = rows.findIndex((xs) => xs.every((other) => Math.abs(other - x) >= minDistance));
    if (row === -1) {
      row = rows.length;
      rows.push([]);
    }
    rows[row].push(x);
    rowOf.set(film.id, row);
  }

  return placed.map(({ film, x }) => ({ film, x, row: rowOf.get(film.id) ?? 0 }));
}

export function rowCount(packed: readonly { row: number }[]): number {
  return packed.reduce((max, p) => Math.max(max, p.row + 1), 1);
}

// ---- Lane geometry ---------------------------------------------------------

export function laneHeight(rows: number): number {
  const n = Math.max(1, rows);
  return CARD_TOP + n * CARD_HEIGHT + (n - 1) * ROW_GAP + LANE_PAD_BOTTOM;
}

/** y of a card's top edge, from the top of its lane. */
export function cardTopInLane(row: number): number {
  return CARD_TOP + row * (CARD_HEIGHT + ROW_GAP);
}

export interface LaneBox {
  top: number;
  height: number;
}

/** Lanes stacked top to bottom, from y = 0. */
export function stackLanes(rowCounts: number[]): LaneBox[] {
  let top = 0;
  return rowCounts.map((rows) => {
    const box = { top, height: laneHeight(rows) };
    top += box.height;
    return box;
  });
}

export function totalHeight(boxes: LaneBox[]): number {
  const last = boxes[boxes.length - 1];
  return last ? last.top + last.height : 0;
}

// ---- Connectors ------------------------------------------------------------

export interface ConnectorLane {
  box: LaneBox;
  items: readonly { film: { id: number }; x: number; row: number }[];
}

export interface Connector {
  filmId: number;
  x: number;
  y1: number;
  y2: number;
  fromLane: number;
  toLane: number;
  /** "all" when every lane has the film, "some" for a subset (3+ lanes only). */
  kind: "all" | "some";
}

/** For each film id, the indexes (ascending) of the lanes that show it. */
export function filmMembership(lanes: readonly { items: readonly { film: { id: number } }[] }[]): Map<number, number[]> {
  const membership = new Map<number, number[]>();
  lanes.forEach((lane, index) => {
    for (const { film } of lane.items) {
      const list = membership.get(film.id);
      if (list) list.push(index);
      else membership.set(film.id, [index]);
    }
  });
  return membership;
}

/**
 * One vertical segment per shared film per pair of neighbouring lanes that show it:
 * from the bottom of the upper lane's card down to the top of the lower lane's card.
 * Coordinates are relative to the top of the first lane.
 */
export function buildConnectors(lanes: readonly ConnectorLane[]): Connector[] {
  const connectors: Connector[] = [];
  const membership = filmMembership(lanes);

  for (const [filmId, laneIndexes] of membership) {
    if (laneIndexes.length < 2) continue;
    const kind = laneIndexes.length === lanes.length ? "all" : "some";
    for (let i = 0; i < laneIndexes.length - 1; i++) {
      const fromLane = laneIndexes[i];
      const toLane = laneIndexes[i + 1];
      const from = lanes[fromLane].items.find((item) => item.film.id === filmId);
      const to = lanes[toLane].items.find((item) => item.film.id === filmId);
      if (!from || !to) continue;
      connectors.push({
        filmId,
        x: from.x,
        y1: lanes[fromLane].box.top + cardTopInLane(from.row) + CARD_HEIGHT,
        y2: lanes[toLane].box.top + cardTopInLane(to.row),
        fromLane,
        toLane,
        kind,
      });
    }
  }

  return connectors.sort((a, b) => a.x - b.x || a.filmId - b.filmId || a.fromLane - b.fromLane);
}

// ---- Zoom and scroll -------------------------------------------------------

export const ZOOM_STEPS = [24, 32, 40, 56, 72, 96, 128, 160, 200] as const;
export const DEFAULT_ZOOM = 72;
export const MIN_ZOOM = ZOOM_STEPS[0];
export const MAX_ZOOM = ZOOM_STEPS[ZOOM_STEPS.length - 1];

/** The next zoom step in the given direction; stays put at either end. */
export function nextZoom(current: number, direction: "in" | "out"): number {
  if (direction === "in") return ZOOM_STEPS.find((step) => step > current) ?? MAX_ZOOM;
  return [...ZOOM_STEPS].reverse().find((step) => step < current) ?? MIN_ZOOM;
}

/** Fractional year under the centre of the visible track area. */
export function centerYear(scrollLeft: number, viewportTrackWidth: number, scale: Scale): number {
  const trackX = scrollLeft + viewportTrackWidth / 2;
  return scale.axisStartYear + (trackX - scale.pad) / scale.pxPerYear;
}

/** Inverse of `centerYear`: the scrollLeft that puts `year` at the centre. May be negative or past the end; the browser clamps it. */
export function scrollLeftForCenter(year: number, viewportTrackWidth: number, scale: Scale): number {
  return xForYear(scale, year) - viewportTrackWidth / 2;
}

/**
 * Where the view should start: the earliest film shared by every lane; failing that
 * (2+ lanes), the point where the latest-starting lane begins, so every lane has
 * something in view; with a single lane, nothing (start at the beginning).
 * Lanes must be ordered by x, as `packFilms` returns them.
 */
export function initialAnchorX(
  lanes: readonly (readonly { film: { id: number }; x: number }[])[],
  sharedIds: ReadonlySet<number>,
): number | null {
  if (lanes.length < 2) return null;
  const shared = lanes[0].find((item) => sharedIds.has(item.film.id));
  if (shared) return shared.x;
  const starts = lanes.filter((items) => items.length > 0).map((items) => items[0].x);
  return starts.length > 0 ? Math.max(...starts) : null;
}

/** Puts the anchor (see `initialAnchorX`) about a quarter of the way into the visible track area. */
export function initialScrollLeft(anchorX: number | null, viewportTrackWidth: number): number {
  if (anchorX === null) return 0;
  const margin = Math.min(viewportTrackWidth * 0.25, 240);
  return Math.max(0, Math.round(anchorX - margin));
}
