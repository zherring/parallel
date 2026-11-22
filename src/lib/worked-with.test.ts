import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/tmdb", () => ({ getPersonMovieCredits: vi.fn() }));

import { getPersonMovieCredits } from "@/lib/tmdb";
import type { Credit, Film, PersonTimeline } from "@/lib/types";
import { filmsTogether } from "@/lib/worked-with";

const load = vi.mocked(getPersonMovieCredits);

const lead: Credit = { role: "actor", job: "Actor", minor: false };
const cameo: Credit = { role: "actor", job: "Actor", character: "Himself", minor: true };
const film = (id: number, releaseDate: string, credits: Credit[] = [lead]): Film => ({
  id,
  title: `Film ${id}`,
  releaseDate,
  year: Number(releaseDate.slice(0, 4)),
  posterPath: null,
  voteCount: 0,
  credits,
  minor: credits.every((credit) => credit.minor),
});
const timeline = (id: number, films: Film[]): PersonTimeline => ({
  person: { id, name: `Person ${id}`, profilePath: null, knownFor: null, birthday: null, deathday: null, biography: null },
  films,
});

const TIMELINES: Record<number, PersonTimeline> = {
  4724: timeline(4724, [film(1, "1984-02-17"), film(2, "1995-06-30"), film(3, "2003-10-15"), film(4, "2999-01-01")]),
  10: timeline(10, [film(1, "1984-02-17"), film(3, "2003-10-15"), film(50, "2010-01-01")]),
  // One film in common, and only as a cameo: the pair page would not count it.
  11: timeline(11, [film(2, "1995-06-30", [cameo])]),
  // Only an unreleased film in common.
  12: timeline(12, [film(4, "2999-01-01")]),
};

beforeEach(() => {
  load.mockReset();
  load.mockImplementation(async (id) => {
    const found = TIMELINES[id];
    if (!found) throw new Error(`no person ${id}`);
    return found;
  });
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("filmsTogether", () => {
  it("counts the films the pair page would show: released, and no minor credits", async () => {
    const counts = await filmsTogether(4724, [10, 11, 12]);
    expect([...counts]).toEqual([[10, 2], [11, 0], [12, 0]]);
  });

  it("skips the short-film lookup for the others, and passes the caller's signal on", async () => {
    const signal = AbortSignal.timeout(1000);
    await filmsTogether(4724, [10], signal);
    expect(load).toHaveBeenCalledWith(4724, { signal });
    expect(load).toHaveBeenCalledWith(10, { shorts: false, signal });
  });

  it("answers null, not zero, for a person who could not be loaded, and for the subject", async () => {
    const counts = await filmsTogether(4724, [10, 999, 4724]);
    expect([...counts]).toEqual([[10, 2], [999, null], [4724, null]]);
    expect(load).toHaveBeenCalledTimes(3);
  });

  it("answers null for everyone when the subject cannot be loaded", async () => {
    const counts = await filmsTogether(998, [10, 11]);
    expect([...counts]).toEqual([[10, null], [11, null]]);
    expect(load).toHaveBeenCalledTimes(1);
  });
});
