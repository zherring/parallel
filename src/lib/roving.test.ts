import { describe, expect, it } from "vitest";
import { rovingIndex, tabStopId } from "@/lib/roving";

describe("rovingIndex", () => {
  it("moves one node along the line", () => {
    expect(rovingIndex("ArrowRight", 2, 6)).toBe(3);
    expect(rovingIndex("ArrowLeft", 2, 6)).toBe(1);
  });

  it("stops at both ends instead of wrapping", () => {
    expect(rovingIndex("ArrowLeft", 0, 6)).toBe(0);
    expect(rovingIndex("ArrowRight", 5, 6)).toBe(5);
  });

  it("jumps to the first and last node", () => {
    expect(rovingIndex("Home", 4, 6)).toBe(0);
    expect(rovingIndex("End", 1, 6)).toBe(5);
  });

  it("ignores keys that do not move focus (Enter and Space activate the button themselves)", () => {
    for (const key of ["Enter", " ", "Tab", "ArrowUp", "ArrowDown", "a"]) expect(rovingIndex(key, 2, 6)).toBeNull();
  });

  it("copes with an unknown current node and an empty lane", () => {
    expect(rovingIndex("ArrowRight", -1, 3)).toBe(1);
    expect(rovingIndex("ArrowLeft", -1, 3)).toBe(0);
    expect(rovingIndex("ArrowRight", 0, 0)).toBeNull();
    expect(rovingIndex("Home", 0, 0)).toBeNull();
  });
});

describe("tabStopId", () => {
  const none = new Set<number>();

  it("keeps the node that was last focused while it is still in the lane", () => {
    expect(tabStopId([1, 2, 3], 2, none)).toBe(2);
    expect(tabStopId([1, 2, 3], 2, new Set([3]))).toBe(2);
  });

  it("starts at the first shared film so a tab lands where the view starts", () => {
    expect(tabStopId([1, 2, 3, 4], undefined, new Set([3, 4]))).toBe(3);
  });

  it("falls back to the first node, also when the stored one was filtered out", () => {
    expect(tabStopId([5, 6], undefined, none)).toBe(5);
    expect(tabStopId([5, 6], 99, none)).toBe(5);
    expect(tabStopId([5, 6], 99, new Set([6]))).toBe(6);
  });

  it("is null for an empty lane", () => {
    expect(tabStopId([], undefined, none)).toBeNull();
    expect(tabStopId([], 4, new Set([4]))).toBeNull();
  });
});
