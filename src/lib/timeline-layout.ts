/**
 * Pure geometry for the timeline: one shared time axis, every film as a node on its
 * lane's line, collision packing of poster cards into sub-rows (capped, with the rest left
 * as nodes), continuous node-to-node connector lines between lanes, and zoom/scroll math.
 *
 * A film shown in several lanes has its own poster card in each of them, at the same x,
 * packed first so it keeps a card (and the row nearest the line) in every lane that has
 * it; one connector line joins its nodes, from the first lane's node down to the last's.
 *
 * Each lane's line (with its nodes) is at the top of the lane with the poster rows hanging below
 * it (`nodeLine: "top"`, the default), or at the bottom of the lane with the rows stacked above it
 * (`"bottom"`). Row 0 is always the row nearest the line; the lane's height is the same either way.
 * The two arrangements are exact vertical mirrors of each other inside a lane.
 *
 * Only released films connect (see `isReleased`). An announced film that two lanes both list is
 * an ordinary "upcoming" poster in each: no connector, no membership, no priority, never lit. The
 * helpers that decide this take `today` (`yyyy-mm-dd`) as a parameter and never read the clock,
 * so a page that passes the date it computed on the server gets the same layout in the browser.
 *
 * Nothing here touches the DOM. Every pixel the UI draws (node and card positions, lane
 * heights, connector endpoints) is derived from these functions, so a film shared by
 * two lanes lands at the identical x in both and the SVG overlay lines up without
 * measuring anything. Lanes are stacked from y = 0; the year axis is a row under the last
 * lane (AXIS_HEIGHT tall), so nothing here is offset by it.
 */

import { connectionSlot } from "@/lib/connections";
import { isReleased } from "@/lib/released";

// ---- Dimensions (px) -------------------------------------------------------

export const CARD_WIDTH = 64;
export const POSTER_HEIGHT = 96;
/**
 * Size of the card of a film that no other lane shares while another film on screen is shared
 * (see `quietFilmIds`): the same 2:3 poster at 78% of the full size, so the linked films stand
 * out. Rows keep the full card height, so lane heights do not change; only the packing does,
 * because cards are packed by their own width.
 */
export const QUIET_CARD_WIDTH = 50;
export const QUIET_POSTER_HEIGHT = 75;
/** How much a quiet card grows to be back at full size (a poster of CARD_WIDTH by POSTER_HEIGHT) while it is hovered, focused or open. */
export const QUIET_RESTORE_SCALE = CARD_WIDTH / QUIET_CARD_WIDTH;
/** Title (2 lines) + year under the poster. */
export const CAPTION_HEIGHT = 44;
export const CARD_HEIGHT = POSTER_HEIGHT + CAPTION_HEIGHT;
export const CARD_GAP = 8;
/** Vertical gap between sub-rows inside a lane. */
export const ROW_GAP = 10;
/** Which end of its lane a lane's line (and so its nodes) sits at; the poster rows are on the other side of it. */
export type NodeLine = "top" | "bottom";
export const DEFAULT_NODE_LINE: NodeLine = "top";
/** y of the lane's track line, from the top of the lane (`nodeLine: "top"`); from the bottom of the lane for `"bottom"`. */
export const LINE_Y = 14;
/** Distance from the lane's line to the nearest edge of the first row of cards (CARD_TOP less LINE_Y). */
export const LINE_TO_CARD = 16;
/** y of the first row of cards, from the top of the lane (`nodeLine: "top"`); of its bottom edge from the bottom of the lane for `"bottom"`. */
export const CARD_TOP = LINE_Y + LINE_TO_CARD;
/** Empty space past the last row of cards, on the far side of the line: under it (top) or above it (bottom). */
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
/** Height of a node's hit area, centred on the line; it stops short of the first row of cards (LINE_TO_CARD away). */
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
   * Films whose card is the narrower quiet one (`quietCardWidth`, never wider than `cardWidth`):
   * the films that only one lane shows while another film is shared (see `quietFilmIds`). Two
   * cards are always `gap` apart whatever their widths, so quiet cards pack tighter. These are
   * never priority films.
   */
  quietIds?: ReadonlySet<number>;
  quietCardWidth?: number;
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

/** Width of a film's card: the full width, or the narrower one of a quiet film. */
export function cardWidthOf(quiet: boolean): number {
  return quiet ? QUIET_CARD_WIDTH : CARD_WIDTH;
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
  const {
    cardWidth = CARD_WIDTH,
    quietCardWidth = QUIET_CARD_WIDTH,
    gap = CARD_GAP,
    pad = TRACK_PAD,
    priorityIds,
    quietIds,
    obstacles = [],
  } = options;
  const maxRows = Math.max(1, options.maxRows ?? Number.POSITIVE_INFINITY);
  const capped = Number.isFinite(maxRows);
  const widthOf = (id: number) => (quietIds?.has(id) ? Math.min(quietCardWidth, cardWidth) : cardWidth);
  const scale = { pxPerYear: options.pxPerYear, axisStartYear: options.axisStartYear, pad };

  const placed = films
    .map((film) => ({ film, x: xForDate(scale, film.releaseDate) }))
    .sort((a, b) => a.x - b.x || a.film.id - b.film.id);

  const priority = (id: number) => priorityIds?.has(id) === true;
  const crossed = (p: { film: F; x: number }) =>
    !priority(p.film.id) && isCrossed(p.film.id, p.x, obstacles, widthOf(p.film.id)) ? 1 : 0;
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

  // Centre and width of every card in each row. Two cards are `gap` apart when their centres are
  // half of each width plus the gap apart (cardWidth + gap for two cards of the full width).
  const rows: { x: number; width: number }[][] = [];
  const rowOf = new Map<number, number>();
  for (const { film, x } of order) {
    const limit = priority(film.id) ? Number.POSITIVE_INFINITY : maxRows;
    const width = widthOf(film.id);
    let row = rows.findIndex(
      (cards, i) => i < limit && cards.every((other) => Math.abs(other.x - x) >= (other.width + width) / 2 + gap),
    );
    if (row === -1 && rows.length < limit) {
      row = rows.length;
      rows.push([]);
    }
    if (row === -1) {
      rowOf.set(film.id, OVERFLOW_ROW);
      continue;
    }
    rows[row].push({ x, width });
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

/** A film of a lane, as far as the connection rules go: which film it is and when it comes out. */
export interface ConnectableFilm {
  id: number;
  releaseDate: string;
}

/**
 * Ids of the released films that more than one lane shows (what each of those lanes gives a card
 * first). A film that is not out on `today` is never in it, however many lanes list it.
 */
export function sharedAcrossLanes(lanes: readonly { films: readonly ConnectableFilm[] }[], today: string): Set<number> {
  const seen = new Set<number>();
  const shared = new Set<number>();
  for (const lane of lanes) {
    const released = lane.films.filter((film) => isReleased(film.releaseDate, today));
    for (const id of new Set(released.map((film) => film.id))) {
      if (seen.has(id)) shared.add(id);
      else seen.add(id);
    }
  }
  return shared;
}

/**
 * Ids of the films whose card is "quiet": smaller and fainter, so that the connected films stand
 * out. That is every film that only one lane shows, but only when two or more lanes are on screen
 * and at least one film is shared (by any pair of lanes, with 3+ of them); otherwise there is
 * nothing to stand out from and every card keeps its full size. It is exactly the set of films
 * `buildConnectors` draws no line for, which includes every film that is not out yet: an announced
 * film is quiet like any other unconnected one while something else is connected, and it does not
 * count as a connection, so a pair whose only shared film is unreleased has nothing quiet at all.
 */
export function quietFilmIds(lanes: readonly { films: readonly ConnectableFilm[] }[], today: string): Set<number> {
  const quiet = new Set<number>();
  if (lanes.length < 2) return quiet;
  const shared = sharedAcrossLanes(lanes, today);
  if (shared.size === 0) return quiet;
  for (const lane of lanes) {
    for (const film of lane.films) if (!shared.has(film.id)) quiet.add(film.id);
  }
  return quiet;
}

/**
 * For each lane, the connector lines that run through its poster rows: those of released films
 * shown in two or more lanes. A line goes from node to node, down the page, so it crosses the
 * rows of the lanes between its two end lanes and one of the two ends: with the line at the top
 * of the lanes (`nodeLine: "top"`) it leaves the first lane's node through that lane's rows and
 * ends on the last lane's node above that lane's rows, so the last lane is never crossed; with
 * it at the bottom (`"bottom"`) it leaves the first lane's node below that lane's rows and runs
 * through the rows of the last lane to its node, so the first lane is never crossed.
 */
export function laneObstacles(
  lanes: readonly { films: readonly PackableFilm[] }[],
  options: Pick<PackOptions, "pxPerYear" | "axisStartYear" | "pad">,
  today: string,
  nodeLine: NodeLine = DEFAULT_NODE_LINE,
): Obstacle[][] {
  const scale = { pxPerYear: options.pxPerYear, axisStartYear: options.axisStartYear, pad: options.pad ?? TRACK_PAD };
  const shownIn = new Map<number, { first: number; last: number; x: number }>();
  lanes.forEach((lane, index) => {
    for (const film of lane.films) {
      if (!isReleased(film.releaseDate, today)) continue;
      const seen = shownIn.get(film.id);
      if (seen) seen.last = index;
      else shownIn.set(film.id, { first: index, last: index, x: xForDate(scale, film.releaseDate) });
    }
  });
  return lanes.map((_, index) =>
    [...shownIn]
      .filter(([, s]) => (nodeLine === "top" ? s.first <= index && index < s.last : s.first < index && index <= s.last))
      .map(([filmId, s]) => ({ filmId, x: s.x }))
      .sort((a, b) => a.x - b.x || a.filmId - b.filmId),
  );
}

// ---- Lane geometry ---------------------------------------------------------

export function laneHeight(rows: number): number {
  const n = Math.max(1, rows);
  return CARD_TOP + n * CARD_HEIGHT + (n - 1) * ROW_GAP + LANE_PAD_BOTTOM;
}

/** y of a card's top edge, from the top of its lane, for a lane whose line is at the top. */
export function cardTopInLane(row: number): number {
  return CARD_TOP + row * (CARD_HEIGHT + ROW_GAP);
}

/**
 * y of a card's top edge, from the top of its lane, for a lane of `height` (see `laneHeight`). With the
 * line at the top this is `cardTopInLane`. With the line at the bottom row 0 sits just above it, its
 * caption ending LINE_TO_CARD short of the line, and the other rows stack upward, ROW_GAP apart; the
 * highest row ends LANE_PAD_BOTTOM from the top of the lane.
 */
export function cardTopFor(row: number, height: number, nodeLine: NodeLine = DEFAULT_NODE_LINE): number {
  return nodeLine === "top"
    ? cardTopInLane(row)
    : height - CARD_TOP - CARD_HEIGHT - row * (CARD_HEIGHT + ROW_GAP);
}

/** y of a lane's line (every node's centre), from the top of a lane of `height`. */
export function lineYInLane(height: number, nodeLine: NodeLine = DEFAULT_NODE_LINE): number {
  return nodeLine === "top" ? LINE_Y : height - LINE_Y;
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

/** y of the line (every node's centre) of the lane in `box`, from the top of the first lane. */
export function nodeY(box: LaneBox, nodeLine: NodeLine = DEFAULT_NODE_LINE): number {
  return box.top + lineYInLane(box.height, nodeLine);
}

export function totalHeight(boxes: LaneBox[]): number {
  const last = boxes[boxes.length - 1];
  return last ? last.top + last.height : 0;
}

// ---- Connectors ------------------------------------------------------------

export interface ConnectorLane {
  box: LaneBox;
  /** The lane's films, each a node on the lane's line. */
  items: readonly { film: ConnectableFilm; x: number }[];
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

/**
 * For each released film id, the indexes (ascending) of the lanes that show it (every film is a
 * node on its lane's line). Films that are not out on `today` are left out: they belong to no
 * connection, so they have no entry here.
 */
export function filmMembership(
  lanes: readonly { items: readonly { film: ConnectableFilm }[] }[],
  today: string,
): Map<number, number[]> {
  const membership = new Map<number, number[]>();
  lanes.forEach((lane, index) => {
    for (const { film } of lane.items) {
      if (!isReleased(film.releaseDate, today)) continue;
      const list = membership.get(film.id);
      if (list) {
        if (list[list.length - 1] !== index) list.push(index);
      } else membership.set(film.id, [index]);
    }
  });
  return membership;
}

/**
 * One continuous vertical line per released film shown in two or more lanes, from its node in the
 * first of those lanes to its node in the last (so it passes through the nodes of the lanes
 * between). Coordinates are relative to the top of the first lane. A film that is not out on
 * `today` gets no line.
 *
 * With the line at the top of the lanes, each lane's own poster of the film hangs below its node, in
 * the line's way; with it at the bottom the poster is above its node and the line comes down
 * through it. Either way the posters of shared films are drawn over the lines, so the line passes
 * behind its own poster (and behind the poster of any other shared film) and shows again between
 * the caption and the node. It is drawn over the posters of films that are not shared.
 */
export function buildConnectors(
  lanes: readonly ConnectorLane[],
  today: string,
  nodeLine: NodeLine = DEFAULT_NODE_LINE,
): Connector[] {
  const connectors: Connector[] = [];

  for (const [filmId, laneIndexes] of filmMembership(lanes, today)) {
    if (laneIndexes.length < 2) continue;
    const fromLane = laneIndexes[0];
    const toLane = laneIndexes[laneIndexes.length - 1];

    connectors.push({
      filmId,
      x: lanes[fromLane].items.find((item) => item.film.id === filmId)!.x,
      y1: nodeY(lanes[fromLane].box, nodeLine),
      y2: nodeY(lanes[toLane].box, nodeLine),
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
