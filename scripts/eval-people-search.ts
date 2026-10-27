// Measures how well the local people matcher finds the person behind ~50 realistic half-typed and
// misspelled queries (src/lib/people-search-eval.ts), over the real index.
//
//   npm run people:eval              hit rates and the misses
//   npm run people:eval -- --all     also every query's top 3
//   npm run people:eval -- --bench   also the matcher's latency over 100 queries
//   npm run people:eval -- --tmdb    also the same queries against TMDB's own /search/person (live,
//                                    one call per query; needs TMDB_READ_ACCESS_TOKEN in .env)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { decodePeopleIndex, type PeopleIndexFile } from "../src/lib/people-index-format";
import { buildMatchIndex, searchIndex } from "../src/lib/people-match";
import { EVAL_QUERIES, hitRank, hitRates, type HitRates } from "../src/lib/people-search-eval";

const INDEX_FILE = fileURLToPath(new URL("../src/lib/people-index.generated.json", import.meta.url));
const flags = new Set(process.argv.slice(2));

const percent = (n: number) => `${(n * 100).toFixed(0)}%`.padStart(4);
const row = (label: string, rates: HitRates) =>
  `${label.padEnd(26)} top-1 ${percent(rates.top1)}   top-3 ${percent(rates.top3)}   top-8 ${percent(rates.top8)}`;

function bench(index: ReturnType<typeof buildMatchIndex>): void {
  const queries = Array.from({ length: 100 }, (_, i) => EVAL_QUERIES[i % EVAL_QUERIES.length].q);
  for (const q of queries) searchIndex(index, q); // warm up
  const times = queries.map((q) => {
    const start = performance.now();
    searchIndex(index, q);
    return performance.now() - start;
  });
  times.sort((a, b) => a - b);
  const at = (p: number) => times[Math.min(times.length - 1, Math.floor(p * times.length))];
  console.log(
    `\nMatcher latency over ${times.length} queries on ${index.entries.length} people: ` +
      `p50 ${at(0.5).toFixed(2)} ms, p95 ${at(0.95).toFixed(2)} ms, max ${at(1).toFixed(2)} ms`,
  );
}

async function tmdbRaw(q: string): Promise<string[]> {
  const url = new URL("https://api.themoviedb.org/3/search/person");
  url.searchParams.set("query", q);
  url.searchParams.set("include_adult", "false");
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.TMDB_READ_ACCESS_TOKEN}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`TMDB search failed with ${res.status} for "${q}"`);
  return ((await res.json()) as { results: { name: string }[] }).results.map((p) => p.name);
}

async function main(): Promise<void> {
  const file = JSON.parse(readFileSync(INDEX_FILE, "utf8")) as PeopleIndexFile;
  const people = decodePeopleIndex(file);
  const index = buildMatchIndex(people);
  console.log(`Index: ${people.length} people, generated ${file.generatedAt}\n`);

  const local = EVAL_QUERIES.map(({ q, expect }) => {
    const names = searchIndex(index, q).map((m) => m.person.name);
    return { q, expect, names, rank: hitRank(names, expect) };
  });

  for (const { q, expect, names, rank } of local) {
    if (flags.has("--all") || rank === 0 || rank > 3) {
      console.log(
        `${rank === 0 ? "MISS" : rank > 3 ? `#${rank}  ` : "ok  "} ${q.padEnd(24)} want ${expect[0]}${expect.length > 1 ? " (+others)" : ""}\n` +
          `       got  ${names.slice(0, 3).join(" | ") || "(nothing)"}`,
      );
    }
  }
  console.log(`\n${row("Local matcher", hitRates(local.map((r) => r.rank)))}`);

  if (flags.has("--tmdb")) {
    if (!process.env.TMDB_READ_ACCESS_TOKEN) throw new Error("TMDB_READ_ACCESS_TOKEN is not set");
    const ranks: number[] = [];
    for (const { q, expect } of EVAL_QUERIES) {
      const names = await tmdbRaw(q);
      const rank = hitRank(names, expect);
      ranks.push(rank);
      if (flags.has("--all")) console.log(`TMDB ${rank === 0 ? "MISS" : `#${rank}`.padEnd(4)} ${q.padEnd(24)} ${names.slice(0, 3).join(" | ")}`);
    }
    console.log(row("TMDB /search/person", hitRates(ranks)));
  }

  if (flags.has("--bench")) bench(index);
}

await main();
