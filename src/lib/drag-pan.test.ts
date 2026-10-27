import { describe, expect, it } from "vitest";
import {
  DRAG_THRESHOLD,
  canStartPan,
  movedPastThreshold,
  nextPanScroll,
  pressOnScrollbar,
  scrollBounds,
  type PanPress,
  type ScrollBounds,
} from "@/lib/drag-pan";

const press = (overrides: Partial<PanPress> = {}, target: Partial<PanPress["target"]> = {}): PanPress => ({
  pointerType: "mouse",
  button: 0,
  isPrimary: true,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  ...overrides,
  target: { interactive: false, inHeader: false, onScrollbar: false, ...target },
});

describe("canStartPan", () => {
  it("starts on the empty surface with a mouse or a pen", () => {
    expect(canStartPan(press())).toBe(true);
    expect(canStartPan(press({ pointerType: "pen" }))).toBe(true);
  });

  it("never takes over touch, which keeps its native scrolling", () => {
    expect(canStartPan(press({ pointerType: "touch" }))).toBe(false);
  });

  it("only starts with the primary button", () => {
    expect(canStartPan(press({ button: 1 }))).toBe(false); // middle
    expect(canStartPan(press({ button: 2 }))).toBe(false); // right: the context menu
    expect(canStartPan(press({ button: -1 }))).toBe(false);
  });

  it("ignores a pointer that is not the primary one", () => {
    expect(canStartPan(press({ isPrimary: false }))).toBe(false);
  });

  it("leaves presses with Ctrl, Meta or Alt to the browser", () => {
    expect(canStartPan(press({ ctrlKey: true }))).toBe(false);
    expect(canStartPan(press({ metaKey: true }))).toBe(false);
    expect(canStartPan(press({ altKey: true }))).toBe(false);
  });

  it("does not start on an interactive element: a film, a button, a link", () => {
    expect(canStartPan(press({}, { interactive: true }))).toBe(false);
  });

  it("does not start in a lane header, whose text and buttons keep working", () => {
    expect(canStartPan(press({}, { inHeader: true }))).toBe(false);
    expect(canStartPan(press({}, { inHeader: true, interactive: true }))).toBe(false);
  });

  it("does not start on the scrollbar", () => {
    expect(canStartPan(press({}, { onScrollbar: true }))).toBe(false);
  });
});

describe("movedPastThreshold", () => {
  it("is false for a click that wobbles a little", () => {
    expect(movedPastThreshold(0, 0)).toBe(false);
    expect(movedPastThreshold(1, -2)).toBe(false);
    expect(movedPastThreshold(DRAG_THRESHOLD - 1, 0)).toBe(false);
    expect(movedPastThreshold(0, -(DRAG_THRESHOLD - 0.1))).toBe(false);
  });

  it("is true from the threshold on, in either direction and either axis", () => {
    expect(movedPastThreshold(DRAG_THRESHOLD, 0)).toBe(true);
    expect(movedPastThreshold(-DRAG_THRESHOLD, 0)).toBe(true);
    expect(movedPastThreshold(0, DRAG_THRESHOLD)).toBe(true);
    expect(movedPastThreshold(0, -DRAG_THRESHOLD)).toBe(true);
  });

  it("counts the diagonal distance, not each axis", () => {
    expect(movedPastThreshold(3, 3)).toBe(true); // 4.24
    expect(movedPastThreshold(2, 2)).toBe(false); // 2.83
  });

  it("takes another threshold", () => {
    expect(movedPastThreshold(7, 0, 8)).toBe(false);
    expect(movedPastThreshold(8, 0, 8)).toBe(true);
  });
});

describe("scrollBounds", () => {
  it("is what the content has beyond the scroller, per axis", () => {
    expect(scrollBounds({ scrollWidth: 5000, clientWidth: 1200, scrollHeight: 900, clientHeight: 600 })).toEqual({
      maxLeft: 3800,
      maxTop: 300,
    });
  });

  it("is zero on an axis where the content fits (or is smaller)", () => {
    expect(scrollBounds({ scrollWidth: 800, clientWidth: 800, scrollHeight: 400, clientHeight: 600 })).toEqual({
      maxLeft: 0,
      maxTop: 0,
    });
  });
});

describe("nextPanScroll", () => {
  const bounds: ScrollBounds = { maxLeft: 3800, maxTop: 300 };
  const start = { left: 1000, top: 100 };

  it("moves the content with the pointer: dragging right scrolls left, dragging down scrolls up", () => {
    expect(nextPanScroll(start, 120, 0, bounds)).toEqual({ left: 880, top: 100 });
    expect(nextPanScroll(start, 0, 40, bounds)).toEqual({ left: 1000, top: 60 });
  });

  it("is the reverse for the reversed direction: dragging left scrolls right, dragging up scrolls down", () => {
    expect(nextPanScroll(start, -250, 0, bounds)).toEqual({ left: 1250, top: 100 });
    expect(nextPanScroll(start, 0, -75, bounds)).toEqual({ left: 1000, top: 175 });
  });

  it("pans both axes at once", () => {
    expect(nextPanScroll(start, -30, -20, bounds)).toEqual({ left: 1030, top: 120 });
  });

  it("does not move without pointer movement", () => {
    expect(nextPanScroll(start, 0, 0, bounds)).toEqual(start);
  });

  it("clamps at the start of both axes", () => {
    expect(nextPanScroll(start, 5000, 5000, bounds)).toEqual({ left: 0, top: 0 });
    expect(nextPanScroll({ left: 0, top: 0 }, 10, 10, bounds)).toEqual({ left: 0, top: 0 });
  });

  it("clamps at the end of both axes", () => {
    expect(nextPanScroll(start, -9000, -9000, bounds)).toEqual({ left: 3800, top: 300 });
    expect(nextPanScroll({ left: 3800, top: 300 }, -10, -10, bounds)).toEqual({ left: 3800, top: 300 });
  });

  it("answers from the start of the drag, so dragging past an end and back does not drift", () => {
    // 5000px past the end, then back to 100px from where the press began: the content is where 100px says.
    expect(nextPanScroll(start, -5000, 0, bounds).left).toBe(3800);
    expect(nextPanScroll(start, -100, 0, bounds).left).toBe(1100);
  });

  it("leaves an axis that cannot scroll where it is (0), whatever the pointer does", () => {
    const flat: ScrollBounds = { maxLeft: 3800, maxTop: 0 };
    expect(nextPanScroll({ left: 1000, top: 0 }, -50, 200, flat)).toEqual({ left: 1050, top: 0 });
    expect(nextPanScroll({ left: 1000, top: 0 }, -50, -200, flat)).toEqual({ left: 1050, top: 0 });
  });

  it("does nothing when the content fits on both axes", () => {
    expect(nextPanScroll({ left: 0, top: 0 }, -300, -300, { maxLeft: 0, maxTop: 0 })).toEqual({ left: 0, top: 0 });
  });

  it("keeps fractional movement (a high-density pointer) and never returns NaN or a negative", () => {
    expect(nextPanScroll(start, 0.5, -0.25, bounds)).toEqual({ left: 999.5, top: 100.25 });
    expect(nextPanScroll(start, Number.NaN, Number.POSITIVE_INFINITY, bounds)).toEqual({ left: 0, top: 0 });
    expect(nextPanScroll(start, 0, 0, { maxLeft: -5, maxTop: -5 })).toEqual({ left: 0, top: 0 });
  });
});

describe("pressOnScrollbar", () => {
  // A scroller at (100, 50) with a 1px border, 800x500 of client area and a 10px scrollbar on the right and at the bottom.
  const box = { left: 100, top: 50, clientLeft: 1, clientTop: 1, clientWidth: 800, clientHeight: 500 };

  it("is false inside the client area, border included at the start", () => {
    expect(pressOnScrollbar(101, 51, box)).toBe(false);
    expect(pressOnScrollbar(500, 300, box)).toBe(false);
    expect(pressOnScrollbar(100, 50, box)).toBe(false); // the border itself
    expect(pressOnScrollbar(900, 550, box)).toBe(false); // last pixel of the client area
  });

  it("is true on the vertical scrollbar, on the horizontal scrollbar and in the corner", () => {
    expect(pressOnScrollbar(902, 300, box)).toBe(true);
    expect(pressOnScrollbar(500, 552, box)).toBe(true);
    expect(pressOnScrollbar(905, 555, box)).toBe(true);
  });

  it("is never true for an overlay scrollbar, which takes no room", () => {
    // Client area = border box less the borders: nothing is left to the right of or below it but the border.
    const overlay = { left: 100, top: 50, clientLeft: 1, clientTop: 1, clientWidth: 810, clientHeight: 510 };
    expect(pressOnScrollbar(909, 559, overlay)).toBe(false);
  });
});
