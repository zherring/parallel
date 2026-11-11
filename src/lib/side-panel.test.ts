import { describe, expect, it } from "vitest";
import { filmIdOf, openFilm, openPerson, personIdOf } from "@/lib/side-panel";

describe("the slide-out panel's target", () => {
  it("shows nothing when it is closed", () => {
    expect(filmIdOf(null)).toBeNull();
    expect(personIdOf(null)).toBeNull();
  });

  it("shows a film or a person, never both", () => {
    expect(filmIdOf(openFilm(550))).toBe(550);
    expect(personIdOf(openFilm(550))).toBeNull();
    expect(personIdOf(openPerson(7467))).toBe(7467);
    expect(filmIdOf(openPerson(7467))).toBeNull();
  });

  it("keeps a film and a person with the same id apart", () => {
    expect(filmIdOf(openPerson(550))).toBeNull();
    expect(personIdOf(openFilm(550))).toBeNull();
  });
});
