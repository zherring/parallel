import { describe, expect, it } from "vitest";
import type { CombinedFilm } from "@/lib/combined-track";
import { demoteMinor, MINOR_OBSCURITY, minorOnlyIds } from "@/lib/depth-minor";
import type { Film } from "@/lib/types";

const film = (id: number, minor: boolean): Film => ({ id, minor }) as Film;
const entry = (id: number, shared: boolean, personIds = [1]): CombinedFilm => ({
  film: film(id, false),
  personIds,
  slots: personIds.map((_, index) => index),
  shared,
});

describe("minorOnlyIds", () => {
  it("is the films every lane that lists them lists as minor", () => {
    const lanes = [{ films: [film(1, true), film(2, false), film(3, true)] }, { films: [film(3, true), film(4, true)] }];
    expect([...minorOnlyIds(lanes)].sort()).toEqual([1, 3, 4]);
  });

  it("leaves out a film that is the work of any one person, whoever's cameo it also is", () => {
    const lanes = [{ films: [film(1, true), film(2, true)] }, { films: [film(1, false)] }];
    expect([...minorOnlyIds(lanes)]).toEqual([2]);
  });

  it("is empty when nothing is minor, or there are no lanes", () => {
    expect(minorOnlyIds([{ films: [film(1, false)] }]).size).toBe(0);
    expect(minorOnlyIds([]).size).toBe(0);
  });
});

describe("demoteMinor", () => {
  it("takes a minor film out of the films made together, and keeps the rest of its entry", () => {
    const shared = entry(1, true, [1, 2]);
    const [demoted] = demoteMinor([shared], new Set([1]));
    expect(demoted.shared).toBe(false);
    expect(demoted.personIds).toEqual([1, 2]);
    expect(demoted.film).toBe(shared.film);
    expect(shared.shared).toBe(true);
  });

  it("leaves the films that are not minor made together", () => {
    const entries = [entry(1, true, [1, 2]), entry(2, true, [1, 2]), entry(3, false)];
    expect(demoteMinor(entries, new Set([2])).map((e) => e.shared)).toEqual([true, false, false]);
  });

  it("returns the same array when there is nothing to demote", () => {
    const entries = [entry(1, true, [1, 2]), entry(2, false)];
    expect(demoteMinor(entries, new Set())).toBe(entries);
    expect(demoteMinor(entries, new Set([2]))).toBe(entries);
  });
});

describe("MINOR_OBSCURITY", () => {
  it("is a cue between the best-known and the most obscure film: faint and far back, but not the last", () => {
    expect(MINOR_OBSCURITY).toBeGreaterThan(0.5);
    expect(MINOR_OBSCURITY).toBeLessThan(1);
  });
});
