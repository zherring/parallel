import { describe, expect, it } from "vitest";
import { filmLabel } from "@/lib/film-label";

describe("filmLabel", () => {
  it("is the title and the year as they are for a title that does not end with its year", () => {
    expect(filmLabel("Woodstock", 1970)).toEqual({ title: "Woodstock", year: 1970 });
    expect(filmLabel("Who's That Knocking at My Door", 1968)).toEqual({ title: "Who's That Knocking at My Door", year: 1968 });
    expect(filmLabel("  Taxi Driver ", 1976)).toEqual({ title: "Taxi Driver", year: 1976 });
  });

  it("takes the year off a title that ends with it, so it is not said twice", () => {
    expect(filmLabel("Street Scenes 1970", 1970)).toEqual({ title: "Street Scenes", year: 1970 });
    expect(filmLabel("Street Scenes (1970)", 1970)).toEqual({ title: "Street Scenes", year: 1970 });
    expect(filmLabel("Street Scenes [1970]", 1970)).toEqual({ title: "Street Scenes", year: 1970 });
    expect(filmLabel("Street Scenes - 1970", 1970)).toEqual({ title: "Street Scenes", year: 1970 });
    expect(filmLabel("Street Scenes: 1970", 1970)).toEqual({ title: "Street Scenes", year: 1970 });
    expect(filmLabel("Street Scenes, 1970", 1970)).toEqual({ title: "Street Scenes", year: 1970 });
    expect(filmLabel("Street Scenes—1970", 1970)).toEqual({ title: "Street Scenes", year: 1970 });
  });

  it("only takes the film's own year: another year in the title stays", () => {
    expect(filmLabel("Blade Runner 2049", 2017)).toEqual({ title: "Blade Runner 2049", year: 2017 });
    expect(filmLabel("Street Scenes 1970", 1971)).toEqual({ title: "Street Scenes 1970", year: 1971 });
    expect(filmLabel("1970: A Year", 1970)).toEqual({ title: "1970: A Year", year: 1970 });
  });

  it("only takes the whole last number", () => {
    expect(filmLabel("Event 21970", 1970)).toEqual({ title: "Event 21970", year: 1970 });
    expect(filmLabel("Hits of the 1970s", 1970)).toEqual({ title: "Hits of the 1970s", year: 1970 });
  });

  it("keeps a title that is only the year, and says the year once", () => {
    expect(filmLabel("1984", 1984)).toEqual({ title: "1984", year: null });
    expect(filmLabel("(1984)", 1984)).toEqual({ title: "(1984)", year: null });
    // ... a film that happens to be named for another year is just a title.
    expect(filmLabel("1984", 1956)).toEqual({ title: "1984", year: 1956 });
    expect(filmLabel("2012", 2009)).toEqual({ title: "2012", year: 2009 });
  });

  it("takes only one year off", () => {
    expect(filmLabel("Remake 1970 1970", 1970)).toEqual({ title: "Remake 1970", year: 1970 });
  });
});
