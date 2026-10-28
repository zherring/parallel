import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

/** Loads a fresh copy of awards.ts whose generated file is `file` (or fails to load). */
async function loadAwards(file: unknown | Error) {
  vi.resetModules();
  vi.doMock("@/lib/awards.generated.json", () => {
    if (file instanceof Error) throw file;
    return { default: file };
  });
  return import("@/lib/awards");
}

afterEach(() => {
  vi.doUnmock("@/lib/awards.generated.json");
  vi.restoreAllMocks();
});

describe("awardsFor", () => {
  const file = {
    generatedAt: "2026-10-27T12:00:00.000Z",
    films: {
      "496243": { w: 4, n: 6, f: [["Cannes", "Palme d'Or"]] },
      "550": { w: 0, n: 1, f: [] },
    },
  };

  it("decodes the compact file into summaries", async () => {
    const { awardsFor } = await loadAwards(file);
    expect(awardsFor(496243)).toEqual({
      oscarWins: 4,
      oscarNominations: 6,
      festivalPrizes: [{ festival: "Cannes", prize: "Palme d'Or" }],
    });
    expect(awardsFor(550)).toEqual({ oscarWins: 0, oscarNominations: 1, festivalPrizes: [] });
  });

  it("returns null for a film that is not in the file (the hover-card row stays hidden)", async () => {
    const { awardsFor } = await loadAwards(file);
    expect(awardsFor(999999999)).toBeNull();
    expect(awardsFor(0)).toBeNull();
    expect(awardsFor(Number.NaN)).toBeNull();
  });

  it("returns null for everything when the file is empty", async () => {
    const { awardsFor } = await loadAwards({ generatedAt: "2026-10-27T12:00:00.000Z", films: {} });
    expect(awardsFor(496243)).toBeNull();
  });

  it("returns null for everything when the file is damaged", async () => {
    const { awardsFor } = await loadAwards({ nonsense: true });
    expect(awardsFor(496243)).toBeNull();
  });

  it("shows no awards, instead of failing the page, when the file cannot be loaded", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { awardsFor } = await loadAwards(new Error("missing"));
    expect(awardsFor(496243)).toBeNull();
    expect(error).toHaveBeenCalledOnce();
  });
});
