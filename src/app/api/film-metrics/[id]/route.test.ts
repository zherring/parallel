import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/awards", () => ({ awardsFor: vi.fn() }));
vi.mock("@/lib/tmdb", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tmdb")>()),
  getMovieMetrics: vi.fn(),
}));

import { GET } from "@/app/api/film-metrics/[id]/route";
import { awardsFor } from "@/lib/awards";
import { TmdbError, getMovieMetrics } from "@/lib/tmdb";

const metrics = vi.mocked(getMovieMetrics);
const awards = vi.mocked(awardsFor);

const FIGHT_CLUB = {
  voteAverage: 8.4,
  voteCount: 33145,
  budget: 63000000,
  revenue: 100853753,
  releaseDate: "1999-10-15",
};

const get = (id: string) =>
  GET(new Request(`http://localhost/api/film-metrics/${id}`), { params: Promise.resolve({ id }) });

beforeEach(() => {
  metrics.mockResolvedValue(FIGHT_CLUB);
  awards.mockReturnValue(null);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  metrics.mockReset();
  awards.mockReset();
});

describe("GET /api/film-metrics/[id]", () => {
  it("returns TMDB's numbers with awards null when the film has none", async () => {
    const res = await get("550");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ...FIGHT_CLUB, awards: null });
    expect(metrics).toHaveBeenCalledWith(550);
    expect(awards).toHaveBeenCalledWith(550);
  });

  it("includes the curated awards when there are some", async () => {
    const summary = {
      oscarWins: 4,
      oscarNominations: 6,
      festivalPrizes: [{ festival: "Cannes", prize: "Palme d'Or" }],
    };
    awards.mockReturnValue(summary);

    const body = (await (await get("496243")).json()) as { awards: unknown };
    expect(body.awards).toEqual(summary);
    expect(awards).toHaveBeenCalledWith(496243);
  });

  it("is cacheable by shared caches", async () => {
    const res = await get("550");
    expect(res.headers.get("Cache-Control")).toBe("public, s-maxage=3600, stale-while-revalidate=86400");
  });

  it("rejects an id that is not a positive integer with a 400 and never calls TMDB", async () => {
    for (const id of ["0", "-5", "abc", "1.5", "12abc", "01", "99999999999", " 5", ""]) {
      const res = await get(id);
      expect(res.status, id).toBe(400);
      expect(await res.json()).toEqual({ error: "id must be a positive integer" });
      expect(res.headers.get("Cache-Control"), id).toBeNull();
    }
    expect(metrics).not.toHaveBeenCalled();
  });

  it("maps a TMDB 404 to a 404 that is not cached", async () => {
    metrics.mockRejectedValue(new TmdbError(404, "missing"));
    const res = await get("1");

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not found" });
    expect(res.headers.get("Cache-Control")).toBeNull();
  });

  it("maps other TMDB failures to a 502 without forwarding details", async () => {
    metrics.mockRejectedValue(new TmdbError(503, "secret upstream detail"));
    const res = await get("1");

    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toContain("secret");
    expect(res.headers.get("Cache-Control")).toBeNull();
  });

  it("maps an unexpected error to a 500", async () => {
    metrics.mockRejectedValue(new Error("boom"));
    const res = await get("1");
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Something went wrong" });
  });
});
