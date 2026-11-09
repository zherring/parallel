import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  TmdbError,
  getFilmCredits,
  getFilmDetails,
  resetTmdbClientState,
  searchPeople,
  searchPeopleWithPopularity,
} from "@/lib/tmdb";

const TOKEN = "test-token-123";
const fetchMock = vi.fn<typeof fetch>();

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers });
const credits = () => json({ cast: [], crew: [] });

/** Starts a call and keeps its eventual rejection from going unhandled while timers are advanced. */
const settle = <T>(promise: Promise<T>) => promise.then((value) => ({ value }), (error: unknown) => ({ error }));

const callAt = (n: number) => {
  const [url, init] = fetchMock.mock.calls[n];
  return { url: new URL(String(url)), init: init as RequestInit & { next?: { revalidate: number } } };
};

beforeEach(() => {
  resetTmdbClientState();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("TMDB_READ_ACCESS_TOKEN", TOKEN);
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-09T12:00:00Z"));
  // Backoff jitter is spread around its middle, so 0.5 gives the exact base delays.
  vi.spyOn(Math, "random").mockReturnValue(0.5);
});
afterEach(() => {
  fetchMock.mockReset();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("concurrency limit", () => {
  /** Makes every fetch wait until its `release` is called. */
  function holdRequests() {
    const state = { active: 0, peak: 0, releases: [] as Array<() => void> };
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          state.active++;
          state.peak = Math.max(state.peak, state.active);
          state.releases.push(() => {
            state.active--;
            resolve(credits());
          });
        }),
    );
    return state;
  }

  it("never has more than 6 requests on the wire, however many are asked for", async () => {
    const held = holdRequests();
    const calls = Array.from({ length: 25 }, (_, i) => getFilmCredits(i + 1));

    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(6);

    while (held.releases.length > 0) {
      held.releases.shift()!();
      await vi.advanceTimersByTimeAsync(0);
      expect(held.active).toBeLessThanOrEqual(6);
    }
    await Promise.all(calls);

    expect(held.peak).toBe(6);
    expect(fetchMock).toHaveBeenCalledTimes(25);
  });

  it("also counts the discover-page fan-out of one person against the same 6", async () => {
    const held = holdRequests();
    const calls = Array.from({ length: 4 }, (_, i) =>
      Promise.all([getFilmCredits(i * 10 + 1), getFilmCredits(i * 10 + 2), getFilmCredits(i * 10 + 3)]),
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(held.active).toBe(6);

    while (held.releases.length > 0) {
      held.releases.shift()!();
      await vi.advanceTimersByTimeAsync(0);
    }
    await Promise.all(calls);
    expect(held.peak).toBe(6);
  });

  it("does not hold a slot while a request waits to retry", async () => {
    fetchMock.mockImplementation(async (input) => {
      const id = Number(new URL(String(input)).pathname.split("/")[3]);
      return id <= 6 ? json({}, 429, { "Retry-After": "5" }) : credits();
    });
    const sleepers = Array.from({ length: 6 }, (_, i) => settle(getFilmCredits(i + 1)));
    const seventh = getFilmCredits(7);

    await vi.advanceTimersByTimeAsync(0);
    // All six are now asleep until Retry-After passes; the seventh was not kept waiting for them.
    await expect(seventh).resolves.toEqual({ cast: [], crew: [] });
    expect(fetchMock).toHaveBeenCalledTimes(7);

    await vi.runAllTimersAsync();
    await Promise.all(sleepers);
  });

  it("gives the slot back when a request fails", async () => {
    fetchMock.mockImplementation(async () => json({}, 404));
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) => settle(getFilmCredits(i + 1))));
    expect(results.every((r) => "error" in r)).toBe(true);

    fetchMock.mockImplementation(async () => credits());
    await expect(getFilmCredits(999)).resolves.toEqual({ cast: [], crew: [] });
  });
});

describe("retries", () => {
  it("honors Retry-After given in seconds", async () => {
    fetchMock.mockResolvedValueOnce(json({}, 429, { "Retry-After": "3" })).mockResolvedValueOnce(credits());
    const promise = getFilmCredits(1);

    await vi.advanceTimersByTimeAsync(2999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(promise).resolves.toEqual({ cast: [], crew: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("honors Retry-After given as an HTTP date", async () => {
    const date = new Date(Date.now() + 4000).toUTCString();
    fetchMock.mockResolvedValueOnce(json({}, 503, { "Retry-After": date })).mockResolvedValueOnce(credits());
    const promise = getFilmCredits(1);

    await vi.advanceTimersByTimeAsync(3999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(promise).resolves.toEqual({ cast: [], crew: [] });
  });

  it("caps a long Retry-After at 10 seconds", async () => {
    fetchMock.mockResolvedValueOnce(json({}, 429, { "Retry-After": "300" })).mockResolvedValueOnce(credits());
    const promise = getFilmCredits(1);

    await vi.advanceTimersByTimeAsync(9999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(promise).resolves.toEqual({ cast: [], crew: [] });
  });

  it("backs off about 500ms, then 1500ms, without Retry-After, and makes 3 attempts in all", async () => {
    fetchMock.mockImplementation(async () => json({}, 503));
    const result = settle(getFilmCredits(1));

    await vi.advanceTimersByTimeAsync(499);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1499);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const outcome = await result;
    expect((outcome as { error: TmdbError }).error).toMatchObject({ name: "TmdbError", status: 503 });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("spends at most 10 seconds waiting: a retry that would not fit the budget is not made", async () => {
    fetchMock.mockImplementation(async () => json({}, 429, { "Retry-After": "6" }));
    const result = settle(getFilmCredits(1));

    await vi.advanceTimersByTimeAsync(5999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    // 6s waited; a second 6s wait would make 12s, so this failure is final.
    const outcome = await result;
    expect((outcome as { error: TmdbError }).error).toMatchObject({ name: "TmdbError", status: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("makes the third attempt when both waits together fit the budget", async () => {
    fetchMock.mockImplementation(async () => json({}, 429, { "Retry-After": "5" }));
    const result = settle(getFilmCredits(1));

    await vi.advanceTimersByTimeAsync(10_000);
    const outcome = await result;
    expect((outcome as { error: TmdbError }).error).toMatchObject({ status: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("retries network errors, then succeeds", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed")).mockResolvedValueOnce(credits());
    const promise = getFilmCredits(1);
    await vi.advanceTimersByTimeAsync(500);
    await expect(promise).resolves.toEqual({ cast: [], crew: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry other 4xx", async () => {
    for (const status of [400, 401, 403, 422]) {
      fetchMock.mockReset();
      fetchMock.mockResolvedValue(json({}, status));
      await expect(getFilmCredits(status)).rejects.toMatchObject({ name: "TmdbError", status });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    }
  });

  it("does not remember a 4xx other than 404", async () => {
    fetchMock.mockResolvedValueOnce(json({}, 401)).mockResolvedValueOnce(credits());
    await expect(getFilmCredits(1)).rejects.toMatchObject({ status: 401 });
    await expect(getFilmCredits(1)).resolves.toEqual({ cast: [], crew: [] });
  });
});

describe("timeout", () => {
  it("gives each attempt 8 seconds", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    fetchMock.mockResolvedValueOnce(credits());
    await getFilmCredits(1);

    expect(timeout).toHaveBeenCalledWith(8000);
    expect(callAt(0).init.signal).toBeInstanceOf(AbortSignal);
  });

  it("retries a timed-out attempt and ends in a 504 TmdbError", async () => {
    fetchMock.mockImplementation(async () => {
      throw new DOMException("The operation timed out", "TimeoutError");
    });
    const result = settle(getFilmCredits(1));
    await vi.advanceTimersByTimeAsync(10_000);

    const outcome = await result;
    expect((outcome as { error: TmdbError }).error).toMatchObject({ name: "TmdbError", status: 504 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not retry or remember a call its own caller gave up on", async () => {
    const controller = new AbortController();
    fetchMock.mockImplementationOnce(async () => {
      controller.abort();
      throw new DOMException("aborted", "AbortError");
    });
    await expect(searchPeopleWithPopularity("gone", controller.signal)).rejects.toMatchObject({
      name: "TmdbError",
      status: 504,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // A caller's own deadline says nothing about TMDB, so the next ask goes through.
    fetchMock.mockResolvedValueOnce(json({ results: [] }));
    await expect(searchPeopleWithPopularity("gone")).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("lets a caller leave the queue when its signal aborts, without a request", async () => {
    fetchMock.mockImplementation(() => new Promise<Response>(() => {})); // six requests that never answer
    for (let id = 1; id <= 6; id++) void getFilmCredits(id);
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(6);

    const controller = new AbortController();
    const queued = settle(searchPeopleWithPopularity("waiting", controller.signal));
    await vi.advanceTimersByTimeAsync(0);
    controller.abort();

    const outcome = await queued;
    expect((outcome as { error: TmdbError }).error).toMatchObject({ name: "TmdbError", status: 504 });
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });
});

describe("negative cache", () => {
  it("remembers a 404, so asking again makes no request and fails the same way", async () => {
    fetchMock.mockResolvedValue(json({ status_code: 34 }, 404));
    const first = await getFilmCredits(404).catch((e: unknown) => e);
    expect(first).toBeInstanceOf(TmdbError);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const second = await getFilmCredits(404).catch((e: unknown) => e);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second).toBeInstanceOf(TmdbError);
    expect(second).toMatchObject({ status: 404, message: (first as Error).message });
  });

  it("keys the memory by URL: another id, or the same path with other parameters, still goes to TMDB", async () => {
    fetchMock.mockResolvedValue(json({}, 404));
    await getFilmCredits(1).catch(() => {});
    await getFilmCredits(2).catch(() => {});
    await getFilmDetails(1).catch(() => {}); // /movie/1 with append_to_response, not /movie/1/credits
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("forgets a 404 after 10 minutes", async () => {
    fetchMock.mockResolvedValueOnce(json({}, 404)).mockResolvedValueOnce(credits());
    await getFilmCredits(1).catch(() => {});

    await vi.advanceTimersByTimeAsync(10 * 60 * 1000 - 1);
    await expect(getFilmCredits(1)).rejects.toMatchObject({ status: 404 });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    await expect(getFilmCredits(1)).resolves.toEqual({ cast: [], crew: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("remembers a 429 storm for 45 seconds and then lets requests through again", async () => {
    fetchMock.mockImplementation(async () => json({}, 429));
    const storm = settle(getFilmCredits(1));
    await vi.advanceTimersByTimeAsync(2000); // the two backoffs: 500ms + 1500ms
    expect((await storm as { error: TmdbError }).error).toMatchObject({ status: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // Page views during the storm fail at once, without touching TMDB.
    for (let i = 0; i < 5; i++) {
      await expect(getFilmCredits(1)).rejects.toMatchObject({ name: "TmdbError", status: 429 });
    }
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // The memory covers that URL only.
    fetchMock.mockImplementationOnce(async () => credits());
    await expect(getFilmCredits(2)).resolves.toEqual({ cast: [], crew: [] });

    await vi.advanceTimersByTimeAsync(45_000 - 1);
    await expect(getFilmCredits(1)).rejects.toMatchObject({ status: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(4);

    await vi.advanceTimersByTimeAsync(1);
    fetchMock.mockImplementation(async () => credits());
    await expect(getFilmCredits(1)).resolves.toEqual({ cast: [], crew: [] });
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("remembers a 5xx and a timeout the same way", async () => {
    fetchMock.mockImplementation(async () => json({}, 503));
    const down = settle(getFilmCredits(1));
    await vi.advanceTimersByTimeAsync(2000);
    await down;
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await expect(getFilmCredits(1)).rejects.toMatchObject({ status: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(3);

    fetchMock.mockImplementation(async () => {
      throw new DOMException("timed out", "TimeoutError");
    });
    const slow = settle(getFilmCredits(2));
    await vi.advanceTimersByTimeAsync(2000);
    expect((await slow as { error: TmdbError }).error).toMatchObject({ status: 504 });
    expect(fetchMock).toHaveBeenCalledTimes(6);
    await expect(getFilmCredits(2)).rejects.toMatchObject({ status: 504 });
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it("never remembers a success", async () => {
    fetchMock.mockImplementation(async () => credits());
    await getFilmCredits(1);
    await getFilmCredits(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("is bounded: the oldest of 500 remembered 404s is evicted first", async () => {
    fetchMock.mockImplementation(async () => json({}, 404));
    for (let id = 1; id <= 501; id++) await getFilmCredits(id).catch(() => {});
    expect(fetchMock).toHaveBeenCalledTimes(501);

    await getFilmCredits(501).catch(() => {}); // still remembered
    expect(fetchMock).toHaveBeenCalledTimes(501);
    await getFilmCredits(1).catch(() => {}); // evicted
    expect(fetchMock).toHaveBeenCalledTimes(502);
  });
});

describe("request shape", () => {
  it("passes next.revalidate for 200 responses so the Next data cache keeps working", async () => {
    fetchMock.mockImplementation(async () => json({ results: [], cast: [], crew: [] }));
    await searchPeople("a");
    await getFilmCredits(1);

    expect(callAt(0).init.next).toEqual({ revalidate: 3600 });
    expect(callAt(1).init.next).toEqual({ revalidate: 86400 });
  });

  it("sends the bearer token, JSON accept and a descriptive User-Agent with no email in it", async () => {
    fetchMock.mockResolvedValueOnce(credits());
    await getFilmCredits(1);

    const headers = callAt(0).init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(headers.Accept).toBe("application/json");
    expect(headers["User-Agent"]).toBe("Parallel/1.0 (+https://github.com/zherring/parallel)");
    expect(headers["User-Agent"]).not.toContain("@");
  });

  it("shares one request between identical calls made at the same time, each with its own copy", async () => {
    fetchMock.mockImplementation(async () => json({ cast: [{ id: 1 }], crew: [] }));
    const [a, b] = await Promise.all([getFilmCredits(7), getFilmCredits(7)]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });

  it("makes a new request once the shared one has finished", async () => {
    fetchMock.mockImplementation(async () => credits());
    await getFilmCredits(7);
    await getFilmCredits(7);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
