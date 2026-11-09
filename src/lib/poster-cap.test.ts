import { describe, expect, it } from "vitest";
import { combineLanes } from "@/lib/combined-track";
import { postersLeftOut } from "@/lib/poster-cap";
import {
  DEFAULT_MAX_ROWS,
  DEFAULT_ZOOM,
  axisRange,
  makeScale,
  overflowCount,
  packFilms,
  packTrackLanes,
  sharedAcrossLanes,
} from "@/lib/timeline-layout";
import type { Film } from "@/lib/types";

const TODAY = "2026-01-01";

const film = (id: number, date: string, voteCount = 0, minor = false): Film => ({
  id,
  title: `Film ${id}`,
  releaseDate: date,
  year: Number(date.slice(0, 4)),
  posterPath: null,
  voteCount,
  credits: [{ role: "actor", job: "Actor", minor }],
  minor,
});

const lane = (id: number, films: Film[]) => ({ person: { id }, films });
const slots = (...ids: number[]) => new Map(ids.map((id, index) => [id, index]));

/** `count` films released on the same day: one column, so only `DEFAULT_MAX_ROWS` of them fit; the more voted keep their posters. */
const pileUp = (firstId: number, count: number, date = "2000-06-01") =>
  Array.from({ length: count }, (_, index) => film(firstId + index, date, 1000 - index * 10));

describe("postersLeftOut", () => {
  it("leaves out nothing when every film fits the rows: spread a year apart, two on a day", () => {
    const films = [film(1, "1990-01-01", 5), film(2, "1991-01-01", 4), film(3, "1992-01-01", 3), film(4, "1992-01-01", 2)];
    expect(postersLeftOut([lane(1, films)], slots(1), TODAY).size).toBe(0);
  });

  it(`gives a poster to as many films of a pile as there are rows (${DEFAULT_MAX_ROWS}), by votes, and leaves the rest out: one person`, () => {
    const films = pileUp(10, 5);
    const left = postersLeftOut([lane(1, films)], slots(1), TODAY);
    expect(DEFAULT_MAX_ROWS).toBe(2);
    // The two most voted (ids 10 and 11) keep their posters.
    expect([...left].sort((a, b) => a - b)).toEqual([12, 13, 14]);
  });

  it("is the same set the flat timeline's own packing leaves as nodes (one person: their lane, the people's lane as the page has it)", () => {
    const films = [...pileUp(10, 6, "2000-03-01"), ...pileUp(30, 4, "2001-03-01"), film(50, "2005-01-01", 1)];
    const range = axisRange(films.map((f) => f.year), Number(TODAY.slice(0, 4)));
    const scale = makeScale(range, DEFAULT_ZOOM);
    const base = { pxPerYear: DEFAULT_ZOOM, axisStartYear: scale.axisStartYear };
    const trackLanes = [lane(1, films)];
    const flat = packTrackLanes(trackLanes, trackLanes, sharedAcrossLanes(trackLanes, TODAY), base, TODAY).capped;
    const expected = flat[0].filter((item) => item.overflow).map((item) => item.film.id);
    expect(overflowCount(flat[0])).toBeGreaterThan(0);
    expect([...postersLeftOut(trackLanes, slots(1), TODAY)].sort()).toEqual([...expected].sort());
    // And that packing is the library's `packFilms` with the row cap, nothing more.
    const direct = packFilms(films, { ...base, priorityIds: new Set(), quietIds: new Set(), obstacles: [], maxRows: DEFAULT_MAX_ROWS });
    expect(direct.filter((item) => item.overflow).map((item) => item.film.id).sort()).toEqual([...expected].sort());
  });

  it("packs several people on one combined track, and always keeps the films they made together", () => {
    // Four films both made, a day apart, and each person's own pile on the same dates: the shared ones are placed first and exempt from the cap.
    const together = [film(1, "2000-06-01", 1), film(2, "2000-06-02", 1), film(3, "2000-06-03", 1), film(4, "2000-06-04", 1)];
    const alpha = [...together, ...pileUp(100, 3, "2000-06-02")];
    const beta = [...together, ...pileUp(200, 3, "2000-06-03")];
    const left = postersLeftOut([lane(1, alpha), lane(2, beta)], slots(1, 2), TODAY);
    for (const id of [1, 2, 3, 4]) expect(left.has(id)).toBe(false);
    // With four shared films packed into the same stretch, the cap leaves the others no row.
    expect([100, 101, 102, 200, 201, 202].every((id) => left.has(id))).toBe(true);
  });

  it("decides on the combined track, not on each person's: two people's films of the same year compete for the same rows", () => {
    const alpha = lane(1, pileUp(10, 2));
    const beta = lane(2, pileUp(20, 2));
    // Each person alone fits their two films in the two rows; together on one track, four films share the column.
    expect(postersLeftOut([alpha], slots(1), TODAY).size).toBe(0);
    expect(postersLeftOut([beta], slots(2), TODAY).size).toBe(0);
    const left = postersLeftOut([alpha, beta], slots(1, 2), TODAY);
    expect(left.size).toBe(2);
    expect(combineLanes([alpha, beta], slots(1, 2), TODAY)).toHaveLength(4);
  });

  it("composes with the minor toggle as the flat page does: the lanes it is given are the films counted, so minor credits compete too", () => {
    const own = [film(1, "2000-06-01", 100), film(2, "2000-06-01", 90)];
    const cameos = [film(3, "2000-06-01", 5000, true), film(4, "2000-06-01", 4000, true)];
    // Minor credits off: the page's lane is the two films, and both keep a poster.
    expect(postersLeftOut([lane(1, own)], slots(1), TODAY).size).toBe(0);
    // On: the lane has four; the two better-voted cameos take the rows (the cap goes by votes) and the person's own films are the ones left out.
    expect([...postersLeftOut([lane(1, [...own, ...cameos])], slots(1), TODAY)].sort((a, b) => a - b)).toEqual([1, 2]);
  });

  it("is a set of film ids of the lanes it was given, and nothing else", () => {
    const films = pileUp(10, 6);
    const left = postersLeftOut([lane(1, films)], slots(1), TODAY);
    const ids = new Set(films.map((f) => f.id));
    for (const id of left) expect(ids.has(id)).toBe(true);
    expect(left.size).toBe(films.length - DEFAULT_MAX_ROWS);
  });

  it("does not depend on the order of the films, or on the clock beyond the date it is given", () => {
    const films = [...pileUp(10, 5), film(40, "2003-01-01", 7), film(41, "2010-01-01", 3)];
    const forwards = postersLeftOut([lane(1, films)], slots(1), TODAY);
    const backwards = postersLeftOut([lane(1, [...films].reverse())], slots(1), TODAY);
    expect([...backwards].sort()).toEqual([...forwards].sort());
    expect([...postersLeftOut([lane(1, films)], slots(1), "2030-01-01")].sort()).toEqual([...forwards].sort());
  });

  it("is empty for a page with no films", () => {
    expect(postersLeftOut([lane(1, [])], slots(1), TODAY).size).toBe(0);
    expect(postersLeftOut([lane(1, []), lane(2, [])], slots(1, 2), TODAY).size).toBe(0);
  });
});
