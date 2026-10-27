import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { TmdbError, getFilmDetails, getPersonMovieCredits, searchPeople } from "@/lib/tmdb";

const TOKEN = "test-token-123";
const fetchMock = vi.fn<typeof fetch>();

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers });

const lastCall = (n = 0) => {
  const [url, init] = fetchMock.mock.calls[n];
  return { url: new URL(String(url)), init: init as RequestInit & { next?: { revalidate: number } } };
};

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("TMDB_READ_ACCESS_TOKEN", TOKEN);
  vi.useFakeTimers();
});
afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("searchPeople", () => {
  const person = (id: number, extra: object = {}) => ({
    id,
    name: `Person ${id}`,
    profile_path: null,
    known_for_department: "Directing",
    known_for: [],
    ...extra,
  });

  it("sends the bearer token, excludes adult results and caches for an hour", async () => {
    fetchMock.mockResolvedValueOnce(json({ results: [] }));
    await searchPeople("fincher");

    const { url, init } = lastCall();
    expect(url.origin + url.pathname).toBe("https://api.themoviedb.org/3/search/person");
    expect(url.searchParams.get("query")).toBe("fincher");
    expect(url.searchParams.get("include_adult")).toBe("false");
    expect(init.headers).toMatchObject({ Authorization: `Bearer ${TOKEN}` });
    expect(init.next).toEqual({ revalidate: 3600 });
  });

  it("returns at most 8 results with up to 3 known-for titles", async () => {
    const known_for = [
      { title: "Fight Club" },
      { name: "A TV Show" },
      { title: "Se7en" },
      { title: "Gone Girl" },
      {},
    ];
    fetchMock.mockResolvedValueOnce(
      json({ results: Array.from({ length: 20 }, (_, i) => person(i + 1, { known_for })) }),
    );
    const results = await searchPeople("x");

    expect(results).toHaveLength(8);
    expect(results[0]).toEqual({
      id: 1,
      name: "Person 1",
      profilePath: null,
      knownFor: "Directing",
      knownForTitles: ["Fight Club", "A TV Show", "Se7en"],
    });
  });
});

describe("getPersonMovieCredits", () => {
  it("combines person details with normalized credits and caches for a day", async () => {
    fetchMock.mockImplementation(async (input) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith("/movie_credits")) {
        return json({
          cast: [],
          crew: [
            { id: 2, title: "B", release_date: "2000-01-01", poster_path: null, job: "Director" },
            { id: 1, title: "A", release_date: "1995-01-01", poster_path: "/a.jpg", job: "Director" },
          ],
        });
      }
      return json({ id: 7467, name: "David Fincher", profile_path: "/f.jpg", known_for_department: "Directing" });
    });

    const timeline = await getPersonMovieCredits(7467);

    expect(timeline.person).toMatchObject({ id: 7467, name: "David Fincher", knownFor: "Directing" });
    expect(timeline.films.map((f) => f.title)).toEqual(["A", "B"]);
    expect(lastCall(0).init.next).toEqual({ revalidate: 86400 });
    expect(lastCall(1).init.next).toEqual({ revalidate: 86400 });
  });
});

describe("getFilmDetails", () => {
  it("requests credits with the movie and normalizes it", async () => {
    fetchMock.mockResolvedValueOnce(
      json({ id: 550, title: "Fight Club", release_date: "1999-10-15", poster_path: null, backdrop_path: null }),
    );
    const film = await getFilmDetails(550);

    expect(lastCall().url.pathname).toBe("/3/movie/550");
    expect(lastCall().url.searchParams.get("append_to_response")).toBe("credits");
    expect(film).toMatchObject({ id: 550, title: "Fight Club", year: 1999 });
  });
});

describe("errors and retries", () => {
  it("throws at call time without echoing anything when the token is missing", async () => {
    vi.stubEnv("TMDB_READ_ACCESS_TOKEN", "");
    const error = await searchPeople("x").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("TMDB_READ_ACCESS_TOKEN is not set");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("retries once after a 429 and succeeds", async () => {
    fetchMock
      .mockResolvedValueOnce(json({}, 429))
      .mockResolvedValueOnce(json({ results: [] }));
    const promise = searchPeople("x");
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("honors a short Retry-After on 429", async () => {
    fetchMock
      .mockResolvedValueOnce(json({}, 429, { "Retry-After": "1" }))
      .mockResolvedValueOnce(json({ results: [] }));
    const promise = searchPeople("x");

    await vi.advanceTimersByTimeAsync(999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(promise).resolves.toEqual([]);
  });

  it("retries once on 5xx, then throws a TmdbError", async () => {
    fetchMock.mockResolvedValue(json({}, 503));
    const promise = searchPeople("x").catch((e: unknown) => e);
    await vi.runAllTimersAsync();
    const error = await promise;

    expect(error).toBeInstanceOf(TmdbError);
    expect((error as TmdbError).status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry a 404 and surfaces its status", async () => {
    fetchMock.mockResolvedValue(json({ status_code: 34 }, 404));
    const error = await getFilmDetails(1).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(TmdbError);
    expect((error as TmdbError).status).toBe(404);
    expect((error as Error).message).not.toContain(TOKEN);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
