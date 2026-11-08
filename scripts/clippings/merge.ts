// Merges staged Clippings research into the app's data files.
//
//   npm run clippings:merge -- [keys...] [--force] [--dry-run]
//
// Reads scripts/clippings/research/quotes/<key>.json (artists on each other, into src/lib/clippings.json) and
// scripts/clippings/research/critics/<key>.json (critics and reading, into src/lib/essays.json), where <key> is
// the pairingKey (the two TMDB ids, sorted, joined with "+").
//
// With no keys it merges every staged file whose key is not in the app JSON yet. With keys it merges just those.
// An existing key is never touched unless --force, which replaces that key's whole entry from the staged file
// (and so loses any hand edits made to it in the app JSON; see research/README.md). Every file is validated
// first; if anything is wrong nothing is written. --dry-run validates and reports without writing.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { ClippingsData } from "../../src/lib/clippings";
import type { CriticsData } from "../../src/lib/critics";
import {
  buildCriticsEntry,
  buildQuotesEntry,
  criticsFlags,
  isPairingKey,
  quotesFlags,
  stringifyData,
  validateCriticsFile,
  validateIds,
  validateQuotesFile,
  type KnownPairings,
  type RawCriticsFile,
  type RawQuotesFile,
} from "./lib";

const path = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));
const QUOTES_DIR = path("./research/quotes/");
const CRITICS_DIR = path("./research/critics/");
const CLIPPINGS_JSON = path("../../src/lib/clippings.json");
const ESSAYS_JSON = path("../../src/lib/essays.json");
const GENERATED_JSON = path("../../src/lib/examples.generated.json");

const readJson = <T>(file: string): T => JSON.parse(readFileSync(file, "utf8")) as T;
const stagedKeys = (dir: string) =>
  existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith(".json"))
        .map((f) => f.slice(0, -".json".length))
        .sort()
    : [];

function fail(lines: string[]): never {
  console.error(lines.join("\n"));
  process.exit(1);
}

function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const dryRun = args.includes("--dry-run");
  const unknownFlags = args.filter((a) => a.startsWith("-") && a !== "--force" && a !== "--dry-run");
  if (unknownFlags.length) fail([`Unknown option ${unknownFlags.join(", ")}. Usage: npm run clippings:merge -- [keys...] [--force] [--dry-run]`]);
  const wanted = args.filter((a) => !a.startsWith("-"));
  const badKeys = wanted.filter((k) => !isPairingKey(k));
  if (badKeys.length) fail([`Not a pairing key (two TMDB ids joined with "+", e.g. 488+491): ${badKeys.join(", ")}`]);
  if (force && wanted.length === 0) fail(["--force needs the keys to replace, e.g. npm run clippings:merge -- 488+491 --force"]);

  const known = readJson<KnownPairings>(GENERATED_JSON);
  const clippings = readJson<ClippingsData>(CLIPPINGS_JSON);
  const essays = readJson<CriticsData>(ESSAYS_JSON);

  const quoteKeys = stagedKeys(QUOTES_DIR);
  const criticKeys = stagedKeys(CRITICS_DIR);
  const missing = wanted.filter((k) => !quoteKeys.includes(k) && !criticKeys.includes(k));
  if (missing.length) fail([`Nothing staged for ${missing.join(", ")}: expected research/quotes/<key>.json or research/critics/<key>.json`]);

  const pick = (staged: string[], data: Record<string, unknown>) => {
    const keys = wanted.length ? staged.filter((k) => wanted.includes(k)) : staged;
    const todo: string[] = [];
    for (const k of keys) {
      if (Object.hasOwn(data, k) && !force) {
        // Naming a key on purpose that is already merged is worth saying; sweeping the staging dir is not.
        if (wanted.length) console.log(`skip ${k}: already merged (use --force to replace it)`);
        continue;
      }
      todo.push(k);
    }
    return todo;
  };
  const quotesTodo = pick(quoteKeys, clippings);
  const criticsTodo = pick(criticKeys, essays);

  const errors: string[] = [];
  const quotesBuilt = new Map<string, ReturnType<typeof buildQuotesEntry>>();
  const criticsBuilt = new Map<string, ReturnType<typeof buildCriticsEntry>>();
  for (const key of quotesTodo) {
    const src: unknown = readJson(`${QUOTES_DIR}${key}.json`);
    const problems = validateQuotesFile(src, key, known);
    if (problems.length) errors.push(...problems.map((p) => `research/quotes/${key}.json: ${p}`));
    else quotesBuilt.set(key, buildQuotesEntry(src as RawQuotesFile));
  }
  for (const key of criticsTodo) {
    const src: unknown = readJson(`${CRITICS_DIR}${key}.json`);
    const problems = validateCriticsFile(src, key, known);
    if (problems.length) errors.push(...problems.map((p) => `research/critics/${key}.json: ${p}`));
    else criticsBuilt.set(key, buildCriticsEntry(src as RawCriticsFile));
  }

  const nextClippings: ClippingsData = { ...clippings };
  for (const [key, entry] of quotesBuilt) nextClippings[key] = entry;
  const nextEssays: CriticsData = { ...essays };
  for (const [key, entry] of criticsBuilt) nextEssays[key] = entry;
  errors.push(...validateIds(nextClippings, nextEssays));
  if (errors.length) fail([`Not merged: ${errors.length} problem(s), nothing was written.`, ...errors.map((e) => `  - ${e}`)]);

  if (quotesBuilt.size === 0 && criticsBuilt.size === 0) {
    console.log("Nothing to merge: every staged file is already in the app data.");
    return;
  }
  for (const [key, entry] of quotesBuilt) {
    const flags = quotesFlags(entry);
    const by = entry.pair.map((n) => `${entry.clippings.filter((c) => c.speaker === n).length} ${n}`).join(", ");
    console.log(`quotes  ${key}  ${entry.pair.join(" & ")}: ${entry.clippings.length} (${by})${flags.length ? `  FLAGS: ${flags.join("; ")}` : ""}`);
  }
  for (const [key, entry] of criticsBuilt) {
    const flags = criticsFlags(entry);
    console.log(`critics ${key}  ${entry.pair.join(" & ")}: ${entry.critics.length} quotes, ${entry.reading.length} reading${flags.length ? `  FLAGS: ${flags.join("; ")}` : ""}`);
  }
  if (dryRun) {
    console.log("Dry run: nothing written.");
    return;
  }
  if (quotesBuilt.size) writeFileSync(CLIPPINGS_JSON, stringifyData(nextClippings));
  if (criticsBuilt.size) writeFileSync(ESSAYS_JSON, stringifyData(nextEssays));
  console.log("Written. Review the new quotes on the dev server, then run `npm test` before committing.");
}

main();
