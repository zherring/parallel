import { describe, expect, it } from "vitest";
import { PLACEHOLDER_TINT_PERCENT, placeholderFill } from "@/lib/poster-placeholder";
import { personColor } from "@/lib/person-colors";

describe("placeholderFill", () => {
  it("is the plain surface when there is nothing to tint it with (a page of one person)", () => {
    expect(placeholderFill(null)).toBe("var(--surface)");
  });

  it("mixes a faint share of the tint into the surface: green for a film made together, the person's colour for theirs", () => {
    expect(placeholderFill("var(--lit)")).toBe(`color-mix(in srgb, var(--lit) ${PLACEHOLDER_TINT_PERCENT}%, var(--surface))`);
    expect(placeholderFill(personColor(0))).toBe(`color-mix(in srgb, var(--person-1) ${PLACEHOLDER_TINT_PERCENT}%, var(--surface))`);
  });

  it("is a hint, not a block of colour: under a fifth of the tint, over a twentieth", () => {
    expect(PLACEHOLDER_TINT_PERCENT).toBeGreaterThan(5);
    expect(PLACEHOLDER_TINT_PERCENT).toBeLessThan(20);
  });
});
