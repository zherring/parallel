import { describe, expect, it } from "vitest";
import { csvFilename, filmsToCsv } from "@/lib/csv";
import type { SharedFilm } from "@/lib/types";

const shared = (id: number, title: string, year: number): SharedFilm => ({
  id,
  title,
  year,
  releaseDate: `${year}-01-01`,
  posterPath: null,
  byPerson: {},
});

describe("filmsToCsv input", () => {
  it("needs only an id, a title and a year", () => {
    expect(filmsToCsv([{ id: 5, title: "Blade Runner", year: 1982 }])).toBe("tmdbID,Title,Year\r\n5,Blade Runner,1982\r\n");
  });
});

describe("filmsToCsv", () => {
  it("writes just the header for no films", () => {
    expect(filmsToCsv([])).toBe("tmdbID,Title,Year\r\n");
  });

  it("writes one CRLF-terminated row per film", () => {
    expect(filmsToCsv([shared(550, "Fight Club", 1999), shared(807, "Se7en", 1995)])).toBe(
      "tmdbID,Title,Year\r\n550,Fight Club,1999\r\n807,Se7en,1995\r\n",
    );
  });

  it("keeps the order it is given (the order of the table), not release order", () => {
    expect(filmsToCsv([shared(2, "Later", 2005), shared(1, "Earlier", 1995), shared(3, "Middle", 2000)])).toBe(
      "tmdbID,Title,Year\r\n2,Later,2005\r\n1,Earlier,1995\r\n3,Middle,2000\r\n",
    );
  });

  it("quotes titles with commas and doubles embedded quotes", () => {
    expect(filmsToCsv([shared(1, "Hello, World", 2000), shared(2, 'The "Best" Film', 2001)])).toBe(
      'tmdbID,Title,Year\r\n1,"Hello, World",2000\r\n2,"The ""Best"" Film",2001\r\n',
    );
  });

  it("quotes titles containing newlines", () => {
    expect(filmsToCsv([shared(3, "Line one\nLine two", 2002)])).toBe(
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

  it("names one person's list after them", () => {
    expect(csvFilename(["Harrison Ford"])).toBe("harrison-ford-films.csv");
    expect(csvFilename(["Zoë Kravitz"])).toBe("zoe-kravitz-films.csv");
  });

  it("falls back when no names slugify", () => {
    expect(csvFilename([])).toBe("shared-films.csv");
    expect(csvFilename(["宮崎駿", "黒澤明"])).toBe("shared-films.csv");
    expect(csvFilename(["宮崎駿"])).toBe("films.csv");
  });
});
