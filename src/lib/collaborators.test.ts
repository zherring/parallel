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
import { getPersonMovieCredits } from "@/lib/tmdb";
import type { PersonTimeline } from "@/lib/types";

const credits = vi.mocked(getPersonMovieCredits);
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

  it("is incomplete, and kept 5 minutes only, when a short-film lookup behind it was cut short", async () => {
    for (const cutShort of [SUBJECT, CANDIDATES[2]]) {
      resetSuggestionCache();
      credits.mockReset();
      credits.mockImplementation(async (id) => ({ ...timeline(id), ...(id === cutShort ? { shortsIncomplete: true as const } : {}) }));
      expect((await suggestCollaboratorsChecked(SUBJECT)).complete, `person ${cutShort}`).toBe(false);

      const calls = credits.mock.calls.length;
      await vi.advanceTimersByTimeAsync(5 * MINUTE - 1);
      await suggestCollaboratorsChecked(SUBJECT);
      expect(credits).toHaveBeenCalledTimes(calls);
      await vi.advanceTimersByTimeAsync(1);
      await suggestCollaboratorsChecked(SUBJECT);
      expect(credits.mock.calls.length).toBeGreaterThan(calls);
    }
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
