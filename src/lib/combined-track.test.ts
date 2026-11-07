import { describe, expect, it } from "vitest";
import { combineLanes, combinedMinimapFilms, describeCombined, toggleHidden } from "@/lib/combined-track";
import { PERSON_COLORS, personColor, personColorCss, personGlow, personSlots } from "@/lib/person-colors";
import type { Credit, Film } from "@/lib/types";

const TODAY = "2026-01-01";

const director: Credit = { role: "director", job: "Director", minor: false };

function film(id: number, releaseDate: string, credits: Credit[] = [director]): Film {
  return {
    id,
    title: `Film ${id}`,
    releaseDate,
    year: Number(releaseDate.slice(0, 4)),
    posterPath: null,
    voteCount: 0,
    credits,
    minor: credits.every((credit) => credit.minor),
  };
}

const people = [{ id: 10 }, { id: 20 }, { id: 30 }];
const slotOf = personSlots(people);
const lanes = [
  { person: people[0], films: [film(1, "1990-01-01"), film(2, "2000-01-01"), film(4, "2030-01-01")] },
  { person: people[1], films: [film(2, "2000-01-01"), film(3, "1995-01-01"), film(4, "2030-01-01")] },
  { person: people[2], films: [film(3, "1995-01-01")] },
];

describe("person colours", () => {
  it("assigns slots by position in the URL", () => {
    expect([...slotOf]).toEqual([
      [10, 0],
      [20, 1],
      [30, 2],
    ]);
  });

  it("names a custom property for every colour, and wraps past the palette", () => {
    expect(personColor(0)).toBe("var(--person-1)");
    expect(personGlow(1)).toBe("var(--person-2-glow)");
    expect(personColor(PERSON_COLORS.length)).toBe("var(--person-1)");
    const css = personColorCss();
    PERSON_COLORS.forEach((color, i) => expect(css).toContain(`--person-${i + 1}:${color.hex};`));
  });
});

describe("combineLanes", () => {
  it("merges the lanes into one list, oldest first, with each film's contributors", () => {
    const films = combineLanes(lanes, slotOf, TODAY);
    expect(films.map((f) => f.film.id)).toEqual([1, 3, 2, 4]);
    expect(films.find((f) => f.film.id === 3)).toMatchObject({ personIds: [20, 30], slots: [1, 2] });
  });

  it("calls a released film shared when two or more visible people made it, and never an upcoming one", () => {
    const byId = new Map(combineLanes(lanes, slotOf, TODAY).map((f) => [f.film.id, f]));
    expect(byId.get(1)?.shared).toBe(false);
    expect(byId.get(2)?.shared).toBe(true);
    expect(byId.get(3)?.shared).toBe(true);
    expect(byId.get(4)?.shared).toBe(false);
    expect(byId.get(4)?.personIds).toEqual([10, 20]);
  });

  it("decides sharing among the visible people only, and keeps their colours", () => {
    const [first, second] = lanes;
    const films = combineLanes([second, lanes[2]], slotOf, TODAY);
    expect(films.find((f) => f.film.id === 2)).toMatchObject({ shared: false, slots: [1] });
    expect(films.find((f) => f.film.id === 3)).toMatchObject({ shared: true, slots: [1, 2] });

    const alone = combineLanes([first], slotOf, TODAY);
    expect(alone.every((f) => !f.shared)).toBe(true);
    expect(alone.every((f) => f.slots.length === 1 && f.slots[0] === 0)).toBe(true);
  });
});

describe("toggleHidden", () => {
  const everyone = [10, 20, 30];

  it("hides and shows a person", () => {
    const hidden = toggleHidden(new Set(), 20, everyone);
    expect([...hidden]).toEqual([20]);
    expect([...toggleHidden(hidden, 20, everyone)]).toEqual([]);
  });

  it("never hides the last visible person", () => {
    const hidden = toggleHidden(toggleHidden(new Set(), 10, everyone), 20, everyone);
    expect([...hidden].sort()).toEqual([10, 20]);
    expect(toggleHidden(hidden, 30, everyone)).toBe(hidden);
  });
});

describe("describeCombined", () => {
  const ann = { id: 10, name: "Ann Alpha" };
  const bo = { id: 20, name: "Bo Beta" };
  const writer: Credit = { role: "writer", job: "Writer", minor: false };
  const producer: Credit = { role: "producer", job: "Producer", minor: true };
  const people = [ann, bo];
  const slots = personSlots(people);
  const pair = [
    { person: ann, films: [film(1, "1990-01-01"), film(2, "2000-01-01", [director, producer]), film(3, "2030-01-01")] },
    { person: bo, films: [film(2, "2000-01-01", [writer]), film(3, "2030-01-01"), film(4, "2010-01-01", [producer])] },
  ];
  const info = (includeMinor = false) => describeCombined(combineLanes(pair, slots, TODAY), pair, includeMinor);

  it("gives a film one person made their colour and a single dot", () => {
    expect(info().get(1)).toEqual({
      roles: "Alpha: Director",
      note: "",
      tint: { color: personColor(0), glow: personGlow(0) },
      dots: [personColor(0)],
    });
    expect(info().get(4)?.tint).toEqual({ color: personColor(1), glow: personGlow(1) });
  });

  it("notes a released film several people made, with no tint and a dot for each", () => {
    expect(info().get(2)).toEqual({
      roles: "Alpha: Director. Beta: Writer",
      note: "Shared by Alpha & Beta",
      tint: null,
      dots: [personColor(0), personColor(1)],
    });
  });

  it("leaves an upcoming film two people are making neutral, with two dots and no note", () => {
    expect(info().get(3)).toEqual({
      roles: "Alpha: Director. Beta: Director",
      note: "",
      tint: null,
      dots: [personColor(0), personColor(1)],
    });
  });

  it("counts minor credits in the roles only when asked, and still names a person left with none", () => {
    expect(info().get(4)?.roles).toBe("Beta");
    expect(info(true).get(4)?.roles).toBe("Beta: Producer");
    expect(info().get(2)?.roles).toBe("Alpha: Director. Beta: Writer");
    expect(info(true).get(2)?.roles).toBe("Alpha: Director, Producer. Beta: Writer");
  });
});

describe("combinedMinimapFilms", () => {
  const people = [{ id: 10 }, { id: 20 }];
  const slots = personSlots(people);
  const pair = [
    { person: people[0], films: [film(1, "1990-01-01"), film(2, "2000-01-01"), film(3, "2030-01-01")] },
    { person: people[1], films: [film(2, "2000-01-01"), film(3, "2030-01-01"), film(4, "2010-01-01")] },
  ];
  const marks = combinedMinimapFilms(combineLanes(pair, slots, TODAY));

  it("puts the films several people made in shared, without a colour", () => {
    expect(marks.shared.map((mark) => mark.id)).toEqual([2]);
    expect(marks.shared[0]).toMatchObject({ title: "Film 2", year: 2000, releaseDate: "2000-01-01", color: undefined });
  });

  it("ticks every other film, in its person's colour when one person made it", () => {
    expect(marks.ticks.map((mark) => [mark.id, mark.color])).toEqual([
      [1, personColor(0)],
      [4, personColor(1)],
      // Announced by both: not shared yet, and no single colour to give it.
      [3, undefined],
    ]);
  });
});
