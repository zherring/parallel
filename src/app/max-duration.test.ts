import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { REQUEST_DEADLINE_MS } from "@/lib/tmdb";

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

describe("maxDuration of everything that can reach TMDB", () => {
  it("finds the pair page, its cards and every TMDB api route", () => {
    expect(entries.sort()).toEqual([
      "api/collaborators/[id]/route.ts",
      "api/film-metrics/[id]/route.ts",
      "api/film-metrics/route.ts",
      "api/movie/[id]/route.ts",
      "api/search/route.ts",
      "p/[people]/og/route.tsx",
      "p/[people]/opengraph-image.tsx",
      "p/[people]/page.tsx",
    ]);
  });

  it.each(entries)("%s sets maxDuration at least 5s above the TMDB deadline", (path) => {
    const source = readFileSync(join(APP, path), "utf8");
    const match = /^export const maxDuration = (\d+);$/m.exec(source);
    expect(match, `${path} must export maxDuration`).not.toBeNull();
    expect(Number(match![1]) * 1000).toBeGreaterThanOrEqual(REQUEST_DEADLINE_MS + HEADROOM_MS);
  });
});
