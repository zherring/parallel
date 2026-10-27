import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EXAMPLE_PAIRINGS } from "@/lib/examples";
import type { PersonTimeline } from "@/lib/types";

vi.mock("server-only", () => ({}));
const getPersonMovieCredits = vi.fn<(id: number) => Promise<PersonTimeline>>();
vi.mock("@/lib/tmdb", () => ({ getPersonMovieCredits: (id: number) => getPersonMovieCredits(id) }));

const uniqueIds = new Set(EXAMPLE_PAIRINGS.flatMap((p) => p.people.map((x) => x.id)));

const timeline = (id: number): PersonTimeline => ({
  person: { id, name: `P${id}`, profilePath: `/p${id}.jpg`, knownFor: null, birthday: null, deathday: null },
  films: [
    {
      id: 1,
      title: "Shared",
      releaseDate: "2000-01-01",
      year: 2000,
      posterPath: null,
      credits: [{ role: "director", job: "Director", minor: false }],
      minor: false,
    },
  ],
});

async function freshModule() {
  vi.resetModules();
  return import("@/lib/load-example-cards");
}

beforeEach(() => {
  vi.useFakeTimers();
  getPersonMovieCredits.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("loadExampleCards", () => {
  it("returns photos and counts, fetching each person once and memoizing", async () => {
    getPersonMovieCredits.mockImplementation(async (id) => timeline(id));
    const { loadExampleCards } = await freshModule();

    const cards = await loadExampleCards();
    expect(cards).toHaveLength(EXAMPLE_PAIRINGS.length);
    expect(cards.every((c) => c.filmsTogether === 1)).toBe(true);
    expect(cards[0].people[0].profilePath).toMatch(/^\/p\d+\.jpg$/);
    expect(getPersonMovieCredits).toHaveBeenCalledTimes(uniqueIds.size);

    await loadExampleCards();
    expect(getPersonMovieCredits).toHaveBeenCalledTimes(uniqueIds.size);
  });

  it("degrades to text-only cards when TMDB fails, then retries after 30s", async () => {
    getPersonMovieCredits.mockRejectedValue(new Error("TMDB_READ_ACCESS_TOKEN is not set"));
    const { loadExampleCards } = await freshModule();

    const cards = await loadExampleCards();
    expect(cards).toHaveLength(EXAMPLE_PAIRINGS.length);
    expect(cards.every((c) => c.filmsTogether === null)).toBe(true);
    expect(cards.every((c) => c.people.every((p) => p.profilePath === null))).toBe(true);

    await loadExampleCards();
    expect(getPersonMovieCredits).toHaveBeenCalledTimes(uniqueIds.size);

    vi.advanceTimersByTime(31_000);
    getPersonMovieCredits.mockImplementation(async (id) => timeline(id));
    const healed = await loadExampleCards();
    expect(healed.every((c) => c.filmsTogether === 1)).toBe(true);
  });

  it("keeps partial data when only some people fail", async () => {
    getPersonMovieCredits.mockImplementation(async (id) => {
      if (id === 7479) throw new Error("boom");
      return timeline(id);
    });
    const { loadExampleCards } = await freshModule();

    const cards = await loadExampleCards();
    const fincherCronenweth = cards[0];
    expect(fincherCronenweth.filmsTogether).toBeNull();
    expect(fincherCronenweth.people[0].profilePath).toBe("/p7467.jpg");
    expect(cards[1].filmsTogether).toBe(1);
  });

  it("stops waiting after the page budget and serves text-only cards", async () => {
    getPersonMovieCredits.mockImplementation(() => new Promise(() => {}));
    const { loadExampleCards } = await freshModule();

    const pending = loadExampleCards();
    await vi.advanceTimersByTimeAsync(4001);
    const cards = await pending;
    expect(cards.every((c) => c.filmsTogether === null)).toBe(true);
  });
});
