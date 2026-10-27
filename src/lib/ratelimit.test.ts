import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clientIp, createRateLimiter } from "@/lib/ratelimit";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("createRateLimiter", () => {
  it("allows up to the limit then blocks", () => {
    const check = createRateLimiter({ limit: 3, windowMs: 60_000 });
    expect([1, 2, 3, 4].map(() => check("a").allowed)).toEqual([true, true, true, false]);
  });

  it("defaults to 60 requests per minute", () => {
    const check = createRateLimiter();
    const results = Array.from({ length: 61 }, () => check("a").allowed);
    expect(results.filter(Boolean)).toHaveLength(60);
    expect(results[60]).toBe(false);
  });

  it("tracks keys independently", () => {
    const check = createRateLimiter({ limit: 1 });
    expect(check("a").allowed).toBe(true);
    expect(check("a").allowed).toBe(false);
    expect(check("b").allowed).toBe(true);
  });

  it("reports seconds until the window resets", () => {
    const check = createRateLimiter({ limit: 1, windowMs: 60_000 });
    check("a");
    vi.advanceTimersByTime(45_500);
    expect(check("a")).toEqual({ allowed: false, retryAfter: 15 });
  });

  it("resets after the window passes", () => {
    const check = createRateLimiter({ limit: 1, windowMs: 60_000 });
    check("a");
    expect(check("a").allowed).toBe(false);
    vi.advanceTimersByTime(60_000);
    expect(check("a").allowed).toBe(true);
  });

  it("sweeps expired windows so stale keys don't pile up", () => {
    const check = createRateLimiter({ limit: 1, windowMs: 1000 });
    for (let i = 0; i < 100; i++) check(`ip-${i}`);
    vi.advanceTimersByTime(1000);
    // A stale key was swept, so a fresh window starts at count 1 (allowed).
    expect(check("ip-0").allowed).toBe(true);
    expect(check("ip-0").allowed).toBe(false);
  });
});

describe("clientIp", () => {
  const headers = (value?: string) => new Headers(value ? { "x-forwarded-for": value } : {});

  it("uses the first x-forwarded-for hop", () => {
    expect(clientIp(headers("203.0.113.7, 10.0.0.1"))).toBe("203.0.113.7");
  });

  it("falls back to unknown", () => {
    expect(clientIp(headers())).toBe("unknown");
    expect(clientIp(headers(" "))).toBe("unknown");
  });
});
