// Builds the awards data behind the film hover card (src/lib/awards.generated.json).
//
//   npm run awards:refresh                 look up the curated films and write the file
//   npm run awards:refresh -- --validate   check the live endpoint against 26 films with known Oscar
//                                          tallies (and 6 festival winners); exits non-zero on a miss
//   npm run awards:refresh -- --dry-run    do everything except writing, and print the statistics
//   npm run awards:refresh -- --force      write even if the safety checks below fail
//   npm run awards:refresh -- --explain 238,10193   print how those films' counts add up
//   npm run awards:refresh -- --no-cache   fresh TMDB crawl (the cache folder is AWARDS_CACHE_DIR)
//
// The films are the ones in the shared-film lists of the curated pairings (see awards-corpus.ts);
// their Oscar wins and nominations and their Palme d'Or, Golden Lion and Golden Bear come from
// Wikidata (CC0), joined on the TMDB movie id (property P4947). The queries and counting rules are
// in src/lib/awards-wikidata.ts; "Awards data" in the README explains the model and its limits.
//
// The endpoint is WDQS_ENDPOINT (default https://query.wikidata.org/sparql). The Wikidata Query
// Service is moving from Blazegraph to QLever; --validate is the regression test for that move.
//
// Safety checks (skipped by --force): nothing is written when the result is empty, when films
// with data drop by more than 30% against the committed file, or when a film of the validation set
// that is in the corpus comes out different from the Academy's official tally.
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { decodeAwards, encodeAwards } from "../src/lib/awards-format";
import {
  ALL_OSCAR_TRUTH,
  FESTIVAL_TRUTH,
  OSCAR_TRUTH,
  OSCAR_TRUTH_EXTRA,
  TRUTH_IDS,
  TRUTH_YEARS,
  type OscarTruth,
} from "../src/lib/awards-truth";
import {
  awardsQuery,
  parseAwardRows,
  summarizeFilms,
  tallyOscarCategories,
  type AwardRow,
  type FilmAwards,
} from "../src/lib/awards-wikidata";
import { buildCorpus, type CorpusFilm } from "./awards-corpus";
import { QueryTimeout, createWikidataClient, type WikidataClient } from "./awards-wikidata-client";

const OUTPUT = fileURLToPath(new URL("../src/lib/awards.generated.json", import.meta.url));
const CACHE_DIR =
  process.env.AWARDS_CACHE_DIR ??
  fileURLToPath(new URL("../node_modules/.cache/parallel-awards/", import.meta.url));
/** Films per query: big enough to be cheap, small enough to stay far from the 60 s query limit. */
const BATCH_SIZE = 50;
/** A batch that times out on the server is split in halves down to this size. */
const MIN_SPLIT = 5;
/** Films with data may drop by this share before the file is considered broken. */
const MAX_DROP = 0.3;

/**
 * `npm run awards:refresh --validate` (no `--`) hands the flag to npm, which passes it on as the
 * npm_config_validate environment variable, so both spellings work.
 */
function flag(name: string): boolean {
  return (
    process.argv.includes(`--${name}`) ||
    process.env[`npm_config_${name.replace(/-/g, "_")}`] === "true"
  );
}

function option(name: string): string | undefined {
  const at = process.argv.indexOf(`--${name}`);
  return at >= 0 ? process.argv[at + 1] : undefined;
}

/** Looks up the films in batches, two requests at a time; a batch that times out is halved. */
async function fetchRows(client: WikidataClient, ids: readonly number[]): Promise<AwardRow[]> {
  async function batch(slice: readonly number[]): Promise<AwardRow[]> {
    try {
      return parseAwardRows(await client.query(awardsQuery(slice)));
    } catch (error) {
      if (!(error instanceof QueryTimeout) || slice.length <= MIN_SPLIT) throw error;
      const half = Math.ceil(slice.length / 2);
      console.warn(`  a batch of ${slice.length} films timed out; retrying as ${half} + ${slice.length - half}`);
      const [first, second] = await Promise.all([batch(slice.slice(0, half)), batch(slice.slice(half))]);
      return [...first, ...second];
    }
  }

  const slices: number[][] = [];
  for (let i = 0; i < ids.length; i += BATCH_SIZE) slices.push(ids.slice(i, i + BATCH_SIZE));
  let done = 0;
  const results = await Promise.all(
    slices.map(async (slice) => {
      const rows = await batch(slice);
      console.log(`  Wikidata: ${++done}/${slices.length} batches`);
      return rows;
    }),
  );
  return results.flat();
}

/** Compares a film's computed awards with the truth set; returns one problem per difference. */
function checkTruth(computed: ReadonlyMap<number, FilmAwards>, only?: ReadonlySet<number>): string[] {
  const problems: string[] = [];
  for (const truth of ALL_OSCAR_TRUTH) {
    if (only && !only.has(truth.tmdbId)) continue;
    const got = computed.get(truth.tmdbId);
    const wins = got?.oscarWins ?? 0;
    const nominations = got?.oscarNominations ?? 0;
    if (wins !== truth.wins || nominations !== truth.nominations) {
      problems.push(
        `${truth.title}: expected ${truth.wins} wins / ${truth.nominations} nominations, got ${wins} / ${nominations}`,
      );
    }
  }
  for (const truth of FESTIVAL_TRUTH) {
    if (only && !only.has(truth.tmdbId)) continue;
    const prizes = computed.get(truth.tmdbId)?.festivalPrizes ?? [];
    if (!prizes.some((p) => p.festival === truth.prize.festival && p.prize === truth.prize.prize)) {
      problems.push(`${truth.title}: expected the ${truth.prize.festival} ${truth.prize.prize}`);
    }
  }
  return problems;
}

async function validate(client: WikidataClient): Promise<void> {
  console.log(
    `Validating against ${client.endpoint} (${OSCAR_TRUTH.length} Oscar films + ${OSCAR_TRUTH_EXTRA.length} song and special-award cases, ` +
      `${FESTIVAL_TRUTH.length} festival winners)...`,
  );
  const rows = await fetchRows(client, TRUTH_IDS);
  const computed = summarizeFilms(rows, TRUTH_YEARS);

  const pad = (text: string, width: number) => text.padEnd(width);
  const oscarTable = (title: string, list: readonly OscarTruth[]): number => {
    console.log(`\n${pad(title, 32)} ${pad("Expected (W/N)", 15)} ${pad("Got (W/N)", 11)} Result`);
    let exact = 0;
    for (const truth of list) {
      const got = computed.get(truth.tmdbId);
      const wins = got?.oscarWins ?? 0;
      const nominations = got?.oscarNominations ?? 0;
      const ok = wins === truth.wins && nominations === truth.nominations;
      if (ok) exact++;
      console.log(
        `${pad(`${truth.title} (${truth.year})`, 32)} ${pad(`${truth.wins} / ${truth.nominations}`, 15)} ${pad(`${wins} / ${nominations}`, 11)} ${ok ? "ok" : "MISMATCH"}`,
      );
    }
    return exact;
  };
  const exact = oscarTable("Validation set", OSCAR_TRUTH);
  const exactExtra = oscarTable("Songs and special awards", OSCAR_TRUTH_EXTRA);

  console.log(`\n${pad("Festival film", 32)} ${pad("Expected", 28)} Result`);
  let festivalsOk = 0;
  for (const truth of FESTIVAL_TRUTH) {
    const prizes = computed.get(truth.tmdbId)?.festivalPrizes ?? [];
    const ok = prizes.some((p) => p.festival === truth.prize.festival && p.prize === truth.prize.prize);
    if (ok) festivalsOk++;
    console.log(
      `${pad(truth.title, 32)} ${pad(`${truth.prize.festival} ${truth.prize.prize}`, 28)} ${ok ? "ok" : "MISSING"}` +
        (ok ? "" : `   (got: ${prizes.map((p) => `${p.festival} ${p.prize}`).join(", ") || "none"})`),
    );
  }
  console.log(
    `\nOscar tallies exact: ${exact} of ${OSCAR_TRUTH.length} (validation set), ${exactExtra} of ${OSCAR_TRUTH_EXTRA.length} (songs and special awards). ` +
      `Festival prizes found: ${festivalsOk} of ${FESTIVAL_TRUTH.length}. ${client.stats.requests} request(s).`,
  );
  if (
    exact !== OSCAR_TRUTH.length ||
    exactExtra !== OSCAR_TRUTH_EXTRA.length ||
    festivalsOk !== FESTIVAL_TRUTH.length
  ) {
    console.error("\nawards:refresh --validate FAILED.");
    process.exitCode = 1;
  }
}

function explain(rows: readonly AwardRow[], films: readonly CorpusFilm[], ids: number[]): void {
  for (const id of ids) {
    const filmRows = rows.filter((row) => row.tmdb === String(id));
    const film = films.find((f) => f.id === id);
    const categories = tallyOscarCategories(filmRows, film?.year);
    console.log(`\nTMDB ${id}${film ? ` ${film.title} (${film.year})` : ""}: ${filmRows.length} statement(s)`);
    for (const c of categories) console.log(`  ${c.cat.padEnd(10)} wins ${c.wins}  nominations ${c.nominations}`);
    console.log(
      `  total: ${categories.reduce((s, c) => s + c.wins, 0)} wins / ${categories.reduce((s, c) => s + c.nominations, 0)} nominations`,
    );
  }
}

const decade = (year: number) => (year > 0 ? `${Math.floor(year / 10) * 10}s` : "unknown");

function printCoverage(films: CorpusFilm[], computed: ReadonlyMap<number, FilmAwards>): void {
  const withData = films.filter((f) => computed.has(f.id));
  const oscar = withData.filter((f) => computed.get(f.id)!.oscarNominations > 0);
  const winners = withData.filter((f) => computed.get(f.id)!.oscarWins > 0);
  const festival = withData.filter((f) => computed.get(f.id)!.festivalPrizes.length > 0);
  const share = (n: number) => `${n} (${((100 * n) / films.length).toFixed(1)}%)`;
  console.log(`\nCoverage of ${films.length} corpus films:`);
  console.log(`  with data (Oscar record or festival prize): ${share(withData.length)}`);
  console.log(`  with an Oscar record:                       ${share(oscar.length)}`);
  console.log(`  with at least one Oscar win:                ${share(winners.length)}`);
  console.log(`  with a festival top prize:                  ${share(festival.length)}`);

  const byDecade = new Map<string, { films: number; data: number; wins: number }>();
  for (const film of films) {
    const entry = byDecade.get(decade(film.year)) ?? { films: 0, data: 0, wins: 0 };
    entry.films++;
    const got = computed.get(film.id);
    if (got) entry.data++;
    if (got && got.oscarWins > 0) entry.wins++;
    byDecade.set(decade(film.year), entry);
  }
  console.log("\n  Decade   films  with data  with a win");
  for (const [name, entry] of [...byDecade].sort(([a], [b]) => a.localeCompare(b))) {
    console.log(`  ${name.padEnd(8)} ${String(entry.films).padStart(5)}  ${String(entry.data).padStart(9)}  ${String(entry.wins).padStart(10)}`);
  }
}

async function main(): Promise<void> {
  const started = Date.now();
  const client = createWikidataClient();

  if (flag("validate")) return validate(client);

  const dryRun = flag("dry-run");
  const force = flag("force");
  const useCache = !flag("no-cache");
  console.log(`TMDB cache: ${useCache ? CACHE_DIR : "off (--no-cache)"}`);

  console.log("Finding the films of the curated pairings...");
  const corpus = await buildCorpus(CACHE_DIR, useCache);
  console.log(
    `  ${corpus.pairings} pairings, ${corpus.people} people, ${corpus.slots} shared-film slots, ${corpus.films.length} unique films ` +
      `(TMDB: ${corpus.tmdb.network} requests, ${corpus.tmdb.retried} retried, ${corpus.tmdb.cached} from cache)`,
  );

  console.log(`Asking ${client.endpoint} (${BATCH_SIZE} films per query, 2 at a time)...`);
  const rows = await fetchRows(client, corpus.films.map((film) => film.id));
  const computed = summarizeFilms(rows, new Map(corpus.films.map((film) => [film.id, film.year])));

  const explainIds = (option("explain") ?? "").split(",").map(Number).filter((id) => id > 0);
  if (explainIds.length > 0) explain(rows, corpus.films, explainIds);

  printCoverage(corpus.films, computed);

  const previous = existsSync(OUTPUT) ? decodeAwards(JSON.parse(readFileSync(OUTPUT, "utf8"))) : new Map();
  console.log(`\nFilms with data: ${computed.size} (committed file: ${previous.size}).`);

  const problems: string[] = [];
  if (computed.size === 0) problems.push("the endpoint returned no awards at all");
  if (previous.size > 0 && computed.size < previous.size * (1 - MAX_DROP)) {
    problems.push(
      `films with data dropped from ${previous.size} to ${computed.size}, more than ${MAX_DROP * 100}%`,
    );
  }
  const inCorpus = new Set(corpus.films.map((film) => film.id));
  const wrong = checkTruth(computed, inCorpus);
  for (const problem of wrong.slice(0, 5)) problems.push(`validation film differs: ${problem}`);
  if (wrong.length > 5) problems.push(`... and ${wrong.length - 5} more validation films differ (see --validate)`);

  if (problems.length > 0 && !force) {
    console.error("\nawards:refresh found problems. Nothing was written (use --force to write anyway):");
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exitCode = 1;
    return;
  }
  if (problems.length > 0) console.warn(`\n--force: writing despite ${problems.length} problem(s).`);

  const file = encodeAwards(computed, new Date().toISOString());
  const json = `${JSON.stringify(file)}\n`;
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  const stats =
    `Wikidata: ${client.stats.requests} request(s), ${client.stats.retries} retried. ${seconds}s.`;

  if (dryRun) {
    console.log(`\n--dry-run: would write ${computed.size} films (${(json.length / 1024).toFixed(1)} KB). Nothing was written.\n${stats}`);
    return;
  }
  writeFileSync(OUTPUT, json);
  console.log(
    `\nWrote ${computed.size} films to src/lib/awards.generated.json (${(statSync(OUTPUT).size / 1024).toFixed(1)} KB).\n${stats}`,
  );
}

try {
  await main();
} catch (error) {
  console.error(`\nawards:refresh failed. Nothing was written.\n  ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
