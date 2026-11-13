import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { LegendEntry } from "@/lib/connections";
import { ConnectionLegend, pairChipName } from "./connection-legend";

const NAMES = ["Fincher", "Pitt", "Cronenweth"];

describe("pairChipName", () => {
  it("reads as words, without the multiplication sign", () => {
    expect(pairChipName(NAMES, [0, 1], 2)).toBe("Fincher and Pitt, 2 films");
    expect(pairChipName(NAMES, [0, 2], 3)).toBe("Fincher and Cronenweth, 3 films");
  });

  it("says 'film' for one", () => {
    expect(pairChipName(NAMES, [1, 2], 1)).toBe("Pitt and Cronenweth, 1 film");
  });
});

describe("ConnectionLegend chips", () => {
  const entries: LegendEntry[] = [
    { key: "all", slot: null, lanes: null, count: 4 },
    { key: "slot-0", slot: 0, lanes: [0, 1], count: 2 },
    { key: "slot-3", slot: 3, lanes: null, count: 1 },
  ];
  const html = renderToStaticMarkup(
    createElement(ConnectionLegend, {
      entries,
      names: NAMES,
      laneCount: 4,
      activeKey: null,
      pinnedKey: null,
      onPreview: () => {},
      onTogglePin: () => {},
    }),
  );

  it("names a pair chip with 'and', not the sign", () => {
    expect(html).toContain('aria-label="Fincher and Pitt, 2 films"');
  });

  it("leaves the all-lanes and three-lane chips to be named by their text", () => {
    expect(html.match(/aria-label=/g)).toHaveLength(1);
    expect(html).toContain("All four");
    expect(html).toContain("Three of four");
  });
});
