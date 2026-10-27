import { describe, expect, it } from "vitest";
import {
  FEW_VOTES_BELOW,
  MIN_REVENUE,
  MIN_VOTES,
  awardsDisplay,
  compactCount,
  filmMetricsDisplay,
  formatMoney,
  formatMultiple,
  isoDate,
  ratingDisplay,
  revenueDisplay,
} from "@/lib/film-metrics";
import type { FilmMetrics } from "@/lib/types";

const TODAY = "2026-10-27";

describe("compactCount", () => {
  it.each([
    [0, "0"],
    [7, "7"],
    [10, "10"],
    [842, "842"],
    [999, "999"],
    [1000, "1k"],
    [1234, "1.2k"],
    [1250, "1.3k"],
    [9949, "9.9k"],
    [9950, "10k"],
    [10_000, "10k"],
    [24_600, "25k"],
    [25_000, "25k"],
    [33_145, "33k"],
    [999_499, "999k"],
    [999_500, "1M"],
    [999_999, "1M"],
    [1_000_000, "1M"],
    [1_234_567, "1.2M"],
    [12_345_678, "12M"],
    [2_500_000_000, "2.5B"],
  ])("%d -> %s", (value, expected) => {
    expect(compactCount(value)).toBe(expected);
  });

  it("rounds fractions and clamps negatives", () => {
    expect(compactCount(41.6)).toBe("42");
    expect(compactCount(-5)).toBe("0");
  });
});

describe("formatMoney", () => {
  it.each([
    [0, "$0"],
    [950, "$950"],
    [1000, "$1K"],
    [122_000, "$122K"],
    [850_000, "$850K"],
    [969_300, "$969K"],
    [999_499, "$999K"],
    [999_500, "$1M"],
    [1_000_000, "$1M"],
    [1_200_000, "$1.2M"],
    [5_049_999, "$5M"],
    [9_960_000, "$10M"],
    [10_500_000, "$11M"],
    [11_363_000, "$11M"],
    [100_853_753, "$101M"],
    [257_584_172, "$258M"],
    [999_400_000, "$999M"],
    [999_600_000, "$1B"],
    [1_000_000_000, "$1B"],
    [1_058_000_000, "$1.1B"],
    [1_200_000_000, "$1.2B"],
    [2_923_706_026, "$2.9B"],
    [12_000_000_000, "$12B"],
  ])("%d -> %s", (value, expected) => {
    expect(formatMoney(value)).toBe(expected);
  });

  it("never depends on the runtime's locale", () => {
    // No separators, no currency or decimal symbol of any locale: only $, digits, ".", K/M/B.
    for (const value of [850_000, 1_234_567, 3_000_000_000]) expect(formatMoney(value)).toMatch(/^\$\d+(\.\d)?[KMB]$/);
  });
});

describe("formatMultiple", () => {
  it.each([
    [0.38, "0.4×"],
    [0.5, "0.5×"],
    [1, "1.0×"],
    [1.6, "1.6×"],
    [1.6008, "1.6×"],
    [22.67, "22.7×"],
    [99.94, "99.9×"],
    [99.96, "100×"],
    [286.4, "286×"],
    [1234.5, "1,235×"],
    [30_000, "30,000×"],
  ])("%d -> %s", (value, expected) => {
    expect(formatMultiple(value)).toBe(expected);
  });

  it("uses a real multiplication sign", () => {
    expect(formatMultiple(2)).toContain("×");
    expect(formatMultiple(2)).not.toContain("x");
  });
});

describe("isoDate", () => {
  it("is the UTC calendar day", () => {
    expect(isoDate(new Date("2026-10-27T23:59:59Z"))).toBe("2026-10-27");
    expect(isoDate(new Date("2026-01-05T00:00:00Z"))).toBe("2026-01-05");
  });
});

describe("ratingDisplay: hiding", () => {
  it("hides without a score", () => {
    expect(ratingDisplay(null, 5000)).toBeNull();
    expect(ratingDisplay(undefined, 5000)).toBeNull();
    expect(ratingDisplay(0, 5000)).toBeNull();
    expect(ratingDisplay(Number.NaN, 5000)).toBeNull();
  });

  it("hides under the vote floor, even for a perfect score", () => {
    expect(MIN_VOTES).toBe(10);
    expect(ratingDisplay(9.5, 2)).toBeNull();
    expect(ratingDisplay(10, 9)).toBeNull();
    expect(ratingDisplay(7, 0)).toBeNull();
    expect(ratingDisplay(7, null)).toBeNull();
    expect(ratingDisplay(7, Number.NaN)).toBeNull();
  });

  it("shows from the floor up", () => {
    expect(ratingDisplay(7, 10)).not.toBeNull();
  });
});

describe("ratingDisplay: few ratings", () => {
  it("flags 10 to 99 votes and words the row \"few ratings\" (the count stays in `votes`)", () => {
    expect(FEW_VOTES_BELOW).toBe(100);
    const low = ratingDisplay(9.1, 42);
    expect(low?.fewRatings).toBe(true);
    expect(low?.text).toBe("9.1 · few ratings · TMDB");
    expect(low).toMatchObject({ votes: "42", votesLabel: "few ratings" });
    expect(ratingDisplay(7, 10)?.fewRatings).toBe(true);
    expect(ratingDisplay(7, 99)?.fewRatings).toBe(true);
  });

  it("does not flag 100 votes or more", () => {
    expect(ratingDisplay(7, 100)?.fewRatings).toBe(false);
    expect(ratingDisplay(7, 100)?.text).toBe("7.0 · 100 votes · TMDB");
    expect(ratingDisplay(8.4, 33_145)?.fewRatings).toBe(false);
  });
});

describe("ratingDisplay: stars", () => {
  const stars = (score: number) => ratingDisplay(score, 1000)!.stars;

  it("rounds the 0-10 score to the nearest half star", () => {
    expect(stars(7.8)).toEqual({ full: 4, half: 0, empty: 1 }); // 3.9 -> 4
    expect(stars(7.2)).toEqual({ full: 3, half: 1, empty: 1 }); // 3.6 -> 3.5
    expect(stars(8.4)).toEqual({ full: 4, half: 0, empty: 1 }); // 4.2 -> 4
    expect(stars(8.6)).toEqual({ full: 4, half: 1, empty: 0 }); // 4.3 -> 4.5
    expect(stars(10)).toEqual({ full: 5, half: 0, empty: 0 });
    expect(stars(6.7)).toEqual({ full: 3, half: 1, empty: 1 }); // 3.35 -> 3.5
    expect(stars(5)).toEqual({ full: 2, half: 1, empty: 2 }); // 2.5
  });

  it("rounds exact quarter-star ties up", () => {
    expect(stars(7.5)).toEqual({ full: 4, half: 0, empty: 1 }); // 3.75 -> 4
    expect(stars(7.25)).toEqual({ full: 3, half: 1, empty: 1 }); // 3.625 -> 3.5
  });

  it("handles the low end", () => {
    expect(stars(0.4)).toEqual({ full: 0, half: 0, empty: 5 });
    expect(stars(1)).toEqual({ full: 0, half: 1, empty: 4 });
    expect(stars(2)).toEqual({ full: 1, half: 0, empty: 4 });
  });

  it("always adds up to five stars and caps a score above 10", () => {
    for (let score = 0.1; score <= 10; score += 0.1) {
      const { full, half, empty } = stars(score);
      expect(full + half + empty).toBe(5);
      expect(half).toBeLessThanOrEqual(1);
      expect(empty).toBeGreaterThanOrEqual(0);
    }
    expect(stars(12)).toEqual({ full: 5, half: 0, empty: 0 });
  });
});

describe("ratingDisplay: text", () => {
  it("shows one decimal for the score and a compact vote count", () => {
    const rating = ratingDisplay(7.8, 25_000)!;
    expect(rating).toMatchObject({ score: "7.8", votes: "25k", votesLabel: "25k votes", source: "TMDB" });
    expect(rating.text).toBe("7.8 · 25k votes · TMDB");
  });

  it("keeps the trailing zero and rounds long scores", () => {
    expect(ratingDisplay(8, 1000)?.score).toBe("8.0");
    expect(ratingDisplay(8.433, 33_145)?.score).toBe("8.4");
    expect(ratingDisplay(8.35, 33_145)?.score).toBe("8.4");
    expect(ratingDisplay(7.04, 2000)?.score).toBe("7.0");
  });

  it("compacts millions of votes", () => {
    expect(ratingDisplay(8.8, 1_200_000)?.text).toBe("8.8 · 1.2M votes · TMDB");
  });
});

describe("revenueDisplay: when it shows", () => {
  it("shows a mainstream film with its gross multiple (Fight Club)", () => {
    const row = revenueDisplay({ revenue: 100_853_753, budget: 63_000_000, releaseDate: "1999-10-15" }, TODAY);
    expect(row).toEqual({
      amount: "$101M",
      label: "worldwide",
      multiple: "1.6×",
      text: "$101M worldwide · 1.6× budget",
    });
  });

  it("shows a big multiple with one decimal (Parasite)", () => {
    const row = revenueDisplay({ revenue: 257_584_172, budget: 11_363_000, releaseDate: "2019-05-30" }, TODAY);
    expect(row?.text).toBe("$258M worldwide · 22.7× budget");
  });

  it("shows billions", () => {
    const row = revenueDisplay({ revenue: 2_923_706_026, budget: 237_000_000, releaseDate: "2009-12-15" }, TODAY);
    expect(row?.text).toBe("$2.9B worldwide · 12.3× budget");
    expect(revenueDisplay({ revenue: 1_058_000_000, budget: null, releaseDate: "1993-06-11" }, TODAY)?.text).toBe(
      "$1.1B worldwide",
    );
  });

  it("shows the gross alone when there is no budget", () => {
    for (const budget of [null, 0]) {
      const row = revenueDisplay({ revenue: 50_000_000, budget, releaseDate: "2001-01-01" }, TODAY);
      expect(row?.multiple).toBeNull();
      expect(row?.text).toBe("$50M worldwide");
    }
  });

  it("shows a genuine flop with its multiple (38% of the budget)", () => {
    const row = revenueDisplay({ revenue: 38_000_000, budget: 100_000_000, releaseDate: "2012-03-09" }, TODAY);
    expect(row?.text).toBe("$38M worldwide · 0.4× budget");
  });
});

describe("revenueDisplay: when it hides", () => {
  it("hides without revenue", () => {
    expect(revenueDisplay({ revenue: null, budget: 63_000_000, releaseDate: "1999-10-15" }, TODAY)).toBeNull();
    expect(revenueDisplay({ revenue: 0, budget: 63_000_000, releaseDate: "1999-10-15" }, TODAY)).toBeNull();
    expect(revenueDisplay({ revenue: Number.NaN, budget: null, releaseDate: null }, TODAY)).toBeNull();
  });

  it("hides streaming films with a token theatrical run (Mank, The Irishman)", () => {
    expect(revenueDisplay({ revenue: 122_000, budget: 25_000_000, releaseDate: "2020-11-13" }, TODAY)).toBeNull();
    expect(revenueDisplay({ revenue: 969_000, budget: 159_000_000, releaseDate: "2019-11-01" }, TODAY)).toBeNull();
  });

  it("draws the line at one million dollars", () => {
    expect(MIN_REVENUE).toBe(1_000_000);
    expect(revenueDisplay({ revenue: 999_999, budget: null, releaseDate: "2010-01-01" }, TODAY)).toBeNull();
    expect(revenueDisplay({ revenue: 1_000_000, budget: null, releaseDate: "2010-01-01" }, TODAY)?.text).toBe(
      "$1M worldwide",
    );
  });

  it("hides an unreleased film even if TMDB carries a number", () => {
    const base = { revenue: 5_000_000, budget: 125_000_000 };
    expect(revenueDisplay({ ...base, releaseDate: "2027-06-04" }, TODAY)).toBeNull();
    expect(revenueDisplay({ ...base, releaseDate: "2026-10-28" }, TODAY)).toBeNull();
    expect(revenueDisplay({ ...base, releaseDate: "2026-10-27" }, TODAY)).not.toBeNull();
    expect(revenueDisplay({ ...base, releaseDate: "2026-10-26" }, TODAY)).not.toBeNull();
  });

  it("takes today as a Date too, compared in UTC", () => {
    const base = { revenue: 5_000_000, budget: null, releaseDate: "2026-10-28" };
    expect(revenueDisplay(base, new Date("2026-10-27T23:59:59Z"))).toBeNull();
    expect(revenueDisplay(base, new Date("2026-10-28T00:00:00Z"))).not.toBeNull();
    expect(revenueDisplay(base, new Date(Number.NaN))).not.toBeNull();
  });
});

describe("revenueDisplay: when the multiple is left out", () => {
  const film = (budget: number | null, revenue = 50_000_000, releaseDate: string | null = "2005-05-05") =>
    revenueDisplay({ revenue, budget, releaseDate }, TODAY);

  it("needs a budget of at least $100K", () => {
    expect(film(99_999)?.multiple).toBeNull();
    expect(film(15_000)?.multiple).toBeNull(); // a $15K horror breakout is not "3,333x"
    expect(film(100_000)?.multiple).toBe("500×");
    expect(film(99_999)?.text).toBe("$50M worldwide");
  });

  it("needs a revenue of at least 5% of the budget", () => {
    expect(film(1_000_000_000, 49_999_999)?.multiple).toBeNull(); // 4.99%
    expect(film(1_000_000_000, 50_000_000)?.multiple).toBe("0.1×"); // exactly 5%
    expect(film(2_000_000_000, 50_000_000)?.text).toBe("$50M worldwide");
  });

  it("needs a film from 1970 on (older figures are first-run guesses in other dollars)", () => {
    expect(film(878_000, 10_500_000, "1943-01-23")?.text).toBe("$11M worldwide"); // Casablanca
    expect(film(806_947, 50_000_000, "1960-09-08")?.multiple).toBeNull(); // Psycho
    expect(film(6_000_000, 245_066_411, "1972-03-14")?.multiple).toBe("40.8×"); // The Godfather
    expect(film(7_000_000, 20_000_000, "1969-12-31")?.multiple).toBeNull();
    expect(film(7_000_000, 20_000_000, "1970-01-01")?.multiple).toBe("2.9×");
  });

  it("needs a known release date", () => {
    expect(film(10_000_000, 50_000_000, null)).toMatchObject({ multiple: null, text: "$50M worldwide" });
    expect(film(10_000_000, 50_000_000, "garbage")).toMatchObject({ multiple: null, text: "$50M worldwide" });
  });

  it("never calls it profit", () => {
    const text = film(10_000_000)!.text;
    expect(text).not.toMatch(/profit|net|roi/i);
    expect(text).toBe("$50M worldwide · 5.0× budget");
  });
});

describe("awardsDisplay: hiding", () => {
  it("hides without data", () => {
    expect(awardsDisplay(null)).toBeNull();
    expect(awardsDisplay(undefined)).toBeNull();
  });

  it("hides when there are no wins, no nominations and no festival prizes", () => {
    expect(awardsDisplay({ oscarWins: 0, oscarNominations: 0, festivalPrizes: [] })).toBeNull();
    expect(awardsDisplay({ oscarWins: -1, oscarNominations: Number.NaN, festivalPrizes: [] })).toBeNull();
    expect(
      awardsDisplay({ oscarWins: 0, oscarNominations: 0, festivalPrizes: [{ festival: " ", prize: "" }] }),
    ).toBeNull();
  });
});

describe("awardsDisplay: Oscars", () => {
  const oscars = (oscarWins: number, oscarNominations: number) =>
    awardsDisplay({ oscarWins, oscarNominations, festivalPrizes: [] })?.text;

  it("leads with the wins and then the nominations", () => {
    expect(oscars(4, 6)).toBe("4 Oscars · 6 nominations");
    expect(oscars(1, 3)).toBe("1 Oscar · 3 nominations");
    expect(oscars(2, 3)).toBe("2 Oscars · 3 nominations");
    expect(oscars(11, 14)).toBe("11 Oscars · 14 nominations");
  });

  it("says nominated for when nothing was won", () => {
    expect(oscars(0, 2)).toBe("Nominated for 2 Oscars");
    expect(oscars(0, 1)).toBe("Nominated for 1 Oscar");
  });

  it("leaves the nominations out when every one of them won (the count includes the wins)", () => {
    expect(oscars(1, 1)).toBe("1 Oscar");
    expect(oscars(3, 3)).toBe("3 Oscars");
    expect(oscars(3, 2)).toBe("3 Oscars"); // inconsistent data: wins win
  });

  it("uses the singular for one nomination", () => {
    expect(oscars(0, 1)).toBe("Nominated for 1 Oscar");
    expect(awardsDisplay({ oscarWins: 0, oscarNominations: 1, festivalPrizes: [] })?.parts).toEqual([
      "Nominated for 1 Oscar",
    ]);
  });

  it("returns the parts a row can wrap between", () => {
    expect(awardsDisplay({ oscarWins: 4, oscarNominations: 6, festivalPrizes: [] })?.parts).toEqual([
      "4 Oscars",
      "6 nominations",
    ]);
  });
});

describe("awardsDisplay: festival prizes", () => {
  const prize = (festival: string, name: string) => ({ festival, prize: name });
  const none = { oscarWins: 0, oscarNominations: 0 };

  it("shows a festival prize on its own", () => {
    expect(awardsDisplay({ ...none, festivalPrizes: [prize("Cannes", "Palme d'Or")] })?.text).toBe(
      "Palme d'Or, Cannes",
    );
  });

  it("puts Oscars first, then the prizes", () => {
    const row = awardsDisplay({
      oscarWins: 4,
      oscarNominations: 6,
      festivalPrizes: [prize("Cannes", "Palme d'Or")],
    });
    expect(row?.text).toBe("4 Oscars · 6 nominations · Palme d'Or, Cannes");
    expect(row?.parts).toEqual(["4 Oscars", "6 nominations", "Palme d'Or, Cannes"]);
  });

  it("shows nominations followed by a prize", () => {
    expect(
      awardsDisplay({ oscarWins: 0, oscarNominations: 2, festivalPrizes: [prize("Venice", "Golden Lion")] })?.text,
    ).toBe("Nominated for 2 Oscars · Golden Lion, Venice");
  });

  it("shows at most two prizes and counts the rest", () => {
    const row = awardsDisplay({
      ...none,
      festivalPrizes: [
        prize("Cannes", "Palme d'Or"),
        prize("Venice", "Golden Lion"),
        prize("Berlin", "Golden Bear"),
        prize("Berlin", "Silver Bear"),
      ],
    });
    expect(row?.text).toBe("Palme d'Or, Cannes · Golden Lion, Venice · +2 more");
  });

  it("drops duplicates and blanks", () => {
    const row = awardsDisplay({
      ...none,
      festivalPrizes: [prize("Cannes", "Palme d'Or"), prize("Cannes", "Palme d'Or"), prize("", "Golden Bear")],
    });
    expect(row?.parts).toEqual(["Palme d'Or, Cannes", "Golden Bear"]);
  });
});

describe("filmMetricsDisplay", () => {
  const fightClub: FilmMetrics = {
    voteAverage: 8.4,
    voteCount: 33_145,
    budget: 63_000_000,
    revenue: 100_853_753,
    releaseDate: "1999-10-15",
    awards: { oscarWins: 0, oscarNominations: 1, festivalPrizes: [] },
  };

  it("builds all three rows in the card's order", () => {
    const display = filmMetricsDisplay(fightClub, TODAY);
    expect(display.revenue?.text).toBe("$101M worldwide · 1.6× budget");
    expect(display.rating?.text).toBe("8.4 · 33k votes · TMDB");
    expect(display.awards?.text).toBe("Nominated for 1 Oscar");
    expect(Object.keys(display)).toEqual(["revenue", "rating", "awards"]);
  });

  it("leaves a row out when it has nothing to show", () => {
    const thin: FilmMetrics = {
      voteAverage: 9.5,
      voteCount: 2,
      budget: null,
      revenue: 122_000,
      releaseDate: "2020-11-13",
      awards: null,
    };
    expect(filmMetricsDisplay(thin, TODAY)).toEqual({ revenue: null, rating: null, awards: null });
  });

  it("renders an unreleased film's card empty", () => {
    const unreleased: FilmMetrics = {
      voteAverage: null,
      voteCount: 0,
      budget: 200_000_000,
      revenue: null,
      releaseDate: "2027-07-16",
      awards: null,
    };
    expect(filmMetricsDisplay(unreleased, TODAY)).toEqual({ revenue: null, rating: null, awards: null });
  });
});
