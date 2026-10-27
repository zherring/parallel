import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "@/proxy";

const request = (ip: string) =>
  new NextRequest("http://localhost/api/search?q=fincher", { headers: { "x-forwarded-for": ip } });

describe("proxy", () => {
  it("lets 60 requests per minute through and answers the 61st with 429 + Retry-After", () => {
    const statuses = Array.from({ length: 61 }, () => proxy(request("198.51.100.1")).status);

    expect(statuses.slice(0, 60).every((s) => s === 200)).toBe(true);
    expect(statuses[60]).toBe(429);

    const limited = proxy(request("198.51.100.1"));
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("limits each client separately", () => {
    for (let i = 0; i < 61; i++) proxy(request("198.51.100.2"));
    expect(proxy(request("198.51.100.3")).status).toBe(200);
  });
});
