import { describe, expect, it } from "vitest";
import {
  MAX_RETRY_WAIT_MS,
  MIN_ATTEMPT_MS,
  classifyConnectionError,
  parseRetryAfterMs,
  retryDelayMs,
  retryFits,
} from "@/lib/retry";

const NOW = Date.parse("2026-11-09T12:00:00Z");

describe("parseRetryAfterMs", () => {
  it("reads a number of seconds", () => {
    expect(parseRetryAfterMs("3", NOW)).toBe(3000);
    expect(parseRetryAfterMs(" 1.5 ", NOW)).toBe(1500);
  });

  it("reads an HTTP date relative to now", () => {
    expect(parseRetryAfterMs("Mon, 09 Nov 2026 12:00:07 GMT", NOW)).toBe(7000);
  });

  it("is null for a missing, empty, unreadable, zero or past value", () => {
    for (const header of [null, undefined, "", "soon", "0", "-5", "Mon, 09 Nov 2026 11:59:00 GMT"]) {
      expect(parseRetryAfterMs(header, NOW)).toBeNull();
    }
  });
});

describe("retryDelayMs", () => {
  it("honors Retry-After exactly, without jitter", () => {
    expect(retryDelayMs(1, "4", NOW, () => 0)).toBe(4000);
    expect(retryDelayMs(2, "4", NOW, () => 1)).toBe(4000);
  });

  it("caps Retry-After at 10 seconds", () => {
    expect(MAX_RETRY_WAIT_MS).toBe(10_000);
    expect(retryDelayMs(1, "120", NOW)).toBe(10_000);
    expect(retryDelayMs(1, "Tue, 10 Nov 2026 12:00:00 GMT", NOW)).toBe(10_000);
  });

  it("backs off about 500ms, then 1500ms, when there is no Retry-After", () => {
    expect(retryDelayMs(1, null, NOW, () => 0.5)).toBe(500);
    expect(retryDelayMs(2, null, NOW, () => 0.5)).toBe(1500);
  });

  it("spreads backoff by +/-25% with jitter", () => {
    expect(retryDelayMs(1, null, NOW, () => 0)).toBe(375);
    expect(retryDelayMs(1, null, NOW, () => 1)).toBe(625);
    expect(retryDelayMs(2, null, NOW, () => 0)).toBe(1125);
    expect(retryDelayMs(2, null, NOW, () => 1)).toBe(1875);
  });

  it("falls back to backoff for an unusable Retry-After", () => {
    expect(retryDelayMs(1, "0", NOW, () => 0.5)).toBe(500);
    expect(retryDelayMs(1, "garbage", NOW, () => 0.5)).toBe(500);
  });
});

describe("retryFits", () => {
  it("needs the wait plus a minimum attempt (1s) to fit before the deadline", () => {
    expect(MIN_ATTEMPT_MS).toBe(1000);
    expect(retryFits(500, 1500)).toBe(true);
    expect(retryFits(500, 1499)).toBe(false);
    expect(retryFits(10_000, 11_000)).toBe(true);
    expect(retryFits(10_000, 10_999)).toBe(false);
  });

  it("never fits once the deadline has passed", () => {
    expect(retryFits(0, 999)).toBe(false);
    expect(retryFits(375, 0)).toBe(false);
    expect(retryFits(375, -50)).toBe(false);
  });
});

describe("classifyConnectionError", () => {
  /** What undici throws: a bare TypeError whose `cause` carries the real error and its code. */
  const fetchFailed = (code: string, extra: Record<string, unknown> = {}) =>
    new TypeError("fetch failed", { cause: Object.assign(new Error(`connect ${code}`), { code, ...extra }) });

  it("calls a reset, refused, DNS or unreachable connection a network failure", () => {
    for (const code of ["ECONNRESET", "ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "EPIPE", "EHOSTUNREACH", "ENETUNREACH"]) {
      expect(classifyConnectionError(fetchFailed(code)), code).toBe("network");
    }
  });

  it("calls undici's socket and closed-connection errors network failures", () => {
    for (const code of ["UND_ERR_SOCKET", "UND_ERR_CLOSED", "UND_ERR_DESTROYED"]) {
      expect(classifyConnectionError(fetchFailed(code)), code).toBe("network");
    }
  });

  it("calls connect, headers and body timeouts timeouts", () => {
    for (const code of ["ETIMEDOUT", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_BODY_TIMEOUT"]) {
      expect(classifyConnectionError(fetchFailed(code)), code).toBe("timeout");
    }
  });

  it("finds a code on the error itself, or further down the cause chain", () => {
    expect(classifyConnectionError(Object.assign(new Error("read"), { code: "ECONNRESET" }))).toBe("network");
    const deep = new TypeError("fetch failed", { cause: new Error("wrapper", { cause: fetchFailed("ECONNRESET").cause }) });
    expect(classifyConnectionError(deep)).toBe("network");
  });

  it("is null for errors that are not the connection failing", () => {
    expect(classifyConnectionError(new TypeError("fetch failed"))).toBeNull();
    expect(classifyConnectionError(new TypeError("Cannot read properties of undefined (reading 'get')"))).toBeNull();
    expect(classifyConnectionError(new TypeError("Failed to parse URL", { cause: Object.assign(new TypeError("Invalid URL"), { code: "ERR_INVALID_URL" }) }))).toBeNull();
    expect(classifyConnectionError(fetchFailed("UND_ERR_INVALID_ARG"))).toBeNull();
    expect(classifyConnectionError(fetchFailed("UND_ERR_ABORTED"))).toBeNull();
    expect(classifyConnectionError(fetchFailed("CERT_HAS_EXPIRED"))).toBeNull();
    expect(classifyConnectionError(new DOMException("aborted", "AbortError"))).toBeNull();
  });

  it("is null for things that are not errors at all", () => {
    for (const value of [null, undefined, "ECONNRESET", { code: "ECONNRESET" }, 42]) {
      expect(classifyConnectionError(value)).toBeNull();
    }
  });
});
