import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Installed before the module under test loads: its caches take Date.now when they are built, so
// the fake clock has to be the one they see. It stays installed for this file.
vi.hoisted(() => vi.useFakeTimers());

vi.mock("server-only", () => ({}));
vi.mock("@/lib/tmdb", () => ({ getPersonMovieCredits: vi.fn(), getFilmCredits: vi.fn() }));
vi.mock("@/lib/collaborators-index", () => ({ loadCollaboratorGraph: vi.fn() }));
vi.mock("@/lib/collaborator-verify", () => ({ suggestFromTimelines: vi.fn() }));

import { suggestFromTimelines } from "@/lib/collaborator-verify";
import { loadCollaboratorGraph } from "@/lib/collaborators-index";
import { resetSuggestionCache, suggestCollaboratorsChecked } from "@/lib/collaborators";
import { getFilmCredits, getPersonMovieCredits } from "@/lib/tmdb";
import type { Film, PersonTimeline } from "@/lib/types";

const credits = vi.mocked(getPersonMovieCredits);
const filmCredits = vi.mocked(getFilmCredits);
const verify = vi.mocked(suggestFromTimelines);
const graph = vi.mocked(loadCollaboratorGraph);

const SUBJECT = 1;
const CANDIDATES = [10, 11, 12, 13];

const timeline = (id: number): PersonTimeline => ({
  person: { id, name: `Person ${id}`, profilePath: null, knownFor: null, birthday: null, deathday: null, biography: null },
  films: [],
});

/** The list alone; `complete` is checked where it matters. */
const suggestCollaborators = async (personId: number) => (await suggestCollaboratorsChecked(personId)).suggestions;

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

beforeEach(() => {
  resetSuggestionCache();
  graph.mockResolvedValue(new Map([[SUBJECT, { ids: CANDIDATES, counts: [5, 4, 3, 2] }]]));
  verify.mockReturnValue([]);
});
afterEach(() => {
  vi.resetAllMocks();
});

/** Loads every filmography except the ones in `failing`. */
const loadAllBut = (failing: number[]) =>
  credits.mockImplementation(async (id) => {
    if (failing.includes(id)) throw new Error(`TMDB failed for ${id}`);
    return timeline(id);
  });

describe("suggestCollaboratorsChecked completeness", () => {
  it("is complete when every candidate loaded and every short-film lookup finished", async () => {
    loadAllBut([]);
    expect((await suggestCollaboratorsChecked(SUBJECT)).complete).toBe(true);
    expect((await suggestCollaboratorsChecked(SUBJECT)).complete).toBe(true); // and so when remembered
  });

  it("is incomplete when a candidate failed to load", async () => {
    loadAllBut([CANDIDATES[1]]);
    expect((await suggestCollaboratorsChecked(SUBJECT)).complete).toBe(false);
    expect((await suggestCollaboratorsChecked(SUBJECT)).complete).toBe(false);
  });

  it("is incomplete, and kept 5 minutes only, when the person's short-film lookup was cut short", async () => {
    credits.mockImplementation(async (id) => ({ ...timeline(id), ...(id === SUBJECT ? { shortsIncomplete: true as const } : {}) }));
    expect((await suggestCollaboratorsChecked(SUBJECT)).complete).toBe(false);

    const calls = credits.mock.calls.length;
    await vi.advanceTimersByTimeAsync(5 * MINUTE - 1);
    await suggestCollaboratorsChecked(SUBJECT);
    expect(credits).toHaveBeenCalledTimes(calls);
    await vi.advanceTimersByTimeAsync(1);
    await suggestCollaboratorsChecked(SUBJECT);
    expect(credits.mock.calls.length).toBeGreaterThan(calls);
  });

  it("skips the short-film lookup for the candidates but not for the person, and gives every call the route's signal", async () => {
    loadAllBut([]);
    const { signal } = new AbortController();
    await suggestCollaboratorsChecked(SUBJECT, signal);

    const optionsOf = (id: number) => credits.mock.calls.find(([called]) => called === id)?.[1];
    expect(optionsOf(SUBJECT)).not.toMatchObject({ shorts: false });
    for (const id of CANDIDATES) expect(optionsOf(id)).toMatchObject({ shorts: false });
    for (const [, options] of credits.mock.calls) expect(options?.signal).toBe(signal);
  });
});

describe("suggestCollaborators caching", () => {
  it("keeps a complete list for 3 hours", async () => {
    loadAllBut([]);
    await suggestCollaborators(SUBJECT);
    const calls = credits.mock.calls.length;

    await vi.advanceTimersByTimeAsync(3 * HOUR - 1);
    await suggestCollaborators(SUBJECT);
    expect(credits).toHaveBeenCalledTimes(calls);

    await vi.advanceTimersByTimeAsync(1);
    await suggestCollaborators(SUBJECT);
    expect(credits.mock.calls.length).toBeGreaterThan(calls);
  });

  it("keeps a partial list, one with failed candidates, for 5 minutes only", async () => {
    loadAllBut([CANDIDATES[1]]);
    const first = await suggestCollaborators(SUBJECT);
    const calls = credits.mock.calls.length;
    expect(verify.mock.calls[0][1]).toHaveLength(CANDIDATES.length - 1);

    await vi.advanceTimersByTimeAsync(5 * MINUTE - 1);
    await expect(suggestCollaborators(SUBJECT)).resolves.toBe(first);
    expect(credits).toHaveBeenCalledTimes(calls);

    await vi.advanceTimersByTimeAsync(1);
    await suggestCollaborators(SUBJECT);
    expect(credits.mock.calls.length).toBeGreaterThan(calls);
  });

  it("heals: once TMDB answers for every candidate the list is complete and kept for 3 hours", async () => {
    loadAllBut([CANDIDATES[0]]);
    await suggestCollaborators(SUBJECT);

    await vi.advanceTimersByTimeAsync(5 * MINUTE);
    loadAllBut([]);
    await suggestCollaborators(SUBJECT);
    const calls = credits.mock.calls.length;

    await vi.advanceTimersByTimeAsync(2 * HOUR);
    await suggestCollaborators(SUBJECT);
    expect(credits).toHaveBeenCalledTimes(calls);
  });

  it("still throws, and remembers nothing, when no candidate loads", async () => {
    credits.mockImplementation(async (id) => {
      if (id === SUBJECT) return timeline(id);
      throw new Error("TMDB is down");
    });
    await expect(suggestCollaborators(SUBJECT)).rejects.toThrow("TMDB is down");
    const calls = credits.mock.calls.length;
    await expect(suggestCollaborators(SUBJECT)).rejects.toThrow("TMDB is down");
    expect(credits.mock.calls.length).toBeGreaterThan(calls);
  });
});

describe("suggestCollaboratorsChecked: minCandidates (the top-up of a thin graph row, only for a caller that asks)", () => {
  const film = (id: number): Film => ({
    id,
    title: `Film ${id}`,
    releaseDate: "2000-01-15",
    year: 2000,
    posterPath: null,
    voteCount: id,
    credits: [{ role: "actor", job: "Actor", minor: false }],
    minor: false,
  });
  const THIN = [10, 11, 12];

  /** The ids of every filmography loaded other than the person's own. */
  const candidatesLoaded = () =>
    credits.mock.calls
      .map(([id]) => id)
      .filter((id) => id !== SUBJECT)
      .sort((a, b) => a - b);

  beforeEach(() => {
    graph.mockResolvedValue(new Map([[SUBJECT, { ids: THIN, counts: [5, 4, 3] }]]));
    credits.mockImplementation(async (id) => (id === SUBJECT ? { ...timeline(id), films: [film(1), film(2), film(3)] } : timeline(id)));
    // 98 and 99 are credited on all three of the person's films.
    filmCredits.mockResolvedValue({ cast: [{ id: 98, order: 0 }, { id: 99, order: 1 }] });
  });

  it("is off by default: a thin row is the graph's own, with no film-credit requests", async () => {
    const { suggestions, complete } = await suggestCollaboratorsChecked(SUBJECT);
    expect(suggestions.source).toBe("graph");
    expect(complete).toBe(true);
    expect(filmCredits).not.toHaveBeenCalled();
    expect(candidatesLoaded()).toEqual(THIN);
  });

  it("tops the row up with the live candidates, the graph's first, when asked", async () => {
    const { suggestions, complete } = await suggestCollaboratorsChecked(SUBJECT, undefined, { minCandidates: 8 });
    expect(suggestions.source).toBe("live");
    expect(complete).toBe(true);
    expect(filmCredits).toHaveBeenCalledTimes(3);
    expect(candidatesLoaded()).toEqual([...THIN, 98, 99]);
    expect(verify.mock.calls[0][1].map((t) => t.person.id)).toEqual([...THIN, 98, 99]);
  });

  it("leaves a row that already has that many alone", async () => {
    const { suggestions } = await suggestCollaboratorsChecked(SUBJECT, undefined, { minCandidates: THIN.length });
    expect(suggestions.source).toBe("graph");
    expect(filmCredits).not.toHaveBeenCalled();
  });

  it("is off for a value that is not a whole number of at least 1", async () => {
    for (const minCandidates of [0, -3, Number.NaN, Number.POSITIVE_INFINITY, undefined]) {
      resetSuggestionCache();
      const { suggestions } = await suggestCollaboratorsChecked(SUBJECT, undefined, { minCandidates });
      expect(suggestions.source, String(minCandidates)).toBe("graph");
    }
    expect(filmCredits).not.toHaveBeenCalled();
  });

  it("keeps the list with it and the list without it apart, each remembered", async () => {
    const plain = (await suggestCollaboratorsChecked(SUBJECT)).suggestions;
    const filled = (await suggestCollaboratorsChecked(SUBJECT, undefined, { minCandidates: 8 })).suggestions;
    expect(plain.source).toBe("graph");
    expect(filled.source).toBe("live");

    const calls = credits.mock.calls.length;
    const asked = filmCredits.mock.calls.length;
    await expect(suggestCollaboratorsChecked(SUBJECT)).resolves.toMatchObject({ suggestions: plain });
    await expect(suggestCollaboratorsChecked(SUBJECT, undefined, { minCandidates: 8 })).resolves.toMatchObject({ suggestions: filled });
    expect(credits).toHaveBeenCalledTimes(calls);
    expect(filmCredits).toHaveBeenCalledTimes(asked);
  });

  it("runs the top-up once for a burst of requests that ask, and once more for the ones that do not", async () => {
    await Promise.all([
      suggestCollaboratorsChecked(SUBJECT, undefined, { minCandidates: 8 }),
      suggestCollaboratorsChecked(SUBJECT, undefined, { minCandidates: 8 }),
      suggestCollaboratorsChecked(SUBJECT),
      suggestCollaboratorsChecked(SUBJECT),
    ]);
    expect(filmCredits).toHaveBeenCalledTimes(3);
    expect(candidatesLoaded().filter((id) => id === THIN[0])).toHaveLength(2);
  });

  it("keeps the graph's own candidates when the top-up fails, as incomplete: remembered 5 minutes, then asked again", async () => {
    filmCredits.mockRejectedValue(new Error("TMDB failed"));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await suggestCollaboratorsChecked(SUBJECT, undefined, { minCandidates: 8 });
    expect(result.complete).toBe(false);
    expect(result.suggestions.source).toBe("graph");
    expect(candidatesLoaded()).toEqual(THIN);

    const asked = filmCredits.mock.calls.length;
    await vi.advanceTimersByTimeAsync(5 * MINUTE - 1);
    await suggestCollaboratorsChecked(SUBJECT, undefined, { minCandidates: 8 });
    expect(filmCredits).toHaveBeenCalledTimes(asked);
    await vi.advanceTimersByTimeAsync(1);
    await suggestCollaboratorsChecked(SUBJECT, undefined, { minCandidates: 8 });
    expect(filmCredits.mock.calls.length).toBeGreaterThan(asked);

    // The list without it was never touched by the failure: complete.
    expect((await suggestCollaboratorsChecked(SUBJECT)).complete).toBe(true);
  });
});
