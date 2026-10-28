import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/collaborators-index", () => ({ loadCollaboratorGraph: vi.fn() }));
vi.mock("@/lib/tmdb", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tmdb")>()),
  getPersonMovieCredits: vi.fn(),
  getFilmCredits: vi.fn(),
}));

import { GET } from "@/app/api/collaborators/[id]/route";
import { resetSuggestionCache } from "@/lib/collaborators";
import { loadCollaboratorGraph } from "@/lib/collaborators-index";
import type { GraphEntry } from "@/lib/collaborators-format";
import { TmdbError, getFilmCredits, getPersonMovieCredits } from "@/lib/tmdb";
import type { RawFilmCredits } from "@/lib/tmdb-types";
import type { CollaboratorSuggestions, Credit, Film, PersonTimeline, RoleKey } from "@/lib/types";

const loadGraph = vi.mocked(loadCollaboratorGraph);
const personCredits = vi.mocked(getPersonMovieCredits);
const filmCredits = vi.mocked(getFilmCredits);

const SUBJECT = 1;

const credit = (role: RoleKey): Credit => ({ role, job: role === "actor" ? "Actor" : role, minor: false });

const film = (id: number, roles: RoleKey[], extra: Partial<Film> = {}): Film => ({
  id,
  title: `Film ${id}`,
  releaseDate: `${1980 + (id % 40)}-0${(id % 9) + 1}-15`,
  year: 1980 + (id % 40),
  posterPath: null,
  voteCount: id,
  credits: roles.map(credit),
  minor: false,
  ...extra,
});

const timeline = (id: number, name: string, films: Film[]): PersonTimeline => ({
  person: { id, name, profilePath: `/${id}.jpg`, knownFor: null, birthday: null, deathday: null, biography: null },
  films,
});

/** Films `ids` as `role` for the person. */
const films = (role: RoleKey, ids: number[]) => ids.map((id) => film(id, [role]));

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

let timelines: Map<number, PersonTimeline>;
let graph: Map<number, GraphEntry>;
let failing: Set<number>;

const row = (...pairs: [id: number, count: number][]): GraphEntry => ({
  ids: pairs.map((p) => p[0]),
  counts: pairs.map((p) => p[1]),
});

const get = (id: string) => GET(new Request(`http://localhost/api/collaborators/${id}`), { params: Promise.resolve({ id }) });

const body = async (res: Response) => (await res.json()) as CollaboratorSuggestions;

beforeEach(() => {
  resetSuggestionCache();
  timelines = new Map();
  graph = new Map();
  failing = new Set();
  loadGraph.mockResolvedValue(graph);
  personCredits.mockImplementation(async (id) => {
    if (failing.has(id)) throw new TmdbError(500, "TMDB request failed with 500");
    const found = timelines.get(id);
    if (!found) throw new TmdbError(404, "TMDB request failed with 404");
    return found;
  });
  filmCredits.mockResolvedValue({});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  loadGraph.mockReset();
  personCredits.mockReset();
  filmCredits.mockReset();
});

describe("GET /api/collaborators/[id]: request handling", () => {
  it("rejects an id that is not a positive integer with a 400 and calls nothing", async () => {
    for (const id of ["abc", "0", "-1", "1.5", "01", "12345678901", "1e3", " 7"]) {
      const res = await get(id);
      expect(res.status, id).toBe(400);
      expect(await res.json()).toEqual({ error: "id must be a positive integer" });
    }
    expect(personCredits).not.toHaveBeenCalled();
    expect(loadGraph).not.toHaveBeenCalled();
  });

  it("answers 404 for a person TMDB does not know", async () => {
    const res = await get("999");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not found" });
  });

  it("answers 502 when TMDB fails for the person themselves", async () => {
    failing.add(SUBJECT);
    const res = await get(String(SUBJECT));
    expect(res.status).toBe(502);
  });
});

describe("GET /api/collaborators/[id]: graph path", () => {
  beforeEach(() => {
    timelines.set(SUBJECT, timeline(SUBJECT, "Harrison Ford", films("actor", range(1, 12))));
    timelines.set(10, timeline(10, "George Lucas", [film(1, ["director"]), film(2, ["director", "writer"]), film(3, ["writer"])]));
    timelines.set(11, timeline(11, "Mark Hamill", films("actor", [2, 3, 4, 5])));
    timelines.set(12, timeline(12, "Steven Spielberg", films("director", [6, 7, 8, 9, 10])));
    graph.set(SUBJECT, row([10, 3], [11, 4], [12, 5]));
  });

  it("answers { source, results } with exact counts, roles and titles and the cache headers", async () => {
    const res = await get(String(SUBJECT));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("public, s-maxage=3600, stale-while-revalidate=86400");

    const data = await body(res);
    expect(Object.keys(data)).toEqual(["source", "results"]);
    expect(data.source).toBe("graph");
    expect(data.results).toEqual([
      {
        id: 12,
        name: "Steven Spielberg",
        profilePath: "/12.jpg",
        sharedCount: 5,
        roles: "Director",
        titles: ["Film 10", "Film 9", "Film 8"],
      },
      {
        id: 11,
        name: "Mark Hamill",
        profilePath: "/11.jpg",
        sharedCount: 4,
        roles: "Actor",
        titles: ["Film 5", "Film 4", "Film 3"],
      },
      {
        id: 10,
        name: "George Lucas",
        profilePath: "/10.jpg",
        sharedCount: 3,
        roles: "Director, Writer",
        titles: ["Film 3", "Film 2", "Film 1"],
      },
    ]);
  });

  it("makes no film-credit calls: the graph needs no live counting", async () => {
    await get(String(SUBJECT));
    expect(filmCredits).not.toHaveBeenCalled();
    // The person, plus each of the three candidates, once.
    expect(personCredits.mock.calls.map(([id]) => id).sort((a, b) => a - b)).toEqual([1, 10, 11, 12]);
  });

  it("recounts: the graph's number is a hint, the pair page's number is shown", async () => {
    // The graph says 9 films, but they really share two.
    graph.set(SUBJECT, row([11, 9], [12, 5], [10, 3]));
    timelines.set(11, timeline(11, "Mark Hamill", films("actor", [2, 3])));
    const data = await body(await get(String(SUBJECT)));
    expect(data.results.find((r) => r.id === 11)?.sharedCount).toBe(2);
    // ...and 11 no longer ranks first: re-ranked by the exact count.
    expect(data.results.map((r) => r.id)).toEqual([12, 10, 11]);
  });

  it("drops a candidate that shares fewer than two films, whatever the graph said", async () => {
    graph.set(SUBJECT, row([10, 3], [11, 4], [12, 5]));
    timelines.set(11, timeline(11, "Mark Hamill", films("actor", [2])));
    const data = await body(await get(String(SUBJECT)));
    expect(data.results.map((r) => r.id)).toEqual([12, 10]);
  });

  it("does not count a shared film that is not out yet", async () => {
    timelines.set(SUBJECT, timeline(SUBJECT, "Harrison Ford", [...films("actor", range(1, 12)), film(77, ["actor"], { releaseDate: "2999-01-01" })]));
    timelines.set(11, timeline(11, "Mark Hamill", [...films("actor", [2, 3]), film(77, ["actor"], { releaseDate: "2999-01-01" })]));
    const data = await body(await get(String(SUBJECT)));
    expect(data.results.find((r) => r.id === 11)?.sharedCount).toBe(2);
  });

  it("is remembered: a second request does not touch TMDB again", async () => {
    await get(String(SUBJECT));
    personCredits.mockClear();
    const res = await get(String(SUBJECT));
    expect((await body(res)).results).toHaveLength(3);
    expect(personCredits).not.toHaveBeenCalled();
  });

  it("does the work once for a burst of simultaneous requests", async () => {
    await Promise.all([get(String(SUBJECT)), get(String(SUBJECT)), get(String(SUBJECT))]);
    expect(personCredits).toHaveBeenCalledTimes(4);
  });

  it("never loads more than six filmographies at once", async () => {
    const ids = range(20, 31);
    for (const id of ids) timelines.set(id, timeline(id, `Costar ${id}`, films("actor", [1, 2, 3])));
    graph.set(SUBJECT, row(...ids.map((id): [number, number] => [id, 3])));
    let running = 0;
    let peak = 0;
    personCredits.mockImplementation(async (id) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 2));
      running--;
      return timelines.get(id)!;
    });
    const data = await body(await get(String(SUBJECT)));
    expect(data.results).toHaveLength(10);
    // The person's own timeline is loaded first; the candidates then run six at a time.
    expect(peak).toBeLessThanOrEqual(6);
    expect(peak).toBeGreaterThan(1);
  });
});

describe("GET /api/collaborators/[id]: variety", () => {
  it("lets the director and the composer in among many co-stars", async () => {
    timelines.set(SUBJECT, timeline(SUBJECT, "Star", films("actor", range(1, 10))));
    const costars = range(20, 29);
    for (const id of costars) timelines.set(id, timeline(id, `Costar ${id}`, films("actor", range(1, 8))));
    timelines.set(40, timeline(40, "The Director", films("director", [1, 2])));
    timelines.set(41, timeline(41, "The Composer", films("composer", [3, 4])));
    graph.set(SUBJECT, row(...costars.map((id): [number, number] => [id, 8]), [40, 2], [41, 2]));

    const data = await body(await get(String(SUBJECT)));
    expect(data.results).toHaveLength(10);
    expect(data.results.map((r) => r.id)).toEqual(expect.arrayContaining([40, 41]));
    expect(data.results.filter((r) => r.roles === "Actor")).toHaveLength(8);
    // Still ordered by shared films.
    const counts = data.results.map((r) => r.sharedCount);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });
});

describe("GET /api/collaborators/[id]: partial TMDB failure", () => {
  beforeEach(() => {
    timelines.set(SUBJECT, timeline(SUBJECT, "Star", films("actor", range(1, 8))));
    for (const id of [10, 11, 12]) timelines.set(id, timeline(id, `Costar ${id}`, films("actor", [1, 2, 3])));
    graph.set(SUBJECT, row([10, 3], [11, 3], [12, 3]));
  });

  it("skips a candidate whose filmography fails and still answers", async () => {
    failing.add(11);
    const res = await get(String(SUBJECT));
    expect(res.status).toBe(200);
    expect((await body(res)).results.map((r) => r.id)).toEqual([10, 12]);
  });

  it("does not remember an incomplete list, so the next request tries again", async () => {
    failing.add(11);
    await get(String(SUBJECT));
    failing.delete(11);
    const data = await body(await get(String(SUBJECT)));
    expect(data.results.map((r) => r.id)).toEqual([10, 11, 12]);
  });

  it("answers 502 when every candidate fails: an outage is not an empty list", async () => {
    for (const id of [10, 11, 12]) failing.add(id);
    const res = await get(String(SUBJECT));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "TMDB is unavailable, try again shortly" });
  });
});

describe("GET /api/collaborators/[id]: live fallback", () => {
  /** Film credits where `people` are top-billed cast. */
  const castOf = (...ids: number[]): RawFilmCredits => ({
    cast: ids.map((id, order) => ({ id, order, character: "Role", popularity: id })),
  });

  beforeEach(() => {
    // Cinematographer (id 1) with 30 films, 40 and 41 are co-stars, 50 is the director of two.
    const all = range(100, 129).map((id, i) => film(id, ["cinematographer"], { voteCount: 1000 - i }));
    timelines.set(SUBJECT, timeline(SUBJECT, "Jeff Cronenweth", all));
    timelines.set(40, timeline(40, "Costar A", films("actor", range(100, 105))));
    timelines.set(41, timeline(41, "Costar B", films("actor", range(100, 102))));
    timelines.set(50, timeline(50, "David Fincher", films("director", [100, 101])));
    timelines.set(60, timeline(60, "Seen Once", films("actor", [100])));
    filmCredits.mockImplementation(async (id) => {
      if (id >= 100 && id <= 105) return { ...castOf(40, 41, 60), crew: [{ id: 50, job: "Director" }] };
      return castOf(900 + id);
    });
  });

  it("counts live over the person's best-known films when the graph has no row", async () => {
    const data = await body(await get(String(SUBJECT)));
    expect(data.source).toBe("live");
    // The credits of films 100-105 name all four people as candidates; each one is then counted
    // exactly from the two filmographies, which re-ranks them and drops "Seen Once".
    expect(data.results.map((r) => r.id)).toEqual([40, 41, 50]);
    expect(data.results.find((r) => r.id === 40)?.sharedCount).toBe(6);
    expect(data.results.find((r) => r.id === 41)?.sharedCount).toBe(3);
    expect(data.results.find((r) => r.id === 50)).toMatchObject({ sharedCount: 2, roles: "Director" });
    // "Seen Once" shares one film with the person: below the threshold.
    expect(data.results.map((r) => r.id)).not.toContain(60);
  });

  it("fetches credits for at most 25 films, the most voted first", async () => {
    await get(String(SUBJECT));
    expect(filmCredits).toHaveBeenCalledTimes(25);
    const asked = filmCredits.mock.calls.map(([id]) => id).sort((a, b) => a - b);
    expect(asked).toEqual(range(100, 124));
  });

  it("skips minor and unreleased films when choosing which to count", async () => {
    timelines.set(
      SUBJECT,
      timeline(SUBJECT, "Jeff Cronenweth", [
        film(100, ["cinematographer"], { voteCount: 10 }),
        film(101, ["cinematographer"], { voteCount: 99_999, minor: true }),
        film(102, ["cinematographer"], { voteCount: 99_999, releaseDate: "2999-01-01" }),
      ]),
    );
    await get(String(SUBJECT));
    expect(filmCredits.mock.calls.map(([id]) => id)).toEqual([100]);
  });

  it("falls back to live counting for a thin graph row", async () => {
    graph.set(SUBJECT, row([40, 5], [41, 3]));
    const data = await body(await get(String(SUBJECT)));
    expect(data.source).toBe("live");
    expect(filmCredits).toHaveBeenCalled();
  });

  it("falls back to live counting when the graph cannot be loaded", async () => {
    loadGraph.mockRejectedValue(new Error("Cannot find module"));
    const res = await get(String(SUBJECT));
    expect(res.status).toBe(200);
    expect((await body(res)).source).toBe("live");
  });

  it("still answers when some film credits fail to load", async () => {
    filmCredits.mockImplementation(async (id) => {
      if (id === 100) throw new TmdbError(500, "boom");
      return { ...castOf(40, 41), crew: [{ id: 50, job: "Director" }] };
    });
    const res = await get(String(SUBJECT));
    expect(res.status).toBe(200);
    expect((await body(res)).results.map((r) => r.id)).toEqual(expect.arrayContaining([40, 41, 50]));
  });

  it("answers 502 when no film's credits load", async () => {
    filmCredits.mockRejectedValue(new TmdbError(500, "boom"));
    expect((await get(String(SUBJECT))).status).toBe(502);
  });

  it("answers an empty list for a person with no films", async () => {
    timelines.set(SUBJECT, timeline(SUBJECT, "Nobody Yet", []));
    const res = await get(String(SUBJECT));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ source: "live", results: [] });
    expect(filmCredits).not.toHaveBeenCalled();
  });
});
