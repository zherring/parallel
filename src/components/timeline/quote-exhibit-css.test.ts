import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./quote-exhibit.css", import.meta.url), "utf8");
/** The rules without their comments and without the `@supports` conditions (which only ask whether the arithmetic parses). */
const rules = css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/@supports \([^\n]*\) \{/g, "@supports {");
const DIVISION = "@supports (width: calc(1px * (1rem / 1px)))";

describe("the fit of the quote's type", () => {
  // `@supports` says only that tan(atan2(length, 1px)) parses, and Safari 26.6 parses it and computes 0 (or noise) for a length that is not in pixels (1rem, 100cqh,
  // 1em), so the quote's font-size was 0px and the quote was not drawn. Chromium and Playwright's WebKit compute it right, so no browser run here can catch that:
  // the stylesheet is what is checked. Each length the fit turns into a number is turned into one by a division as well, in a rule after the tan(atan2()) ones.
  const at = css.indexOf(DIVISION);
  const lengthToNumber = [...rules.matchAll(/(--fit-[a-z-]+): tan\(atan2\(/g)].map((match) => match[1]);

  it("reads every length in pixels by a division too, after the tan(atan2()) it falls back to", () => {
    expect(lengthToNumber.length).toBeGreaterThan(0);
    const division = css.slice(at);
    expect(at).toBeGreaterThan(-1);
    expect(css.lastIndexOf("tan(atan2(var(--quote-")).toBeLessThan(at);
    for (const name of lengthToNumber) expect(division, name).toMatch(new RegExp(`${name}: calc\\([^;]*/ 1px\\);`));
    expect([...division.matchAll(/(--fit-[a-z-]+):/g)].map((match) => match[1]).sort()).toEqual([...lengthToNumber].sort());
    expect(division).not.toContain("atan2");
  });

  it("takes a length's pixels only in those declarations, so the size is never taken from arithmetic Safari gets wrong", () => {
    expect(rules.match(/atan2\(/g)?.length).toBe(lengthToNumber.length);
  });
});
