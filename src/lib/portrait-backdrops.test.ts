import { describe, expect, it } from "vitest";
import { BACKDROP_POSTERS, CORE_POSTERS, EXTENSION_POSTERS, firstTouching } from "@/lib/backdrop-posters";
import { buildHeroPairings } from "@/lib/example-cards";
import { extensionPosters } from "@/lib/hero-backdrop";
import { heroPool } from "@/lib/hero-scenes";
import backdrops from "@/lib/portrait-backdrops.json";
import cuts from "@/lib/portrait-cuts.json";
import type { PortraitCuts } from "@/lib/portrait-cuts";

// The montage's posters as `npm run portraits:cut -- --posters` stores them (see backdrop-posters.ts for the rules): the core in portrait-cuts.json, the extension in portrait-backdrops.json.

const CUTS = cuts as unknown as PortraitCuts;
const BACKDROPS = backdrops as Record<string, string[]>;
const POSTER = /^\/[A-Za-z0-9]+\.(jpg|png)$/;

/** The people of the landing hero's pool, by id. */
const landingIds = [...new Set(heroPool(buildHeroPairings()).flatMap((pairing) => pairing.people.map((person) => person.id)))];

/** How many different posters a person's two lists hold. */
const distinctOf = (id: number) => new Set([...CUTS[String(id)].posters, ...BACKDROPS[String(id)]]).size;

/**
 * The landing people with fewer than `BACKDROP_POSTERS` different posters, and how many they have: they have fewer films than the montage has tiles (a non-minor credit, released, with
 * a poster, not a short, at most two of a franchise: Brad Bird has seven), so a poster repeats on the outer columns of a very wide screen (past 2560px for most), never on a tile
 * beside itself. A new name here is a person who has too few films, not a list gone wrong; `npm run portraits:cut -- --posters` names the short ones.
 */
const ACCEPTED_SHORT_LISTS: Record<number, number> = {
  7087: 7, // Brad Bird
  138781: 7, // Robert Eggers
  15810: 9, // Ron Clements
  15811: 9, // John Musker
  9339: 10, // Lilly Wachowski
  9340: 10, // Lana Wachowski
  26458: 10, // Kevin Williamson
  69797: 10, // Dean DeBlois
  4762: 12, // Paul Thomas Anderson
  40644: 12, // Chad Stahelski
  1135102: 12, // Jarin Blaschke
  5655: 13, // Wes Anderson
  9033: 13, // Christopher McQuarrie
  66193: 13, // Chris Sanders
  525: 14, // Christopher Nolan
  7467: 14, // David Fincher
  7479: 14, // Jeff Cronenweth
  9248: 15, // Nora Ephron
  137427: 15, // Denis Villeneuve
  11090: 16, // Edgar Wright
  74333: 16, // Jonny Greenwood
  11218: 18, // Alfonso Cuarón
  21684: 18, // Bong Joon Ho
  1: 19, // George Lucas
  20629: 19, // George Miller
  638: 20, // Michael Mann
  5656: 20, // Noah Baumbach
  74401: 20, // Hoyte van Hoytema
  4385: 21, // Sergio Leone
  1075441: 21, // Sam Levy
  2710: 22, // James Cameron
  30715: 22, // Terrence Malick
  2746: 23, // Elia Kazan
  15813: 24, // Alan Menken
  893: 25, // Tony Scott
  3147: 25, // I. A. L. Diamond
  10099: 25, // Park Chan-wook
  54734: 26, // Evan Goldberg
};

describe("the montage's stored posters", () => {
  it("has a core of nine and an extension of eighteen for every cut, and none for anyone else", () => {
    expect(Object.keys(BACKDROPS).sort()).toEqual(Object.keys(CUTS).sort());
    for (const [id, cut] of Object.entries(CUTS)) {
      expect(cut.posters, cut.name).toHaveLength(CORE_POSTERS);
      expect(BACKDROPS[id], cut.name).toHaveLength(EXTENSION_POSTERS);
      for (const path of [...cut.posters, ...BACKDROPS[id]]) expect(path, cut.name).toMatch(POSTER);
    }
  });

  it("never puts the same poster on two touching tiles, side by side, above and below, or diagonally, in the left half or the right, for anyone who has four films to show", () => {
    for (const [id, cut] of Object.entries(CUTS)) {
      if (distinctOf(Number(id)) < 4) continue;
      expect(firstTouching([...cut.posters, ...BACKDROPS[id]]), cut.name).toBeNull();
    }
  });

  it("repeats a poster only for a person with fewer films than tiles: a list with all of its tiles different has none twice, and a list's repeats are of its own posters", () => {
    for (const [id, cut] of Object.entries(CUTS)) {
      const all = [...cut.posters, ...BACKDROPS[id]];
      expect(all).toHaveLength(BACKDROP_POSTERS);
      if (distinctOf(Number(id)) === BACKDROP_POSTERS) expect(new Set(all).size, cut.name).toBe(BACKDROP_POSTERS);
      // The core, the cards' tile, shows nine different posters whenever the person has nine.
      if (distinctOf(Number(id)) >= CORE_POSTERS) expect(new Set(cut.posters).size, cut.name).toBe(CORE_POSTERS);
    }
  });

  it("gives every person on the landing page enough films to fill the montage without repeating, or is listed here as having fewer", () => {
    expect(landingIds.length).toBeGreaterThan(100);
    for (const id of landingIds) {
      expect(CUTS[String(id)], `${id} has a cut`).toBeDefined();
      const floor = ACCEPTED_SHORT_LISTS[id] ?? BACKDROP_POSTERS;
      expect(distinctOf(id), CUTS[String(id)].name).toBeGreaterThanOrEqual(floor);
    }
  });

  it("lists as short only landing people who are short", () => {
    for (const [id, floor] of Object.entries(ACCEPTED_SHORT_LISTS).map(([id, floor]) => [Number(id), floor] as const)) {
      expect(landingIds, `${id}`).toContain(id);
      expect(floor).toBeLessThan(BACKDROP_POSTERS);
      expect(distinctOf(id), CUTS[String(id)].name).toBeLessThan(BACKDROP_POSTERS);
    }
  });
});

describe("extensionPosters", () => {
  it("is the stored extension of a person the file lists", () => {
    expect(extensionPosters(1532, CUTS["1532"].posters)).toEqual(BACKDROPS["1532"]);
  });

  it("arranges the core's own posters for a person it does not list, keeping like ones apart, and is empty for a person with no posters", () => {
    const core = Array.from({ length: CORE_POSTERS }, (_, index) => `/core${index}.jpg`);
    const made = extensionPosters(-1, core);
    expect(made).toHaveLength(EXTENSION_POSTERS);
    expect(firstTouching([...core, ...made])).toBeNull();
    expect(new Set(made).size).toBeGreaterThan(0);
    expect(extensionPosters(-1, [])).toEqual([]);
  });

  describe("the fallback, for a person the file does not list", () => {
    const coreOf = (count: number, prefix = "core") => Array.from({ length: count }, (_, index) => `/${prefix}${index}.jpg`);

    it("searches once for a person and a core: the next render gets the same list, not another search", () => {
      const core = coreOf(CORE_POSTERS, "memo");
      expect(extensionPosters(-2, core)).toBe(extensionPosters(-2, core));
    });

    it("is not stale when the same person's core is another one, nor shared between people", () => {
      const first = extensionPosters(-3, coreOf(CORE_POSTERS, "first"));
      const second = extensionPosters(-3, coreOf(CORE_POSTERS, "second"));
      expect(first.every((poster) => poster.startsWith("/first"))).toBe(true);
      expect(second.every((poster) => poster.startsWith("/second"))).toBe(true);
      expect(extensionPosters(-4, coreOf(CORE_POSTERS, "first"))).toEqual(first);
    });

    it("fills every tile from the core's own posters whatever the core's size, also for a person with two or three posters, whose search can only give up on keeping like ones apart", () => {
      for (let count = 1; count <= CORE_POSTERS; count++) {
        const core = coreOf(count, `n${count}x`);
        const made = extensionPosters(-10 - count, core);
        expect(made, `${count} posters`).toHaveLength(EXTENSION_POSTERS);
        for (const poster of made) expect(core, `${count} posters`).toContain(poster);
      }
    });
  });
});
