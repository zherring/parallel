import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/teams", () => ({ suggestTeamsChecked: vi.fn() }));

import { GET } from "@/app/api/teams/[id]/route";
import { suggestTeamsChecked } from "@/lib/teams";
import { TmdbError } from "@/lib/tmdb";

const suggest = vi.mocked(suggestTeamsChecked);
const get = (id: string) => GET(new Request(`http://localhost/api/teams/${id}`), { params: Promise.resolve({ id }) });
const teams = { results: [{ people: [{ id: 10, name: "A", profilePath: null }, { id: 11, name: "B", profilePath: null }], sharedCount: 2, titles: ["One", "Two"] }] } as const;

beforeEach(() => {
  suggest.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("GET /api/teams/[id]", () => {
  it("answers the teams, cached for an hour when complete and a minute when not", async () => {
    suggest.mockResolvedValue({ teams: structuredClone(teams) as never, complete: true });
    const res = await get("4724");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(teams);
    expect(res.headers.get("Cache-Control")).toBe("public, s-maxage=3600, stale-while-revalidate=86400");
    expect(suggest.mock.calls[0][0]).toBe(4724);
    expect(suggest.mock.calls[0][1]).toBeInstanceOf(AbortSignal);

    suggest.mockResolvedValue({ teams: { results: [] }, complete: false });
    expect((await get("4724")).headers.get("Cache-Control")).toBe("public, s-maxage=60, stale-while-revalidate=60");
  });

  it("rejects an id that is not a positive integer", async () => {
    for (const id of ["0", "abc", "-1", "12x"]) expect((await get(id)).status, id).toBe(400);
    expect(suggest).not.toHaveBeenCalled();
  });

  it("answers 404 for a person TMDB does not know", async () => {
    suggest.mockRejectedValue(new TmdbError(404, "not found"));
    expect((await get("999999")).status).toBe(404);
  });
});
