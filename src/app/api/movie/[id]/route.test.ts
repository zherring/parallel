import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/tmdb", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tmdb")>()),
  getFilmDetails: vi.fn(),
}));

import { GET } from "@/app/api/movie/[id]/route";
import { TmdbError, getFilmDetails } from "@/lib/tmdb";
import type { FilmDetails } from "@/lib/types";

const details = vi.mocked(getFilmDetails);
const FILM = { id: 550, title: "Fight Club" } as unknown as FilmDetails;

const get = (id: string) =>
  GET(new Request(`http://localhost/api/movie/${id}`), { params: Promise.resolve({ id }) });

beforeEach(() => {
  details.mockResolvedValue(FILM);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  details.mockReset();
});

describe("GET /api/movie/[id]", () => {
  it("returns the film and lets shared caches keep it, like film-metrics", async () => {
    const res = await get("550");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(FILM);
    expect(details).toHaveBeenCalledWith(550);
    expect(res.headers.get("Cache-Control")).toBe("public, s-maxage=3600, stale-while-revalidate=86400");
  });

  it("sends no Cache-Control with a bad id", async () => {
    const res = await get("abc");
    expect(res.status).toBe(400);
    expect(res.headers.get("Cache-Control")).toBeNull();
    expect(details).not.toHaveBeenCalled();
  });

  it("sends no Cache-Control with a 404", async () => {
    details.mockRejectedValue(new TmdbError(404, "missing"));
    const res = await get("1");
    expect(res.status).toBe(404);
    expect(res.headers.get("Cache-Control")).toBeNull();
  });

  it("sends no Cache-Control with a 502, so a TMDB hiccup is not kept by shared caches", async () => {
    details.mockRejectedValue(new TmdbError(503, "upstream"));
    const res = await get("1");
    expect(res.status).toBe(502);
    expect(res.headers.get("Cache-Control")).toBeNull();
  });
});
