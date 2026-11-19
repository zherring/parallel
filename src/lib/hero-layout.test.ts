import { describe, expect, it } from "vitest";
import {
  AXIS_PAD,
  BAND,
  BAND_WIDTH_CSS,
  DOT_MIN_SCALE,
  LABEL_END_CLEAR,
  LABEL_GAP,
  POSTER_CAPS,
  axisFraction,
  axisWidth,
  bandWidth,
  decodedYears,
  dotScale,
  labelYears,
  moreCount,
  posterPlace,
  postersShown,
  stripOf,
  yearAxis,
} from "@/lib/hero-layout";
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

  it("has one dot per person and year (two films of one person in a year are one dot over the other), and one per film made together", () => {
    const strip = stripOf({ ...pairing(5, 9), years: { own: [[1977, 0, 4], [1971, 2]], together: [1980, 3, 32] } })!;
    expect(strip.axis).toEqual({ first: 1971, last: 2015 });
    expect(strip.own.map((dots) => dots.length)).toEqual([2, 2]);
    expect(strip.own[0]).toEqual([axisFraction(1977, strip.axis), axisFraction(1981, strip.axis)]);
    expect(strip.together).toEqual([axisFraction(1980, strip.axis), axisFraction(1983, strip.axis), 1]);
    expect(stripOf({ ...pairing(5, 9), years: { own: [[], []], together: [] } })).toBeNull();
  });
});

describe("the dots' size and the year labels, by the axis's width", () => {
  const long = { first: 1940, last: 2018 };

  it("keeps the pair page's dot size where the years are 9px apart or more, and shrinks them as the years come closer, never below half", () => {
    expect(dotScale({ first: 1990, last: 2000 }, 1400)).toBe(1);
    expect(dotScale(long, 1400)).toBe(1);
    expect(dotScale(long, 78 * 9 * 0.8)).toBeCloseTo(0.8);
    expect(dotScale(long, 262)).toBe(DOT_MIN_SCALE);
    // Not measured yet, or one year only: full size.
    expect(dotScale(long, 0)).toBe(1);
    expect(dotScale({ first: 1990, last: 1990 }, 300)).toBe(1);
  });

  it("labels none until the axis is measured, and none within the caps' reach of either end", () => {
    expect(labelYears(long, 0)).toEqual([]);
    expect(labelYears({ first: 1990, last: 1990 }, 800)).toEqual([]);
    const width = 1400;
    const px = (year: number) => ((year - long.first) / (long.last - long.first)) * width;
    const years = labelYears(long, width);
    expect(years.length).toBeGreaterThan(0);
    expect(years.every((year) => px(year) >= LABEL_END_CLEAR && width - px(year) >= LABEL_END_CLEAR)).toBe(true);
  });

  it("labels every ten years on a long career at desktop width, and thins out to twenty on a phone's", () => {
    expect(labelYears(long, 1400)).toEqual([1950, 1960, 1970, 1980, 1990, 2000, 2010]);
    const phone = labelYears(long, 262);
    expect(phone.length).toBeLessThan(labelYears(long, 1400).length);
    const gaps = phone.slice(1).map((year, index) => (year - phone[index]) * (262 / 78));
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(LABEL_GAP);
  });

  it("labels every year of a short career (the room each has, as the pair page's axis does)", () => {
    expect(labelYears({ first: 1991, last: 1996 }, 1400)).toEqual([1992, 1993, 1994, 1995]);
  });
});

describe("the band the timeline's content is in", () => {
  it("is half of the screen from 1200px up, and 86% of it at 390px", () => {
    expect(bandWidth(1200)).toBeCloseTo(600);
    expect(bandWidth(1440)).toBeCloseTo(720);
    expect(bandWidth(1920)).toBeCloseTo(960);
    expect(bandWidth(390)).toBeCloseTo(0.86 * 390);
  });

  it("widens as the screen narrows, by a straight line in px between those two, so a phone's years have room", () => {
    const share = (viewport: number) => bandWidth(viewport) / viewport;
    expect(share(800)).toBeGreaterThan(0.5);
    expect(share(800)).toBeLessThan(0.86);
    const widths = [1200, 1000, 800, 600, 390].map(bandWidth);
    expect(widths).toEqual([...widths].sort((a, b) => b - a));
    // Half way along the line in px is half way between its two ends.
    expect(bandWidth(795)).toBeCloseTo((bandWidth(1200) + bandWidth(390)) / 2);
    // Narrower than a phone it is held to `maxShare`, so the caps keep clear of the screen's edge.
    expect(bandWidth(320)).toBeCloseTo(BAND.maxShare * 320);
    expect(bandWidth(200) / 200).toBeLessThanOrEqual(BAND.maxShare);
  });

  it("is the same rule in CSS, for the stage to set as --band-w", () => {
    expect(BAND_WIDTH_CSS).toBe("max(50cqw, min(90cqw, calc(32.6667cqw + 208px)))");
  });

  it("leaves an axis for the dots of about 590px on a 1440px screen and 230px on a phone", () => {
    expect(axisWidth(1440)).toBeCloseTo(720 - 2 * AXIS_PAD.desktop);
    expect(axisWidth(390)).toBeCloseTo(0.86 * 390 - 2 * AXIS_PAD.phone);
    expect(axisWidth(390)).toBeGreaterThan(200);
  });
});

describe("the dots' size and the year labels in the band's axis", () => {
  const career = { first: 1972, last: 2023 };

  it("sizes the dots from the band: full size on a desktop's axis for a long career, half on a phone's", () => {
    expect(dotScale(career, axisWidth(1440))).toBe(1);
    expect(dotScale(career, axisWidth(390))).toBe(DOT_MIN_SCALE);
    // In between it is the formula's: smaller the narrower the band.
    const tablet = dotScale(career, axisWidth(768));
    expect(tablet).toBeGreaterThan(DOT_MIN_SCALE);
    expect(tablet).toBeLessThan(1);
  });

  it("keeps two labels at least a gap apart, and the first and last clear of the caps' ends, on every screen width and career length", () => {
    for (const viewport of [320, 390, 430, 640, 768, 1024, 1200, 1440, 1920]) {
      const width = axisWidth(viewport);
      for (const span of [4, 12, 30, 51, 80]) {
        const axis = { first: 1940, last: 1940 + span };
        const years = labelYears(axis, width);
        const px = (year: number) => ((year - axis.first) / span) * width;
        for (let index = 1; index < years.length; index += 1) expect(px(years[index]) - px(years[index - 1])).toBeGreaterThanOrEqual(LABEL_GAP - 1e-9);
        for (const year of years) {
          expect(px(year)).toBeGreaterThanOrEqual(LABEL_END_CLEAR);
          expect(width - px(year)).toBeGreaterThanOrEqual(LABEL_END_CLEAR);
        }
      }
    }
  });

  it("labels a long career every ten years at 1440px and on a phone (45px apart there), and every twenty on a phone once it is 80 years", () => {
    expect(labelYears(career, axisWidth(1440))).toEqual([1980, 1990, 2000, 2010, 2020]);
    expect(labelYears(career, axisWidth(390))).toEqual([1980, 1990, 2000, 2010]);
    expect(labelYears({ first: 1940, last: 2020 }, axisWidth(390))).toEqual([1960, 1980, 2000]);
  });
});
