import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BACON } from "@/lib/bacon-mode";
import {
  BACON_ORANGE,
  TOGETHER_WHITE,
  baconCardSearch,
  baconDescription,
  baconImagePath,
  baconOnPage,
  baconTitle,
  isBaconCard,
  shareHref,
  togetherColor,
} from "@/lib/bacon-share";
import { pairEmbedPath } from "@/lib/player-cards";

const ORIGIN = "https://parallel.example";
const PAIR = "/p/4724-kevin-bacon+26467-kyra-sedgwick";

describe("shareHref: the one rule of every way of sharing a page", () => {
  it("carries the mode when the page is in it, after the period the link opens on", () => {
    expect(shareHref(`${ORIGIN}${PAIR}`, true)).toBe(`${ORIGIN}${PAIR}?mode=bacon`);
    expect(shareHref(`${ORIGIN}${PAIR}?from=1978&to=1993`, true)).toBe(`${ORIGIN}${PAIR}?from=1978&to=1993&mode=bacon`);
  });

  it("leaves a link that already names the mode exactly as it is, however it is written", () => {
    for (const href of [`${ORIGIN}${PAIR}?mode=bacon`, `${ORIGIN}${PAIR}?view=table&sort=year&mode=bacon#films`, `${ORIGIN}${PAIR}?quote=a%20b&mode=bacon`]) {
      expect(shareHref(href, true)).toBe(href);
    }
  });

  it("carries the mode into a quote's link, and keeps the hash after the query", () => {
    expect(shareHref(`${PAIR}/q/short-one`, true)).toBe(`${PAIR}/q/short-one?mode=bacon`);
    expect(shareHref(`${PAIR}#top`, true)).toBe(`${PAIR}?mode=bacon#top`);
  });

  it("is the link as it is out of the mode", () => {
    expect(shareHref(`${ORIGIN}${PAIR}`, false)).toBe(`${ORIGIN}${PAIR}`);
    expect(shareHref(`${ORIGIN}${PAIR}?from=1978&to=1993`, false)).toBe(`${ORIGIN}${PAIR}?from=1978&to=1993`);
  });

  it("drops a mode that means nothing (the page is not in it) and keeps the rest of the link", () => {
    expect(shareHref(`${ORIGIN}${PAIR}?mode=bacon`, false)).toBe(`${ORIGIN}${PAIR}`);
    expect(shareHref(`${ORIGIN}${PAIR}?view=table&mode=bacon#x`, false)).toBe(`${ORIGIN}${PAIR}?view=table#x`);
  });
});

describe("baconOnPage: a page is in the mode when its address says so and he is on it", () => {
  it("reads the people from the pathname and the mode from the query", () => {
    expect(baconOnPage(PAIR, "?mode=bacon")).toBe(true);
    expect(baconOnPage(`${PAIR}/`, "mode=bacon&view=table")).toBe(true);
    expect(baconOnPage(`/p/${BACON.id}`, "?mode=bacon")).toBe(true);
  });

  it("is not without him, without the mode, or off the /p/ pages", () => {
    expect(baconOnPage("/p/3151-jack-lemmon+6837-walter-matthau", "?mode=bacon")).toBe(false);
    expect(baconOnPage(PAIR, "")).toBe(false);
    expect(baconOnPage(PAIR, "?mode=other")).toBe(false);
    expect(baconOnPage("/", "?mode=bacon")).toBe(false);
    expect(baconOnPage("/p/not-people", "?mode=bacon")).toBe(false);
  });
});

describe("isBaconCard: the preview of a pair is in the mode", () => {
  it("is for two to four people, he one of them, whose address names the mode", () => {
    expect(isBaconCard({ mode: "bacon" }, [4724, 26467])).toBe(true);
    expect(isBaconCard("?mode=bacon", [26467, 4724, 3151])).toBe(true);
    expect(isBaconCard(new URLSearchParams("mode=bacon"), [1, 2, 3, 4724])).toBe(true);
  });

  it("is not for one person (the mode's colour is the films made together, which a page of one has none of), nor without him, nor without the mode", () => {
    expect(isBaconCard({ mode: "bacon" }, [4724])).toBe(false);
    expect(isBaconCard({ mode: "bacon" }, [3151, 6837])).toBe(false);
    expect(isBaconCard({}, [4724, 26467])).toBe(false);
    expect(isBaconCard({ mode: ["other", "bacon"] }, [4724, 26467])).toBe(false);
  });
});

describe("the preview's words", () => {
  it("says the mode in the title, after the page's own", () => {
    expect(baconTitle("Kevin Bacon & Kyra Sedgwick: films made together")).toBe("Kevin Bacon & Kyra Sedgwick: films made together · Kevin Bacon mode");
    expect(baconTitle("Kevin Bacon & Kyra Sedgwick: films made together, 1978–1993")).toBe("Kevin Bacon & Kyra Sedgwick: films made together, 1978–1993 · Kevin Bacon mode");
  });

  it("says the mode first in the description", () => {
    expect(baconDescription("Films made together by A & B: X, Y.")).toBe("Kevin Bacon mode. Films made together by A & B: X, Y.");
  });
});

describe("the mode's card and frame", () => {
  it("is the /og route asked for the mode, after the period when the link has one", () => {
    expect(baconCardSearch(null)).toBe("?mode=bacon");
    expect(baconCardSearch({ from: 1978, to: 1993 })).toBe("?from=1978&to=1993&mode=bacon");
    expect(baconImagePath("4724-kevin-bacon+26467-kyra-sedgwick", null)).toBe("/p/4724-kevin-bacon+26467-kyra-sedgwick/og?mode=bacon");
    expect(baconImagePath("4724-kevin-bacon+26467-kyra-sedgwick", { from: 1978, to: 1993 })).toBe(
      "/p/4724-kevin-bacon+26467-kyra-sedgwick/og?from=1978&to=1993&mode=bacon",
    );
  });

  it("frames the embed with the mode only when asked", () => {
    expect(pairEmbedPath("4724-kevin-bacon+26467-kyra-sedgwick")).toBe("/embed/p/4724-kevin-bacon+26467-kyra-sedgwick");
    expect(pairEmbedPath("4724-kevin-bacon+26467-kyra-sedgwick", true)).toBe("/embed/p/4724-kevin-bacon+26467-kyra-sedgwick?mode=bacon");
  });
});

describe("the colour of the films made together on a card or in a frame", () => {
  it("is white, and the mode's orange in the mode", () => {
    expect(togetherColor(false)).toBe("#ffffff");
    expect(togetherColor(true)).toBe("#ff8000");
    expect(togetherColor(false)).toBe(TOGETHER_WHITE);
    expect(togetherColor(true)).toBe(BACON_ORANGE);
  });

  // The card is drawn where CSS cannot be read, so its two colours are repeated in bacon-share.ts: this holds them to the page's.
  describe("is the page's own (globals.css)", () => {
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    const hex = (value: string) => value.toLowerCase().replace(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/, "#$1$1$2$2$3$3");

    it("white where a pair's films made together are white: `--together` on :root", () => {
      const root = /:root\s*\{[^}]*--together:\s*(#[0-9a-fA-F]{3,6})\s*;/.exec(css);
      expect(root, "--together on :root").not.toBeNull();
      expect(hex(root![1])).toBe(TOGETHER_WHITE);
    });

    it("orange in the mode: `--together` is `--orange` on a page that has the mode's mark, and `--orange` is the card's", () => {
      const mode = /:root:has\(\[data-bacon-page\]\)\s*\{[^}]*--together:\s*var\(--orange\)\s*;/.exec(css);
      expect(mode, ":root:has([data-bacon-page]) sets --together to --orange").not.toBeNull();
      const orange = /--orange:\s*(#[0-9a-fA-F]{3,6})\s*;/.exec(css);
      expect(orange, "--orange").not.toBeNull();
      expect(hex(orange![1])).toBe(BACON_ORANGE);
    });
  });
});
