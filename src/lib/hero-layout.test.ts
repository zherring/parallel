import { describe, expect, it } from "vitest";
import { DOT_NUDGE, POSTER_CAPS, axisFraction, decodedYears, dotsOf, moreCount, posterPlace, postersShown, stripOf, yearAxis } from "@/lib/hero-layout";
import type { HeroPairing } from "@/lib/hero-scenes";

function pairing(posterCount: number, sharedCount: number): HeroPairing {
  return {
    key: "1+2",
    sharedCount,
    years: { own: [[1990, 2, 3], [1995, 4]], together: [2001, 1, 1] },
    people: [
      { id: 1, name: "A", profilePath: "/a.jpg" },
      { id: 2, name: "B", profilePath: "/b.jpg" },
    ],
    posters: Array.from({ length: posterCount }, (_, i) => ({ path: `/p${i}.jpg`, title: `Film ${i}`, year: 1990 + i })),
  };
}

describe("POSTER_CAPS", () => {
  it("shows up to five posters on a desktop, four on a tablet and three on a phone", () => {
    expect(POSTER_CAPS).toEqual({ phone: 3, tablet: 4, desktop: 5 });
  });
});

describe("postersShown", () => {
  it("is the cap of the width, or all the posters there are when they are fewer", () => {
    expect(postersShown(pairing(5, 9), "desktop")).toBe(5);
    expect(postersShown(pairing(5, 9), "tablet")).toBe(4);
    expect(postersShown(pairing(5, 9), "phone")).toBe(3);
    expect(postersShown(pairing(3, 3), "desktop")).toBe(3);
    expect(postersShown(pairing(4, 6), "tablet")).toBe(4);
  });
});

describe("moreCount", () => {
  it("counts every shared film the shown posters leave out, the dropped posters included", () => {
    // Eleven films, five posters: six more on a desktop, seven on a tablet, eight on a phone.
    expect(moreCount(pairing(5, 11), "desktop")).toBe(6);
    expect(moreCount(pairing(5, 11), "tablet")).toBe(7);
    expect(moreCount(pairing(5, 11), "phone")).toBe(8);
  });

  it("is 0 where the posters show every film", () => {
    expect(moreCount(pairing(5, 5), "desktop")).toBe(0);
    expect(moreCount(pairing(3, 3), "phone")).toBe(0);
    expect(moreCount(pairing(3, 3), "desktop")).toBe(0);
  });

  it("says one more for the poster a narrower width drops from a pairing it shows whole on a desktop", () => {
    expect(moreCount(pairing(5, 5), "tablet")).toBe(1);
    expect(moreCount(pairing(5, 5), "phone")).toBe(2);
  });
});

describe("posterPlace", () => {
  it("fans the cluster: the row turns from left-leaning to right-leaning about its middle, each poster a little off the even fan", () => {
    const tilts = [0, 1, 2, 3, 4].map((slot) => posterPlace(slot, 5).tilt);
    expect(tilts[0]).toBeLessThan(0);
    expect(tilts[4]).toBeGreaterThan(0);
    // The jitter breaks the ruled look: the tilts are not evenly spaced.
    const gaps = tilts.slice(1).map((tilt, i) => Math.round((tilt - tilts[i]) * 10) / 10);
    expect(new Set(gaps).size).toBeGreaterThan(1);
    // Small tilts: a hand of cards, not a scatter.
    expect(tilts.every((tilt) => Math.abs(tilt) <= 7)).toBe(true);
  });

  it("offsets the posters alternately up and down, and puts the middle of the row nearest", () => {
    const places = [0, 1, 2, 3, 4].map((slot) => posterPlace(slot, 5));
    expect(places[0].dy).toBeGreaterThan(0);
    expect(places[1].dy).toBeLessThan(0);
    expect(Math.max(...places.map((place) => place.scale))).toBe(places[2].scale);
    expect(places.every((place) => place.scale > 0.9 && place.scale < 1.1)).toBe(true);
  });

  it("keeps a poster's offset and depth by its slot, whatever the count, so it keeps its place from arrival to departure", () => {
    expect(posterPlace(1, 3).dy).toBe(posterPlace(1, 5).dy);
    expect(posterPlace(1, 3).scale).toBe(posterPlace(1, 5).scale);
  });
});

describe("the timeline's axis and dots", () => {
  // Delta-coded: Ford-like films 1977, 1977, 1981 / Lucas-like 1971, 1973 / together 1980, 1983, 2015.
  const years = decodedYears({ own: [[1977, 0, 4], [1971, 2]], together: [1980, 3, 32] });

  it("decodes each list", () => {
    expect(years).toEqual({ own: [[1977, 1977, 1981], [1971, 1973]], together: [1980, 1983, 2015] });
  });

  it("runs from the first film of either person to the last of either: the year caps", () => {
    expect(yearAxis(years)).toEqual({ first: 1971, last: 2015 });
    // A film of one person alone can be the end, not only a film they made together.
    expect(yearAxis(decodedYears({ own: [[1950], [2024]], together: [1980] }))).toEqual({ first: 1950, last: 2024 });
    expect(yearAxis(decodedYears({ own: [[], []], together: [] }))).toBeNull();
  });

  it("places a year across the axis in proportion, 0 at the first year and 1 at the last", () => {
    const axis = { first: 1971, last: 2015 };
    expect(axisFraction(1971, axis)).toBe(0);
    expect(axisFraction(2015, axis)).toBe(1);
    expect(axisFraction(1993, axis)).toBeCloseTo(0.5);
    // One year only: the middle.
    expect(axisFraction(1990, { first: 1990, last: 1990 })).toBe(0.5);
  });

  it("nudges the films of one person in the same year apart, evenly about their year, and leaves a lone film where it is", () => {
    const axis = { first: 1977, last: 1981 };
    const dots = dotsOf([1977, 1977, 1977, 1981], axis);
    expect(dots.map((dot) => dot.nudge)).toEqual([-DOT_NUDGE, 0, DOT_NUDGE, 0]);
    expect(dots.map((dot) => dot.x)).toEqual([0, 0, 0, 1]);
    // They are closer than a dot is wide, so a year with several is one small cluster, not a row.
    expect(DOT_NUDGE).toBeLessThan(6);
  });

  it("has a dot per film: each person's own films in their own lane, the shared films on the line", () => {
    const strip = stripOf({ ...pairing(5, 9), years: { own: [[1977, 0, 4], [1971, 2]], together: [1980, 3, 32] } })!;
    expect(strip.axis).toEqual({ first: 1971, last: 2015 });
    expect(strip.own.map((lane) => lane.length)).toEqual([3, 2]);
    expect(strip.together.map((dot) => dot.x)).toEqual([axisFraction(1980, strip.axis), axisFraction(1983, strip.axis), 1]);
    expect(stripOf({ ...pairing(5, 9), years: { own: [[], []], together: [] } })).toBeNull();
  });
});
