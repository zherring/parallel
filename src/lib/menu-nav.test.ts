import { describe, expect, it } from "vitest";
import { menuIndex } from "@/lib/menu-nav";

describe("menuIndex", () => {
  it("moves down and wraps to the first item", () => {
    expect(menuIndex("ArrowDown", 0, 3)).toBe(1);
    expect(menuIndex("ArrowDown", 1, 3)).toBe(2);
    expect(menuIndex("ArrowDown", 2, 3)).toBe(0);
  });

  it("moves up and wraps to the last item", () => {
    expect(menuIndex("ArrowUp", 2, 3)).toBe(1);
    expect(menuIndex("ArrowUp", 0, 3)).toBe(2);
  });

  it("starts at the first or last item when focus is not on an item", () => {
    expect(menuIndex("ArrowDown", -1, 3)).toBe(0);
    expect(menuIndex("ArrowUp", -1, 3)).toBe(2);
  });

  it("jumps to the ends with Home and End", () => {
    expect(menuIndex("Home", 2, 3)).toBe(0);
    expect(menuIndex("End", 0, 3)).toBe(2);
  });

  it("ignores other keys and empty menus", () => {
    expect(menuIndex("a", 0, 3)).toBeNull();
    expect(menuIndex("Tab", 0, 3)).toBeNull();
    expect(menuIndex("ArrowDown", 0, 0)).toBeNull();
  });

  it("walks the five items of the share menu (X, Bluesky, Copy link, Copy image, More) and wraps both ways", () => {
    const order = [0];
    for (let step = 0; step < 6; step++) order.push(menuIndex("ArrowDown", order[order.length - 1], 5) as number);
    expect(order).toEqual([0, 1, 2, 3, 4, 0, 1]);
    expect(menuIndex("ArrowUp", 0, 5)).toBe(4);
    expect(menuIndex("End", 1, 5)).toBe(4);
    expect(menuIndex("Home", 3, 5)).toBe(0);
  });

  it("copes with the menu losing items (Copy image or More hidden)", () => {
    // Without Copy image or More: X, Bluesky, Copy link.
    expect(menuIndex("ArrowDown", 2, 3)).toBe(0);
    expect(menuIndex("ArrowUp", 0, 3)).toBe(2);
    // Without More only: four items.
    expect(menuIndex("ArrowDown", 3, 4)).toBe(0);
    expect(menuIndex("End", 0, 4)).toBe(3);
  });

  it("stays put in a one-item menu", () => {
    expect(menuIndex("ArrowDown", 0, 1)).toBe(0);
    expect(menuIndex("ArrowUp", 0, 1)).toBe(0);
  });
});
