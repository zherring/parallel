import { describe, expect, it } from "vitest";
import { separateMinimapFilms } from "@/lib/minimap-films";
import { personColor, personSlots } from "@/lib/person-colors";
import type { Film } from "@/lib/types";

function film(id: number, year: number): Film {
  return {
    id,
    title: `Film ${id}`,
    releaseDate: `${year}-01-01`,
    year,
    posterPath: null,
    voteCount: 0,
    credits: [{ role: "director", job: "Director", minor: false }],
    minor: false,
  };
}

const people = [{ id: 10 }, { id: 20 }, { id: 30 }];
const slots = personSlots(people);
const everyone = film(1, 1990); // all three lanes
const pairOnly = film(2, 1995); // lanes 0 and 1
const soloA = film(3, 2000); // lane 0
const soloC = film(4, 2005); // lane 2
const lanes = [
  { person: people[0], films: [everyone, pairOnly, soloA] },
  { person: people[1], films: [everyone, pairOnly] },
  { person: people[2], films: [everyone, soloC] },
];
// What the track placed: the lanes that show each film.
const membership = new Map<number, number[]>([
  [1, [0, 1, 2]],
  [2, [0, 1]],
]);
const accents = new Map([[2, "var(--slot-0)"]]);

describe("separateMinimapFilms", () => {
  it("marks a film shown in every lane as shared", () => {
    const { shared, ticks } = separateMinimapFilms(lanes, membership, accents, slots, true);
    expect(shared.map((mark) => mark.id)).toEqual([1]);
    expect(ticks.map((mark) => mark.id)).not.toContain(1);
  });

  it("colours a film of one lane with its person, and a film of some lanes with its connection's accent", () => {
    const { ticks } = separateMinimapFilms(lanes, membership, accents, slots, true);
    const colorOf = (id: number) => ticks.find((mark) => mark.id === id)?.color;
    expect(colorOf(3)).toBe(personColor(0));
    expect(colorOf(4)).toBe(personColor(2));
    expect(colorOf(2)).toBe("var(--slot-0)");
  });

  it("leaves the ticks uncoloured when the page has one person", () => {
    const { shared, ticks } = separateMinimapFilms([lanes[0]], new Map(), new Map(), slots, false);
    expect(shared).toEqual([]);
    expect(ticks.map((mark) => mark.id)).toEqual([1, 2, 3]);
    expect(ticks.every((mark) => mark.color === undefined)).toBe(true);
  });

  it("gives no film a colour when the page is not coloured, whatever the lanes show", () => {
    const { ticks } = separateMinimapFilms(lanes, membership, accents, slots, false);
    expect(ticks.length).toBeGreaterThan(0);
    expect(ticks.every((mark) => mark.color === undefined)).toBe(true);
  });

  it("carries the film's title, year and date", () => {
    const { ticks } = separateMinimapFilms(lanes, membership, accents, slots, true);
    expect(ticks.find((mark) => mark.id === 4)).toEqual({
      id: 4,
      title: "Film 4",
      year: 2005,
      releaseDate: "2005-01-01",
      color: personColor(2),
    });
  });
});
