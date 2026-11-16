import { describe, expect, it } from "vitest";
import { buildFrame, jitterForWidth } from "./rough-frame";

const base = { w: 64, h: 96, margin: 10, offset: 3, jitter: 35, style: "rough" as const };

describe("rough frame", () => {
  it("picks the jitter by the poster's width", () => {
    expect([50, 69, 70, 119, 120, 300].map(jitterForWidth)).toEqual([35, 35, 25, 25, 20, 20]);
  });

  it("is the same cut for the same seed, and another for another", () => {
    const a = buildFrame({ ...base, seeds: ["1:2+3:a", "1:2+3:b"] });
    expect(buildFrame({ ...base, seeds: ["1:2+3:a", "1:2+3:b"] })).toEqual(a);
    expect(buildFrame({ ...base, seeds: ["9:2+3:a", "9:2+3:b"] }).shapes[0]).not.toEqual(a.shapes[0]);
    expect(a.shapes).toHaveLength(2);
  });

  it("draws one shape around the poster for one person, wider than the poster", () => {
    const { shapes, view } = buildFrame({ ...base, seeds: ["1:2:a"] });
    expect(shapes).toHaveLength(1);
    expect(view.x0).toBeLessThan(0);
    expect(view.y1).toBeGreaterThan(96);
  });
});
