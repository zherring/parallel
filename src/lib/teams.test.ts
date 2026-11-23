import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/collaborators-index", () => ({ loadCollaboratorGraph: vi.fn() }));
vi.mock("@/lib/tmdb", () => ({
  ROUTE_BUDGET_MS: 45_000,
  TmdbError: class TmdbError extends Error {
    constructor(readonly status: number, message: string) {
      super(message);
    }
  },
  getPersonMovieCredits: vi.fn(),
  getFilmCredits: vi.fn(),
}));

import { resetTeamCache, suggestTeamsChecked } from "@/lib/teams";
import { MIN_TEAM_FILMS } from "@/lib/teams-rank";
import { getFilmCredits, getPersonMovieCredits } from "@/lib/tmdb";
import type { Credit, Film, PersonTimeline } from "@/lib/types";

const loadPerson = vi.mocked(getPersonMovieCredits);
const loadCredits = vi.mocked(getFilmCredits);

const lead: Credit = { role: "actor", job: "Actor", minor: false };
const cameo: Credit = { role: "actor", job: "Actor", character: "Himself", minor: true };
const film = (id: number, credits: Credit[] = [lead]): Film => ({
  id,
  title: `Film ${id}`,
  releaseDate: `19${80 + id}-01-01`,
  year: 1980 + id,
  posterPath: null,
  voteCount: id * 10,
  credits,
  minor: credits.every((credit) => credit.minor),
});
const timeline = (id: number, films: Film[]): PersonTimeline => ({
  person: { id, name: `Person ${id}`, profilePath: `/${id}.jpg`, knownFor: null, birthday: null, deathday: null, biography: null },
  films,
});

/** Who is billed on each of the subject's films (the subject, 1, on all of them): 10 and 11 are in four of them, 20 and 21 and 30 and 31 in three, 40 and 41 in two. */
const BASE_CAST: Record<number, number[]> = {
  1: [1, 10, 11, 12, 40, 41],
  2: [1, 10, 11, 12, 40, 41],
  3: [1, 10, 11, 20, 21],
  4: [1, 10, 11, 20, 21, 30, 31],
  5: [1, 20, 21, 30, 31],
  6: [1, 30, 31],
};
/** The crew of the same films: 70 and 71 (a composer and a costume designer) are on the first three, as often as 10 and 11 are on theirs. */
const CREW: Record<number, { id: number; job: string; popularity?: number }[]> = {
  1: [{ id: 70, job: "Original Music Composer", popularity: 500 }, { id: 71, job: "Costume Design", popularity: 500 }],
  2: [{ id: 70, job: "Original Music Composer", popularity: 500 }, { id: 71, job: "Costume Design", popularity: 500 }],
  3: [{ id: 70, job: "Original Music Composer", popularity: 500 }, { id: 71, job: "Costume Design", popularity: 500 }],
};
/** The films' billing as this test has it: the table above, which a test may change. */
let CAST: Record<number, number[]>;
const filmsOf = (id: number) => Object.entries(CAST).filter(([, cast]) => cast.includes(id)).map(([filmId]) => Number(filmId));
const creditsOf = (id: number) => ({
  cast: CAST[id].map((person, order) => ({ id: person, order, character: "Lead", popularity: 100 - person })),
  crew: CREW[id] ?? [],
});

let timelines: Record<number, PersonTimeline>;

beforeEach(() => {
  resetTeamCache();
  CAST = structuredClone(BASE_CAST);
  timelines = Object.fromEntries([1, 10, 11, 12, 20, 21, 30, 31, 40, 41].map((id) => [id, timeline(id, filmsOf(id).map((filmId) => film(filmId)))]));
  // The crew's own filmographies: the same three films, as their jobs.
  const crewCredit = (role: Credit["role"], job: string): Credit => ({ role, job, minor: false });
  timelines[70] = timeline(70, [1, 2, 3].map((filmId) => film(filmId, [crewCredit("composer", "Original Music Composer")])));
  timelines[71] = timeline(71, [1, 2, 3].map((filmId) => film(filmId, [crewCredit("costume-designer", "Costume Design")])));
  loadPerson.mockReset();
  loadPerson.mockImplementation(async (id) => {
    const found = timelines[id];
    if (!found) throw new Error(`no person ${id}`);
    return found;
  });
  loadCredits.mockReset();
  loadCredits.mockImplementation(async (id) => creditsOf(id));
});

describe("suggestTeamsChecked", () => {
  it("lists the pairs who share the most of the subject's films, nobody twice, with the exact count and the best-voted titles", async () => {
    const { teams, complete } = await suggestTeamsChecked(1);
    expect(complete).toBe(true);
    expect(teams.results.map((team) => [team.people.map((person) => person.id), team.sharedCount])).toEqual([
      [[10, 11], 4],
      [[20, 21], 3],
      [[30, 31], 3],
    ]);
    expect(teams.results[0].titles).toEqual(["Film 4", "Film 3", "Film 2"]);
    expect(teams.results[0].people[0]).toEqual({ id: 10, name: "Person 10", profilePath: "/10.jpg" });
  });

  it("needs three films: a pair who made two with the subject is not a team", async () => {
    // 40 and 41 are billed together on films 1 and 2 only.
    expect(MIN_TEAM_FILMS).toBe(3);
    const { teams } = await suggestTeamsChecked(1);
    expect(teams.results.map((team) => team.people.map((person) => person.id))).not.toContainEqual([40, 41]);
    // Give them a third film and they are one.
    CAST[6] = [1, 30, 31, 40, 41];
    resetTeamCache();
    timelines[40] = timeline(40, [1, 2, 6].map((filmId) => film(filmId)));
    timelines[41] = timeline(41, [1, 2, 6].map((filmId) => film(filmId)));
    const third = await suggestTeamsChecked(1);
    expect(third.teams.results.map((team) => [team.people.map((person) => person.id), team.sharedCount])).toContainEqual([[40, 41], 3]);
  });

  it("is actors and directors only: a composer and a costume designer who share as many films are nobody's partner", async () => {
    const { teams } = await suggestTeamsChecked(1);
    const ids = teams.results.flatMap((team) => team.people.map((person) => person.id));
    expect(ids).not.toContain(70);
    expect(ids).not.toContain(71);
    // Their credits are not even loaded as candidates: only the people who are teams, or could be, have their filmographies read.
    expect(loadPerson.mock.calls.map(([id]) => id)).not.toContain(70);
    expect(loadPerson.mock.calls.map(([id]) => id)).not.toContain(71);
  });

  it("is actors and directors by the filmographies too: a pair billed as cast on the films, who are crew in their own, is not a team", async () => {
    CAST[1] = [1, 10, 11, 12, 40, 41, 50, 51];
    CAST[2] = [1, 10, 11, 12, 40, 41, 50, 51];
    CAST[3] = [1, 10, 11, 20, 21, 50, 51];
    // 50 is a composer on the films the credits bill them in; 51 acted.
    timelines[50] = timeline(50, [1, 2, 3].map((filmId) => film(filmId, [{ role: "composer", job: "Original Music Composer", minor: false }])));
    timelines[51] = timeline(51, [1, 2, 3].map((filmId) => film(filmId)));
    const { teams } = await suggestTeamsChecked(1);
    expect(teams.results.flatMap((team) => team.people.map((person) => person.id))).not.toContain(50);
  });

  it("counts by the filmographies, as the page does: a team whose films are cameos for one of them drops out", async () => {
    // 20 is billed on films 3, 4 and 5, but their own filmography has them as cameos.
    timelines[20] = timeline(20, [film(3, [cameo]), film(4, [cameo]), film(5, [cameo])]);
    const { teams } = await suggestTeamsChecked(1);
    expect(teams.results.map((team) => team.people.map((person) => person.id))).toEqual([[10, 11], [30, 31]]);
  });

  it("leaves out a team whose filmography did not load, and says the list is incomplete", async () => {
    delete timelines[31];
    const { teams, complete } = await suggestTeamsChecked(1);
    expect(complete).toBe(false);
    expect(teams.results.map((team) => team.people.map((person) => person.id))).not.toContainEqual([30, 31]);
  });

  it("remembers a complete list, and shares one computation between requests made at once", async () => {
    const [a, b] = await Promise.all([suggestTeamsChecked(1), suggestTeamsChecked(1)]);
    expect(a).toBe(b);
    const calls = loadCredits.mock.calls.length;
    await suggestTeamsChecked(1);
    expect(loadCredits.mock.calls.length).toBe(calls);
  });

  it("runs on a time budget of its own: a caller's signal ends that caller's wait, not the work the others share", async () => {
    // The first caller's request gives up while the film credits are still loading; a second request joined the same work.
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    loadCredits.mockImplementation(async (id) => {
      await gate;
      return creditsOf(id);
    });
    const first = new AbortController();
    const early = suggestTeamsChecked(1, first.signal);
    const later = suggestTeamsChecked(1, new AbortController().signal);

    first.abort();
    await expect(early).rejects.toMatchObject({ status: 504 });

    release();
    const { teams, complete } = await later;
    expect(complete).toBe(true);
    expect(teams.results.map((team) => team.people.map((person) => person.id))).toEqual([[10, 11], [20, 21], [30, 31]]);
    // None of the work was given the first caller's signal.
    const signals = [...loadCredits.mock.calls.map(([, signal]) => signal), ...loadPerson.mock.calls.map(([, options]) => options?.signal)];
    expect(signals.length).toBeGreaterThan(0);
    for (const signal of signals) expect(signal).not.toBe(first.signal);
    // ...and it is remembered, so a later request is answered at once.
    const calls = loadCredits.mock.calls.length;
    await suggestTeamsChecked(1);
    expect(loadCredits.mock.calls.length).toBe(calls);
  });

  it("answers a caller whose signal is already aborted with a timeout, and still finishes the work for the list's cache", async () => {
    const gone = new AbortController();
    gone.abort();
    await expect(suggestTeamsChecked(1, gone.signal)).rejects.toMatchObject({ status: 504 });
    await expect(suggestTeamsChecked(1)).resolves.toMatchObject({ complete: true });
  });

  it("fails when no film's credits can be loaded, and for an unknown person", async () => {
    loadCredits.mockRejectedValue(new Error("down"));
    await expect(suggestTeamsChecked(1)).rejects.toThrow("down");
    await expect(suggestTeamsChecked(999)).rejects.toThrow("no person 999");
  });
});
