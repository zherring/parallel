import { describe, expect, it } from "vitest";
import { laneScrollTop, mostVisibleLane } from "@/lib/lane-dock";
import { AXIS_HEIGHT, stackLanes } from "@/lib/timeline-layout";

// Two-row lanes are 338px tall, one-row lanes 188px (see laneHeight). The scroller shows the
// lanes from y = 0 and keeps the AXIS_HEIGHT-tall year axis at its bottom edge, over the lanes.
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
    // Visible lane area is [scrollTop, scrollTop + 400 - 44]. At scrollTop 250 that is y 250..606:
    // lane 0 (y 0..338) shows 88 of its 338px, lane 1 (338..676) shows 268 of its 338px.
    expect(mostVisibleLane(boxes, 250, 400)).toBe(1);
    // At scrollTop 100 (y 100..456) it is 238px of lane 0 against 118px of lane 1.
    expect(mostVisibleLane(boxes, 100, 400)).toBe(0);
  });

  it("does not let a tall lane beat a short first lane while both are fully on screen", () => {
    // 188px, 338px and 338px lanes in a scroller with a 633px lane area: the first two are completely visible.
    const mixed = stackLanes([1, 2, 2]);
    expect(mostVisibleLane(mixed, 0, 633 + AXIS_HEIGHT)).toBe(0);
  });

  it("prefers the lane that is fully visible over a partly hidden one", () => {
    const mixed = stackLanes([1, 2, 2]);
    // Scrolled to the bottom (content is 864 + 44 tall): lane 1 is cut off, lane 2 is complete.
    const clientHeight = 633 + AXIS_HEIGHT;
    expect(mostVisibleLane(mixed, 864 + AXIS_HEIGHT - clientHeight, clientHeight)).toBe(2);
  });

  it("treats a lane taller than the viewport as fully visible when it fills it", () => {
    const tall = stackLanes([3, 3]);
    expect(mostVisibleLane(tall, tall[1].top, 300 + AXIS_HEIGHT)).toBe(1);
    expect(mostVisibleLane(tall, 0, 300 + AXIS_HEIGHT)).toBe(0);
  });

  it("ignores the area hidden under the sticky axis at the bottom", () => {
    // Two 188px lanes, scrollTop 94 in a 232px scroller: the axis covers y 282..326, so the
    // visible lane area is 94..282 and each lane shows 94px. Counting the axis's 44px as visible
    // would hand the second lane 138px and the win.
    const equal = stackLanes([1, 1]);
    expect(mostVisibleLane(equal, 94, 188 + AXIS_HEIGHT)).toBe(0);
    expect(mostVisibleLane(equal, 100, 188 + AXIS_HEIGHT)).toBe(1);
  });

  it("copes with overscroll and short lists", () => {
    expect(mostVisibleLane(boxes, -50, 760)).toBe(0);
    expect(mostVisibleLane(boxes, 99_999, 760)).toBe(0);
    expect(mostVisibleLane([], 0, 760)).toBe(-1);
    expect(mostVisibleLane(stackLanes([1]), 0, 760)).toBe(0);
  });

  it("uses the axis height as the default", () => {
    expect(mostVisibleLane(boxes, 0, AXIS_HEIGHT + 100)).toBe(mostVisibleLane(boxes, 0, AXIS_HEIGHT + 100, AXIS_HEIGHT));
    // Without an axis the whole scroller is lane area, which moves the tie.
    expect(mostVisibleLane(stackLanes([1, 1]), 94, 232, 0)).toBe(1);
  });
});

describe("laneScrollTop", () => {
  it("is the lane's top, which lands it at the top of the scroller", () => {
    expect(laneScrollTop(boxes, 0)).toBe(0);
    expect(laneScrollTop(boxes, 1)).toBe(boxes[1].top);
    expect(laneScrollTop(boxes, 3)).toBe(boxes[3].top);
  });

  it("is 0 for an unknown lane", () => {
    expect(laneScrollTop(boxes, 9)).toBe(0);
    expect(laneScrollTop([], 0)).toBe(0);
  });
});
