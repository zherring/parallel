import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The frame under `lg` (src/components/bacon-frame.tsx) is CSS: this holds its rules to what the owner asked for, where a unit test can read them (the browser spec, bacon-mode.spec.ts, holds the rest).
const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
const component = readFileSync(join(process.cwd(), "src/components/bacon-frame.tsx"), "utf8");
const badge = readFileSync(join(process.cwd(), "src/components/bacon-mode-badge.tsx"), "utf8");

/** The declarations of the first rule that starts with `selector`, as written. */
function ruleOf(selector: string): string {
  const match = new RegExp(`${selector.replace(/[[\]]/g, "\\$&")}\\s*\\{([^}]*)\\}`).exec(css);
  expect(match, selector).not.toBeNull();
  return match![1];
}

describe("the frame's CSS", () => {
  it("keeps the line clear of every safe area: a notch, the home indicator, and the rounded corners", () => {
    const frame = ruleOf("[data-bacon-frame]");
    for (const side of ["top", "right", "bottom", "left"]) expect(frame).toContain(`env(safe-area-inset-${side})`);
    // The plaque is on the frame's left line, so it has the left inset.
    expect(ruleOf("[data-bacon-plaque]")).toContain("env(safe-area-inset-left)");
  });

  it("comes in only for a visitor who has not asked for less motion: the entrance is not a rule of the frame itself", () => {
    expect(ruleOf("[data-bacon-frame]")).not.toContain("animation");
    expect(ruleOf("[data-bacon-plaque]")).not.toContain("animation");
    const motion = /@media \(prefers-reduced-motion: no-preference\) \{([\s\S]*?)\n\}/.exec(css);
    expect(motion, "the entrance sits in a no-preference media query").not.toBeNull();
    expect(motion![1]).toContain("[data-bacon-frame][data-enter]");
    expect(motion![1]).toContain("[data-bacon-plaque][data-enter]");
  });
});

describe("the frame's markup", () => {
  it("is decoration that takes no pointer, is hidden from assistive technology, and is gone from lg up", () => {
    const line = /<div[^>]*data-bacon-frame[^>]*>/.exec(component)?.[0] ?? "";
    expect(line).toContain("pointer-events-none");
    expect(line).toContain('aria-hidden="true"');
    expect(line).toContain("lg:hidden");
    expect(line).toContain("fixed");
    expect(line).toContain("border-accent-orange");
  });

  it("has the plaque as the badge's own link (the one leave behaviour), hidden from lg up, under the bar", () => {
    expect(component).toContain("<BaconModeBadge plaque");
    expect(component).toMatch(/<BaconModeBadge plaque[^>]*lg:hidden/);
    // Under the bar (z-30) and under the line (z-[35]): what the bar opens, and the hero's band, cover it.
    expect(component).toMatch(/<BaconModeBadge plaque[^>]*z-\[25\]/);
    expect(badge).toContain("searchWithoutBaconMode(search)");
    expect(badge).toContain("aria-label={`Leave ${BACON_MODE_LABEL}`}");
  });
});
