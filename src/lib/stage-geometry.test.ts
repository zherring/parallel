import { describe, expect, it } from "vitest";
import { extensionColumnsFor } from "@/lib/backdrop-posters";
import { CORE_PAD_CSS, GUTTER, GUTTER_CSS, SECTION_GEOMETRY, SEAM, SM_WIDTH, corePadAt, gutterAt, seamAt } from "@/lib/stage-geometry";

// The stage's sideways geometry: the CSS the section and the stage are given, and the same numbers as px for what is worked out in TS (see stage-geometry.ts).

describe("the CSS the stage is given", () => {
  it("is the gutter's clamp, the two seams and the decoration box's inset, from the constants", () => {
    expect(GUTTER_CSS).toBe("clamp(12px, 5vw, 88px)");
    expect(SECTION_GEOMETRY).toEqual({ "--gutter": GUTTER_CSS, "--seam-phone": "6px", "--seam-wide": "12px" });
    expect(CORE_PAD_CSS).toBe("max(var(--gutter), calc((100cqw - 1600px) / 2 + var(--gutter)))");
  });
});

describe("the same numbers in px", () => {
  it("has the gutter a twentieth of the width, from 12px to 88px", () => {
    expect(gutterAt(100)).toBe(GUTTER.min);
    expect(gutterAt(320)).toBe(16);
    expect(gutterAt(1000)).toBe(50);
    expect(gutterAt(1760)).toBe(GUTTER.max);
    expect(gutterAt(3840)).toBe(GUTTER.max);
  });

  it("has the narrow seam below `sm` and the wide one from it", () => {
    expect(seamAt(SM_WIDTH - 1)).toBe(SEAM.phone);
    expect(seamAt(SM_WIDTH)).toBe(SEAM.wide);
  });

  it("insets the decoration box by the gutter, and past 1600px by half of what is left more", () => {
    expect(corePadAt(390)).toBeCloseTo(19.5);
    expect(corePadAt(1600)).toBe(80);
    expect(corePadAt(1920)).toBe(248);
    expect(corePadAt(3840)).toBe(1208);
  });

  it("is what the montage's columns are worked from", () => {
    // 1920px: a core of (960 - 6 - 248) wide, the box 248 in from the edge, so two more columns of a third of the core.
    expect(extensionColumnsFor(1920)).toBe(Math.ceil(248 / ((960 - SEAM.wide / 2 - 248) / 3)));
    expect(extensionColumnsFor(1920)).toBe(2);
  });
});
