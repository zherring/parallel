import { describe, expect, it } from "vitest";
import { TtlCache } from "@/lib/ttl-cache";

describe("TtlCache", () => {
  it("forgets an entry once its time to live has passed", () => {
    let now = 1_000;
    const cache = new TtlCache<string, number>(10, 500, () => now);
    cache.set("a", 1);
    now += 499;
    expect(cache.get("a")).toBe(1);
    now += 1;
    expect(cache.get("a")).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it("starts the clock again when a key is set again", () => {
    let now = 0;
    const cache = new TtlCache<string, number>(10, 100, () => now);
    cache.set("a", 1);
    now = 90;
    cache.set("a", 2);
    now = 150;
    expect(cache.get("a")).toBe(2);
  });

  it("drops the least recently used entry when full, and a read counts as use", () => {
    const cache = new TtlCache<string, number>(2, 1_000, () => 0);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.get("a");
    cache.set("c", 3);
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("a")).toBe(1);
    expect(cache.get("c")).toBe(3);
    expect(cache.size).toBe(2);
  });

  it("clears", () => {
    const cache = new TtlCache<string, number>(2, 1_000, () => 0);
    cache.set("a", 1);
    cache.clear();
    expect(cache.get("a")).toBeUndefined();
  });
});
