import { describe, expect, it } from "vitest";
import { laneScrollTop, mostVisibleLane } from "@/lib/lane-dock";
import { AXIS_HEIGHT, stackLanes } from "@/lib/timeline-layout";

// Two-row lanes are 338px tall, one-row lanes 188px (see laneHeight).
const boxes = stackLanes([2, 2, 2, 1]);

describe("mostVisibleLane", () => {
  it("is the first lane at the top", () => {
    expect(mostVisibleLane(boxes, 0, 760)).toBe(0);
  });

  it("follows the scroll position", () => {
    expect(mostVisibleLane(boxes, boxes[1].top, 400)).toBe(1);
    expect(mostVisibleLane(boxes, boxes[2].top, 400)).toBe(2);
    expect(mostVisibleLane(boxes, boxes[3].top, 400)).toBe(3);
  });

  it("picks the lane with the larger share showing when two are cut off", () => {
    // Visible lane area is [scrollTop + 44, scrollTop + 400]. At scrollTop 250 that is y 294..650:
    // lane 0 (content y 44..382) shows 88 of its 338px, lane 1 (382..720) shows 268 of its 338px.
    expect(mostVisibleLane(boxes, 250, 400)).toBe(1);
    // At scrollTop 100 (y 144..500) it is 238px of lane 0 against 118px of lane 1.
    expect(mostVisibleLane(boxes, 100, 400)).toBe(0);
  });

  it("does not let a tall lane beat a short first lane while both are fully on screen", () => {
    // 188px, 338px and 338px lanes in a 633px scroller: the first two are completely visible.
    const mixed = stackLanes([1, 2, 2]);
    expect(mostVisibleLane(mixed, 0, 633)).toBe(0);
  });

  it("prefers the lane that is fully visible over a partly hidden one", () => {
    const mixed = stackLanes([1, 2, 2]);
    // Scrolled to the bottom (content is 44 + 864 tall): lane 1 is cut off, lane 2 is complete.
    expect(mostVisibleLane(mixed, 44 + 864 - 633, 633)).toBe(2);
  });

  it("treats a lane taller than the viewport as fully visible when it fills it", () => {
    const tall = stackLanes([3, 3]);
    expect(mostVisibleLane(tall, tall[1].top, 300)).toBe(1);
    expect(mostVisibleLane(tall, 0, 300)).toBe(0);
  });

  it("ignores the area hidden under the sticky axis header", () => {
    // Lane 0 spans content y 44..382. With scrollTop 300 the header covers 300..344, so 38px of
    // lane 0 is really visible (344..382) against 318px of lane 1.
    expect(mostVisibleLane(boxes, 300, 400)).toBe(1);
  });

  it("breaks ties towards the earlier lane", () => {
    const equal = stackLanes([1, 1]);
    // Lanes span content y 44..232 and 232..420; the visible area 138..326 covers 94px of each.
    expect(mostVisibleLane(equal, 94, 232)).toBe(0);
  });

  it("copes with overscroll and short lists", () => {
    expect(mostVisibleLane(boxes, -50, 760)).toBe(0);
    expect(mostVisibleLane(boxes, 99_999, 760)).toBe(0);
    expect(mostVisibleLane([], 0, 760)).toBe(-1);
    expect(mostVisibleLane(stackLanes([1]), 0, 760)).toBe(0);
  });

  it("uses the axis height as the default header", () => {
    expect(mostVisibleLane(boxes, 0, AXIS_HEIGHT + 100)).toBe(mostVisibleLane(boxes, 0, AXIS_HEIGHT + 100, AXIS_HEIGHT));
  });
});

describe("laneScrollTop", () => {
  it("is the lane's top, which lands it right under the axis header", () => {
    expect(laneScrollTop(boxes, 0)).toBe(0);
    expect(laneScrollTop(boxes, 1)).toBe(boxes[1].top);
    expect(laneScrollTop(boxes, 3)).toBe(boxes[3].top);
  });

  it("is 0 for an unknown lane", () => {
    expect(laneScrollTop(boxes, 9)).toBe(0);
    expect(laneScrollTop([], 0)).toBe(0);
  });
});
