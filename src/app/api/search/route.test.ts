import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/people-index", () => ({ loadPeopleMatchIndex: vi.fn() }));
vi.mock("@/lib/tmdb", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tmdb")>()),
  searchPeopleWithPopularity: vi.fn(),
}));

import { GET } from "@/app/api/search/route";
import { loadPeopleMatchIndex } from "@/lib/people-index";
import { buildMatchIndex, type MatchablePerson } from "@/lib/people-match";
import { TmdbError, searchPeopleWithPopularity } from "@/lib/tmdb";

const loadIndex = vi.mocked(loadPeopleMatchIndex);
const tmdbSearch = vi.mocked(searchPeopleWithPopularity);

const indexed = (id: number, name: string, popularity: number, knownForTitles: string[] = []): MatchablePerson => ({
  id,
  name,
  profilePath: `/${id}.jpg`,
  knownFor: "Directing",
  knownForTitles,
  popularity,
  credits: 0,
});

const hit = (id: number, name: string, popularity: number, knownForTitles: string[] = []) => ({
  id,
  name,
  profilePath: null,
  knownFor: "Acting",
  knownForTitles,
  popularity,
});

const INDEX = buildMatchIndex([
  indexed(488, "Steven Spielberg", 12, ["Jaws", "E.T."]),
  indexed(1884, "Steven Soderbergh", 4),
  indexed(1, "George Lucas", 8),
  indexed(1461, "George Clooney", 18),
]);

const get = (q: string | null) =>
  GET(new Request(`http://localhost/api/search${q === null ? "" : `?q=${encodeURIComponent(q)}`}`));

const namesOf = async (res: Response) =>
  ((await res.json()) as { results: { name: string }[] }).results.map((r) => r.name);

beforeEach(() => {
  loadIndex.mockResolvedValue(INDEX);
  tmdbSearch.mockResolvedValue([]);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(loadPeopleMatchIndex).mockReset();
  tmdbSearch.mockReset();
});

describe("GET /api/search: request handling", () => {
  it("rejects a missing, one-character or over-long query with a 400", async () => {
    for (const q of [null, "", " ", "a", " a ", "x".repeat(101)]) {
      const res = await get(q);
      expect(res.status, String(q)).toBe(400);
      expect(await res.json()).toEqual({ error: "q must be 2 to 100 characters" });
    }
    expect(tmdbSearch).not.toHaveBeenCalled();
    expect(loadIndex).not.toHaveBeenCalled();
  });

  it("trims the query and sends it to TMDB with an abort signal", async () => {
    await get("  spielberg  ");
    expect(tmdbSearch).toHaveBeenCalledTimes(1);
    const [query, signal] = tmdbSearch.mock.calls[0];
    expect(query).toBe("spielberg");
    expect(signal).toBeInstanceOf(AbortSignal);
  });

  it("answers { results } with the same cache headers as before", async () => {
    const res = await get("spielberg");
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("public, s-maxage=300, stale-while-revalidate=3600");
    const body = (await res.json()) as { results: unknown[] };
    expect(Object.keys(body)).toEqual(["results"]);
    expect(body.results[0]).toEqual({
      id: 488,
      name: "Steven Spielberg",
      profilePath: "/488.jpg",
      knownFor: "Directing",
      knownForTitles: ["Jaws", "E.T."],
    });
  });
});

describe("GET /api/search: merging", () => {
  it("finds a typo'd name from the local index alone", async () => {
    tmdbSearch.mockResolvedValue([hit(900, "Gavin Speiller", 0.4), hit(901, "David Speilberg", 0.2)]);
    expect(await namesOf(await get("speil"))).toEqual([
      "Steven Spielberg",
      "Gavin Speiller",
      "David Speilberg",
    ]);
  });

  it("returns a local-only hit when TMDB has no results", async () => {
    expect(await namesOf(await get("george luc"))).toEqual(["George Lucas"]);
  });

  it("returns a TMDB-only hit when the index finds nothing", async () => {
    tmdbSearch.mockResolvedValue([hit(7, "Jane Obscure", 1), hit(8, "John Obscure", 3)]);
    expect(await namesOf(await get("obscure"))).toEqual(["John Obscure", "Jane Obscure"]);
  });

  it("lists strong local matches by score, then TMDB's by popularity", async () => {
    tmdbSearch.mockResolvedValue([hit(10, "Quiet Person", 1), hit(11, "Loud Person", 20), hit(12, "Mid Person", 5)]);
    expect(await namesOf(await get("georg"))).toEqual([
      "George Clooney",
      "George Lucas",
      "Loud Person",
      "Mid Person",
      "Quiet Person",
    ]);
  });

  it("lists a person TMDB and the index both know once", async () => {
    tmdbSearch.mockResolvedValue([hit(488, "Steven Spielberg", 99, ["Other"]), hit(1884, "Steven Soderbergh", 1, ["Traffic"])]);
    const res = await get("steven");
    const { results } = (await res.json()) as { results: { id: number; knownForTitles: string[] }[] };
    expect(results.map((r) => r.id)).toEqual([488, 1884]);
    expect(results[0].knownForTitles).toEqual(["Jaws", "E.T."]);
    // The index has no titles for Soderbergh, so TMDB's fill in.
    expect(results[1].knownForTitles).toEqual(["Traffic"]);
  });

  it("never returns more than 8 results", async () => {
    loadIndex.mockResolvedValue(
      buildMatchIndex(Array.from({ length: 12 }, (_, i) => indexed(i + 1, `Alex Stone ${i}`, i))),
    );
    tmdbSearch.mockResolvedValue(Array.from({ length: 20 }, (_, i) => hit(100 + i, `Alex Other ${i}`, i)));
    const results = await namesOf(await get("alex"));
    expect(results).toHaveLength(8);
    expect(new Set(results).size).toBe(8);
  });

  it("returns an empty list when neither source finds anything", async () => {
    const res = await get("qqqqzzzz");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ results: [] });
  });
});

describe("GET /api/search: when TMDB fails", () => {
  it("returns the local results alone on a TMDB error", async () => {
    tmdbSearch.mockRejectedValue(new TmdbError(500, "boom"));
    const res = await get("speil");
    expect(res.status).toBe(200);
    expect(await namesOf(res)).toEqual(["Steven Spielberg"]);
  });

  it("returns the local results alone on a non-TMDB failure (a missing token, a network error)", async () => {
    tmdbSearch.mockRejectedValue(new TypeError("fetch failed"));
    expect(await namesOf(await get("george luc"))).toEqual(["George Lucas"]);
  });

  it("gives up on TMDB after 1.5 seconds and returns the local results", async () => {
    let signal: AbortSignal | undefined;
    tmdbSearch.mockImplementation((_query, s) => {
      signal = s;
      return new Promise(() => {}); // never answers
    });
    const timeout = vi.spyOn(AbortSignal, "timeout").mockImplementation((ms) => {
      expect(ms).toBe(1500);
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 0);
      return controller.signal;
    });

    const res = await get("speil");
    expect(timeout).toHaveBeenCalledWith(1500);
    expect(signal?.aborted).toBe(true);
    expect(res.status).toBe(200);
    expect(await namesOf(res)).toEqual(["Steven Spielberg"]);
  });

  it("answers 502 when TMDB fails and the index found nothing, as it did before the index", async () => {
    tmdbSearch.mockRejectedValue(new TmdbError(503, "down"));
    const res = await get("qqqqzzzz");
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "TMDB is unavailable, try again shortly" });
  });

  it("answers 502 on a timeout when the index found nothing", async () => {
    tmdbSearch.mockRejectedValue(new TmdbError(504, "timed out"));
    expect((await get("qqqqzzzz")).status).toBe(502);
  });
});

describe("GET /api/search: when the index cannot load", () => {
  it("returns TMDB's results alone", async () => {
    loadIndex.mockRejectedValue(new Error("no file"));
    tmdbSearch.mockResolvedValue([hit(7, "Jane Obscure", 1)]);
    const res = await get("obscure");
    expect(res.status).toBe(200);
    expect(await namesOf(res)).toEqual(["Jane Obscure"]);
  });

  it("answers with the TMDB error when both fail", async () => {
    loadIndex.mockRejectedValue(new Error("no file"));
    tmdbSearch.mockRejectedValue(new TmdbError(500, "boom"));
    expect((await get("obscure")).status).toBe(502);
  });
});
