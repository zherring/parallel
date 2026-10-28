import { describe, expect, it } from "vitest";
import { mapLimited } from "@/lib/map-limited";

const tick = () => new Promise((resolve) => setTimeout(resolve, 1));

describe("mapLimited", () => {
  it("never runs more than the limit at once and keeps the input order", async () => {
    let running = 0;
    let peak = 0;
    const results = await mapLimited(Array.from({ length: 20 }, (_, i) => i), 6, async (n) => {
      running++;
      peak = Math.max(peak, running);
      await tick();
      running--;
      return n * 2;
    });
    expect(peak).toBe(6);
    expect(results.map((r) => (r.status === "fulfilled" ? r.value : null))).toEqual(
      Array.from({ length: 20 }, (_, i) => i * 2),
    );
  });

  it("settles each item on its own, so one failure keeps the rest", async () => {
    const results = await mapLimited([1, 2, 3], 2, async (n) => {
      if (n === 2) throw new Error("boom");
      return n;
    });
    expect(results.map((r) => r.status)).toEqual(["fulfilled", "rejected", "fulfilled"]);
    expect((results[1] as PromiseRejectedResult).reason).toEqual(new Error("boom"));
  });

  it("handles an empty list and a limit below one", async () => {
    expect(await mapLimited([], 6, async () => 1)).toEqual([]);
    const results = await mapLimited([1, 2], 0, async (n) => n);
    expect(results.map((r) => r.status)).toEqual(["fulfilled", "fulfilled"]);
  });
});
