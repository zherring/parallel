import type { AwardsSummary, FestivalPrize } from "@/lib/awards";

/**
 * Everything `npm run awards:refresh` knows about Wikidata's award modelling: the SPARQL that
 * reads it and the rules that turn its rows into "N Oscars, M nominations" the way the Academy
 * counts them. Pure (no network, no fs), so the rules are unit-tested with fixture rows.
 *
 * Data model (checked against live Wikidata, see "Awards data" in the README):
 *  - A film item carries P166 "award received" and P1411 "nominated for" statements itself.
 *  - Acting, directing, writing... awards usually sit on the PERSON item, with the film in the
 *    P1686 "for work" qualifier. Those statements carry a rank, and a nomination the Academy later
 *    withdrew (The Godfather's score) is kept there with DEPRECATED rank, so it must be skipped.
 *  - A Best Original Song award is about the SONG: the song item (or the person, with the song as
 *    "for work") carries it, and the film is reached from the song item, through one of a handful
 *    of properties or through the film's soundtrack album (SONG_FILM_LINKS and below). Where
 *    Wikidata has no such link, SONG_LINK_OVERRIDES supplies it by hand.
 *  - Category items point at their ceremony inconsistently (P31, P279 or P361): one hop along any
 *    of the three reaches the Academy Awards item.
 *
 * The queries are plain SPARQL 1.1 plus the Wikibase RDF vocabulary (p:, ps:, pq:, wikibase:rank),
 * with no label service and no Blazegraph-only syntax, so they also run on QLever, which is
 * replacing Blazegraph behind query.wikidata.org.
 */

export const ACADEMY_AWARDS = "Q19020";

/** The festival top prizes shown next to the Oscars: Wikidata item -> [festival, prize]. */
export const FESTIVAL_PRIZE_ITEMS: Readonly<Record<string, readonly [festival: string, prize: string]>> = {
  Q179808: ["Cannes", "Palme d'Or"],
  Q209459: ["Venice", "Golden Lion"],
  Q154590: ["Berlin", "Golden Bear"],
};

/** Oscar categories where each nominee is a nomination of its own (the Academy counts them so). */
const PER_NOMINEE_CATEGORIES: ReadonlySet<string> = new Set([
  "Q103916", // Best Actor
  "Q103618", // Best Actress
  "Q106291", // Best Supporting Actor
  "Q106301", // Best Supporting Actress
]);

/** Best Original Song: one nomination per song. */
export const BEST_ORIGINAL_SONG = "Q112243";

/**
 * Items under the Academy Awards item that are not competitive categories: honorary and
 * technical awards go to people, "Award of Merit" is the statuette in general, and the Special
 * Achievement Award is not a competitive category (the Academy lists it apart). Counting any of
 * them as an Oscar win or nomination of a film would disagree with the Academy's own tallies.
 */
const NON_COMPETITIVE: ReadonlySet<string> = new Set([
  "Q8624", // Academy Award of Merit (the statuette)
  "Q727328", // Academy Honorary Award
  "Q489705", // Academy Juvenile Award
  "Q8610", // Academy Scientific and Technical Award
  "Q8636", // Academy Award for Technical Achievement
  "Q8250869", // Scientific and Engineering Award
  "Q844273", // Irving G. Thalberg Memorial Award
  "Q488151", // Gordon E. Sawyer Award
  "Q1699048", // John A. Bonner Medal of Commendation
  "Q116197098", // Academy Award of Commendation
  "Q111210907", // Oscars Fan Favorite
  "Q2032630", // Special Achievement Academy Award
]);

/**
 * How a Best Original Song item points at its film: P9899 "music created for", P361 "part of",
 * P13602, P1433 "published in" and P1441 "present in work" (all seen on songs that Wikidata links).
 */
const SONG_FILM_LINKS = "wdt:P9899|wdt:P361|wdt:P13602|wdt:P1433|wdt:P1441";
/** How a song item points at a soundtrack album, which the film lists with P406 "soundtrack release". */
const SONG_ALBUM_LINKS = "wdt:P361|wdt:P13602|wdt:P1433";

/**
 * Best Original Song items that carry the award but that Wikidata does not connect to their film
 * in any way the query can follow (no film link, no soundtrack album). Each was found by listing
 * the unlinked Best Original Song items and matching them against the curated films; the film is
 * the one the song was written for. Harmless once Wikidata links the song: a song counts once.
 * The README's "Awards data" section explains how to find more (`--audit-songs`).
 */
export const SONG_LINK_OVERRIDES: readonly { song: string; tmdb: number; note: string }[] = [
  { song: "Q257915", tmdb: 574, note: "Que Sera, Sera (The Man Who Knew Too Much, 1956; won)" },
  { song: "Q7249775", tmdb: 242, note: "Promise Me You'll Remember (The Godfather Part III, 1990)" },
  { song: "Q25383026", tmdb: 879, note: "When You're Alone (Hook, 1991)" },
  { song: "Q1326000", tmdb: 812, note: "A Whole New World (Aladdin, 1992; won)" },
  { song: "Q7992731", tmdb: 863, note: "When She Loved Me (Toy Story 2, 1999)" },
  { song: "Q124800301", tmdb: 13370, note: "A Kiss at the End of the Rainbow (A Mighty Wind, 2003)" },
  { song: "Q28152062", tmdb: 313369, note: "City of Stars (La La Land, 2016; won)" },
  { song: "Q28495923", tmdb: 313369, note: "Audition (The Fools Who Dream) (La La Land, 2016)" },
  { song: "Q82145833", tmdb: 301528, note: "I Can't Let You Throw Yourself Away (Toy Story 4, 2019)" },
];

/**
 * A song's award year may lead its film's release year by at most this many years. A soundtrack
 * of a remake lists the old film's songs (Pinocchio 2022 lists "When You Wish Upon a Star"), and
 * those must not count for the new film.
 */
const SONG_YEAR_WINDOW = 2;

/** One statement found for a film, as the query returns it. */
export interface AwardRow {
  /** TMDB movie id. */
  tmdb: string;
  /** Wikidata item id of the award category (or festival prize). */
  cat: string;
  won: boolean;
  /** Where the statement lives: on the film item, on a person ("for work" = film), or on a song. */
  kind: "film" | "person" | "song";
  /** The person item (kind "person") or song item (kind "song"); unset for "film". */
  who?: string;
  /** Year of the ceremony (the statement's point in time), recorded for songs. */
  year?: number;
}

/** What one film adds up to: the same shape the app reads. */
export type FilmAwards = AwardsSummary;

const filmValues = (ids: readonly number[]) => ids.map((id) => `"${Math.trunc(id)}"`).join(" ");

/**
 * The query for a batch of TMDB movie ids. Rows: ?tmdb ?cat ?w (1 won, 0 nominated) ?kind ?who ?pit.
 * `?film` is bound first (VALUES on the TMDB id property P4947, then the join) because Wikidata's
 * optimiser otherwise scans every statement of the property before reaching the films; never
 * filter on labels before that join either.
 */
export function awardsQuery(tmdbIds: readonly number[]): string {
  const prizes = Object.keys(FESTIVAL_PRIZE_ITEMS).map((q) => `wd:${q}`).join(" ");
  const batch = new Set(tmdbIds);
  const overrides = SONG_LINK_OVERRIDES.filter((o) => batch.has(o.tmdb))
    .map((o) => `(wd:${o.song} "${o.tmdb}")`)
    .join(" ");
  const song = `wd:${BEST_ORIGINAL_SONG}`;
  return `SELECT DISTINCT ?tmdb ?cat ?w ?kind ?who ?pit WHERE {
  VALUES ?tmdb { ${filmValues(tmdbIds)} }
  ?film wdt:P4947 ?tmdb .
  {
    { ?film wdt:P166 ?cat . BIND(1 AS ?w) BIND("film" AS ?kind) }
    UNION { ?film wdt:P1411 ?cat . BIND(0 AS ?w) BIND("film" AS ?kind) }
    UNION {
      ?who p:P166 ?s1 . ?s1 ps:P166 ?cat ; pq:P1686 ?film ; wikibase:rank ?r1 .
      FILTER(?r1 != wikibase:DeprecatedRank)
      BIND(1 AS ?w) BIND("person" AS ?kind)
    }
    UNION {
      ?who p:P1411 ?s2 . ?s2 ps:P1411 ?cat ; pq:P1686 ?film ; wikibase:rank ?r2 .
      FILTER(?r2 != wikibase:DeprecatedRank)
      BIND(0 AS ?w) BIND("person" AS ?kind)
    }
    UNION {
      { ?song (${SONG_FILM_LINKS}) ?film }
      UNION { ?film wdt:P406 ?album . ?song (${SONG_ALBUM_LINKS}) ?album }
      UNION { ?film wdt:P406 ?album . ?album wdt:P658 ?song }${overrides ? `\n      UNION { VALUES (?song ?tmdb) { ${overrides} } }` : ""}
      {
        {
          ?song p:P166 ?s3 . ?s3 ps:P166 ${song} ; wikibase:rank ?r3 .
          FILTER(?r3 != wikibase:DeprecatedRank) OPTIONAL { ?s3 pq:P585 ?pit } BIND(1 AS ?w)
        }
        UNION {
          ?song p:P1411 ?s4 . ?s4 ps:P1411 ${song} ; wikibase:rank ?r4 .
          FILTER(?r4 != wikibase:DeprecatedRank) OPTIONAL { ?s4 pq:P585 ?pit } BIND(0 AS ?w)
        }
        UNION {
          ?p5 p:P166 ?s5 . ?s5 ps:P166 ${song} ; pq:P1686 ?song ; wikibase:rank ?r5 .
          FILTER(?r5 != wikibase:DeprecatedRank) OPTIONAL { ?s5 pq:P585 ?pit } BIND(1 AS ?w)
        }
        UNION {
          ?p6 p:P1411 ?s6 . ?s6 ps:P1411 ${song} ; pq:P1686 ?song ; wikibase:rank ?r6 .
          FILTER(?r6 != wikibase:DeprecatedRank) OPTIONAL { ?s6 pq:P585 ?pit } BIND(0 AS ?w)
        }
      }
      BIND(${song} AS ?cat) BIND(?song AS ?who) BIND("song" AS ?kind)
    }
  }
  {
    ?cat (wdt:P31|wdt:P279|wdt:P361) wd:${ACADEMY_AWARDS} .
  } UNION {
    VALUES ?cat { ${prizes} }
  }
}`;
}

/** One SPARQL JSON result binding, as the endpoint returns it. */
export type SparqlBinding = Record<string, { type: string; value: string } | undefined>;

const qid = (value: string) => value.slice(value.lastIndexOf("/") + 1);

/** Reads the query's result bindings into rows; ignores any binding that lacks a required field. */
export function parseAwardRows(bindings: readonly SparqlBinding[]): AwardRow[] {
  const rows: AwardRow[] = [];
  for (const b of bindings) {
    const tmdb = b.tmdb?.value;
    const cat = b.cat?.value;
    const kind = b.kind?.value;
    const won = b.w?.value;
    if (!tmdb || !cat || (kind !== "film" && kind !== "person" && kind !== "song")) continue;
    if (won !== "0" && won !== "1") continue;
    const year = Number(b.pit?.value?.match(/^\d{4}/)?.[0]);
    rows.push({
      tmdb,
      cat: qid(cat),
      won: won === "1",
      kind,
      who: b.who?.value ? qid(b.who.value) : undefined,
      year: Number.isInteger(year) && year > 0 ? year : undefined,
    });
  }
  return rows;
}

/** One category of one film, as counted. */
export interface CategoryTally {
  cat: string;
  nominations: number;
  wins: number;
}

/**
 * Counts the Oscar categories of one film's rows the way the Academy counts:
 *  - every competitive category with a statement is one nomination, and a win is also a nomination;
 *  - except acting categories (each nominee counts) and Best Original Song (each song counts);
 *  - withdrawn nominations are deprecated in Wikidata and never reach here (the query skips them);
 *  - honorary, scientific and special awards are not competitive categories and are dropped;
 *  - a song whose ceremony is outside the film's years does not belong to it (remake soundtracks).
 * `filmYear` is the film's release year; without it no song is ruled out.
 */
export function tallyOscarCategories(rows: readonly AwardRow[], filmYear?: number): CategoryTally[] {
  const byCategory = new Map<
    string,
    { won: boolean; holders: Set<string>; holdersWon: Set<string>; songs: Set<string>; songsWon: Set<string> }
  >();
  for (const row of rows) {
    if (row.cat in FESTIVAL_PRIZE_ITEMS || NON_COMPETITIVE.has(row.cat)) continue;
    if (
      row.kind === "song" &&
      row.year !== undefined &&
      filmYear !== undefined &&
      (row.year < filmYear || row.year > filmYear + SONG_YEAR_WINDOW)
    ) {
      continue;
    }
    let entry = byCategory.get(row.cat);
    if (!entry) {
      entry = { won: false, holders: new Set(), holdersWon: new Set(), songs: new Set(), songsWon: new Set() };
      byCategory.set(row.cat, entry);
    }
    if (row.won) entry.won = true;
    if (row.kind === "person" && row.who && PER_NOMINEE_CATEGORIES.has(row.cat)) {
      entry.holders.add(row.who);
      if (row.won) entry.holdersWon.add(row.who);
    }
    if (row.kind === "song" && row.who && row.cat === BEST_ORIGINAL_SONG) {
      entry.songs.add(row.who);
      if (row.won) entry.songsWon.add(row.who);
    }
  }

  return [...byCategory]
    .map(([cat, entry]) => {
      const nominees = cat === BEST_ORIGINAL_SONG ? entry.songs : entry.holders;
      const winners = cat === BEST_ORIGINAL_SONG ? entry.songsWon : entry.holdersWon;
      return {
        cat,
        nominations: Math.max(1, nominees.size),
        wins: entry.won ? Math.max(1, winners.size) : 0,
      };
    })
    .sort((a, b) => a.cat.localeCompare(b.cat, "en", { numeric: true }));
}

/**
 * The festival top prizes a film won, in the fixed order Cannes, Venice, Berlin. Only statements
 * on the film item count: the top prizes are awarded to the film, every real winner in the curated
 * set has one, and a statement on a person is where Wikidata confuses neighbouring prizes (Park
 * Chan-wook is recorded with the Golden Lion for Lady Vengeance, which won the Little Golden Lion).
 */
export function festivalPrizesWon(rows: readonly AwardRow[]): FestivalPrize[] {
  const won = new Set(
    rows.filter((r) => r.won && r.kind === "film" && r.cat in FESTIVAL_PRIZE_ITEMS).map((r) => r.cat),
  );
  return Object.entries(FESTIVAL_PRIZE_ITEMS)
    .filter(([q]) => won.has(q))
    .map(([, [festival, prize]]) => ({ festival, prize }));
}

/** Everything one film's rows add up to. */
export function summarizeFilm(rows: readonly AwardRow[], filmYear?: number): FilmAwards {
  const categories = tallyOscarCategories(rows, filmYear);
  return {
    oscarWins: categories.reduce((sum, c) => sum + c.wins, 0),
    oscarNominations: categories.reduce((sum, c) => sum + c.nominations, 0),
    festivalPrizes: festivalPrizesWon(rows),
  };
}

/**
 * Groups rows by film and summarizes each (`years`: TMDB id -> release year); films with neither
 * an Oscar record nor a prize are left out.
 */
export function summarizeFilms(
  rows: readonly AwardRow[],
  years: ReadonlyMap<number, number> = new Map(),
): Map<number, FilmAwards> {
  const byFilm = new Map<string, AwardRow[]>();
  for (const row of rows) {
    const list = byFilm.get(row.tmdb);
    if (list) list.push(row);
    else byFilm.set(row.tmdb, [row]);
  }
  const out = new Map<number, FilmAwards>();
  for (const [tmdb, filmRows] of byFilm) {
    const id = Number(tmdb);
    const summary = summarizeFilm(filmRows, years.get(id));
    if (summary.oscarNominations > 0 || summary.festivalPrizes.length > 0) out.set(id, summary);
  }
  return out;
}
