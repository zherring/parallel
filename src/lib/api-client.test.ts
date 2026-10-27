import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApiClientError,
  errorKindForStatus,
  errorMessage,
  getJson,
  isAbortError,
} from "@/lib/api-client";

const fetchMock = vi.fn<typeof fetch>();

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe("errorKindForStatus", () => {
  it("maps statuses to kinds", () => {
    expect(errorKindForStatus(404)).toBe("not-found");
    expect(errorKindForStatus(429)).toBe("rate-limited");
    expect(errorKindForStatus(500)).toBe("server");
    expect(errorKindForStatus(502)).toBe("server");
    expect(errorKindForStatus(400)).toBe("server");
  });
});

describe("errorMessage", () => {
  it("has a distinct friendly message per kind and subject", () => {
    expect(errorMessage("rate-limited", "search")).toMatch(/too fast/i);
    expect(errorMessage("rate-limited", "film")).toMatch(/too many requests/i);
    expect(errorMessage("not-found", "film")).toMatch(/couldn't find that film/i);
    expect(errorMessage("server", "search")).toMatch(/search is having trouble/i);
    expect(errorMessage("server", "film")).toMatch(/unavailable/i);
    expect(errorMessage("network", "film")).toMatch(/connection/i);
  });

  it("never leaks status codes", () => {
    for (const kind of ["not-found", "rate-limited", "server", "network"] as const) {
      expect(errorMessage(kind, "search")).not.toMatch(/\d{3}/);
      expect(errorMessage(kind, "film")).not.toMatch(/\d{3}/);
    }
  });
});

describe("getJson", () => {
  it("returns parsed JSON and forwards the abort signal", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    const controller = new AbortController();

    await expect(getJson("/api/x", controller.signal)).resolves.toEqual({ ok: true });
    expect(fetchMock.mock.calls[0][1]?.signal).toBe(controller.signal);
  });

  it("throws typed errors for HTTP failures", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(new Response("{}", { status: 429 }));
    await expect(getJson("/api/x")).rejects.toMatchObject({ kind: "rate-limited", status: 429 });

    fetchMock.mockResolvedValue(new Response("{}", { status: 404 }));
    await expect(getJson("/api/x")).rejects.toMatchObject({ kind: "not-found" });

    fetchMock.mockResolvedValue(new Response("{}", { status: 502 }));
    await expect(getJson("/api/x")).rejects.toMatchObject({ kind: "server" });
  });

  it("reports an unreadable body as a server error", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(new Response("<html>nope</html>"));
    await expect(getJson("/api/x")).rejects.toBeInstanceOf(ApiClientError);
  });

  it("maps network failures but rethrows aborts untouched", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(getJson("/api/x")).rejects.toMatchObject({ kind: "network" });

    const abort = new DOMException("Aborted", "AbortError");
    fetchMock.mockRejectedValue(abort);
    const error = await getJson("/api/x").catch((e: unknown) => e);
    expect(error).toBe(abort);
    expect(isAbortError(error)).toBe(true);
  });
});
