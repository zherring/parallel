import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FAILURE_MEMORY_MS,
  loadFilmMetrics,
  loadFilmMetricsBatch,
  peekFilmMetrics,
  resetFilmMetricsStore,
} from "@/lib/film-metrics-store";
import type { FilmMetrics } from "@/lib/types";

const metrics = (extra: Partial<FilmMetrics> = {}): FilmMetrics => ({
  voteAverage: 8.4,
  voteCount: 33_145,
  budget: 63_000_000,
  revenue: 100_853_753,
  releaseDate: "1999-10-15",
  awards: null,
  ...extra,
});
const forId = (id: number) => metrics({ voteAverage: id / 10 });

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

const fetchMock = vi.fn<typeof fetch>();
const urls = () => fetchMock.mock.calls.map(([url]) => String(url));
const idsOf = (url: string) => (new URL(url, "http://localhost").searchParams.get("ids") ?? "").split(",").map(Number);

/** A fetch that stays pending until `settle`, and rejects with an AbortError when its signal aborts. */
function pendingFetch() {
  let settle: (res: Response) => void = () => {};
  fetchMock.mockImplementationOnce(
    (_url, init) =>
      new Promise<Response>((resolve, reject) => {
        settle = resolve;
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      }),
  );
  return { settle: (res: Response) => settle(res) };
}

/** Answers every batch request with metrics for each id it asked for, except the ids in `missing` (null). */
function answerBatches(missing: number[] = []) {
  fetchMock.mockImplementation((url) =>
    Promise.resolve(
      json({
        results: Object.fromEntries(idsOf(String(url)).map((id) => [id, missing.includes(id) ? null : forId(id)])),
      }),
    ),
  );
}

const batchBody = (...ids: number[]) => json({ results: Object.fromEntries(ids.map((id) => [id, forId(id)])) });
const signal = () => new AbortController();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-27T12:00:00Z"));
});
afterEach(() => {
  resetFilmMetricsStore();
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("loadFilmMetricsBatch: fetching and caching", () => {
  it("fetches many films in one request, with the ids sorted", async () => {
    answerBatches();
    const lookups = await loadFilmMetricsBatch([30, 10, 20], signal().signal);

    expect(urls()).toEqual(["/api/film-metrics?ids=10,20,30"]);
    expect([...lookups.keys()].sort()).toEqual([10, 20, 30]);
    expect(lookups.get(20)).toEqual({ status: "ready", metrics: forId(20) });
  });

  it("fills the per-film cache, so the hover card for each film needs no request", async () => {
    answerBatches();
    await loadFilmMetricsBatch([1, 2, 3], signal().signal);

    for (const id of [1, 2, 3]) expect(peekFilmMetrics(id)).toEqual({ status: "ready", metrics: forId(id) });
    expect(await loadFilmMetrics(2, signal().signal)).toEqual({ status: "ready", metrics: forId(2) });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("asks only for films it does not know", async () => {
    fetchMock.mockResolvedValueOnce(json(forId(1)));
    await loadFilmMetrics(1, signal().signal);
    answerBatches();

    const lookups = await loadFilmMetricsBatch([1, 2, 3], signal().signal);

    expect(urls()).toEqual(["/api/film-metrics/1", "/api/film-metrics?ids=2,3"]);
    expect(lookups.get(1)).toEqual({ status: "ready", metrics: forId(1) });
  });

  it("makes no request when every film is already known", async () => {
    answerBatches();
    await loadFilmMetricsBatch([1, 2], signal().signal);
    fetchMock.mockClear();

    const lookups = await loadFilmMetricsBatch([2, 1], signal().signal);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(lookups.size).toBe(2);
  });

  it("resolves with an empty map for no films, without a request", async () => {
    expect((await loadFilmMetricsBatch([], signal().signal)).size).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ignores repeated ids", async () => {
    answerBatches();
    const lookups = await loadFilmMetricsBatch([1, 1, 2, 2], signal().signal);

    expect(urls()).toEqual(["/api/film-metrics?ids=1,2"]);
    expect(lookups.size).toBe(2);
  });

  it("splits a long list into requests of at most 50 films", async () => {
    answerBatches();
    const ids = Array.from({ length: 120 }, (_, i) => i + 1);
    const lookups = await loadFilmMetricsBatch(ids, signal().signal);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(urls().map((url) => idsOf(url).length)).toEqual([50, 50, 20]);
    expect(lookups.size).toBe(120);
    expect([...lookups.values()].every((lookup) => lookup.status === "ready")).toBe(true);
  });

  it("adds one listener to the caller's signal, not one per film", async () => {
    answerBatches();
    const controller = signal();
    const add = vi.spyOn(controller.signal, "addEventListener");
    await loadFilmMetricsBatch(
      Array.from({ length: 40 }, (_, i) => i + 1),
      controller.signal,
    );

    expect(add.mock.calls.filter(([type]) => type === "abort")).toHaveLength(1);
  });
});

describe("loadFilmMetricsBatch: failures", () => {
  it("gives failed for a film the response has null for, and ready for the rest", async () => {
    answerBatches([2]);
    const lookups = await loadFilmMetricsBatch([1, 2, 3], signal().signal);

    expect(lookups.get(1)?.status).toBe("ready");
    expect(lookups.get(2)).toEqual({ status: "failed" });
    expect(lookups.get(3)?.status).toBe("ready");
    expect(peekFilmMetrics(2)).toEqual({ status: "failed" });
  });

  it("remembers a missing film for 30 seconds, then asks about it again", async () => {
    answerBatches([2]);
    await loadFilmMetricsBatch([1, 2], signal().signal);
    fetchMock.mockClear();

    await loadFilmMetricsBatch([1, 2], signal().signal);
    expect(fetchMock).not.toHaveBeenCalled();

    vi.advanceTimersByTime(FAILURE_MEMORY_MS);
    answerBatches();
    const lookups = await loadFilmMetricsBatch([1, 2], signal().signal);
    expect(urls()).toEqual(["/api/film-metrics?ids=2"]);
    expect(lookups.get(2)?.status).toBe("ready");
  });

  it.each([
    ["a 500", () => json({ error: "x" }, 500)],
    ["a 429", () => json({ error: "Too many requests" }, 429)],
    ["a 502", () => json({ error: "TMDB is unavailable" }, 502)],
    ["a body that is not JSON", () => new Response("<html>", { status: 200 })],
    ["a body without results", () => json({ nope: true })],
    ["a null body", () => json(null)],
  ])("resolves every film to failed on %s, never rejects", async (_name, response) => {
    fetchMock.mockResolvedValueOnce(response());
    const lookups = await loadFilmMetricsBatch([1, 2], signal().signal);

    expect([...lookups.values()]).toEqual([{ status: "failed" }, { status: "failed" }]);
    expect(peekFilmMetrics(1)).toEqual({ status: "failed" });
  });

  it("resolves to failed on a network error and remembers it for 30 seconds", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect((await loadFilmMetricsBatch([1], signal().signal)).get(1)).toEqual({ status: "failed" });

    await loadFilmMetricsBatch([1], signal().signal);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fails only the chunk whose request failed", async () => {
    fetchMock.mockImplementation((url) => {
      const ids = idsOf(String(url));
      return Promise.resolve(ids[0] === 1 ? json({ error: "x" }, 500) : batchBody(...ids));
    });
    const lookups = await loadFilmMetricsBatch(
      Array.from({ length: 60 }, (_, i) => i + 1),
      signal().signal,
    );

    expect(lookups.get(1)).toEqual({ status: "failed" });
    expect(lookups.get(50)).toEqual({ status: "failed" });
    expect(lookups.get(51)?.status).toBe("ready");
  });
});

describe("loadFilmMetricsBatch: de-duplication", () => {
  it("shares one request between two batches asking for the same films at once", async () => {
    const pending = pendingFetch();
    const a = loadFilmMetricsBatch([1, 2], signal().signal);
    const b = loadFilmMetricsBatch([2, 1], signal().signal);
    pending.settle(batchBody(1, 2));

    expect(await a).toEqual(await b);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fetches only the films another batch is not already fetching", async () => {
    const first = pendingFetch();
    const a = loadFilmMetricsBatch([1, 2], signal().signal);
    answerBatches();
    const b = loadFilmMetricsBatch([2, 3], signal().signal);
    first.settle(batchBody(1, 2));

    expect((await a).size).toBe(2);
    expect([...(await b).keys()].sort()).toEqual([2, 3]);
    expect(urls()).toEqual(["/api/film-metrics?ids=1,2", "/api/film-metrics?ids=3"]);
  });

  it("joins a single-film fetch that is already out instead of asking again", async () => {
    const single = pendingFetch();
    const one = loadFilmMetrics(1, signal().signal);
    answerBatches();
    const batch = loadFilmMetricsBatch([1, 2], signal().signal);
    single.settle(json(forId(1)));

    expect(await one).toEqual({ status: "ready", metrics: forId(1) });
    expect((await batch).get(1)).toEqual({ status: "ready", metrics: forId(1) });
    expect(urls()).toEqual(["/api/film-metrics/1", "/api/film-metrics?ids=2"]);
  });

  it("lets a hover card join a film a batch is already fetching", async () => {
    const pending = pendingFetch();
    const batch = loadFilmMetricsBatch([1, 2], signal().signal);
    const card = loadFilmMetrics(2, signal().signal);
    pending.settle(batchBody(1, 2));

    expect(await card).toEqual({ status: "ready", metrics: forId(2) });
    await batch;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("loadFilmMetricsBatch: aborting", () => {
  it("rejects with an AbortError and cancels the request when the only caller leaves", async () => {
    const pending = pendingFetch();
    const controller = signal();
    const result = loadFilmMetricsBatch([1, 2], controller.signal);
    const rejected = expect(result).rejects.toMatchObject({ name: "AbortError" });

    controller.abort();
    await rejected;

    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
    pending.settle(batchBody(1, 2)); // too late to matter
    await vi.advanceTimersByTimeAsync(0);
    expect(peekFilmMetrics(1)).toBeUndefined();
    expect(peekFilmMetrics(2)).toBeUndefined();
  });

  it("remembers no failure for an abort, and asks again next time", async () => {
    pendingFetch();
    const controller = signal();
    const rejected = expect(loadFilmMetricsBatch([1], controller.signal)).rejects.toBeDefined();
    controller.abort();
    await rejected;
    await vi.advanceTimersByTimeAsync(0);

    answerBatches();
    expect((await loadFilmMetricsBatch([1], signal().signal)).get(1)?.status).toBe("ready");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects at once, without fetching, for a signal that is already aborted", async () => {
    const controller = signal();
    controller.abort();
    await expect(loadFilmMetricsBatch([1, 2], controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers known films even for a signal that is already aborted", async () => {
    answerBatches();
    await loadFilmMetricsBatch([1, 2], signal().signal);
    const controller = signal();
    controller.abort();
    await expect(loadFilmMetricsBatch([1, 2], controller.signal)).resolves.toHaveProperty("size", 2);
  });

  it("keeps the request alive while another caller still waits for one of its films", async () => {
    const pending = pendingFetch();
    const first = signal();
    const a = loadFilmMetricsBatch([1, 2], first.signal);
    const b = loadFilmMetricsBatch([2], signal().signal);
    const aRejected = expect(a).rejects.toMatchObject({ name: "AbortError" });

    first.abort();
    await aRejected;
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(false);

    pending.settle(batchBody(1, 2));
    expect((await b).get(2)).toEqual({ status: "ready", metrics: forId(2) });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // The batch still filled the cache for the film nobody was left waiting for.
    expect(peekFilmMetrics(1)).toEqual({ status: "ready", metrics: forId(1) });
  });

  it("cancels the request once the last caller leaves", async () => {
    pendingFetch();
    const first = signal();
    const second = signal();
    const a = expect(loadFilmMetricsBatch([1, 2], first.signal)).rejects.toBeDefined();
    const b = expect(loadFilmMetricsBatch([1, 2], second.signal)).rejects.toBeDefined();

    first.abort();
    await a;
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(false);
    second.abort();
    await b;
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
  });
});
