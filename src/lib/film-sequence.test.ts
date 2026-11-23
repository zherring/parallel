import { describe, expect, it } from "vitest";
import { filmNeighbours } from "@/lib/film-sequence";

const film = (id: number, releaseDate: string, shared = false) => ({ id, releaseDate, shared });

describe("filmNeighbours", () => {
  const films = [film(3, "2001-05-01"), film(1, "1990-01-01", true), film(2, "1995-06-01"), film(4, "2010-01-01", true), film(5, "2020-01-01", true)];

  it("steps through every film in release order from a film that is one person's", () => {
    expect(filmNeighbours(films, 2)).toEqual({ prev: 1, next: 3 });
    expect(filmNeighbours(films, 3)).toEqual({ prev: 2, next: 4 });
  });

  it("steps through the films made together from one of them", () => {
    expect(filmNeighbours(films, 4)).toEqual({ prev: 1, next: 5 });
  });

  it("has nothing past either end", () => {
    expect(filmNeighbours(films, 1)).toEqual({ prev: null, next: 4 });
    expect(filmNeighbours(films, 5)).toEqual({ prev: 4, next: null });
    expect(filmNeighbours([film(1, "1990-01-01")], 1)).toEqual({ prev: null, next: null });
  });

  it("has nothing for a film that is not listed, or for none", () => {
    expect(filmNeighbours(films, 99)).toEqual({ prev: null, next: null });
    expect(filmNeighbours(films, null)).toEqual({ prev: null, next: null });
  });

  it("counts a film listed once per person once, shared if either listing says so", () => {
    const twice = [film(1, "1990-01-01"), film(2, "1995-01-01"), film(2, "1995-01-01", true), film(3, "2000-01-01", true), film(4, "1997-01-01")];
    expect(filmNeighbours(twice, 2)).toEqual({ prev: null, next: 3 });
    expect(filmNeighbours(twice, 4)).toEqual({ prev: 2, next: 3 });
  });

  it("orders films of one day by id, and an undated film first", () => {
    const same = [film(9, "2000-01-01"), film(7, "2000-01-01"), film(8, "")];
    expect(filmNeighbours(same, 7)).toEqual({ prev: 8, next: 9 });
  });
});
