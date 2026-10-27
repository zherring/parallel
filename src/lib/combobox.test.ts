import { describe, expect, it } from "vitest";
import { moveActive, normalizeQuery } from "@/lib/combobox";

describe("normalizeQuery", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeQuery("  brad   pitt ")).toBe("brad pitt");
    expect(normalizeQuery("\tfincher\n")).toBe("fincher");
    expect(normalizeQuery("   ")).toBe("");
  });
});

describe("moveActive", () => {
  const none = [false, false, false];

  it("moves down and wraps", () => {
    expect(moveActive(none, -1, "next")).toBe(0);
    expect(moveActive(none, 0, "next")).toBe(1);
    expect(moveActive(none, 2, "next")).toBe(0);
  });

  it("moves up and wraps", () => {
    expect(moveActive(none, -1, "prev")).toBe(2);
    expect(moveActive(none, 2, "prev")).toBe(1);
    expect(moveActive(none, 0, "prev")).toBe(2);
  });

  it("jumps to the first and last selectable option", () => {
    expect(moveActive(none, 1, "first")).toBe(0);
    expect(moveActive(none, 1, "last")).toBe(2);
    expect(moveActive([true, false, false, true], 1, "first")).toBe(1);
    expect(moveActive([true, false, false, true], 1, "last")).toBe(2);
  });

  it("skips disabled options", () => {
    const disabled = [false, true, false];
    expect(moveActive(disabled, 0, "next")).toBe(2);
    expect(moveActive(disabled, 2, "prev")).toBe(0);
    expect(moveActive(disabled, 2, "next")).toBe(0);
  });

  it("returns -1 when nothing can be selected", () => {
    expect(moveActive([], -1, "next")).toBe(-1);
    expect(moveActive([true, true], -1, "next")).toBe(-1);
    expect(moveActive([true, true], 0, "last")).toBe(-1);
  });

  it("stays put when there is a single selectable option", () => {
    expect(moveActive([true, false], 1, "next")).toBe(1);
    expect(moveActive([true, false], 1, "prev")).toBe(1);
  });
});
