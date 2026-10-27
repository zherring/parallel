import { describe, expect, it } from "vitest";
import { buildExampleCards } from "@/lib/example-cards";
import type { ExamplePairing } from "@/lib/examples";
import type { Film, PersonTimeline } from "@/lib/types";

const film = (id: number, minor = false): Film => ({
  id,
  title: `Film ${id}`,
  releaseDate: `20${String(id).padStart(2, "0")}-01-01`,
  year: 2000 + id,
  posterPath: null,
  credits: [{ role: "director", job: "Director", minor }],
  minor,
});

const timeline = (id: number, films: Film[], profilePath: string | null = `/p${id}.jpg`): PersonTimeline => ({
  person: { id, name: `Person ${id}`, profilePath, knownFor: null, birthday: null, deathday: null },
  films,
});

const pairings: ExamplePairing[] = [
  { people: [{ id: 1, name: "One" }, { id: 2, name: "Two" }], blurb: "First pair" },
  { people: [{ id: 3, name: "Three" }, { id: 4, name: "Four" }], blurb: "Second pair" },
];

describe("buildExampleCards", () => {
  it("counts shared non-minor films and carries photos", () => {
    const map = new Map([
      [1, timeline(1, [film(1), film(2), film(3, true)])],
      [2, timeline(2, [film(2), film(3, true), film(4)])],
      [3, timeline(3, [film(5)])],
      [4, timeline(4, [film(6)], null)],
    ]);
    const cards = buildExampleCards(map, pairings);

    expect(cards[0]).toMatchObject({
      href: "/p/1-one+2-two",
      blurb: "First pair",
      filmsTogether: 1,
    });
    expect(cards[0].people.map((p) => p.profilePath)).toEqual(["/p1.jpg", "/p2.jpg"]);
    expect(cards[1].filmsTogether).toBe(0);
    expect(cards[1].people[1].profilePath).toBeNull();
  });

  it("degrades to text-only cards when nothing loaded", () => {
    const cards = buildExampleCards(new Map(), pairings);
    expect(cards).toHaveLength(2);
    for (const card of cards) {
      expect(card.filmsTogether).toBeNull();
      expect(card.people.every((p) => p.profilePath === null)).toBe(true);
      expect(card.href.startsWith("/p/")).toBe(true);
    }
  });

  it("drops only the count (and that person's photo) when one person is missing", () => {
    const map = new Map([[1, timeline(1, [film(1)])]]);
    const [card] = buildExampleCards(map, pairings);
    expect(card.filmsTogether).toBeNull();
    expect(card.people.map((p) => p.profilePath)).toEqual(["/p1.jpg", null]);
  });

  it("builds a card per example pairing by default", () => {
    expect(buildExampleCards(new Map())).toHaveLength(6);
  });
});
