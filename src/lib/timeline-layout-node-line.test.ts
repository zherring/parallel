import { describe, expect, it } from "vitest";
import {
  CARD_HEIGHT,
  CARD_TOP,
  DEFAULT_MAX_ROWS,
  DEFAULT_NODE_LINE,
  LANE_PAD_BOTTOM,
  LINE_TO_CARD,
  LINE_Y,
  NODE_HIT_HEIGHT,
  NODE_RADIUS,
  ROW_GAP,
  buildConnectors,
  cardTopFor,
  cardTopInLane,
  laneHeight,
  laneObstacles,
  lineYInLane,
  nodeY,
  packFilms,
  quietFilmIds,
  rowCount,
  sharedAcrossLanes,
  stackLanes,
  totalHeight,
  type NodeLine,
} from "@/lib/timeline-layout";

const f = (id: number, releaseDate: string, voteCount?: number) => ({
  id,
  releaseDate,
  ...(voteCount === undefined ? {} : { voteCount }),
});
const TODAY = "2025-06-15";
const base = { pxPerYear: 72, axisStartYear: 1999 };
const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

/**
 * Three lanes with everything the layout has a rule for: a film of every lane (4), of a pair of
 * lanes (1, 3, 12), films over the two-row cap (13, 5, 6, 9, 10), an announced film both of the
 * first two lanes list (8) and a lane that needs one row only (the third).
 */
const lanes = [
  {
    films: [
      f(1, "2000-03-01", 50),
      f(2, "2000-03-20", 500),
      f(3, "2001-06-01", 10),
      f(4, "2002-01-01", 300),
      f(5, "2002-01-10", 100),
      f(6, "2002-01-20", 90),
      f(7, "2003-05-05", 5),
      f(8, "2030-01-01", 1),
      f(12, "2003-08-01", 20),
      f(13, "2002-01-05", 80),
    ],
  },
  {
    films: [
      f(1, "2000-03-01", 50),
      f(3, "2001-06-01", 10),
      f(9, "2001-06-10", 70),
      f(10, "2002-01-12", 60),
      f(4, "2002-01-01", 300),
      f(8, "2030-01-01", 1),
    ],
  },
  { films: [f(4, "2002-01-01", 300), f(11, "2005-01-01", 40), f(12, "2003-08-01", 20)] },
];

/** The timeline's layout pipeline (see `Timeline`) for `nodeLine`; `undefined` is the call as it was before the parameter existed. */
function scenario(nodeLine?: NodeLine, sourceLanes = lanes) {
  const priorityIds = sharedAcrossLanes(sourceLanes, TODAY);
  const quietIds = quietFilmIds(sourceLanes, TODAY);
  const obstacles = laneObstacles(sourceLanes, base, TODAY, nodeLine);
  const items = sourceLanes.map((lane, i) =>
    packFilms(lane.films, { ...base, priorityIds, quietIds, obstacles: obstacles[i], maxRows: DEFAULT_MAX_ROWS }),
  );
  const boxes = stackLanes(items.map(rowCount));
  const connectors = buildConnectors(
    items.map((laneItems, i) => ({ box: boxes[i], items: laneItems })),
    TODAY,
    nodeLine,
  );
  return { items, boxes, connectors, obstacles, quietIds, priorityIds };
}

describe("the default layout is the line at the top", () => {
  it("is 'top'", () => {
    expect(DEFAULT_NODE_LINE).toBe("top");
  });

  /**
   * Captured from the layout code before `nodeLine` existed (commit 43be119), for the scenario above:
   * the pipeline with no `nodeLine` and with "top" must still give exactly this.
   */
  const GOLDEN = {
    obstacles: [
      [
        { filmId: 1, x: 123.80327868853237 },
        { filmId: 3, x: 213.7863013698552 },
        { filmId: 4, x: 256 },
        { filmId: 12, x: 369.81917808218896 },
      ],
      [
        { filmId: 4, x: 256 },
        { filmId: 12, x: 369.81917808218896 },
      ],
      [],
    ],
    items: [
      [[1, 123.803279, 0, false], [2, 127.540984, 1, false], [3, 213.786301, 1, false], [4, 256, 0, false], [13, 256.789041, -1, true], [5, 257.775342, -1, true], [6, 259.747945, -1, true], [7, 352.460274, 1, false], [12, 369.819178, 0, false], [8, 2272, 0, false]],
      [[1, 123.803279, 0, false], [3, 213.786301, 1, false], [9, 215.561644, -1, true], [4, 256, 0, false], [10, 258.169863, -1, true], [8, 2272, 0, false]],
      [[4, 256, 0, false], [12, 369.819178, 0, false], [11, 472, 0, false]],
    ],
    boxes: [
      { top: 0, height: 338 },
      { top: 338, height: 338 },
      { top: 676, height: 188 },
    ],
    height: 864,
    cardTops: [
      [[1, 30], [2, 180], [3, 180], [4, 30], [7, 180], [12, 30], [8, 30]],
      [[1, 30], [3, 180], [4, 30], [8, 30]],
      [[4, 30], [12, 30], [11, 30]],
    ],
    connectors: [
      { filmId: 1, x: 123.803279, y1: 14, y2: 352, fromLane: 0, toLane: 1, lanes: [0, 1], kind: "some", slot: 0 },
      { filmId: 3, x: 213.786301, y1: 14, y2: 352, fromLane: 0, toLane: 1, lanes: [0, 1], kind: "some", slot: 0 },
      { filmId: 4, x: 256, y1: 14, y2: 690, fromLane: 0, toLane: 2, lanes: [0, 1, 2], kind: "all", slot: null },
      { filmId: 12, x: 369.819178, y1: 14, y2: 690, fromLane: 0, toLane: 2, lanes: [0, 2], kind: "some", slot: 1 },
    ],
  };

  const snapshot = (s: ReturnType<typeof scenario>) => ({
    obstacles: s.obstacles,
    items: s.items.map((lane) => lane.map((p) => [p.film.id, round6(p.x), p.row, p.overflow])),
    boxes: s.boxes,
    height: totalHeight(s.boxes),
    cardTops: s.items.map((lane) => lane.filter((p) => !p.overflow).map((p) => [p.film.id, cardTopInLane(p.row)])),
    connectors: s.connectors.map((c) => ({ ...c, x: round6(c.x) })),
  });

  it("gives byte for byte what it gave before the parameter existed, called without it", () => {
    expect(snapshot(scenario())).toEqual(GOLDEN);
  });

  it("gives the same with 'top' passed explicitly", () => {
    expect(snapshot(scenario("top"))).toEqual(GOLDEN);
  });

  it("puts a card at the same y whether it is asked for the lane's height or not", () => {
    for (const rows of [1, 2, 5]) {
      for (let row = 0; row < rows; row++) expect(cardTopFor(row, laneHeight(rows), "top")).toBe(cardTopInLane(row));
      expect(lineYInLane(laneHeight(rows), "top")).toBe(LINE_Y);
    }
  });
});

describe("lane geometry for the line at the bottom", () => {
  it("is as tall as the lane with the line at the top, for any number of rows", () => {
    // laneHeight does not take the line's side: the lane is the same box, flipped inside.
    for (const rows of [1, 2, 3, 7]) {
      const boxes = stackLanes([rows]);
      expect(boxes[0].height).toBe(laneHeight(rows));
    }
    expect(laneHeight(1)).toBe(188);
    expect(laneHeight(2)).toBe(338);
  });

  it("puts the line LINE_Y from the bottom of the lane, where the top variant puts it LINE_Y from the top", () => {
    for (const rows of [1, 2, 3]) {
      const height = laneHeight(rows);
      expect(lineYInLane(height, "top")).toBe(LINE_Y);
      expect(lineYInLane(height, "bottom")).toBe(height - LINE_Y);
    }
    expect(lineYInLane(188, "bottom")).toBe(174);
    expect(lineYInLane(338, "bottom")).toBe(324);
  });

  it("mirrors every card: the bottom of a card is as far above the line as its top is below it at the top", () => {
    for (const rows of [1, 2, 3, 5]) {
      const height = laneHeight(rows);
      for (let row = 0; row < rows; row++) {
        const top = cardTopFor(row, height, "top");
        const bottom = cardTopFor(row, height, "bottom");
        expect(bottom).toBe(height - (top + CARD_HEIGHT));
        // The first row is LINE_TO_CARD (CARD_TOP less LINE_Y) from the line, on either side of it; each row after it a row further.
        const further = row * (CARD_HEIGHT + ROW_GAP);
        expect(top - lineYInLane(height, "top")).toBe(LINE_TO_CARD + further);
        expect(lineYInLane(height, "bottom") - (bottom + CARD_HEIGHT)).toBe(LINE_TO_CARD + further);
      }
    }
    expect(LINE_TO_CARD).toBe(CARD_TOP - LINE_Y);
  });

  it("stacks the rows upward: row 0 is nearest the line and each next row is a card and a gap higher", () => {
    for (const rows of [2, 3, 5]) {
      const height = laneHeight(rows);
      const tops = Array.from({ length: rows }, (_, row) => cardTopFor(row, height, "bottom"));
      for (let row = 1; row < rows; row++) expect(tops[row - 1] - tops[row]).toBe(CARD_HEIGHT + ROW_GAP);
      expect(tops[0]).toBeGreaterThan(tops[rows - 1]);
      expect(tops[0] + CARD_HEIGHT).toBeLessThan(lineYInLane(height, "bottom"));
    }
    // The same rows hang downward at the top.
    const downward = [0, 1, 2].map((row) => cardTopFor(row, laneHeight(3), "top"));
    expect(downward[1] - downward[0]).toBe(CARD_HEIGHT + ROW_GAP);
  });

  it("keeps the highest row inside the lane with LANE_PAD_BOTTOM to spare, and the first row clear of the line and its nodes", () => {
    for (const rows of [1, 2, 3, 6]) {
      const height = laneHeight(rows);
      expect(cardTopFor(rows - 1, height, "bottom")).toBe(LANE_PAD_BOTTOM);
      const firstRowBottom = cardTopFor(0, height, "bottom") + CARD_HEIGHT;
      const line = lineYInLane(height, "bottom");
      // A node, even the largest, never touches the caption above it...
      expect(line - firstRowBottom).toBeGreaterThan(NODE_RADIUS.lit);
      // ...and neither does a node's hit area (it is centred on the line).
      expect(line - NODE_HIT_HEIGHT / 2).toBeGreaterThanOrEqual(firstRowBottom);
      // Same on the other side with the line at the top.
      expect(cardTopFor(0, height, "top") - (LINE_Y + NODE_HIT_HEIGHT / 2)).toBeGreaterThanOrEqual(0);
    }
  });

  it("leaves LINE_Y between the last lane's line and the axis row under it", () => {
    for (const rows of [[1], [2, 1], [1, 3, 2]]) {
      const boxes = stackLanes(rows);
      const last = boxes[boxes.length - 1];
      expect(totalHeight(boxes) - nodeY(last, "bottom")).toBe(LINE_Y);
    }
  });

  it("finds a lane's line from its box, in the coordinates of the first lane", () => {
    const boxes = stackLanes([1, 2, 1]);
    expect(boxes.map((box) => nodeY(box, "top"))).toEqual([14, 188 + 14, 188 + 338 + 14]);
    expect(boxes.map((box) => nodeY(box, "bottom"))).toEqual([188 - 14, 188 + 338 - 14, 188 + 338 + 188 - 14]);
  });
});

describe("connectors with the line at the bottom", () => {
  const bottom = scenario("bottom");
  const top = scenario("top");
  const lineOf = (s: ReturnType<typeof scenario>, lane: number, nodeLine: NodeLine) => nodeY(s.boxes[lane], nodeLine);

  it("runs from the first lane's node to the last lane's node, both on their lane lines", () => {
    for (const c of bottom.connectors) {
      expect(c.y1).toBe(lineOf(bottom, c.fromLane, "bottom"));
      expect(c.y2).toBe(lineOf(bottom, c.toLane, "bottom"));
      expect(c.y2).toBeGreaterThan(c.y1);
    }
    expect(bottom.connectors.map((c) => [c.filmId, c.y1, c.y2])).toEqual([
      [1, 324, 662],
      [3, 324, 662],
      [4, 324, 850],
      [12, 324, 850],
    ]);
  });

  it("joins the same films, at the same x, in the same colours as the top variant", () => {
    const strip = (c: (typeof top.connectors)[number]) => ({ ...c, y1: 0, y2: 0 });
    expect(bottom.connectors.map(strip)).toEqual(top.connectors.map(strip));
  });

  it("has one connector, at one x, per film shared by two lanes or more, and a node for every film in each lane", () => {
    const ids = bottom.connectors.map((c) => c.filmId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of bottom.connectors) {
      for (const lane of c.lanes) {
        const item = bottom.items[lane].find((p) => p.film.id === c.filmId);
        expect(item?.x).toBe(c.x);
      }
    }
    for (const laneItems of bottom.items) expect(laneItems.length).toBe(lanes[bottom.items.indexOf(laneItems)].films.length);
  });

  it("leaves the first lane alone and runs through the rows of the lanes below it, the last lane's too", () => {
    expect(bottom.obstacles[0]).toEqual([]);
    expect(bottom.obstacles[1].map((o) => o.filmId)).toEqual([1, 3, 4, 12]);
    expect(bottom.obstacles[2].map((o) => o.filmId)).toEqual([4, 12]);
    // At the top it is the other way round: through the first lane, never through the last.
    expect(top.obstacles[0].map((o) => o.filmId)).toEqual([1, 3, 4, 12]);
    expect(top.obstacles[2]).toEqual([]);
  });

  it("crosses a lane a film skips, and never a lane it ends in at the top or starts in at the bottom", () => {
    const shown = [{ films: [f(1, "2000-01-01")] }, { films: [] }, { films: [f(1, "2000-01-01")] }];
    expect(laneObstacles(shown, base, TODAY, "bottom").map((o) => o.length)).toEqual([0, 1, 1]);
    expect(laneObstacles(shown, base, TODAY, "top").map((o) => o.length)).toEqual([1, 1, 0]);
    expect(laneObstacles(shown, base, TODAY).map((o) => o.length)).toEqual([1, 1, 0]);
  });

  it("has no obstacles for a single lane or a film that is not out yet, whichever side the line is on", () => {
    for (const nodeLine of ["top", "bottom"] as const) {
      expect(laneObstacles([{ films: [f(1, "2000-01-01")] }], base, TODAY, nodeLine)).toEqual([[]]);
      const upcoming = f(9, "2029-12-19");
      const both = laneObstacles([{ films: [upcoming] }, { films: [upcoming] }], base, TODAY, nodeLine);
      expect(both).toEqual([[], []]);
    }
  });

  it("ends the line of a film that is the last lane's lit poster on the node under that poster", () => {
    const [, , last] = bottom.items;
    const lit = last.find((p) => p.film.id === 4)!;
    expect(lit.overflow).toBe(false);
    const height = bottom.boxes[2].height;
    const posterBottom = bottom.boxes[2].top + cardTopFor(lit.row, height, "bottom") + CARD_HEIGHT;
    const c = bottom.connectors.find((x) => x.filmId === 4)!;
    expect(c.y2).toBeGreaterThan(posterBottom);
    expect(c.y2 - posterBottom).toBe(LINE_TO_CARD + (lit.row === 0 ? 0 : (CARD_HEIGHT + ROW_GAP) * lit.row));
  });

  it("gives a shared film a card in every lane that has it, directly above its node (row 0) or a row of cards higher", () => {
    for (const lane of [0, 1, 2]) {
      const { height } = bottom.boxes[lane];
      for (const p of bottom.items[lane]) {
        if (p.overflow) continue;
        const cardBottom = cardTopFor(p.row, height, "bottom") + CARD_HEIGHT;
        expect(lineYInLane(height, "bottom") - cardBottom).toBe(LINE_TO_CARD + p.row * (CARD_HEIGHT + ROW_GAP));
      }
      for (const p of bottom.items[lane]) if (bottom.priorityIds.has(p.film.id)) expect(p.overflow).toBe(false);
    }
  });
});

describe("packing with the line at the bottom", () => {
  it("puts a film of row 0 below a film of row 1 on the page and a film of row 1 below it at the top", () => {
    const films = [f(1, "2000-06-01", 900), f(2, "2000-06-02", 100)];
    const [a, b] = packFilms(films, { ...base, maxRows: 2 });
    expect([a.row, b.row]).toEqual([0, 1]);
    const height = laneHeight(2);
    expect(cardTopFor(a.row, height, "bottom")).toBeGreaterThan(cardTopFor(b.row, height, "bottom"));
    expect(cardTopFor(a.row, height, "top")).toBeLessThan(cardTopFor(b.row, height, "top"));
  });

  it("keeps every card inside its lane and clear of the line and of the other rows, for every row count", () => {
    for (const rows of [1, 2, 3, 4]) {
      const height = laneHeight(rows);
      const line = lineYInLane(height, "bottom");
      const spans = Array.from({ length: rows }, (_, row) => {
        const top = cardTopFor(row, height, "bottom");
        return [top, top + CARD_HEIGHT] as const;
      }).sort((a, b) => a[0] - b[0]);
      expect(spans[0][0]).toBeGreaterThanOrEqual(0);
      expect(spans[rows - 1][1]).toBeLessThan(line);
      for (let i = 1; i < spans.length; i++) expect(spans[i][0] - spans[i - 1][1]).toBe(ROW_GAP);
    }
  });
});
