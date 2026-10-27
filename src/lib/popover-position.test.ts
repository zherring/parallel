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

describe("placePopover: keeping a side when the card's height changes", () => {
  it("stays above, anchored at the trigger, when a card that opened above shrinks", () => {
    const trigger = box(700, 800);
    const tall = { width: 400, height: 300 };
    const short = { width: 400, height: 240 };
    const opened = placePopover(trigger, tall, viewport);
    expect(opened.placement).toBe("above");

    const resized = placePopover(trigger, short, viewport, { prefer: opened.placement });
    expect(resized.placement).toBe("above");
    // The edge facing the trigger did not move; only the far edge did.
    expect(resized.top + short.height).toBe(opened.top + tall.height);
  });

  it("stays below with the same top edge when a card that opened below shrinks", () => {
    const trigger = box(700, 200);
    const tall = { width: 400, height: 300 };
    const short = { width: 400, height: 240 };
    const opened = placePopover(trigger, tall, viewport);
    const resized = placePopover(trigger, short, viewport, { prefer: opened.placement });
    expect(resized.placement).toBe("below");
    expect(resized.top).toBe(opened.top);
  });

  it("does not hop below just because a card that opened above got short enough to fit there", () => {
    const trigger = box(700, 450);
    const small = { width: 1440, height: 700 }; // 204px of room below, 432px above
    const tall = { width: 400, height: 300 };
    const short = { width: 400, height: 200 };
    expect(placePopover(trigger, tall, small).placement).toBe("above");
    expect(placePopover(trigger, short, small).placement).toBe("below"); // what a fresh placement would do
    expect(placePopover(trigger, short, small, { prefer: "above" }).placement).toBe("above");
  });

  it("gives the preference up when the card no longer fits on that side", () => {
    const trigger = box(700, 450);
    const tall = { width: 400, height: 300 };
    const small_viewport = { width: 1440, height: 700 };
    // 700 - 8 - 488 = 204 below: too small; above has room.
    expect(placePopover(trigger, tall, small_viewport, { prefer: "below" }).placement).toBe("above");
    expect(placePopover(trigger, tall, viewport, { prefer: "above" }).placement).toBe("above");
  });

  it("still clamps into the viewport with a preference", () => {
    const result = placePopover(box(1420, 300), card, viewport, { prefer: "below" });
    expect(result.left + card.width).toBe(viewport.width - POPOVER_MARGIN);
  });
});
