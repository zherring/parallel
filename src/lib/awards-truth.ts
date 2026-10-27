import type { FestivalPrize } from "@/lib/awards";

/**
 * Films whose awards are known, used to check the Wikidata pipeline: `npm run awards:refresh --
 * --validate` compares the live endpoint with them (the regression test for any change of query
 * or endpoint), and awards.generated.test.ts compares the committed file with them, so a bad
 * regeneration fails `npm test` without the network.
 *
 * Oscar figures are the Academy's official tallies of competitive categories (wins, nominations;
 * a win is also a nomination), as listed on Wikipedia's "List of Academy Award-winning films" and
 * the films' own pages; Fight Club, Psycho and Vertigo never won. Counting rules the figures rely
 * on: each acting nominee is a nomination of its own (The Godfather has three Supporting Actor
 * nominees), each nominated song is one, withdrawn nominations are not counted, and honorary and
 * Special Achievement awards are not competitive (Star Wars: 6 wins, plus a Special Achievement).
 */
export interface OscarTruth {
  tmdbId: number;
  title: string;
  /** TMDB release year (what the pipeline ties a film's songs to). */
  year: number;
  wins: number;
  nominations: number;
}

/** The 26 films of the feasibility spike's validation set. */
export const OSCAR_TRUTH: readonly OscarTruth[] = [
  { tmdbId: 496243, title: "Parasite", year: 2019, wins: 4, nominations: 6 },
  { tmdbId: 550, title: "Fight Club", year: 1999, wins: 0, nominations: 1 },
  { tmdbId: 614560, title: "Mank", year: 2020, wins: 2, nominations: 10 },
  { tmdbId: 289, title: "Casablanca", year: 1942, wins: 3, nominations: 8 },
  { tmdbId: 597, title: "Titanic", year: 1997, wins: 11, nominations: 14 },
  { tmdbId: 872585, title: "Oppenheimer", year: 2023, wins: 7, nominations: 13 },
  { tmdbId: 424, title: "Schindler's List", year: 1993, wins: 7, nominations: 12 },
  { tmdbId: 680, title: "Pulp Fiction", year: 1994, wins: 1, nominations: 7 },
  { tmdbId: 1578, title: "Raging Bull", year: 1980, wins: 2, nominations: 8 },
  { tmdbId: 284, title: "The Apartment", year: 1960, wins: 5, nominations: 10 },
  { tmdbId: 239, title: "Some Like It Hot", year: 1959, wins: 1, nominations: 6 },
  { tmdbId: 129, title: "Spirited Away", year: 2001, wins: 1, nominations: 1 },
  { tmdbId: 578, title: "Jaws", year: 1975, wins: 3, nominations: 4 },
  { tmdbId: 539, title: "Psycho", year: 1960, wins: 0, nominations: 4 },
  { tmdbId: 426, title: "Vertigo", year: 1958, wins: 0, nominations: 2 },
  { tmdbId: 769, title: "GoodFellas", year: 1990, wins: 1, nominations: 6 },
  { tmdbId: 329, title: "Jurassic Park", year: 1993, wins: 3, nominations: 3 },
  { tmdbId: 679, title: "Aliens", year: 1986, wins: 2, nominations: 7 },
  { tmdbId: 857, title: "Saving Private Ryan", year: 1998, wins: 5, nominations: 11 },
  { tmdbId: 419430, title: "Get Out", year: 2017, wins: 1, nominations: 4 },
  { tmdbId: 399055, title: "The Shape of Water", year: 2017, wins: 4, nominations: 13 },
  { tmdbId: 1417, title: "Pan's Labyrinth", year: 2006, wins: 3, nominations: 6 },
  { tmdbId: 10193, title: "Toy Story 3", year: 2010, wins: 2, nominations: 5 },
  { tmdbId: 947, title: "Lawrence of Arabia", year: 1962, wins: 7, nominations: 10 },
  { tmdbId: 238, title: "The Godfather", year: 1972, wins: 3, nominations: 10 },
  { tmdbId: 240, title: "The Godfather Part II", year: 1974, wins: 6, nominations: 11 },
];

/**
 * Further films, added for the cases the 26 do not reach: Best Original Song (which Wikidata
 * attaches to the song, not the film), several songs in one film, and Special Achievement awards.
 */
export const OSCAR_TRUTH_EXTRA: readonly OscarTruth[] = [
  { tmdbId: 812, title: "Aladdin", year: 1992, wins: 2, nominations: 5 },
  { tmdbId: 313369, title: "La La Land", year: 2016, wins: 6, nominations: 14 },
  { tmdbId: 301528, title: "Toy Story 4", year: 2019, wins: 1, nominations: 2 },
  { tmdbId: 863, title: "Toy Story 2", year: 1999, wins: 0, nominations: 1 },
  { tmdbId: 13370, title: "A Mighty Wind", year: 2003, wins: 0, nominations: 1 },
  { tmdbId: 242, title: "The Godfather Part III", year: 1990, wins: 0, nominations: 7 },
  { tmdbId: 574, title: "The Man Who Knew Too Much", year: 1956, wins: 1, nominations: 1 },
  { tmdbId: 3131, title: "Gangs of New York", year: 2002, wins: 0, nominations: 10 },
  { tmdbId: 10144, title: "The Little Mermaid", year: 1989, wins: 2, nominations: 3 },
  { tmdbId: 920, title: "Cars", year: 2006, wins: 0, nominations: 2 },
  { tmdbId: 5255, title: "The Polar Express", year: 2004, wins: 0, nominations: 3 },
  { tmdbId: 11, title: "Star Wars", year: 1977, wins: 6, nominations: 10 },
  { tmdbId: 85, title: "Raiders of the Lost Ark", year: 1981, wins: 4, nominations: 8 },
  { tmdbId: 13, title: "Forrest Gump", year: 1994, wins: 6, nominations: 13 },
];

/** Both lists. */
export const ALL_OSCAR_TRUTH: readonly OscarTruth[] = [...OSCAR_TRUTH, ...OSCAR_TRUTH_EXTRA];

export interface FestivalTruth {
  tmdbId: number;
  title: string;
  prize: FestivalPrize;
}

export const FESTIVAL_TRUTH: readonly FestivalTruth[] = [
  { tmdbId: 496243, title: "Parasite", prize: { festival: "Cannes", prize: "Palme d'Or" } },
  { tmdbId: 680, title: "Pulp Fiction", prize: { festival: "Cannes", prize: "Palme d'Or" } },
  { tmdbId: 103, title: "Taxi Driver", prize: { festival: "Cannes", prize: "Palme d'Or" } },
  { tmdbId: 129, title: "Spirited Away", prize: { festival: "Berlin", prize: "Golden Bear" } },
  { tmdbId: 399055, title: "The Shape of Water", prize: { festival: "Venice", prize: "Golden Lion" } },
  { tmdbId: 548, title: "Rashomon", prize: { festival: "Venice", prize: "Golden Lion" } },
];

/** Release years of the truth films (festival-only films have none: no song needs them). */
export const TRUTH_YEARS: ReadonlyMap<number, number> = new Map(ALL_OSCAR_TRUTH.map((t) => [t.tmdbId, t.year]));

/** Every TMDB id the truth set mentions. */
export const TRUTH_IDS: readonly number[] = [
  ...new Set([...ALL_OSCAR_TRUTH.map((t) => t.tmdbId), ...FESTIVAL_TRUTH.map((t) => t.tmdbId)]),
];
