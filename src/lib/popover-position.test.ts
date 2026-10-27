import { describe, expect, it } from "vitest";
import { POPOVER_GAP, POPOVER_MARGIN, placePopover, type Box } from "@/lib/popover-position";

const viewport = { width: 1440, height: 900 };
const card = { width: 400, height: 240 };
const box = (left: number, top: number, width = 24, height = 28): Box => ({
  left,
  top,
  right: left + width,
  bottom: top + height,
});

describe("placePopover", () => {
  it("centres the card under the trigger when it fits", () => {
    const result = placePopover(box(700, 200), card, viewport);
    expect(result.placement).toBe("below");
    expect(result.top).toBe(228 + POPOVER_GAP);
    expect(result.left).toBe(712 - 200);
  });

  it("flips above when there is no room below but enough above", () => {
    const trigger = box(700, 800);
    const result = placePopover(trigger, card, viewport);
    expect(result.placement).toBe("above");
    expect(result.top).toBe(trigger.top - POPOVER_GAP - card.height);
    expect(result.top + card.height).toBeLessThanOrEqual(trigger.top);
  });

  it("stays below when it does not fit either way but below has more room", () => {
    const short = { width: 1440, height: 300 };
    const trigger = box(700, 40);
    const result = placePopover(trigger, card, short);
    expect(result.placement).toBe("below");
    expect(result.top + card.height).toBeLessThanOrEqual(short.height - POPOVER_MARGIN);
  });

  it("takes the roomier side when neither fits", () => {
    const short = { width: 1440, height: 300 };
    const result = placePopover(box(700, 200), card, short);
    expect(result.placement).toBe("above");
    expect(result.top).toBeGreaterThanOrEqual(POPOVER_MARGIN);
  });

  it("clamps at the right edge, as for a node near the end of the timeline", () => {
    const result = placePopover(box(1420, 300), card, viewport);
    expect(result.left + card.width).toBe(viewport.width - POPOVER_MARGIN);
  });

  it("clamps at the left edge", () => {
    const result = placePopover(box(2, 300), card, viewport);
    expect(result.left).toBe(POPOVER_MARGIN);
  });

  it("shrinks into a narrow viewport rather than leaving it", () => {
    const narrow = { width: 375, height: 700 };
    const wide = { width: 359, height: 240 };
    const result = placePopover(box(300, 200), wide, narrow);
    expect(result.left).toBe(POPOVER_MARGIN);
    expect(result.left + wide.width).toBeLessThanOrEqual(narrow.width - POPOVER_MARGIN);
  });

  it("sticks to the top margin when the card is taller than the viewport", () => {
    const result = placePopover(box(700, 200), { width: 400, height: 2000 }, viewport);
    expect(result.top).toBe(POPOVER_MARGIN);
  });

  it("takes a custom gap and margin", () => {
    const result = placePopover(box(700, 200), card, viewport, { gap: 0, margin: 0 });
    expect(result.top).toBe(228);
    expect(placePopover(box(0, 200), card, viewport, { margin: 0 }).left).toBe(0);
  });
});
