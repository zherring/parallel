import { describe, expect, it } from "vitest";
import { filmIdOf, openFilm, openPerson, personIdOf, type PanelTarget } from "@/lib/side-panel";

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

  it("replaces one target with the other when state is set to the new one", () => {
    let state: PanelTarget | null = openFilm(550);
    state = openPerson(287);
    expect(filmIdOf(state)).toBeNull();
    expect(personIdOf(state)).toBe(287);
  });
});
