import { afterEach, describe, expect, it, vi } from "vitest";
import { PLAYER_CARDS, pairEmbedPath, pairPlayer, playerCardsOn, quotePlayer } from "@/lib/player-cards";

describe("the player-cards flag", () => {
  it("is on unless the variable says off", () => {
    expect(playerCardsOn(undefined)).toBe(true);
    expect(playerCardsOn("")).toBe(true);
    expect(playerCardsOn("1")).toBe(true);
    expect(playerCardsOn("true")).toBe(true);
    for (const off of ["0", "false", "FALSE", "off", "No", " 0 "]) expect(playerCardsOn(off)).toBe(false);
  });

  it("is on by default in the app (no variable set)", () => {
    expect(PLAYER_CARDS).toBe(true);
  });

  describe("switched off by NEXT_PUBLIC_PLAYER_CARDS", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
      vi.resetModules();
    });

    it("gives a link to a pair and to a quote no player, so that they are the large-image card again", async () => {
      vi.stubEnv("NEXT_PUBLIC_PLAYER_CARDS", "0");
      vi.resetModules();
      const off = await import("@/lib/player-cards");
      expect(off.PLAYER_CARDS).toBe(false);
      expect(off.pairPlayer("1-a+2-b")).toBeUndefined();
      expect(off.quotePlayer("1-a+2-b", "x")).toBeUndefined();
    });
  });
});

describe("the player of a link", () => {
  it("is the pair's embed, at the poster's size", () => {
    expect(pairEmbedPath("488-steven-spielberg+491-john-williams")).toBe("/embed/p/488-steven-spielberg+491-john-williams");
    expect(pairPlayer("488-steven-spielberg+491-john-williams")).toEqual({
      path: "/embed/p/488-steven-spielberg+491-john-williams",
      width: 1200,
      height: 630,
    });
  });

  it("is the quote's embed for a link to a quote, its id written as in a URL", () => {
    expect(quotePlayer("1-a+2-b", "a b")).toEqual({ path: "/embed/q/1-a+2-b/a%20b", width: 1200, height: 630 });
  });
});
