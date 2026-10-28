import { describe, expect, it } from "vitest";
import {
  CARD_HEIGHT,
  DEFAULT_MAX_ROWS,
  LANE_PAD_TOP,
  LINE_FROM_BOTTOM,
  LINE_TO_CARD,
  NODE_HIT_HEIGHT,
  NODE_RADIUS,
  ROW_GAP,
  buildConnectors,
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

/** The timeline's layout pipeline (see `Timeline`). */
function scenario(sourceLanes = lanes) {
  const priorityIds = sharedAcrossLanes(sourceLanes, TODAY);
  const quietIds = quietFilmIds(sourceLanes, TODAY);
  const obstacles = laneObstacles(sourceLanes, base, TODAY);
  const items = sourceLanes.map((lane, i) =>
    packFilms(lane.films, { ...base, priorityIds, quietIds, obstacles: obstacles[i], maxRows: DEFAULT_MAX_ROWS }),
  );
  const boxes = stackLanes(items.map(rowCount));
  const connectors = buildConnectors(
    items.map((laneItems, i) => ({ box: boxes[i], items: laneItems })),
    TODAY,
  );
  return { items, boxes, connectors, obstacles, quietIds, priorityIds };
}

describe("the three-lane layout", () => {
  /**
   * Captured from the layout code as it ran with the line at the bottom of the lanes (`?nodes=bottom`, commit
   * bab1142), before that became the only layout, for the scenario above.
   */
  const GOLDEN = {
    obstacles: [
      [],
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
      [[1, 168], [2, 18], [3, 18], [4, 168], [7, 18], [12, 168], [8, 168]],
      [[1, 168], [3, 18], [4, 168], [8, 168]],
      [[4, 18], [12, 18], [11, 18]],
    ],
    connectors: [
      { filmId: 1, x: 123.803279, y1: 324, y2: 662, fromLane: 0, toLane: 1, lanes: [0, 1], kind: "some", slot: 0 },
      { filmId: 3, x: 213.786301, y1: 324, y2: 662, fromLane: 0, toLane: 1, lanes: [0, 1], kind: "some", slot: 0 },
      { filmId: 4, x: 256, y1: 324, y2: 850, fromLane: 0, toLane: 2, lanes: [0, 1, 2], kind: "all", slot: null },
      { filmId: 12, x: 369.819178, y1: 324, y2: 850, fromLane: 0, toLane: 2, lanes: [0, 2], kind: "some", slot: 1 },
    ],
  };

  const snapshot = (s: ReturnType<typeof scenario>) => ({
    obstacles: s.obstacles,
    items: s.items.map((lane) => lane.map((p) => [p.film.id, round6(p.x), p.row, p.overflow])),
    boxes: s.boxes,
    height: totalHeight(s.boxes),
    cardTops: s.items.map((lane, i) =>
      lane.filter((p) => !p.overflow).map((p) => [p.film.id, cardTopInLane(p.row, s.boxes[i].height)]),
    ),
    connectors: s.connectors.map((c) => ({ ...c, x: round6(c.x) })),
  });

  it("gives byte for byte what the layout gave with the line at the bottom before it was the only one", () => {
    expect(snapshot(scenario())).toEqual(GOLDEN);
  });
});

describe("lane geometry", () => {
  it("is 188px tall for one row and 338px for two", () => {
    expect(laneHeight(1)).toBe(188);
    expect(laneHeight(2)).toBe(338);
  });

  it("puts the line LINE_FROM_BOTTOM from the bottom of the lane", () => {
    for (const rows of [1, 2, 3]) {
      const height = laneHeight(rows);
      expect(lineYInLane(height)).toBe(height - LINE_FROM_BOTTOM);
    }
    expect(lineYInLane(188)).toBe(174);
    expect(lineYInLane(338)).toBe(324);
  });

  it("puts the first row of cards just above the line and the highest row LANE_PAD_TOP from the top of the lane", () => {
    expect(cardTopInLane(0, 188)).toBe(18);
    expect(cardTopInLane(0, 338)).toBe(168);
    expect(cardTopInLane(1, 338)).toBe(18);
    for (const rows of [1, 2, 3, 6]) expect(cardTopInLane(rows - 1, laneHeight(rows))).toBe(LANE_PAD_TOP);
  });

  it("ends every card the same distance above the line: LINE_TO_CARD for the first row, a row further for each next one", () => {
    expect(LINE_TO_CARD).toBe(16);
    for (const rows of [1, 2, 3, 5]) {
      const height = laneHeight(rows);
      for (let row = 0; row < rows; row++) {
        const cardBottom = cardTopInLane(row, height) + CARD_HEIGHT;
        expect(lineYInLane(height) - cardBottom).toBe(LINE_TO_CARD + row * (CARD_HEIGHT + ROW_GAP));
      }
    }
  });

  it("stacks the rows upward: row 0 is nearest the line and each next row is a card and a gap higher", () => {
    for (const rows of [2, 3, 5]) {
      const height = laneHeight(rows);
      const tops = Array.from({ length: rows }, (_, row) => cardTopInLane(row, height));
      for (let row = 1; row < rows; row++) expect(tops[row - 1] - tops[row]).toBe(CARD_HEIGHT + ROW_GAP);
      expect(tops[0]).toBeGreaterThan(tops[rows - 1]);
      expect(tops[0] + CARD_HEIGHT).toBeLessThan(lineYInLane(height));
    }
  });

  it("keeps the first row clear of the line and its nodes", () => {
    for (const rows of [1, 2, 3, 6]) {
      const height = laneHeight(rows);
      const firstRowBottom = cardTopInLane(0, height) + CARD_HEIGHT;
      const line = lineYInLane(height);
      // A node, even the largest, never touches the caption above it...
      expect(line - firstRowBottom).toBeGreaterThan(NODE_RADIUS.lit);
      // ...and neither does a node's hit area (it is centred on the line).
      expect(line - NODE_HIT_HEIGHT / 2).toBeGreaterThanOrEqual(firstRowBottom);
    }
  });

  it("leaves LINE_FROM_BOTTOM between the last lane's line and the axis row under it", () => {
    for (const rows of [[1], [2, 1], [1, 3, 2]]) {
      const boxes = stackLanes(rows);
      const last = boxes[boxes.length - 1];
      expect(totalHeight(boxes) - nodeY(last)).toBe(LINE_FROM_BOTTOM);
    }
  });

  it("finds a lane's line from its box, in the coordinates of the first lane", () => {
    const boxes = stackLanes([1, 2, 1]);
    expect(boxes.map((box) => nodeY(box))).toEqual([174, 512, 700]);
    expect(boxes.map((box) => nodeY(box))).toEqual([188 - 14, 188 + 338 - 14, 188 + 338 + 188 - 14]);
  });
});

describe("connectors", () => {
  const { items, boxes, connectors, obstacles, priorityIds } = scenario();

  it("runs from the first lane's node to the last lane's node, both on their lane lines", () => {
    for (const c of connectors) {
      expect(c.y1).toBe(nodeY(boxes[c.fromLane]));
      expect(c.y2).toBe(nodeY(boxes[c.toLane]));
      expect(c.y2).toBeGreaterThan(c.y1);
    }
    expect(connectors.map((c) => [c.filmId, c.y1, c.y2])).toEqual([
      [1, 324, 662],
      [3, 324, 662],
      [4, 324, 850],
      [12, 324, 850],
    ]);
  });

  it("has one connector, at one x, per film shared by two lanes or more, and a node for every film in each lane", () => {
    const ids = connectors.map((c) => c.filmId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of connectors) {
      for (const lane of c.lanes) {
        const item = items[lane].find((p) => p.film.id === c.filmId);
        expect(item?.x).toBe(c.x);
      }
    }
    items.forEach((laneItems, i) => expect(laneItems.length).toBe(lanes[i].films.length));
  });

  it("leaves the first lane alone and runs through the rows of the lanes below it, the last lane's too", () => {
    expect(obstacles[0]).toEqual([]);
    expect(obstacles[1].map((o) => o.filmId)).toEqual([1, 3, 4, 12]);
    expect(obstacles[2].map((o) => o.filmId)).toEqual([4, 12]);
  });

  it("crosses a lane a film skips, and never the lane it starts in", () => {
    const shown = [{ films: [f(1, "2000-01-01")] }, { films: [] }, { films: [f(1, "2000-01-01")] }];
    expect(laneObstacles(shown, base, TODAY).map((o) => o.length)).toEqual([0, 1, 1]);
  });

  it("has no obstacles for a single lane or a film that is not out yet", () => {
    expect(laneObstacles([{ films: [f(1, "2000-01-01")] }], base, TODAY)).toEqual([[]]);
    const upcoming = f(9, "2029-12-19");
    expect(laneObstacles([{ films: [upcoming] }, { films: [upcoming] }], base, TODAY)).toEqual([[], []]);
  });

  it("ends the line of a film that is the last lane's lit poster on the node under that poster", () => {
    const [, , last] = items;
    const lit = last.find((p) => p.film.id === 4)!;
    expect(lit.overflow).toBe(false);
    const posterBottom = boxes[2].top + cardTopInLane(lit.row, boxes[2].height) + CARD_HEIGHT;
    const c = connectors.find((x) => x.filmId === 4)!;
    expect(c.y2).toBeGreaterThan(posterBottom);
    expect(c.y2 - posterBottom).toBe(LINE_TO_CARD + lit.row * (CARD_HEIGHT + ROW_GAP));
  });

  it("gives a shared film a card in every lane that has it, directly above its node (row 0) or a row of cards higher", () => {
    for (const lane of [0, 1, 2]) {
      const { height } = boxes[lane];
      for (const p of items[lane]) {
        if (p.overflow) continue;
        const cardBottom = cardTopInLane(p.row, height) + CARD_HEIGHT;
        expect(lineYInLane(height) - cardBottom).toBe(LINE_TO_CARD + p.row * (CARD_HEIGHT + ROW_GAP));
      }
      for (const p of items[lane]) if (priorityIds.has(p.film.id)) expect(p.overflow).toBe(false);
    }
  });
});

describe("packing into the rows", () => {
  it("puts a film of row 0 below a film of row 1 on the page", () => {
    const films = [f(1, "2000-06-01", 900), f(2, "2000-06-02", 100)];
    const [a, b] = packFilms(films, { ...base, maxRows: 2 });
    expect([a.row, b.row]).toEqual([0, 1]);
    const height = laneHeight(2);
    expect(cardTopInLane(a.row, height)).toBeGreaterThan(cardTopInLane(b.row, height));
  });

  it("keeps every card inside its lane and clear of the line and of the other rows, for every row count", () => {
    for (const rows of [1, 2, 3, 4]) {
      const height = laneHeight(rows);
      const line = lineYInLane(height);
      const spans = Array.from({ length: rows }, (_, row) => {
        const top = cardTopInLane(row, height);
        return [top, top + CARD_HEIGHT] as const;
      }).sort((a, b) => a[0] - b[0]);
      expect(spans[0][0]).toBeGreaterThanOrEqual(0);
      expect(spans[rows - 1][1]).toBeLessThan(line);
      for (let i = 1; i < spans.length; i++) expect(spans[i][0] - spans[i - 1][1]).toBe(ROW_GAP);
    }
  });
});
