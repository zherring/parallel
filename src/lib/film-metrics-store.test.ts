import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FAILURE_MEMORY_MS, loadFilmMetrics, peekFilmMetrics, resetFilmMetricsStore } from "@/lib/film-metrics-store";
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

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

const fetchMock = vi.fn<typeof fetch>();
const urls = () => fetchMock.mock.calls.map(([url]) => String(url));

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

describe("loadFilmMetrics: fetching and caching", () => {
  it("fetches /api/film-metrics/{id} and resolves with the metrics", async () => {
    fetchMock.mockResolvedValueOnce(json(metrics()));
    const result = await loadFilmMetrics(550, signal().signal);

    expect(urls()).toEqual(["/api/film-metrics/550"]);
    expect(result).toEqual({ status: "ready", metrics: metrics() });
  });

  it("keeps a successful result for the session: no second fetch, even much later", async () => {
    fetchMock.mockResolvedValueOnce(json(metrics()));
    await loadFilmMetrics(550, signal().signal);

    vi.advanceTimersByTime(24 * 60 * 60 * 1000);
    const again = await loadFilmMetrics(550, signal().signal);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(again).toEqual({ status: "ready", metrics: metrics() });
    expect(peekFilmMetrics(550)).toEqual({ status: "ready", metrics: metrics() });
  });

  it("caches per film", async () => {
    fetchMock.mockResolvedValueOnce(json(metrics())).mockResolvedValueOnce(json(metrics({ voteAverage: 7.1 })));
    await loadFilmMetrics(1, signal().signal);
    await loadFilmMetrics(2, signal().signal);

    expect(urls()).toEqual(["/api/film-metrics/1", "/api/film-metrics/2"]);
    expect(peekFilmMetrics(1)).toMatchObject({ metrics: { voteAverage: 8.4 } });
    expect(peekFilmMetrics(2)).toMatchObject({ metrics: { voteAverage: 7.1 } });
  });

  it("knows nothing about a film it has not loaded", () => {
    expect(peekFilmMetrics(999)).toBeUndefined();
  });

  it("evicts the least recently stored film beyond its limit", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(json(metrics())));
    for (let id = 1; id <= 301; id++) await loadFilmMetrics(id, signal().signal);

    expect(peekFilmMetrics(1)).toBeUndefined();
    expect(peekFilmMetrics(2)).toBeDefined();
    expect(peekFilmMetrics(301)).toBeDefined();
  });
});

describe("loadFilmMetrics: de-duplication", () => {
  it("shares one request between callers asking for the same film at once", async () => {
    const pending = pendingFetch();
    const a = loadFilmMetrics(550, signal().signal);
    const b = loadFilmMetrics(550, signal().signal);
    pending.settle(json(metrics()));

    expect(await a).toEqual(await b);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not share between films", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(json(metrics())));
    await Promise.all([loadFilmMetrics(1, signal().signal), loadFilmMetrics(2, signal().signal)]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("loadFilmMetrics: failures", () => {
  it.each([
    ["a 500", () => json({ error: "x" }, 500)],
    ["a 404", () => json({ error: "Not found" }, 404)],
    ["a 429", () => json({ error: "Too many requests" }, 429)],
    ["a body that is not JSON", () => new Response("<html>", { status: 200 })],
  ])("resolves to failed on %s, never rejects", async (_name, response) => {
    fetchMock.mockResolvedValueOnce(response());
    expect(await loadFilmMetrics(1, signal().signal)).toEqual({ status: "failed" });
  });

  it("resolves to failed on a network error", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect(await loadFilmMetrics(1, signal().signal)).toEqual({ status: "failed" });
  });

  it("remembers a failure for 30 seconds and then tries again", async () => {
    expect(FAILURE_MEMORY_MS).toBe(30_000);
    fetchMock.mockResolvedValueOnce(json({ error: "x" }, 500));
    await loadFilmMetrics(1, signal().signal);
    expect(peekFilmMetrics(1)).toEqual({ status: "failed" });

    vi.advanceTimersByTime(FAILURE_MEMORY_MS - 1);
    expect(await loadFilmMetrics(1, signal().signal)).toEqual({ status: "failed" });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1);
    expect(peekFilmMetrics(1)).toBeUndefined();
    fetchMock.mockResolvedValueOnce(json(metrics()));
    expect(await loadFilmMetrics(1, signal().signal)).toMatchObject({ status: "ready" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("remembers a failure per film", async () => {
    fetchMock.mockResolvedValueOnce(json({}, 500)).mockResolvedValueOnce(json(metrics()));
    await loadFilmMetrics(1, signal().signal);
    expect(await loadFilmMetrics(2, signal().signal)).toMatchObject({ status: "ready" });
  });
});

describe("loadFilmMetrics: aborting", () => {
  it("rejects with an AbortError and cancels the fetch when the only caller leaves", async () => {
    const pending = pendingFetch();
    const controller = signal();
    const result = loadFilmMetrics(550, controller.signal);
    const rejected = expect(result).rejects.toMatchObject({ name: "AbortError" });

    controller.abort();
    await rejected;

    const init = fetchMock.mock.calls[0][1];
    expect(init?.signal?.aborted).toBe(true);
    pending.settle(json(metrics())); // too late to matter
    await vi.advanceTimersByTimeAsync(0);
    expect(peekFilmMetrics(550)).toBeUndefined();
  });

  it("remembers no failure for an abort, and asks again next time", async () => {
    pendingFetch();
    const controller = signal();
    const rejected = expect(loadFilmMetrics(550, controller.signal)).rejects.toBeDefined();
    controller.abort();
    await rejected;
    await vi.advanceTimersByTimeAsync(0);

    expect(peekFilmMetrics(550)).toBeUndefined();
    fetchMock.mockResolvedValueOnce(json(metrics()));
    expect(await loadFilmMetrics(550, signal().signal)).toMatchObject({ status: "ready" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects at once, without fetching, for a signal that is already aborted", async () => {
    const controller = signal();
    controller.abort();
    await expect(loadFilmMetrics(550, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers a cached film even for a signal that is already aborted", async () => {
    fetchMock.mockResolvedValueOnce(json(metrics()));
    await loadFilmMetrics(550, signal().signal);
    const controller = signal();
    controller.abort();
    // A cached film needs no fetch, so there is nothing to abort.
    await expect(loadFilmMetrics(550, controller.signal)).resolves.toMatchObject({ status: "ready" });
  });

  it("keeps the shared fetch alive while another caller still waits", async () => {
    const pending = pendingFetch();
    const first = signal();
    const second = signal();
    const a = loadFilmMetrics(550, first.signal);
    const b = loadFilmMetrics(550, second.signal);
    const aRejected = expect(a).rejects.toMatchObject({ name: "AbortError" });

    first.abort();
    await aRejected;
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(false);

    pending.settle(json(metrics()));
    expect(await b).toMatchObject({ status: "ready" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("cancels the shared fetch once the last caller leaves", async () => {
    pendingFetch();
    const first = signal();
    const second = signal();
    const a = expect(loadFilmMetrics(550, first.signal)).rejects.toBeDefined();
    const b = expect(loadFilmMetrics(550, second.signal)).rejects.toBeDefined();

    first.abort();
    await a;
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(false);
    second.abort();
    await b;
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
  });
});
