import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { decodeAwards, type AwardsFile } from "@/lib/awards-format";
import { ALL_OSCAR_TRUTH, FESTIVAL_TRUTH, OSCAR_TRUTH } from "@/lib/awards-truth";

// The committed awards.generated.json against films whose awards are known, so a bad regeneration
// (a changed query, a degraded endpoint, a damaged edit) fails `npm test` without the network.
// Films that are not in the file are skipped: the file lists only films with an Oscar record or a
// prize, and the truth set is not part of the curated corpus (pairings change).
const PATH = fileURLToPath(new URL("./awards.generated.json", import.meta.url));
const raw = readFileSync(PATH, "utf8");
const file = JSON.parse(raw) as AwardsFile;
const awards = decodeAwards(file);

/** A file with fewer of the truth films than this is broken, not a smaller corpus. */
const MIN_TRUTH_FILMS_PRESENT = 20;

describe("the generated awards file", () => {
  it("is compact, dated and has a decodable entry for every film", () => {
    expect(raw.trim().split("\n")).toHaveLength(1);
    expect(Number.isNaN(Date.parse(file.generatedAt))).toBe(false);
    expect(Object.keys(file.films).length).toBeGreaterThan(100);
    expect(awards.size).toBe(Object.keys(file.films).length);
    expect(raw.length).toBeLessThan(100 * 1024);
  });

  it("has the Academy's tallies for the films of the truth set it contains", () => {
    const present = ALL_OSCAR_TRUTH.filter((t) => awards.has(t.tmdbId));
    expect(present.length).toBeGreaterThanOrEqual(MIN_TRUTH_FILMS_PRESENT);
    const mismatches = present
      .filter((t) => {
        const got = awards.get(t.tmdbId)!;
        return got.oscarWins !== t.wins || got.oscarNominations !== t.nominations;
      })
      .map((t) => `${t.title}: expected ${t.wins}/${t.nominations}, file has ${awards.get(t.tmdbId)!.oscarWins}/${awards.get(t.tmdbId)!.oscarNominations}`);
    // Fix: run `npm run awards:refresh -- --validate`, then `npm run awards:refresh`.
    expect(mismatches).toEqual([]);
  });

  it("has the original 26 validation films it contains exactly right", () => {
    const present = OSCAR_TRUTH.filter((t) => awards.has(t.tmdbId));
    expect(present.length).toBeGreaterThanOrEqual(15);
    for (const t of present) {
      expect([t.title, awards.get(t.tmdbId)?.oscarWins, awards.get(t.tmdbId)?.oscarNominations]).toEqual([
        t.title,
        t.wins,
        t.nominations,
      ]);
    }
  });

  it("has the top festival prizes of the truth-set films it contains", () => {
    const present = FESTIVAL_TRUTH.filter((t) => awards.has(t.tmdbId));
    expect(present.length).toBeGreaterThanOrEqual(4);
    for (const t of present) {
      expect([t.title, awards.get(t.tmdbId)?.festivalPrizes]).toEqual(
        [t.title, expect.arrayContaining([t.prize])],
      );
    }
  });

  it("is consistent: a win is a nomination, festival prizes are known ones", () => {
    const known = new Set(["Cannes:Palme d'Or", "Venice:Golden Lion", "Berlin:Golden Bear"]);
    for (const [id, film] of awards) {
      expect(film.oscarWins, `film ${id}`).toBeLessThanOrEqual(film.oscarNominations);
      expect(film.oscarNominations + film.festivalPrizes.length, `film ${id}`).toBeGreaterThan(0);
      for (const p of film.festivalPrizes) expect(known.has(`${p.festival}:${p.prize}`)).toBe(true);
    }
  });
});
