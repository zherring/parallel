import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  TmdbError,
  __resetTmdbClientStateForTests,
  getFilmCredits,
  getFilmDetails,
  getPersonMovieCredits,
  getShortMovieIds,
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

/** What undici throws when the connection fails: a bare TypeError, the real error (and its code) in `cause`. */
const networkError = (code = "ECONNRESET") =>
  new TypeError("fetch failed", { cause: Object.assign(new Error(`read ${code}`), { code }) });

/** A 200 whose body cannot be read: the connection drops halfway through it. */
const brokenBody = (error: unknown) =>
  ({ ok: true, status: 200, headers: new Headers(), body: null, text: () => Promise.reject(error) }) as unknown as Response;

/** AbortSignal.timeout runs on a timer fake timers cannot see; this one aborts on the fake clock. */
function fakeAbortSignalTimeout() {
  const asked: number[] = [];
  vi.spyOn(AbortSignal, "timeout").mockImplementation((ms: number) => {
    asked.push(ms);
    const controller = new AbortController();
    setTimeout(() => controller.abort(new DOMException("The operation timed out", "TimeoutError")), ms);
    return controller.signal;
  });
  return asked;
}

/** A fetch that never answers on its own and fails the way a real one does when its signal aborts. */
const hangUntilAborted = () =>
  fetchMock.mockImplementation(
    (_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
      }),
  );

const callAt = (n: number) => {
  const [url, init] = fetchMock.mock.calls[n];
  return { url: new URL(String(url)), init: init as RequestInit & { next?: { revalidate: number } } };
};

beforeEach(() => {
  __resetTmdbClientStateForTests();
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

  it("gives up after about 12 seconds in all: a retry that would not fit before the deadline is not made", async () => {
    fetchMock.mockImplementation(async () => json({}, 429, { "Retry-After": "6" }));
    const result = settle(getFilmCredits(1));

    await vi.advanceTimersByTimeAsync(5999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    // 6s have passed; another 6s wait would end exactly at the 12s deadline with no time left for
    // the attempt itself, so this failure is final.
    const outcome = await result;
    expect((outcome as { error: TmdbError }).error).toMatchObject({ name: "TmdbError", status: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries only if the wait plus a 1s minimum attempt still fits before the deadline", async () => {
    // 6s lost to the first wait, so 6s are left: 5s + 1s fits exactly, 5.5s + 1s does not.
    for (const [secondWait, attempts] of [["5", 3], ["5.5", 2]] as const) {
      __resetTmdbClientStateForTests();
      fetchMock.mockReset();
      fetchMock
        .mockResolvedValueOnce(json({}, 429, { "Retry-After": "6" }))
        .mockResolvedValueOnce(json({}, 429, { "Retry-After": secondWait }))
        .mockResolvedValue(credits());
      const result = settle(getFilmCredits(1));
      await vi.advanceTimersByTimeAsync(11_000);
      await result;
      expect(fetchMock, `second wait ${secondWait}s`).toHaveBeenCalledTimes(attempts);
    }
  });

  it("makes the third attempt when both waits together fit before the deadline", async () => {
    fetchMock.mockImplementation(async () => json({}, 429, { "Retry-After": "5" }));
    const result = settle(getFilmCredits(1));

    await vi.advanceTimersByTimeAsync(10_000);
    const outcome = await result;
    expect((outcome as { error: TmdbError }).error).toMatchObject({ status: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("retries network errors, then succeeds", async () => {
    for (const code of ["ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "UND_ERR_SOCKET", "UND_ERR_CONNECT_TIMEOUT"]) {
      fetchMock.mockReset();
      fetchMock.mockRejectedValueOnce(networkError(code)).mockResolvedValueOnce(credits());
      const promise = getFilmCredits(1);
      await vi.advanceTimersByTimeAsync(500);
      await expect(promise, code).resolves.toEqual({ cast: [], crew: [] });
      expect(fetchMock, code).toHaveBeenCalledTimes(2);
    }
  });

  it("retries a connection that drops while the body is being read", async () => {
    fetchMock.mockResolvedValueOnce(brokenBody(new TypeError("terminated", { cause: Object.assign(new Error("closed"), { code: "UND_ERR_SOCKET" }) })));
    fetchMock.mockResolvedValueOnce(credits());
    const promise = getFilmCredits(1);
    await vi.advanceTimersByTimeAsync(500);
    await expect(promise).resolves.toEqual({ cast: [], crew: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("ends a network error that outlasts the retries in a 502, and remembers it", async () => {
    fetchMock.mockRejectedValue(networkError());
    const result = settle(getFilmCredits(1));
    await vi.advanceTimersByTimeAsync(2000);
    expect((await result as { error: TmdbError }).error).toMatchObject({ name: "TmdbError", status: 502 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await expect(getFilmCredits(1)).rejects.toMatchObject({ status: 502 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not disguise a bug of ours as a TMDB outage: other errors are rethrown as they are, not retried, not remembered", async () => {
    const bugs = [
      new TypeError("Cannot read properties of undefined (reading 'get')"),
      new TypeError("fetch failed"), // no cause, so nothing says it was the connection
      new TypeError("Failed to parse URL", { cause: Object.assign(new TypeError("Invalid URL"), { code: "ERR_INVALID_URL" }) }),
      new TypeError("fetch failed", { cause: Object.assign(new Error("bad arg"), { code: "UND_ERR_INVALID_ARG" }) }),
      new DOMException("The operation was aborted", "AbortError"), // not our timeout, and not the caller's signal
      "a string",
    ];
    for (const bug of bugs) {
      fetchMock.mockReset();
      fetchMock.mockRejectedValueOnce(bug).mockResolvedValueOnce(credits());
      const first = await getFilmCredits(1).catch((e: unknown) => e);
      expect(first).toBe(bug);
      expect(first).not.toBeInstanceOf(TmdbError);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // Nothing was remembered about the URL: the next ask goes to TMDB again.
      await expect(getFilmCredits(1)).resolves.toEqual({ cast: [], crew: [] });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    }
  });

  it("rethrows an unexpected error from reading the body too", async () => {
    const bug = new RangeError("Invalid string length");
    fetchMock.mockResolvedValueOnce(brokenBody(bug));
    await expect(getFilmCredits(1)).rejects.toBe(bug);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("treats a 200 that is not JSON (an HTML error page) like a 5xx: retried, straight to TMDB, then remembered", async () => {
    fetchMock.mockImplementation(async () => new Response("<html><body>Bad gateway</body></html>", { status: 200 }));
    const result = settle(getFilmCredits(1));
    await vi.advanceTimersByTimeAsync(2000);

    const outcome = await result;
    expect((outcome as { error: TmdbError }).error).toMatchObject({ name: "TmdbError", status: 502 });
    expect(((outcome as { error: TmdbError }).error).message).toContain("unreadable");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    // The first try may be answered by the Next data cache, which keeps 200s, so the retries skip it.
    expect(callAt(0).init.next).toEqual({ revalidate: 86400 });
    for (const n of [1, 2]) {
      expect(callAt(n).init.cache).toBe("no-store");
      expect(callAt(n).init.next).toBeUndefined();
    }

    await expect(getFilmCredits(1)).rejects.toMatchObject({ status: 502 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("recovers when the retry after an unreadable 200 gets a real body", async () => {
    fetchMock.mockResolvedValueOnce(new Response("<html>", { status: 200 })).mockResolvedValueOnce(credits());
    const promise = getFilmCredits(1);
    await vi.advanceTimersByTimeAsync(500);
    await expect(promise).resolves.toEqual({ cast: [], crew: [] });
  });

  it("says to check TMDB_READ_ACCESS_TOKEN on a 401 or 403, never prints the token, and does so once a minute", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockImplementation(async () => json({ status_message: "Invalid API key" }, 401));
    await expect(getFilmCredits(1)).rejects.toMatchObject({ status: 401 });
    await expect(getFilmCredits(2)).rejects.toMatchObject({ status: 401 });

    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0][0])).toContain("TMDB_READ_ACCESS_TOKEN");
    expect(String(error.mock.calls[0][0])).toContain("401");
    expect(JSON.stringify(error.mock.calls)).not.toContain(TOKEN);

    await vi.advanceTimersByTimeAsync(60_000);
    fetchMock.mockImplementation(async () => json({}, 403));
    await expect(getFilmCredits(3)).rejects.toMatchObject({ status: 403 });
    expect(error).toHaveBeenCalledTimes(2);
    expect(String(error.mock.calls[1][0])).toContain("403");
  });

  it("does not talk about the token for other failures", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    for (const status of [400, 404, 422]) {
      fetchMock.mockResolvedValueOnce(json({}, status));
      await getFilmCredits(status).catch(() => {});
    }
    expect(error).not.toHaveBeenCalled();
  });

  it("does not retry other 4xx", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    for (const status of [400, 401, 403, 422]) {
      fetchMock.mockReset();
      fetchMock.mockResolvedValue(json({}, status));
      await expect(getFilmCredits(status)).rejects.toMatchObject({ name: "TmdbError", status });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    }
  });

  it("does not remember a 4xx other than 404", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
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

  describe("with timers the fake clock drives", () => {
    it("fails by about 12 seconds when every attempt times out, with the last attempt cut short", async () => {
      const asked = fakeAbortSignalTimeout();
      hangUntilAborted();
      const result = settle(getFilmCredits(1));

      await vi.advanceTimersByTimeAsync(11_999);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(1);

      // 8s, then the ~500ms backoff, then what is left of the 12s: 3.5s.
      const outcome = await result;
      expect((outcome as { error: TmdbError }).error).toMatchObject({ name: "TmdbError", status: 504 });
      expect(asked.filter((ms) => ms <= 8000)).toEqual([8000, 3500]);
      expect(fetchMock).toHaveBeenCalledTimes(2);

      // No third attempt (it would not fit), and the failure is remembered (for 45s).
      await vi.advanceTimersByTimeAsync(30_000);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      await expect(getFilmCredits(1)).rejects.toMatchObject({ status: 504 });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("counts the wait for a limiter slot: a request still queued at 12 seconds gives up without being sent", async () => {
      fakeAbortSignalTimeout();
      const hung: Array<() => void> = [];
      fetchMock.mockImplementation(
        () => new Promise<Response>((resolve) => hung.push(() => resolve(credits()))), // ignores its signal
      );
      for (let id = 1; id <= 6; id++) void getFilmCredits(id);
      await vi.advanceTimersByTimeAsync(0);
      expect(fetchMock).toHaveBeenCalledTimes(6);

      const queued = settle(getFilmCredits(7));
      await vi.advanceTimersByTimeAsync(11_999);
      expect(fetchMock).toHaveBeenCalledTimes(6);
      await vi.advanceTimersByTimeAsync(1);

      const outcome = await queued;
      expect((outcome as { error: TmdbError }).error).toMatchObject({ name: "TmdbError", status: 504 });
      expect(fetchMock).toHaveBeenCalledTimes(6);

      // TMDB was never asked about it, so nothing is remembered against it.
      fetchMock.mockImplementation(async () => credits());
      for (const release of hung.splice(0)) release();
      await vi.advanceTimersByTimeAsync(0);
      await expect(getFilmCredits(7)).resolves.toEqual({ cast: [], crew: [] });
    });

    it("keeps a retry that waited in the queue inside the same 12 seconds", async () => {
      fakeAbortSignalTimeout();
      // Request 1 fails at once and wants 5s; meanwhile six hung requests keep every slot busy.
      let first = true;
      fetchMock.mockImplementation((input) => {
        const id = Number(new URL(String(input)).pathname.split("/")[3]);
        if (id === 1 && first) {
          first = false;
          return Promise.resolve(json({}, 429, { "Retry-After": "5" }));
        }
        return new Promise<Response>(() => {});
      });
      const retried = settle(getFilmCredits(1));
      await vi.advanceTimersByTimeAsync(0);
      for (let id = 2; id <= 7; id++) void getFilmCredits(id);
      await vi.advanceTimersByTimeAsync(5000);
      // Back from its wait at 5s, request 1 has to queue behind the six hung ones...
      expect(fetchMock).toHaveBeenCalledTimes(7);

      await vi.advanceTimersByTimeAsync(6_999);
      expect(fetchMock).toHaveBeenCalledTimes(7);
      await vi.advanceTimersByTimeAsync(1);
      // ...and at the 12s mark it is over, though only 5s of its own wait were spent.
      const outcome = await retried;
      expect((outcome as { error: TmdbError }).error).toMatchObject({ name: "TmdbError", status: 504 });
    });
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

describe("a page's time budget", () => {
  const discoverPage = (ids: number[], total_pages: number) => json({ page: 1, total_pages, results: ids.map((id) => ({ id })) });
  const pageOf = (input: Parameters<typeof fetch>[0]) => Number(new URL(String(input)).searchParams.get("page"));

  it("settles 48 requests queued behind 6 slots by 12 seconds when TMDB hangs: queue time counts from when each was asked for", async () => {
    // A cold 4-person page asks for about this many at once (4 x 12).
    fakeAbortSignalTimeout();
    hangUntilAborted();
    const started = Date.now();
    const settledAt: number[] = [];
    const results = Array.from({ length: 48 }, (_, i) =>
      settle(getFilmCredits(i + 1)).then((outcome) => {
        settledAt.push(Date.now() - started);
        return outcome;
      }),
    );

    await vi.advanceTimersByTimeAsync(11_999);
    expect(settledAt).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);

    const outcomes = await Promise.all(results);
    expect(settledAt).toHaveLength(48);
    expect(Math.max(...settledAt)).toBe(12_000);
    for (const outcome of outcomes) {
      expect((outcome as { error: TmdbError }).error).toMatchObject({ name: "TmdbError", status: 504 });
    }
    // Only the first 12 ever reached TMDB (6 slots, twice over); the rest never got one in time.
    expect(fetchMock).toHaveBeenCalledTimes(12);
  });

  it("does the same for a whole 4-person page: the people and the short-film lookups all settle by 12 seconds", async () => {
    fakeAbortSignalTimeout();
    hangUntilAborted();
    const started = Date.now();
    let settledAt = -1;
    const page = Promise.allSettled([1, 2, 3, 4].map((id) => getPersonMovieCredits(id, { peopleOnPage: 4 }))).then(
      (all) => {
        settledAt = Date.now() - started;
        return all;
      },
    );

    await vi.advanceTimersByTimeAsync(12_000);
    const all = await page;
    expect(settledAt).toBe(12_000);
    expect(all.map((r) => r.status)).toEqual(["rejected", "rejected", "rejected", "rejected"]);
  });

  it("gives a person's whole short-film lookup, page after page, 3 seconds, whatever the 12 second deadline says", async () => {
    fakeAbortSignalTimeout();
    // Page 1 arrives; the pages it unlocks then hang. Without a budget over the whole lookup they
    // would each get the full 12 seconds.
    fetchMock.mockImplementation((input, init) =>
      pageOf(input) === 1
        ? new Promise<Response>((resolve) => setTimeout(() => resolve(discoverPage([7], 10)), 2000))
        : new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
          }),
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const started = Date.now();
    let settledAt = -1;
    const lookup = getShortMovieIds(1).then((ids) => {
      settledAt = Date.now() - started;
      return ids;
    });

    await vi.advanceTimersByTimeAsync(2999);
    expect(settledAt).toBe(-1);
    await vi.advanceTimersByTimeAsync(1);

    // What it had by then, not an error and not an empty set.
    await expect(lookup).resolves.toEqual(new Set([7]));
    expect(settledAt).toBe(3000);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain("cut short");
  });

  it("resolves with the ids it has at 3 seconds even if TMDB's requests ignore their abort signals", async () => {
    fakeAbortSignalTimeout();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    fetchMock.mockImplementation((input) =>
      pageOf(input) === 1
        ? Promise.resolve(discoverPage([7], 10))
        : new Promise<Response>(() => {}), // never answers, never aborts
    );
    const started = Date.now();
    let settledAt = -1;
    const lookup = getShortMovieIds(1).then((ids) => {
      settledAt = Date.now() - started;
      return ids;
    });
    await vi.advanceTimersByTimeAsync(3000);
    await expect(lookup).resolves.toEqual(new Set([7]));
    expect(settledAt).toBe(3000);
  });

  it("does not hold a person's page up for the lookup: critical calls ready at 500ms, discover hanging, resolves at ~3000ms", async () => {
    fakeAbortSignalTimeout();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    fetchMock.mockImplementation((input, init) => {
      const { pathname } = new URL(String(input));
      if (pathname.includes("/discover/")) {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
        });
      }
      const body = pathname.endsWith("/movie_credits") ? { cast: [], crew: [] } : { id: 1, name: "Someone" };
      return new Promise<Response>((resolve) => setTimeout(() => resolve(json(body)), 500));
    });
    const started = Date.now();
    let settledAt = -1;
    const timeline = getPersonMovieCredits(1).then((t) => {
      settledAt = Date.now() - started;
      return t;
    });

    await vi.advanceTimersByTimeAsync(2999);
    expect(settledAt).toBe(-1);
    await vi.advanceTimersByTimeAsync(1);

    const result = await timeline;
    expect(settledAt).toBe(3000);
    expect(result.person.name).toBe("Someone");
    // Marked, so what is built from it is not kept for long.
    expect(result.shortsIncomplete).toBe(true);
  });

  it("marks a timeline whose lookup lost a page, but not one that finished", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const serve = (failPage2: boolean) =>
      fetchMock.mockImplementation(async (input) => {
        const { pathname } = new URL(String(input));
        if (pathname.includes("/discover/")) {
          return pageOf(input) === 2 && failPage2 ? json({}, 404) : discoverPage([pageOf(input)], 2);
        }
        return json(pathname.endsWith("/movie_credits") ? { cast: [], crew: [] } : { id: 1, name: "Someone" });
      });

    serve(true);
    expect((await getPersonMovieCredits(1)).shortsIncomplete).toBe(true);

    __resetTmdbClientStateForTests();
    serve(false);
    const whole = await getPersonMovieCredits(1);
    expect(whole.shortsIncomplete).toBeUndefined();
    expect("shortsIncomplete" in whole).toBe(false);
  });

  it("does not remember the pages a spent lookup cut off as TMDB failures", async () => {
    fakeAbortSignalTimeout();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    fetchMock.mockImplementation((input, init) =>
      pageOf(input) === 1
        ? new Promise<Response>((resolve) => setTimeout(() => resolve(discoverPage([7], 3)), 2000))
        : new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
          }),
    );
    const first = getShortMovieIds(1);
    await vi.advanceTimersByTimeAsync(3000);
    await first;

    // The lookup's budget ran out, which says nothing about TMDB: asking again goes through.
    fetchMock.mockImplementation(async (input) => discoverPage([pageOf(input)], 3));
    await expect(getShortMovieIds(1)).resolves.toEqual(new Set([1, 2, 3]));
  });

  it("cuts a long Retry-After short when the caller's deadline passes, instead of sleeping through it", async () => {
    fakeAbortSignalTimeout();
    fetchMock.mockImplementation(async () => json({}, 429, { "Retry-After": "10" }));
    const controller = new AbortController();
    const started = Date.now();
    let settledAt = -1;
    const result = settle(searchPeopleWithPopularity("x", controller.signal)).then((outcome) => {
      settledAt = Date.now() - started;
      return outcome;
    });
    await vi.advanceTimersByTimeAsync(1500);
    controller.abort();
    await vi.advanceTimersByTimeAsync(0);

    expect(settledAt).toBe(1500);
    expect(((await result) as { error: TmdbError }).error).toMatchObject({ name: "TmdbError", status: 504 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not send an attempt that gets its slot after the deadline, nor remember the URL as failing", async () => {
    // Real AbortSignal.timeout here: only the clock says the deadline has passed, as in the instant
    // between a slot being granted and the queue's own deadline signal firing.
    const hung: Array<() => void> = [];
    fetchMock.mockImplementation(() => new Promise<Response>((resolve) => hung.push(() => resolve(credits()))));
    for (let id = 1; id <= 6; id++) void getFilmCredits(id);
    await vi.advanceTimersByTimeAsync(0);
    const late = settle(getFilmCredits(7));
    await vi.advanceTimersByTimeAsync(12_000);
    expect(fetchMock).toHaveBeenCalledTimes(6);

    for (const release of hung.splice(0)) release(); // a slot goes to request 7, 12s late
    await vi.advanceTimersByTimeAsync(0);
    expect(((await late) as { error: TmdbError }).error).toMatchObject({ name: "TmdbError", status: 504 });
    expect(fetchMock).toHaveBeenCalledTimes(6); // no 1ms attempt

    fetchMock.mockImplementation(async () => credits());
    await expect(getFilmCredits(7)).resolves.toEqual({ cast: [], crew: [] }); // not remembered
  });
});

describe("short-film lane", () => {
  const discoverBody = (totalPages: number) => json({ page: 1, total_pages: totalPages, results: [] });

  /** Every fetch stays on the wire until released; counts what is on the wire, by kind. */
  function holdRequests(totalPages = 1) {
    const state = {
      releases: [] as Array<() => void>,
      discover: 0,
      other: 0,
      peakDiscover: 0,
      peakTotal: 0,
    };
    fetchMock.mockImplementation((input) => {
      const isDiscover = new URL(String(input)).pathname.includes("/discover/");
      state[isDiscover ? "discover" : "other"]++;
      state.peakDiscover = Math.max(state.peakDiscover, state.discover);
      state.peakTotal = Math.max(state.peakTotal, state.discover + state.other);
      return new Promise<Response>((resolve) => {
        state.releases.push(() => {
          state[isDiscover ? "discover" : "other"]--;
          resolve(isDiscover ? discoverBody(totalPages) : credits());
        });
      });
    });
    return state;
  }

  const releaseAll = async (state: ReturnType<typeof holdRequests>) => {
    while (state.releases.length > 0) {
      state.releases.shift()!();
      await vi.advanceTimersByTimeAsync(0);
    }
  };

  it("lets 2 short-film requests at a time on the wire, the rest of the 6 slots stay for what a page needs", async () => {
    const wire = holdRequests();
    const lookups = [1, 2, 3, 4, 5].map((id) => getShortMovieIds(id));
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(2); // 5 lookups asked, 2 sent; the others wait in their lane

    // The requests a page cannot do without go straight past them: 4 slots were never the lane's.
    const critical = [101, 102, 103, 104].map((id) => getFilmCredits(id));
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(wire.other).toBe(4);

    await releaseAll(wire);
    await Promise.all([...lookups, ...critical]);
    expect(wire.peakDiscover).toBe(2);
    expect(wire.peakTotal).toBeLessThanOrEqual(6);
  });

  it("does not starve critical requests behind a long backlog of short-film requests", async () => {
    const wire = holdRequests(10);
    // 12 people at 10 pages each: far more short-film requests than anything else.
    const lookups = Array.from({ length: 12 }, (_, i) => getShortMovieIds(i + 1));
    await vi.advanceTimersByTimeAsync(0);
    expect(wire.discover).toBe(2);

    // Let the first pages through so their 9 follow-up pages join the backlog too.
    for (let round = 0; round < 6; round++) {
      wire.releases.shift()?.();
      await vi.advanceTimersByTimeAsync(0);
    }
    expect(wire.discover).toBe(2);

    // A person's own requests, asked now, are sent at once: they only ever share the limiter with 2 lookups.
    const person = getFilmCredits(500);
    const more = [501, 502, 503].map((id) => getFilmCredits(id));
    await vi.advanceTimersByTimeAsync(0);
    expect(wire.other).toBe(4);

    await releaseAll(wire);
    await Promise.all([person, ...more, ...lookups]);
    expect(wire.peakDiscover).toBe(2);
    expect(wire.peakTotal).toBeLessThanOrEqual(6);
  });

  it("counts the wait in the lane against the lookup's 3 second budget too", async () => {
    fakeAbortSignalTimeout();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    // Two lookups hang on the wire for good (and ignore their signals); a third waits in the lane.
    const hung: Array<() => void> = [];
    fetchMock.mockImplementation(() => new Promise<Response>((resolve) => hung.push(() => resolve(discoverBody(1)))));
    void getShortMovieIds(1);
    void getShortMovieIds(2);
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const third = getShortMovieIds(3);
    await vi.advanceTimersByTimeAsync(3000);
    // Its lookup is over (it never throws) and TMDB was never asked about it.
    await expect(third).resolves.toEqual(new Set());
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const release of hung) release();
  });
});
