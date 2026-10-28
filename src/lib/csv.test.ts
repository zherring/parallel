import { describe, expect, it } from "vitest";
import { CSV_HEADER, csvFilename, filmsToCsv, type CsvFilm } from "@/lib/csv";
import type { AwardsSummary } from "@/lib/awards";
import type { FilmMetrics } from "@/lib/types";

const TODAY = "2026-10-28";

const film = (id: number, title: string, year: number, extra: Partial<CsvFilm> = {}): CsvFilm => ({
  id,
  title,
  year,
  ...extra,
});

const metrics = (overrides: Partial<FilmMetrics> = {}): FilmMetrics => ({
  voteAverage: 8.438,
  voteCount: 33_147,
  budget: 63_000_000,
  revenue: 100_853_753,
  releaseDate: "1999-10-15",
  awards: null,
  ...overrides,
});

/** A small RFC 4180 reader: quoted cells may hold commas, doubled quotes and line breaks. */
function parse(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (quoted) {
      if (ch === '"' && csv[i + 1] === '"') {
        value += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else value += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(value);
      value = "";
    } else if (ch === "\r" && csv[i + 1] === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
      i++;
    } else value += ch;
  }
  return rows;
}

const column = (name: (typeof CSV_HEADER)[number]) => CSV_HEADER.indexOf(name);

describe("filmsToCsv shape", () => {
  it("writes just the header for no films", () => {
    expect(filmsToCsv([])).toBe(`${CSV_HEADER.join(",")}\r\n`);
  });

  it("is a plain CSV of the table's columns, with the film's own TMDB id and link last", () => {
    expect(CSV_HEADER).toEqual([
      "Title",
      "Year",
      "Release date",
      "Credits",
      "Rating (TMDB 0-10)",
      "Votes (TMDB)",
      "Box office (USD worldwide)",
      "Budget (USD)",
      "Gross multiple",
      "Oscar wins",
      "Oscar nominations",
      "Festival prizes",
      "TMDB ID",
      "TMDB URL",
    ]);
  });

  it("needs only an id, a title and a year; the other cells are empty", () => {
    const [header, row] = parse(filmsToCsv([film(5, "Blade Runner", 1982)]));
    expect(header).toEqual([...CSV_HEADER]);
    expect(row).toEqual(["Blade Runner", "1982", "", "", "", "", "", "", "", "", "", "", "5", "https://www.themoviedb.org/movie/5"]);
  });

  it("writes one CRLF-terminated row per film, in the order given (the order of the table)", () => {
    const csv = filmsToCsv([film(2, "Later", 2005), film(1, "Earlier", 1995), film(3, "Middle", 2000)]);
    expect(csv.endsWith("\r\n")).toBe(true);
    expect(parse(csv).slice(1).map((row) => row[0])).toEqual(["Later", "Earlier", "Middle"]);
  });

  it("quotes titles with commas, quotes and newlines", () => {
    const csv = filmsToCsv([film(1, "Hello, World", 2000), film(2, 'The "Best" Film', 2001), film(3, "Line one\nLine two", 2002)]);
    expect(csv).toContain('"Hello, World",2000');
    expect(csv).toContain('"The ""Best"" Film",2001');
    expect(csv).toContain('"Line one\nLine two",2002');
  });
});

describe("credits and release date", () => {
  it("writes the release date and one person's roles as they are", () => {
    const row = parse(
      filmsToCsv([
        film(1, "Star Wars", 1977, {
          releaseDate: "1977-05-25",
          credits: [{ personId: 3, name: null, roles: "Actor" }],
        }),
      ]),
    )[1];
    expect(row[column("Release date")]).toBe("1977-05-25");
    expect(row[column("Credits")]).toBe("Actor");
  });

  it("names each person when several made the film, separated by semicolons", () => {
    const csv = filmsToCsv([
      film(1, "Star Wars", 1977, {
        credits: [
          { personId: 3, name: "Harrison Ford", roles: "Actor" },
          { personId: 1, name: "George Lucas", roles: "Director, Writer" },
        ],
      }),
    ]);
    expect(csv).toContain('"Harrison Ford: Actor; George Lucas: Director, Writer"');
  });
});

describe("metrics", () => {
  const withMetrics = (f: CsvFilm, m: FilmMetrics | null, today = TODAY) =>
    parse(filmsToCsv([f], { metrics: new Map([[f.id, m]]), today }))[1];

  it("writes rating, votes, box office, budget and the gross multiple as plain numbers", () => {
    const row = withMetrics(film(550, "Fight Club", 1999), metrics());
    expect(row[column("Rating (TMDB 0-10)")]).toBe("8.4");
    expect(row[column("Votes (TMDB)")]).toBe("33147");
    expect(row[column("Box office (USD worldwide)")]).toBe("100853753");
    expect(row[column("Budget (USD)")]).toBe("63000000");
    expect(row[column("Gross multiple")]).toBe("1.6");
  });

  it("leaves the metric cells empty for a film without metrics", () => {
    const row = withMetrics(film(1, "Unknown", 2000), null);
    expect(row.slice(column("Rating (TMDB 0-10)"), column("Festival prizes") + 1).every((c) => c === "")).toBe(true);
    const missing = parse(filmsToCsv([film(1, "Unknown", 2000)], { metrics: new Map(), today: TODAY }))[1];
    expect(missing[column("Votes (TMDB)")]).toBe("");
  });

  it("hides a rating with fewer than 10 votes, as the table does", () => {
    const row = withMetrics(film(1, "Obscure", 2017), metrics({ voteAverage: 9.5, voteCount: 2 }));
    expect(row[column("Rating (TMDB 0-10)")]).toBe("");
    expect(row[column("Votes (TMDB)")]).toBe("");
  });

  it("hides the box office of a tiny or streaming release and of an announced film", () => {
    const streaming = withMetrics(film(1, "Mank", 2020), metrics({ revenue: 122_000, budget: 25_000_000 }));
    expect(streaming[column("Box office (USD worldwide)")]).toBe("");
    expect(streaming[column("Gross multiple")]).toBe("");

    const announced = withMetrics(film(2, "Next Indy", 2027), metrics({ releaseDate: "2027-06-01" }));
    expect(announced[column("Box office (USD worldwide)")]).toBe("");
  });

  it("writes no multiple for a film before 1970 or without a believable budget", () => {
    const old = withMetrics(film(289, "Casablanca", 1943), metrics({ releaseDate: "1943-01-23", revenue: 10_460_000, budget: 878_000 }));
    expect(old[column("Box office (USD worldwide)")]).toBe("10460000");
    expect(old[column("Gross multiple")]).toBe("");

    const noBudget = withMetrics(film(3, "Slacker", 1990), metrics({ releaseDate: "1990-07-05", budget: null, revenue: 1_200_000 }));
    expect(noBudget[column("Gross multiple")]).toBe("");
    expect(noBudget[column("Budget (USD)")]).toBe("");
  });

  it("writes awards: Oscar wins, nominations including the wins, and festival prizes", () => {
    const awards: AwardsSummary = {
      oscarWins: 4,
      oscarNominations: 6,
      festivalPrizes: [{ festival: "Cannes", prize: "Palme d'Or" }],
    };
    const row = withMetrics(film(496243, "Parasite", 2019), metrics({ releaseDate: "2019-05-30", awards }));
    expect(row[column("Oscar wins")]).toBe("4");
    expect(row[column("Oscar nominations")]).toBe("6");
    expect(row[column("Festival prizes")]).toBe("Palme d'Or, Cannes");
  });

  it("writes only nominations for a film that won nothing, and nothing for a festival-only film's Oscars", () => {
    const nominated: AwardsSummary = { oscarWins: 0, oscarNominations: 1, festivalPrizes: [] };
    const a = withMetrics(film(550, "Fight Club", 1999), metrics({ awards: nominated }));
    expect(a[column("Oscar wins")]).toBe("");
    expect(a[column("Oscar nominations")]).toBe("1");

    const festivalOnly: AwardsSummary = {
      oscarWins: 0,
      oscarNominations: 0,
      festivalPrizes: [{ festival: "Berlin", prize: "Golden Bear" }],
    };
    const b = withMetrics(film(9, "Red Sorghum", 1987), metrics({ awards: festivalOnly }));
    expect(b[column("Oscar wins")]).toBe("");
    expect(b[column("Oscar nominations")]).toBe("");
    expect(b[column("Festival prizes")]).toBe("Golden Bear, Berlin");
  });
});

describe("csvFilename", () => {
  it("joins slugified names", () => {
    expect(csvFilename(["David Fincher", "Jeff Cronenweth"])).toBe("david-fincher-jeff-cronenweth-shared-films.csv");
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
