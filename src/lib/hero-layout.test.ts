import { describe, expect, it } from "vitest";
import { POSTER_CAPS, moreText, moreTexts, postersShown } from "@/lib/hero-layout";
import type { HeroPairing } from "@/lib/hero-scenes";

function pairing(posterCount: number, sharedCount: number): HeroPairing {
  return {
    key: "1+2",
    sharedCount,
    span: { first: 1990, last: 2010 },
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

describe("moreText", () => {
  it("counts every shared film the shown posters leave out, the dropped posters included", () => {
    // Eleven films, five posters: six more on a desktop, seven on a tablet, eight on a phone.
    expect(moreText(pairing(5, 11), "desktop")).toBe("+6 more");
    expect(moreText(pairing(5, 11), "tablet")).toBe("+7 more");
    expect(moreText(pairing(5, 11), "phone")).toBe("+8 more");
  });

  it("is null where the posters show every film", () => {
    expect(moreText(pairing(5, 5), "desktop")).toBeNull();
    expect(moreText(pairing(3, 3), "phone")).toBeNull();
    expect(moreText(pairing(3, 3), "desktop")).toBeNull();
  });

  it("says one more for the poster a narrower width drops from a pairing it shows whole on a desktop", () => {
    expect(moreText(pairing(5, 5), "tablet")).toBe("+1 more");
    expect(moreText(pairing(5, 5), "phone")).toBe("+2 more");
  });
});

describe("moreTexts", () => {
  it("has the hint of every width, for the label that lets CSS choose", () => {
    expect(moreTexts(pairing(5, 5))).toEqual({ phone: "+2 more", tablet: "+1 more", desktop: null });
    expect(moreTexts(pairing(3, 3))).toEqual({ phone: null, tablet: null, desktop: null });
  });
});
