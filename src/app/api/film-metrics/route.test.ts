import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/awards", () => ({ awardsFor: vi.fn() }));
vi.mock("@/lib/tmdb", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tmdb")>()),
  getMovieMetrics: vi.fn(),
}));

import { GET } from "@/app/api/film-metrics/route";
import { MAX_BATCH_IDS } from "@/lib/film-metrics-batch";
import { awardsFor } from "@/lib/awards";
import { TmdbError, getMovieMetrics } from "@/lib/tmdb";
import type { MovieMetrics } from "@/lib/types";

const metrics = vi.mocked(getMovieMetrics);
const awards = vi.mocked(awardsFor);

const CACHEABLE = "public, s-maxage=3600, stale-while-revalidate=86400";

const movie = (voteAverage: number): MovieMetrics => ({
  voteAverage,
  voteCount: 1000,
  budget: 10_000_000,
  revenue: 50_000_000,
  releaseDate: "1999-10-15",
});

const get = (ids: string | null) =>
  GET(new Request(`http://localhost/api/film-metrics${ids === null ? "" : `?ids=${ids}`}`));

const body = async (res: Response) => (await res.json()) as { results?: Record<string, unknown>; error?: string };

beforeEach(() => {
  metrics.mockImplementation(async (id) => movie(id / 10));
  awards.mockReturnValue(null);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  metrics.mockReset();
  awards.mockReset();
});

describe("GET /api/film-metrics?ids=", () => {
  it("returns every film's numbers keyed by id, with awards null when it has none", async () => {
    const res = await get("10,20,30");

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({
      results: {
        "10": { ...movie(1), awards: null },
        "20": { ...movie(2), awards: null },
        "30": { ...movie(3), awards: null },
      },
    });
    expect(metrics.mock.calls.map(([id]) => id).sort()).toEqual([10, 20, 30]);
  });

  it("merges the curated awards per film", async () => {
    const summary = { oscarWins: 4, oscarNominations: 6, festivalPrizes: [{ festival: "Cannes", prize: "Palme d'Or" }] };
    awards.mockImplementation((id) => (id === 20 ? summary : null));

    const { results } = await body(await get("10,20"));

    expect(results).toMatchObject({ "10": { awards: null }, "20": { awards: summary } });
    expect(awards.mock.calls.map(([id]) => id).sort()).toEqual([10, 20]);
  });

  it("is cacheable by shared caches like the single-film route", async () => {
    const res = await get("10");
    expect(res.headers.get("Cache-Control")).toBe(CACHEABLE);
  });

  it("deduplicates ids and looks each film up once", async () => {
    const res = await get("5,3,5,3");

    expect(Object.keys((await body(res)).results!).sort()).toEqual(["3", "5"]);
    expect(metrics).toHaveBeenCalledTimes(2);
  });

  it("gives null for a film that fails and still returns the rest, uncached", async () => {
    metrics.mockImplementation(async (id) => {
      if (id === 20) throw new TmdbError(503, "secret upstream detail");
      return movie(id / 10);
    });

    const res = await get("10,20,30");
    const json = await body(res);

    expect(res.status).toBe(200);
    expect(json.results).toEqual({ "10": { ...movie(1), awards: null }, "20": null, "30": { ...movie(3), awards: null } });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(JSON.stringify(json)).not.toContain("secret");
  });

  it("gives null for a film TMDB does not have, and still caches the answer", async () => {
    metrics.mockImplementation(async (id) => {
      if (id === 20) throw new TmdbError(404, "missing");
      return movie(id / 10);
    });

    const res = await get("10,20");

    expect((await body(res)).results).toEqual({ "10": { ...movie(1), awards: null }, "20": null });
    expect(res.headers.get("Cache-Control")).toBe(CACHEABLE);
  });

  it("answers 200 with nothing but nulls when every film is simply unknown to TMDB", async () => {
    metrics.mockRejectedValue(new TmdbError(404, "missing"));
    const res = await get("1,2");

    expect(res.status).toBe(200);
    expect((await body(res)).results).toEqual({ "1": null, "2": null });
  });

  it("answers 502 without forwarding details when every film failed", async () => {
    metrics.mockRejectedValue(new TmdbError(503, "secret upstream detail"));
    const res = await get("1,2,3");

    expect(res.status).toBe(502);
    expect(await body(res)).toEqual({ error: "TMDB is unavailable, try again shortly" });
    expect(res.headers.get("Cache-Control")).toBeNull();
  });

  it("answers 502 when films failed and the rest were unknown", async () => {
    metrics.mockImplementation(async (id) => {
      throw id === 1 ? new TmdbError(404, "missing") : new Error("boom");
    });
    expect((await get("1,2")).status).toBe(502);
  });

  it("counts a single failing film as every film failing", async () => {
    metrics.mockRejectedValue(new Error("boom"));
    expect((await get("7")).status).toBe(502);
  });

  it("answers 400 for a missing or malformed ids and never calls TMDB", async () => {
    for (const ids of [null, "", ",", "1,2,", "0", "-5", "abc", "1.5", "12abc", "01", "99999999999", "1,,2"]) {
      const res = await get(ids);
      expect(res.status, String(ids)).toBe(400);
      expect(typeof (await body(res)).error).toBe("string");
      expect(res.headers.get("Cache-Control"), String(ids)).toBeNull();
    }
    expect(metrics).not.toHaveBeenCalled();
  });

  it("answers 400 for more than the maximum number of films and never calls TMDB", async () => {
    const ids = Array.from({ length: MAX_BATCH_IDS + 1 }, (_, i) => i + 1).join(",");
    const res = await get(ids);

    expect(res.status).toBe(400);
    expect(metrics).not.toHaveBeenCalled();
  });

  it("accepts exactly the maximum number of films", async () => {
    const ids = Array.from({ length: MAX_BATCH_IDS }, (_, i) => i + 1).join(",");
    const res = await get(ids);

    expect(res.status).toBe(200);
    expect(Object.keys((await body(res)).results!)).toHaveLength(MAX_BATCH_IDS);
  });

  it("looks films up with limited concurrency", async () => {
    let running = 0;
    let peak = 0;
    metrics.mockImplementation(async (id) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running--;
      return movie(id / 10);
    });

    const ids = Array.from({ length: 30 }, (_, i) => i + 1).join(",");
    const res = await get(ids);

    expect(res.status).toBe(200);
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThanOrEqual(8);
  });
});
