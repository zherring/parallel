/**
 * Pure geometry for the timeline: one shared time axis, every film as a node on its
 * lane's line, collision packing of poster cards into sub-rows (capped, with the rest left
 * as nodes), continuous node-to-node connector lines between lanes, and zoom/scroll math.
 *
 * Two layouts share this geometry. In "strip" mode (2+ lanes and at least one film shared
 * by all of them) the shared films get one lit poster each in a strip between the first
 * two lanes and only a green node on each lane's line; every other film keeps its poster
 * in its own lane. In "plain" mode (a single person, or nothing shared by all) there is no
 * strip: every lane is just its posters.
 *
 * Nothing here touches the DOM. Every pixel the UI draws (node and card positions, lane
 * heights, connector endpoints) is derived from these functions, so a film shared by
 * two lanes lands at the identical x in both and the SVG overlay lines up without
 * measuring anything.
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
/** Space above and below the poster rows of the shared-films strip. */
export const STRIP_PAD = 14;
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
  /** No poster card (over the row cap, or the poster is in the shared strip): only a node on the lane line. */
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
  /** Films placed first, so they claim the lowest rows, and exempt from `maxRows`. */
  priorityIds?: ReadonlySet<number>;
  /**
   * Also exempt from `maxRows`, but placed with everything else: a film shown in several
   * lanes always keeps its card, which is where its connector line skips past.
   */
  exemptIds?: ReadonlySet<number>;
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
   * (and is not that line's own film) is placed after the others of its tier, so it keeps
   * its card whenever a row is still free and only gives way when the rows are taken.
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
  const { cardWidth = CARD_WIDTH, gap = CARD_GAP, pad = TRACK_PAD, priorityIds, exemptIds, obstacles = [] } = options;
  const maxRows = Math.max(1, options.maxRows ?? Number.POSITIVE_INFINITY);
  const capped = Number.isFinite(maxRows);
  const minDistance = cardWidth + gap;
  const scale = { pxPerYear: options.pxPerYear, axisStartYear: options.axisStartYear, pad };

  const placed = films
    .map((film) => ({ film, x: xForDate(scale, film.releaseDate) }))
    .sort((a, b) => a.x - b.x || a.film.id - b.film.id);

  const tier = (id: number) => (priorityIds?.has(id) ? 0 : exemptIds?.has(id) && capped ? 1 : 2);
  const crossed = (p: { film: F; x: number }) => (tier(p.film.id) === 2 && isCrossed(p.film.id, p.x, obstacles, cardWidth) ? 1 : 0);
  const order = capped
    ? [...placed].sort(
        (a, b) =>
          tier(a.film.id) - tier(b.film.id) ||
          crossed(a) - crossed(b) ||
          (b.film.voteCount ?? 0) - (a.film.voteCount ?? 0) ||
          a.x - b.x ||
          a.film.id - b.film.id,
      )
    : [...placed.filter((p) => tier(p.film.id) === 0), ...placed.filter((p) => tier(p.film.id) !== 0)];

  const rows: number[][] = [];
  const rowOf = new Map<number, number>();
  for (const { film, x } of order) {
    const limit = tier(film.id) < 2 ? Number.POSITIVE_INFINITY : maxRows;
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

/**
 * How many films of a packed lane have no poster card, leaving out `exceptIds`: the films
 * whose poster is in the shared strip, which are not "missing" a card.
 */
export function overflowCount(
  packed: readonly { film?: { id: number }; overflow?: boolean }[],
  exceptIds?: ReadonlySet<number>,
): number {
  return packed.reduce((n, p) => (p.overflow && !(p.film && exceptIds?.has(p.film.id)) ? n + 1 : n), 0);
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

/**
 * Films as nodes on the lane line, with no poster card: x from the release date, ordered by
 * x then id. They are all `overflow` (no card, in packing terms), so `rowCount` and the
 * connectors treat them like any other card-less film.
 */
export function placeNodes<F extends PackableFilm>(
  films: readonly F[],
  options: Pick<PackOptions, "pxPerYear" | "axisStartYear" | "pad">,
): PackedFilm<F>[] {
  const scale = { pxPerYear: options.pxPerYear, axisStartYear: options.axisStartYear, pad: options.pad ?? TRACK_PAD };
  return films
    .map((film) => ({ film, x: xForDate(scale, film.releaseDate), row: OVERFLOW_ROW, overflow: true }))
    .sort((a, b) => a.x - b.x || a.film.id - b.film.id);
}

/**
 * One lane of the strip layout: its films packed into poster rows, except `sharedIds` (their
 * posters are in the strip), which are only nodes. Every film comes back, in x then id order.
 */
export function packLane<F extends PackableFilm>(
  films: readonly F[],
  sharedIds: ReadonlySet<number>,
  options: PackOptions,
): PackedFilm<F>[] {
  if (sharedIds.size === 0) return packFilms(films, options);
  const posters = packFilms(
    films.filter((film) => !sharedIds.has(film.id)),
    options,
  );
  const nodes = placeNodes(
    films.filter((film) => sharedIds.has(film.id)),
    options,
  );
  return [...posters, ...nodes].sort((a, b) => a.x - b.x || a.film.id - b.film.id);
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

// ---- Layout mode -----------------------------------------------------------

/**
 * "strip": the films shared by all lanes get posters once, in a strip between the first two
 * lanes, and only a node in the lanes. "plain": no strip, every lane keeps its own posters.
 */
export type LayoutMode = "strip" | "plain";

/** Ids from `candidateIds` (the films shared by every person) that every lane actually shows, ascending. */
export function filmsInEveryLane(
  lanes: readonly { films: readonly { id: number }[] }[],
  candidateIds: ReadonlySet<number>,
): number[] {
  if (lanes.length < 2) return [];
  const [first, ...rest] = lanes.map((lane) => new Set(lane.films.map((film) => film.id)));
  return [...first].filter((id) => candidateIds.has(id) && rest.every((ids) => ids.has(id))).sort((a, b) => a - b);
}

/** "strip" with 2+ lanes and at least one film every lane shows; otherwise "plain". */
export function layoutMode(
  lanes: readonly { films: readonly { id: number }[] }[],
  candidateIds: ReadonlySet<number>,
): LayoutMode {
  return filmsInEveryLane(lanes, candidateIds).length > 0 ? "strip" : "plain";
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

/** Height of the shared-films strip: padding above and below `rows` rows of poster cards. */
export function stripHeight(rows: number): number {
  const n = Math.max(1, rows);
  return STRIP_PAD * 2 + n * CARD_HEIGHT + (n - 1) * ROW_GAP;
}

/** y of a strip poster's top edge, from the top of the strip. */
export function stripCardTop(row: number): number {
  return STRIP_PAD + row * (CARD_HEIGHT + ROW_GAP);
}

export interface StripStack {
  /** One box per lane, each as tall as its poster rows need, with the strip's height inserted after the first. */
  lanes: LaneBox[];
  /** The shared-films strip, between the first and second lane. */
  strip: LaneBox;
}

/**
 * Lanes of the strip layout, top to bottom from y = 0: the strip of shared posters sits under
 * the first lane (so, with two lanes, exactly between them); further lanes follow directly.
 * Needs at least one lane.
 */
export function stackStripLanes(rowCounts: number[], stripRows: number): StripStack {
  const plain = stackLanes(rowCounts);
  const strip = { top: plain[0].top + plain[0].height, height: stripHeight(stripRows) };
  const lanes = plain.map((box, index) => (index === 0 ? box : { top: box.top + strip.height, height: box.height }));
  return { lanes, strip };
}

// ---- Connectors ------------------------------------------------------------

export interface ConnectorLane {
  box: LaneBox;
  /** The lane's films: `overflow` ones are nodes only, the rest also have a poster card in `row`. */
  items: readonly { film: { id: number }; x: number; row: number; overflow?: boolean }[];
}

/** The posters of the shared strip: the strip's box and each film's row in it. */
export interface ConnectorStrip {
  box: LaneBox;
  rows: ReadonlyMap<number, number>;
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
  /**
   * y ranges between y1 and y2 where the film's own poster card sits, in the shared strip or
   * in a lane above the last one that shows it. The line enters the card from above and leaves
   * below it, so it is not drawn across the card; see `connectorSegments`.
   */
  gaps: { y1: number; y2: number }[];
}

/** For each film id, the indexes (ascending) of the lanes that show it as a node (every film is one). */
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
 * The line skips the film's own poster wherever it would run through it: the poster in the
 * shared `strip`, and a lane's own card in every lane but the last (that card hangs below the
 * lane's node, in the line's way). It is drawn over every other poster it meets.
 */
export function buildConnectors(lanes: readonly ConnectorLane[], strip?: ConnectorStrip): Connector[] {
  const connectors: Connector[] = [];

  for (const [filmId, laneIndexes] of filmMembership(lanes)) {
    if (laneIndexes.length < 2) continue;
    const fromLane = laneIndexes[0];
    const toLane = laneIndexes[laneIndexes.length - 1];
    const x = lanes[fromLane].items.find((item) => item.film.id === filmId)!.x;

    const gaps: Connector["gaps"] = [];
    const stripRow = strip?.rows.get(filmId);
    if (strip && stripRow !== undefined) {
      const top = strip.box.top + stripCardTop(stripRow);
      gaps.push({ y1: top, y2: top + CARD_HEIGHT });
    }
    for (const index of laneIndexes.slice(0, -1)) {
      const item = lanes[index].items.find((it) => it.film.id === filmId)!;
      if (item.overflow) continue;
      const top = lanes[index].box.top + cardTopInLane(item.row);
      gaps.push({ y1: top, y2: top + CARD_HEIGHT });
    }

    connectors.push({
      filmId,
      x,
      y1: lanes[fromLane].box.top + LINE_Y,
      y2: lanes[toLane].box.top + LINE_Y,
      fromLane,
      toLane,
      lanes: laneIndexes,
      kind: laneIndexes.length === lanes.length ? "all" : "some",
      slot: connectionSlot(laneIndexes, lanes.length),
      gaps,
    });
  }

  return connectors.sort((a, b) => a.x - b.x || a.filmId - b.filmId);
}

/** The pieces of a connector that are drawn: its full length minus the ranges behind the film's own poster. */
export function connectorSegments(connector: Pick<Connector, "y1" | "y2" | "gaps">): { y1: number; y2: number }[] {
  const segments: { y1: number; y2: number }[] = [];
  let from = connector.y1;
  for (const gap of [...connector.gaps].sort((a, b) => a.y1 - b.y1)) {
    if (gap.y1 > from) segments.push({ y1: from, y2: Math.min(gap.y1, connector.y2) });
    from = Math.max(from, gap.y2);
  }
  if (from < connector.y2) segments.push({ y1: from, y2: connector.y2 });
  return segments;
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
