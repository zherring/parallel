import { describe, expect, it } from "vitest";
import { nodeOnlyIds, rovingIndex, tabStopId } from "@/lib/roving";

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
  it("keeps the node that was last focused while it is still in the lane", () => {
    expect(tabStopId([1, 2, 3], 2)).toBe(2);
  });

  it("starts at the first node", () => {
    expect(tabStopId([5, 6], undefined)).toBe(5);
  });

  it("falls back to the first node when the stored one has left the lane (it got a card, or was filtered out)", () => {
    expect(tabStopId([5, 6], 99)).toBe(5);
  });

  it("is null when no film of the lane is only a node", () => {
    expect(tabStopId([], undefined)).toBeNull();
    expect(tabStopId([], 4)).toBeNull();
  });
});

describe("nodeOnlyIds", () => {
  const item = (id: number, overflow: boolean) => ({ film: { id }, overflow });

  it("lists only the films without a card in the lane, in order", () => {
    expect(nodeOnlyIds([item(1, false), item(2, true), item(3, false), item(4, true)])).toEqual([2, 4]);
  });

  it("is empty when every film of the lane has a card: no node is a control then", () => {
    expect(nodeOnlyIds([item(1, false), item(2, false)])).toEqual([]);
    expect(tabStopId(nodeOnlyIds([item(1, false)]), undefined)).toBeNull();
    expect(nodeOnlyIds([])).toEqual([]);
  });

  it("gives a film one control per lane: a card in one lane and a node in another is a roving stop only in the second", () => {
    const first = [item(7, false), item(8, true)];
    const second = [item(7, true), item(8, false)];
    expect(nodeOnlyIds(first)).toEqual([8]);
    expect(nodeOnlyIds(second)).toEqual([7]);
    expect(tabStopId(nodeOnlyIds(second), 8)).toBe(7);
  });
});
