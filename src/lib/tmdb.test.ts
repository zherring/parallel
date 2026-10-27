import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  TmdbError,
  getFilmDetails,
  getMovieMetrics,
  getPersonMovieCredits,
  getShortMovieIds,
  searchPeople,
  searchPeopleWithPopularity,
} from "@/lib/tmdb";

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

describe("searchPeopleWithPopularity", () => {
  const raw = (id: number, popularity?: number) => ({
    id,
    name: `Person ${id}`,
    profile_path: `/${id}.jpg`,
    known_for_department: "Acting",
    known_for: [{ title: "A Film" }],
    ...(popularity === undefined ? {} : { popularity }),
  });

  it("returns every hit TMDB sent, each with its popularity (0 when missing)", async () => {
    fetchMock.mockResolvedValueOnce(
      json({ results: Array.from({ length: 20 }, (_, i) => raw(i + 1, i === 0 ? undefined : i * 1.5)) }),
    );
    const results = await searchPeopleWithPopularity("x");

    expect(results).toHaveLength(20);
    expect(results[0]).toEqual({
      id: 1,
      name: "Person 1",
      profilePath: "/1.jpg",
      knownFor: "Acting",
      knownForTitles: ["A Film"],
      popularity: 0,
    });
    expect(results[2].popularity).toBe(3);
  });

  it("uses the same request as searchPeople and passes the abort signal to fetch", async () => {
    fetchMock.mockResolvedValueOnce(json({ results: [] }));
    const signal = new AbortController().signal;
    await searchPeopleWithPopularity("speil", signal);

    const { url, init } = lastCall();
    expect(url.pathname).toBe("/3/search/person");
    expect(url.searchParams.get("query")).toBe("speil");
    expect(url.searchParams.get("include_adult")).toBe("false");
    expect(init.next).toEqual({ revalidate: 3600 });
    expect(init.signal).toBe(signal);
  });

  it("does not add a signal to the request when none is given", async () => {
    fetchMock.mockResolvedValueOnce(json({ results: [] }));
    await searchPeopleWithPopularity("x");
    expect("signal" in lastCall().init).toBe(false);
  });

  it("fails with a 504 TmdbError when the signal aborts the request", async () => {
    const controller = new AbortController();
    fetchMock.mockImplementationOnce(async () => {
      controller.abort();
      throw new DOMException("The operation was aborted", "AbortError");
    });
    const error = await searchPeopleWithPopularity("x", controller.signal).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(TmdbError);
    expect((error as TmdbError).status).toBe(504);
  });

  it("rethrows other network errors unchanged", async () => {
    const failure = new TypeError("fetch failed");
    fetchMock.mockRejectedValueOnce(failure);
    await expect(searchPeopleWithPopularity("x")).rejects.toBe(failure);
  });
});

describe("getShortMovieIds", () => {
  const discoverPage = (ids: number[], total_pages: number) => json({ page: 1, total_pages, results: ids.map((id) => ({ id })) });
  const pageOf = (n: number) => Number(lastCall(n).url.searchParams.get("page"));

  afterEach(() => vi.restoreAllMocks());

  it("asks discover for the person's under-40-minute movies, with auth and a day of caching", async () => {
    fetchMock.mockResolvedValueOnce(discoverPage([1], 1));
    await getShortMovieIds(7467);

    const { url, init } = lastCall();
    expect(url.origin + url.pathname).toBe("https://api.themoviedb.org/3/discover/movie");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      with_people: "7467",
      "with_runtime.gte": "1",
      "with_runtime.lte": "39",
      include_adult: "false",
      include_video: "true",
      sort_by: "primary_release_date.asc",
      page: "1",
    });
    expect(init.headers).toMatchObject({ Authorization: `Bearer ${TOKEN}` });
    expect(init.next).toEqual({ revalidate: 86400 });
  });

  it("makes a single request when there is one page", async () => {
    fetchMock.mockResolvedValueOnce(discoverPage([5, 6], 1));
    await expect(getShortMovieIds(1)).resolves.toEqual(new Set([5, 6]));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fetches the remaining pages after reading total_pages and merges every id", async () => {
    fetchMock.mockImplementation(async (input) => {
      const page = Number(new URL(String(input)).searchParams.get("page"));
      return discoverPage([page * 10, page * 10 + 1], 3);
    });
    const ids = await getShortMovieIds(1);

    expect(ids).toEqual(new Set([10, 11, 20, 21, 30, 31]));
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect([pageOf(0), pageOf(1), pageOf(2)]).toEqual([1, 2, 3]);
  });

  it("requests the remaining pages concurrently, not one after another", async () => {
    let pending = 0;
    let peak = 0;
    fetchMock.mockImplementation(async (input) => {
      const page = Number(new URL(String(input)).searchParams.get("page"));
      pending++;
      peak = Math.max(peak, pending);
      await Promise.resolve();
      pending--;
      return discoverPage([page], 4);
    });
    await getShortMovieIds(1);
    expect(peak).toBe(3);
  });

  it("stops at 10 pages even when TMDB reports more", async () => {
    fetchMock.mockImplementation(async (input) => {
      const page = Number(new URL(String(input)).searchParams.get("page"));
      return discoverPage([page], 500);
    });
    const ids = await getShortMovieIds(1);

    expect(fetchMock).toHaveBeenCalledTimes(10);
    expect(ids).toEqual(new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));
  });

  it("degrades to an empty set when the first page fails, without throwing or leaking the token", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    fetchMock.mockResolvedValue(json({}, 503));
    const promise = getShortMovieIds(7467);
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toEqual(new Set());
    expect(fetchMock).toHaveBeenCalledTimes(2); // one retry, same as every other call
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0])).not.toContain(TOKEN);
  });

  it("degrades to an empty set on a network error", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    await expect(getShortMovieIds(1)).resolves.toEqual(new Set());
  });

  it("degrades to an empty set on a malformed response", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    fetchMock.mockResolvedValue(json(null));
    await expect(getShortMovieIds(1)).resolves.toEqual(new Set());
  });

  it("keeps the pages that loaded when a later page fails", async () => {
    fetchMock.mockImplementation(async (input) => {
      const page = Number(new URL(String(input)).searchParams.get("page"));
      if (page === 2) return json({}, 404);
      return discoverPage([page], 3);
    });
    await expect(getShortMovieIds(1)).resolves.toEqual(new Set([1, 3]));
  });

  it("retries a 429 on the first page like any other call", async () => {
    fetchMock.mockResolvedValueOnce(json({}, 429)).mockResolvedValueOnce(discoverPage([9], 1));
    const promise = getShortMovieIds(1);
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toEqual(new Set([9]));
  });
});

describe("getPersonMovieCredits", () => {
  afterEach(() => vi.restoreAllMocks());

  const credits = {
    cast: [],
    crew: [
      { id: 2, title: "B", release_date: "2000-01-01", poster_path: null, job: "Director" },
      { id: 1, title: "A", release_date: "1995-01-01", poster_path: "/a.jpg", job: "Director" },
    ],
  };
  const respond = (discover: () => Response) => async (input: RequestInfo | URL) => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith("/movie_credits")) return json(credits);
    if (path.endsWith("/discover/movie")) return discover();
    return json({
      id: 7467,
      name: "David Fincher",
      profile_path: "/f.jpg",
      known_for_department: "Directing",
      biography: "David Fincher is an American film director.\r\n\r\nHe made Seven.",
    });
  };

  it("combines person details with normalized credits and caches for a day", async () => {
    fetchMock.mockImplementation(respond(() => json({ total_pages: 1, results: [] })));

    const timeline = await getPersonMovieCredits(7467);

    expect(timeline.person).toMatchObject({
      id: 7467,
      name: "David Fincher",
      knownFor: "Directing",
      biography: "David Fincher is an American film director.\n\nHe made Seven.",
    });
    expect(timeline.films.map((f) => f.title)).toEqual(["A", "B"]);
    expect(timeline.films.every((f) => !f.minor)).toBe(true);
    for (const n of [0, 1, 2]) expect(lastCall(n).init.next).toEqual({ revalidate: 86400 });
  });

  it("marks films from the short-movie set minor", async () => {
    fetchMock.mockImplementation(respond(() => json({ total_pages: 1, results: [{ id: 2 }] })));

    const { films } = await getPersonMovieCredits(7467);

    expect(films.map((f) => [f.id, f.minor])).toEqual([
      [1, false],
      [2, true],
    ]);
  });

  it("still returns the timeline, with nothing marked short, when the discover call fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    fetchMock.mockImplementation(respond(() => json({}, 500)));

    const promise = getPersonMovieCredits(7467);
    await vi.runAllTimersAsync();
    const { films } = await promise;

    expect(films.map((f) => f.title)).toEqual(["A", "B"]);
    expect(films.every((f) => !f.minor)).toBe(true);
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

describe("getMovieMetrics", () => {
  const movie = (extra: object = {}) => ({
    id: 550,
    title: "Fight Club",
    release_date: "1999-10-15",
    vote_average: 8.4,
    vote_count: 33145,
    budget: 63000000,
    revenue: 100853753,
    ...extra,
  });

  it("asks for the plain movie (no appended credits) and caches for a day", async () => {
    fetchMock.mockResolvedValueOnce(json(movie()));
    await getMovieMetrics(550);

    const { url, init } = lastCall();
    expect(url.pathname).toBe("/3/movie/550");
    expect(url.searchParams.has("append_to_response")).toBe(false);
    expect(init.headers).toMatchObject({ Authorization: `Bearer ${TOKEN}` });
    expect(init.next).toEqual({ revalidate: 86400 });
  });

  it("returns only the numbers the card needs", async () => {
    fetchMock.mockResolvedValueOnce(json(movie({ overview: "x", genres: [] })));
    expect(await getMovieMetrics(550)).toEqual({
      voteAverage: 8.4,
      voteCount: 33145,
      budget: 63000000,
      revenue: 100853753,
      releaseDate: "1999-10-15",
    });
  });

  it("turns TMDB's zeros and blanks into null", async () => {
    fetchMock.mockResolvedValueOnce(
      json(movie({ budget: 0, revenue: 0, vote_average: 0, vote_count: 0, release_date: "" })),
    );
    expect(await getMovieMetrics(1)).toEqual({
      voteAverage: null,
      voteCount: 0,
      budget: null,
      revenue: null,
      releaseDate: null,
    });
  });

  it("tolerates missing fields", async () => {
    fetchMock.mockResolvedValueOnce(json({ id: 1 }));
    expect(await getMovieMetrics(1)).toEqual({
      voteAverage: null,
      voteCount: 0,
      budget: null,
      revenue: null,
      releaseDate: null,
    });
  });

  it("drops an average that has no votes behind it", async () => {
    fetchMock.mockResolvedValueOnce(json(movie({ vote_average: 7.5, vote_count: 0 })));
    expect(await getMovieMetrics(1)).toMatchObject({ voteAverage: null, voteCount: 0 });
  });

  it("throws a TmdbError with TMDB's status", async () => {
    fetchMock.mockResolvedValueOnce(json({ status_message: "nope" }, 404));
    const error = await getMovieMetrics(1).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(TmdbError);
    expect((error as TmdbError).status).toBe(404);
  });
});
