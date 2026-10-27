/**
 * Pure geometry for the timeline: one shared time axis, every film as a node on its
 * lane's line, collision packing of poster cards into sub-rows (capped, with the rest left
 * as nodes), continuous node-to-node connector lines between lanes, and zoom/scroll math.
 *
 * A film shown in several lanes has its own poster card in each of them, at the same x,
 * packed first so it keeps a card (and the lowest row it can have) in every lane that has
 * it; one connector line joins its nodes, from the first lane's node down to the last's.
 *
 * Nothing here touches the DOM. Every pixel the UI draws (node and card positions, lane
 * heights, connector endpoints) is derived from these functions, so a film shared by
 * two lanes lands at the identical x in both and the SVG overlay lines up without
 * measuring anything. Lanes are stacked from y = 0; the year axis is a row under the last
 * lane (AXIS_HEIGHT tall), so nothing here is offset by it.
 */

import { connectionSlot } from "@/lib/connections";

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
/** Height of the year axis row under the lanes. */
export const AXIS_HEIGHT = 44;
/** Empty space before the first and after the last year so edge cards are not clipped. */
export const TRACK_PAD = CARD_WIDTH / 2 + CARD_GAP;
/** Rows of poster cards a lane shows before the rest are left as nodes. */
export const DEFAULT_MAX_ROWS = 2;
/** Widest hit area of the invisible button around a node. */
export const DOT_HIT_SIZE = 24;
/** Narrowest hit area a node is squeezed to when its neighbours are close. */
export const DOT_HIT_MIN = 8;
/** Height of a node's hit area, centred on the line; it ends above the first row of cards (CARD_TOP). */
export const NODE_HIT_HEIGHT = 28;
/** How far past a card's edge a vertical line still counts as running over the card (half its halo). */
export const LINE_HALO = 1;
/** Radii of the nodes on a lane line: a film of one lane, a film shared by some lanes, a film shared by all. */
export const NODE_RADIUS = { plain: 3, some: 4.5, lit: 6 } as const;

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
  /** TMDB vote_count; with a row cap, the most voted films get the poster cards. */
  voteCount?: number;
}

/** `row` of a film that did not get a poster card. */
export const OVERFLOW_ROW = -1;

export interface PackedFilm<F extends PackableFilm = PackableFilm> {
  film: F;
  /** Centre of the card (or node), in track coordinates. */
  x: number;
  /** Sub-row of the poster card, or OVERFLOW_ROW. */
  row: number;
  /** No poster card (over the row cap): only a node on the lane line. */
  overflow: boolean;
}

/** A vertical connector line that runs through a lane's poster rows: the film it belongs to, and its x. */
export interface Obstacle {
  filmId: number;
  x: number;
}

export interface PackOptions {
  pxPerYear: number;
  axisStartYear: number;
  pad?: number;
  cardWidth?: number;
  gap?: number;
  /**
   * Films placed first, so they claim the lowest rows, and exempt from `maxRows`: the films
   * shown in several lanes (see `sharedAcrossLanes`), which always keep a card in each.
   */
  priorityIds?: ReadonlySet<number>;
  /**
   * Rows of poster cards to allow (default: unlimited). Films are then placed by
   * priority, vote count (high first) and date, each into the lowest row it fits;
   * a film that fits none of the first `maxRows` rows is overflow.
   */
  maxRows?: number;
  /**
   * Soft obstacles: connector lines that run through every row of this lane. A line crosses
   * all the rows at its x, so no row can avoid it; what can be avoided is a card under a
   * line winning a contested slot. With a row cap, a film whose card would sit on a line
   * (and is not that line's own film) is placed after the other films that are not priority,
   * so it keeps its card whenever a row is still free and only gives way when the rows are taken.
   */
  obstacles?: readonly Obstacle[];
}

/** Whether a card centred at `x` for `filmId` has the connector line of another film running over it. */
export function isCrossed(filmId: number, x: number, obstacles: readonly Obstacle[], cardWidth: number = CARD_WIDTH): boolean {
  return obstacles.some((o) => o.filmId !== filmId && Math.abs(o.x - x) < cardWidth / 2 + LINE_HALO);
}

/**
 * Places each film at the x of its release date and bumps cards that would overlap
 * (closer than cardWidth + gap) into the lowest free sub-row. Output is ordered by
 * x then id, which is also the sensible tab order.
 *
 * Without `maxRows`, films are placed left to right, which makes the greedy first-fit
 * use the fewest rows possible. With it, the most important films are placed first so
 * they are the ones that keep their cards.
 */
export function packFilms<F extends PackableFilm>(films: readonly F[], options: PackOptions): PackedFilm<F>[] {
  const { cardWidth = CARD_WIDTH, gap = CARD_GAP, pad = TRACK_PAD, priorityIds, obstacles = [] } = options;
  const maxRows = Math.max(1, options.maxRows ?? Number.POSITIVE_INFINITY);
  const capped = Number.isFinite(maxRows);
  const minDistance = cardWidth + gap;
  const scale = { pxPerYear: options.pxPerYear, axisStartYear: options.axisStartYear, pad };

  const placed = films
    .map((film) => ({ film, x: xForDate(scale, film.releaseDate) }))
    .sort((a, b) => a.x - b.x || a.film.id - b.film.id);

  const priority = (id: number) => priorityIds?.has(id) === true;
  const crossed = (p: { film: F; x: number }) => (!priority(p.film.id) && isCrossed(p.film.id, p.x, obstacles, cardWidth) ? 1 : 0);
  const order = capped
    ? [...placed].sort(
        (a, b) =>
          Number(!priority(a.film.id)) - Number(!priority(b.film.id)) ||
          crossed(a) - crossed(b) ||
          (b.film.voteCount ?? 0) - (a.film.voteCount ?? 0) ||
          a.x - b.x ||
          a.film.id - b.film.id,
      )
    : [...placed.filter((p) => priority(p.film.id)), ...placed.filter((p) => !priority(p.film.id))];

  const rows: number[][] = [];
  const rowOf = new Map<number, number>();
  for (const { film, x } of order) {
    const limit = priority(film.id) ? Number.POSITIVE_INFINITY : maxRows;
    let row = rows.findIndex((xs, i) => i < limit && xs.every((other) => Math.abs(other - x) >= minDistance));
    if (row === -1 && rows.length < limit) {
      row = rows.length;
      rows.push([]);
    }
    if (row === -1) {
      rowOf.set(film.id, OVERFLOW_ROW);
      continue;
    }
    rows[row].push(x);
    rowOf.set(film.id, row);
  }

  return placed.map(({ film, x }) => {
    const row = rowOf.get(film.id) ?? 0;
    return { film, x, row, overflow: row === OVERFLOW_ROW };
  });
}

/** Rows of poster cards actually used (at least 1); films without a card take no room. */
export function rowCount(packed: readonly { row: number; overflow?: boolean }[]): number {
  return packed.reduce((max, p) => (p.overflow ? max : Math.max(max, p.row + 1)), 1);
}

/** How many films of a packed lane have no poster card: the ones that are only a node on the line. */
export function overflowCount(packed: readonly { overflow?: boolean }[]): number {
  return packed.reduce((n, p) => (p.overflow ? n + 1 : n), 0);
}

/**
 * Hit-area width per node, by film id: DOT_HIT_SIZE, narrowed (down to DOT_HIT_MIN) so that
 * neighbouring nodes on the line never overlap. Every film of a lane has a node, so pass
 * them all, in x order.
 */
export function nodeHitWidths(items: readonly { film: { id: number }; x: number }[]): Map<number, number> {
  const widths = new Map<number, number>();
  items.forEach((item, i) => {
    const before = i > 0 ? item.x - items[i - 1].x : Number.POSITIVE_INFINITY;
    const after = i < items.length - 1 ? items[i + 1].x - item.x : Number.POSITIVE_INFINITY;
    widths.set(item.film.id, Math.max(DOT_HIT_MIN, Math.min(DOT_HIT_SIZE, before, after)));
  });
  return widths;
}

/** Ids of the films that more than one lane shows (what each of those lanes gives a card first). */
export function sharedAcrossLanes(lanes: readonly { films: readonly { id: number }[] }[]): Set<number> {
  const seen = new Set<number>();
  const shared = new Set<number>();
  for (const lane of lanes) {
    for (const id of new Set(lane.films.map((film) => film.id))) {
      if (seen.has(id)) shared.add(id);
      else seen.add(id);
    }
  }
  return shared;
}

/**
 * For each lane, the connector lines that run through its poster rows: those of films shown
 * in two or more lanes, from the first lane that shows them down to, but not including, the
 * last. A line goes from node to node, so the last lane's rows are never crossed.
 */
export function laneObstacles(
  lanes: readonly { films: readonly PackableFilm[] }[],
  options: Pick<PackOptions, "pxPerYear" | "axisStartYear" | "pad">,
): Obstacle[][] {
  const scale = { pxPerYear: options.pxPerYear, axisStartYear: options.axisStartYear, pad: options.pad ?? TRACK_PAD };
  const shownIn = new Map<number, { first: number; last: number; x: number }>();
  lanes.forEach((lane, index) => {
    for (const film of lane.films) {
      const seen = shownIn.get(film.id);
      if (seen) seen.last = index;
      else shownIn.set(film.id, { first: index, last: index, x: xForDate(scale, film.releaseDate) });
    }
  });
  return lanes.map((_, index) =>
    [...shownIn]
      .filter(([, s]) => s.first <= index && index < s.last)
      .map(([filmId, s]) => ({ filmId, x: s.x }))
      .sort((a, b) => a.x - b.x || a.filmId - b.filmId),
  );
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
  /** The lane's films, each a node on the lane's line. */
  items: readonly { film: { id: number }; x: number }[];
}

export interface Connector {
  filmId: number;
  x: number;
  /** y of the node in the first lane that shows the film. */
  y1: number;
  /** y of the node in the last lane that shows the film. */
  y2: number;
  fromLane: number;
  toLane: number;
  /** Every lane that shows the film, ascending (the line passes through the nodes of the ones between). */
  lanes: number[];
  /** "all" when every lane has the film, "some" for a subset (3+ lanes only). */
  kind: "all" | "some";
  /** Palette slot of a "some" connector (see `connectionSlot`); null for "all", which is green. */
  slot: number | null;
}

/** For each film id, the indexes (ascending) of the lanes that show it (every film is a node on its lane's line). */
export function filmMembership(lanes: readonly { items: readonly { film: { id: number } }[] }[]): Map<number, number[]> {
  const membership = new Map<number, number[]>();
  lanes.forEach((lane, index) => {
    for (const { film } of lane.items) {
      const list = membership.get(film.id);
      if (list) {
        if (list[list.length - 1] !== index) list.push(index);
      } else membership.set(film.id, [index]);
    }
  });
  return membership;
}

/**
 * One continuous vertical line per film shown in two or more lanes, from its node in the
 * first of those lanes to its node in the last (so it passes through the nodes of the lanes
 * between). Coordinates are relative to the top of the first lane.
 *
 * Each lane's own poster of the film hangs below its node, in the line's way; the posters of
 * shared films are drawn over the lines, so the line passes behind its own poster (and behind
 * the poster of any other shared film) and shows again below its caption. It is drawn over
 * the posters of films that are not shared.
 */
export function buildConnectors(lanes: readonly ConnectorLane[]): Connector[] {
  const connectors: Connector[] = [];

  for (const [filmId, laneIndexes] of filmMembership(lanes)) {
    if (laneIndexes.length < 2) continue;
    const fromLane = laneIndexes[0];
    const toLane = laneIndexes[laneIndexes.length - 1];

    connectors.push({
      filmId,
      x: lanes[fromLane].items.find((item) => item.film.id === filmId)!.x,
      y1: lanes[fromLane].box.top + LINE_Y,
      y2: lanes[toLane].box.top + LINE_Y,
      fromLane,
      toLane,
      lanes: laneIndexes,
      kind: laneIndexes.length === lanes.length ? "all" : "some",
      slot: connectionSlot(laneIndexes, lanes.length),
    });
  }

  return connectors.sort((a, b) => a.x - b.x || a.filmId - b.filmId);
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
