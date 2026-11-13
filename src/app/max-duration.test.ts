import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { REQUEST_DEADLINE_MS, ROUTE_BUDGET_MS } from "@/lib/tmdb";

const APP = join(process.cwd(), "src", "app");
/** The files Next runs per request (pages, route handlers, generated images). */
const ENTRY = /(^|\/)(page\.tsx|route\.tsx?|(opengraph|twitter)-image\.tsx?)$/;
/** Anything that imports these can end up waiting on TMDB. */
const REACHES_TMDB = /from "@\/lib\/(tmdb|people|collaborators|api-error)"/;
/** The platform's default limit may be as low as 10s; with maxDuration the TMDB deadline can fire first. */
const HEADROOM_MS = 5000;

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? sources(path) : [path];
  });
}

const entries = sources(APP)
  .map((path) => relative(APP, path))
  .filter((path) => ENTRY.test(path))
  .filter((path) => REACHES_TMDB.test(readFileSync(join(APP, path), "utf8")));

/**
 * Seconds each entry may run. 20 where one round of TMDB requests is made; 60 on the two routes
 * that make several in turn (a person, then 16 candidates; 50 films, 8 at a time).
 */
const EXPECTED: Record<string, number> = {
  "api/collaborators/[id]/route.ts": 60,
  "api/film-metrics/[id]/route.ts": 20,
  "api/film-metrics/route.ts": 60,
  "api/movie/[id]/route.ts": 20,
  "api/search/route.ts": 20,
  "embed/q/[people]/[id]/page.tsx": 20,
  "p/[people]/og/route.tsx": 20,
  "p/[people]/opengraph-image.tsx": 20,
  "p/[people]/page.tsx": 20,
  "p/[people]/q/[id]/page.tsx": 20,
};

describe("maxDuration of everything that can reach TMDB", () => {
  it("leaves the 60s routes at least 5s above their route budget", () => {
    expect(ROUTE_BUDGET_MS + HEADROOM_MS).toBeLessThanOrEqual(60_000);
    expect(ROUTE_BUDGET_MS).toBeGreaterThan(REQUEST_DEADLINE_MS);
  });

  it("finds the pair page, its cards and every TMDB api route", () => {
    expect(entries.sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  it.each(entries)("%s sets the maxDuration listed above, at least 5s above the TMDB deadline", (path) => {
    const source = readFileSync(join(APP, path), "utf8");
    const match = /^export const maxDuration = (\d+);$/m.exec(source);
    expect(match, `${path} must export maxDuration`).not.toBeNull();
    expect(Number(match![1])).toBe(EXPECTED[path]);
    expect(Number(match![1]) * 1000).toBeGreaterThanOrEqual(REQUEST_DEADLINE_MS + HEADROOM_MS);
  });
});
