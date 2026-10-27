import { describe, expect, it } from "vitest";
import { csvFilename, sharedFilmsToCsv } from "@/lib/csv";
import type { SharedFilm } from "@/lib/types";

const shared = (id: number, title: string, year: number): SharedFilm => ({
  id,
  title,
  year,
  releaseDate: `${year}-01-01`,
  posterPath: null,
  byPerson: {},
});

describe("sharedFilmsToCsv", () => {
  it("writes just the header for no films", () => {
    expect(sharedFilmsToCsv([])).toBe("tmdbID,Title,Year\r\n");
  });

  it("writes one CRLF-terminated row per film", () => {
    expect(sharedFilmsToCsv([shared(550, "Fight Club", 1999), shared(807, "Se7en", 1995)])).toBe(
      "tmdbID,Title,Year\r\n550,Fight Club,1999\r\n807,Se7en,1995\r\n",
    );
  });

  it("quotes titles with commas and doubles embedded quotes", () => {
    expect(sharedFilmsToCsv([shared(1, "Hello, World", 2000), shared(2, 'The "Best" Film', 2001)])).toBe(
      'tmdbID,Title,Year\r\n1,"Hello, World",2000\r\n2,"The ""Best"" Film",2001\r\n',
    );
  });

  it("quotes titles containing newlines", () => {
    expect(sharedFilmsToCsv([shared(3, "Line one\nLine two", 2002)])).toBe(
      'tmdbID,Title,Year\r\n3,"Line one\nLine two",2002\r\n',
    );
  });
});

describe("csvFilename", () => {
  it("joins slugified names", () => {
    expect(csvFilename(["David Fincher", "Jeff Cronenweth"])).toBe(
      "david-fincher-jeff-cronenweth-shared-films.csv",
    );
  });

  it("falls back when no names slugify", () => {
    expect(csvFilename([])).toBe("shared-films.csv");
    expect(csvFilename(["宮崎駿"])).toBe("shared-films.csv");
  });
});
