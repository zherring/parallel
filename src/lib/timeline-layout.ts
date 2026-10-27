/**
 * Pure geometry for the timeline: one shared time axis, every film as a node on its
 * lane's line, collision packing of poster cards into sub-rows, continuous node-to-node
 * connector lines between lanes, and zoom/scroll math.
 *
 * Two layouts share this geometry. In "nodes" mode (2+ lanes and at least one film
 * shared by all of them) lanes are short lines of nodes, and the shared films get one
 * poster each in a strip between the first two lanes. In "posters" mode (a single
 * person, or nothing shared by all) lanes keep their poster cards, capped to a few
 * rows, with the rest as nodes.
 *
 * Nothing here touches the DOM. Every pixel the UI draws (node and card positions, lane
 * heights, connector endpoints) is derived from these functions, so a film shared by
 * two lanes lands at the identical x in both and the SVG overlay lines up without
 * measuring anything.
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
/** y of the lane's track line, from the top of the lane (posters layout). */
export const LINE_Y = 14;
/** y of the first row of cards, from the top of the lane. */
export const CARD_TOP = 30;
export const LANE_PAD_BOTTOM = 18;
export const AXIS_HEIGHT = 44;
/** Empty space before the first and after the last year so edge cards are not clipped. */
export const TRACK_PAD = CARD_WIDTH / 2 + CARD_GAP;
/** Rows of poster cards a lane shows before the rest collapse into dots. */
export const DEFAULT_MAX_ROWS = 2;
/** Height (and widest width) of the invisible hit area around an overflow dot. */
export const DOT_HIT_SIZE = 24;
/** Narrowest hit area an overflow dot is squeezed to when its neighbours are close. */
export const DOT_HIT_MIN = 8;
/** Height of a node's hit area; taller than it is wide because a lane has room above and below the line. */
export const NODE_HIT_HEIGHT = 28;
/** Height of a lane in the nodes layout: the header's avatar, name and a bio button, and the line. */
export const NODE_LANE_HEIGHT = 132;
/** y of the track line in the nodes layout, from the top of the lane. */
export const NODE_LINE_Y = NODE_LANE_HEIGHT / 2;
/** Space above and below the poster rows of the shared-films strip. */
export const STRIP_PAD = 14;
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
  /** Centre of the card (or dot), in track coordinates. */
  x: number;
  /** Sub-row of the poster card, or OVERFLOW_ROW. */
  row: number;
  /** Over the row cap: drawn as a dot on the lane line instead of a poster card. */
  overflow: boolean;
}

export interface PackOptions {
  pxPerYear: number;
  axisStartYear: number;
  pad?: number;
  cardWidth?: number;
  gap?: number;
  /**
   * Films placed first, so they claim the lowest rows (shared films line up on row 0),
   * and exempt from `maxRows`: a film shared by several lanes always gets a card, so its
   * connector has both ends.
   */
  priorityIds?: ReadonlySet<number>;
  /** Also exempt from `maxRows`, but placed with everything else. */
  exemptIds?: ReadonlySet<number>;
  /**
   * Rows of poster cards to allow (default: unlimited). Films are then placed by
   * priority, vote count (high first) and date, each into the lowest row it fits;
   * a film that fits none of the first `maxRows` rows is overflow.
   */
  maxRows?: number;
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
  const { cardWidth = CARD_WIDTH, gap = CARD_GAP, pad = TRACK_PAD, priorityIds, exemptIds } = options;
  const maxRows = Math.max(1, options.maxRows ?? Number.POSITIVE_INFINITY);
  const capped = Number.isFinite(maxRows);
  const minDistance = cardWidth + gap;
  const scale = { pxPerYear: options.pxPerYear, axisStartYear: options.axisStartYear, pad };

  const placed = films
    .map((film) => ({ film, x: xForDate(scale, film.releaseDate) }))
    .sort((a, b) => a.x - b.x || a.film.id - b.film.id);

  const tier = (id: number) => (priorityIds?.has(id) ? 0 : exemptIds?.has(id) && capped ? 1 : 2);
  const order = capped
    ? [...placed].sort(
        (a, b) =>
          tier(a.film.id) - tier(b.film.id) ||
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

/** Rows of poster cards actually used (at least 1); overflow dots take no room. */
export function rowCount(packed: readonly { row: number; overflow?: boolean }[]): number {
  return packed.reduce((max, p) => (p.overflow ? max : Math.max(max, p.row + 1)), 1);
}

/** How many films of a packed lane are dots rather than cards. */
export function overflowCount(packed: readonly { overflow?: boolean }[]): number {
  return packed.reduce((n, p) => (p.overflow ? n + 1 : n), 0);
}

/**
 * Hit-area width per overflow dot, by film id: DOT_HIT_SIZE, narrowed (down to
 * DOT_HIT_MIN) so that neighbouring dots on the line never overlap. Input in x order.
 */
export function dotHitWidths(packed: readonly { film: { id: number }; x: number; overflow: boolean }[]): Map<number, number> {
  const dots = packed.filter((p) => p.overflow);
  const widths = new Map<number, number>();
  dots.forEach((dot, i) => {
    const before = i > 0 ? dot.x - dots[i - 1].x : Number.POSITIVE_INFINITY;
    const after = i < dots.length - 1 ? dots[i + 1].x - dot.x : Number.POSITIVE_INFINITY;
    widths.set(dot.film.id, Math.max(DOT_HIT_MIN, Math.min(DOT_HIT_SIZE, before, after)));
  });
  return widths;
}

/**
 * Every film as a node on the lane line, with no poster card: x from the release date,
 * ordered by x then id. They are all `overflow` (dots, in packing terms), so
 * `dotHitWidths`, `overflowCount` and the connectors treat them like any other node.
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

// ---- Layout mode -----------------------------------------------------------

/**
 * "nodes": every film is a node and only the films shared by all lanes get posters (once,
 * in a strip between lanes). "posters": the lanes keep their own poster cards.
 */
export type LayoutMode = "nodes" | "posters";

/** Ids from `candidateIds` (the films shared by every person) that every lane actually shows, ascending. */
export function filmsInEveryLane(
  lanes: readonly { films: readonly { id: number }[] }[],
  candidateIds: ReadonlySet<number>,
): number[] {
  if (lanes.length < 2) return [];
  const [first, ...rest] = lanes.map((lane) => new Set(lane.films.map((film) => film.id)));
  return [...first].filter((id) => candidateIds.has(id) && rest.every((ids) => ids.has(id))).sort((a, b) => a - b);
}

/** "nodes" with 2+ lanes and at least one film every lane shows; otherwise "posters". */
export function layoutMode(
  lanes: readonly { films: readonly { id: number }[] }[],
  candidateIds: ReadonlySet<number>,
): LayoutMode {
  return filmsInEveryLane(lanes, candidateIds).length > 0 ? "nodes" : "posters";
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

export interface NodeStack {
  /** One box per lane, `NODE_LANE_HEIGHT` tall, with the strip's height inserted after the first. */
  lanes: LaneBox[];
  /** The shared-films strip, between the first and second lane. */
  strip: LaneBox;
}

/**
 * Lanes of the nodes layout, top to bottom from y = 0. The strip of shared posters sits in
 * the gap under the first lane; the lines of further lanes follow directly, so a connector
 * through them is just the lane height long.
 */
export function stackNodeLanes(laneCount: number, stripRows: number): NodeStack {
  const strip = { top: NODE_LANE_HEIGHT, height: stripHeight(stripRows) };
  const lanes: LaneBox[] = [];
  for (let i = 0; i < laneCount; i++) {
    const top = i === 0 ? 0 : i === 1 ? strip.top + strip.height : lanes[i - 1].top + NODE_LANE_HEIGHT;
    lanes.push({ top, height: NODE_LANE_HEIGHT });
  }
  return { lanes, strip };
}

// ---- Connectors ------------------------------------------------------------

export interface ConnectorLane {
  box: LaneBox;
  /** y of the lane's node line, from the top of the lane. */
  lineY: number;
  /** The lane's films: `overflow` ones are nodes only, the rest also have a poster card in `row`. */
  items: readonly { film: { id: number }; x: number; row: number; overflow?: boolean }[];
}

/** The posters of the nodes layout's shared strip: the strip's box and each film's row in it. */
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
  /**
   * y ranges between y1 and y2 where the film's own poster card sits. The line enters the
   * card from above and leaves below it, so it is not drawn across the card; see
   * `connectorSegments`.
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
 * With a `strip` (nodes layout) the film's poster is in the strip and the line skips it. Without
 * one, the line skips the film's own poster card in every lane but the last, since the card
 * hangs below that lane's node, in the line's way.
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
    } else if (!strip) {
      for (const index of laneIndexes.slice(0, -1)) {
        const item = lanes[index].items.find((it) => it.film.id === filmId)!;
        if (item.overflow) continue;
        const top = lanes[index].box.top + cardTopInLane(item.row);
        gaps.push({ y1: top, y2: top + CARD_HEIGHT });
      }
    }

    connectors.push({
      filmId,
      x,
      y1: lanes[fromLane].box.top + lanes[fromLane].lineY,
      y2: lanes[toLane].box.top + lanes[toLane].lineY,
      fromLane,
      toLane,
      lanes: laneIndexes,
      kind: laneIndexes.length === lanes.length ? "all" : "some",
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
