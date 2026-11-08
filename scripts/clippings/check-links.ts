// Checks that every Clippings link still works and, for a quote, that the quote is still on the page.
//
//   npm run clippings:check -- [keys...] [--strict]
//
// For each quote in src/lib/clippings.json and src/lib/essays.json (and each "More reading" link) it fetches the
// URL like a browser, 15 s timeout, 6 at a time (each distinct URL once), and gives the item a status:
//   ok             page reachable and, for a quote, every stretch of it is on the page (see check-lib.ts)
//   quote-missing  page reachable but the quote is not there any more
//   dead           404 / 410, DNS failure, redirected to the site's front page, or a "not found" page
//   blocked        401 / 403 / 429, a bot wall, a timeout or other network error, a PDF: could not be checked (a warning)
// The report goes to scripts/clippings/reports/check-<date>.json (check-<date>-partial.json when keys limit the run;
// gitignored). The exit code is non-zero only with --strict and only for dead or quote-missing items; blocked never
// fails a run.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { ClippingsData } from "../../src/lib/clippings";
import type { CriticsData } from "../../src/lib/critics";
import { classifyFetch, classifyLink, classifyQuote, decodeBody, type CheckStatus, type FetchOutcome, type Verdict } from "./check-lib";

const CONCURRENCY = 6;
const TIMEOUT_MS = 15_000;
const ATTEMPTS = 2;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const path = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));
const readJson = <T>(rel: string): T => JSON.parse(readFileSync(path(rel), "utf8")) as T;

interface Item {
  kind: "quote" | "critic" | "reading";
  key: string;
  pair: string;
  /** The clipping's or critic's id, or the reading item's title. */
  ref: string;
  url: string;
  /** The text to find on the page; null for a link only. */
  quote: string | null;
}

interface Result extends Item {
  status: CheckStatus;
  detail: string;
  httpStatus: number | null;
  finalUrl: string;
}

function collectItems(only: readonly string[]): Item[] {
  const clippings = readJson<ClippingsData>("../../src/lib/clippings.json");
  const essays = readJson<CriticsData>("../../src/lib/essays.json");
  const items: Item[] = [];
  const wanted = (key: string) => only.length === 0 || only.includes(key);
  for (const [key, entry] of Object.entries(clippings)) {
    if (!wanted(key)) continue;
    for (const c of entry.clippings) items.push({ kind: "quote", key, pair: entry.pair.join(" & "), ref: c.id, url: c.url, quote: c.quote });
  }
  for (const [key, entry] of Object.entries(essays)) {
    if (!wanted(key)) continue;
    const pair = entry.pair.join(" & ");
    for (const c of entry.critics) items.push({ kind: "critic", key, pair, ref: c.id, url: c.url, quote: c.quote });
    for (const r of entry.reading) items.push({ kind: "reading", key, pair, ref: r.title, url: r.url, quote: null });
  }
  return items;
}

async function fetchOnce(url: string): Promise<FetchOutcome> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
      },
    });
    const contentType = res.headers.get("content-type") ?? "";
    const readable = /html|xml|text\/plain|json/i.test(contentType) || contentType === "";
    const body = res.ok && readable ? decodeBody(new Uint8Array(await res.arrayBuffer()), contentType) : null;
    if (!res.ok) await res.body?.cancel().catch(() => undefined);
    return { httpStatus: res.status, finalUrl: res.url || url, contentType, body, error: null };
  } catch (err) {
    const cause = (err as { cause?: { code?: string; message?: string } }).cause;
    const name = (err as Error).name;
    const error = name === "TimeoutError" || name === "AbortError" ? `timeout after ${TIMEOUT_MS / 1000}s` : (cause?.code ?? cause?.message ?? (err as Error).message);
    return { httpStatus: null, finalUrl: url, contentType: "", body: null, error };
  }
}

async function fetchPage(url: string): Promise<FetchOutcome> {
  let last = await fetchOnce(url);
  // One retry for failures that are often momentary; a DNS failure or an HTTP answer is final.
  for (let attempt = 1; attempt < ATTEMPTS && last.error && last.error !== "ENOTFOUND"; attempt++) last = await fetchOnce(url);
  return last;
}

function verdictFor(item: Item, page: FetchOutcome): Verdict {
  const early = classifyFetch(item.url, page);
  if (early) return early;
  return item.quote ? classifyQuote(item.quote, page.body ?? "") : classifyLink(page.body ?? "");
}

/** Runs `worker` over `inputs`, at most `limit` at a time. */
async function pool<T>(inputs: readonly T[], limit: number, worker: (input: T) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, inputs.length) }, async () => {
      while (next < inputs.length) await worker(inputs[next++]);
    }),
  );
}

async function main() {
  const args = process.argv.slice(2);
  const strict = args.includes("--strict");
  const unknown = args.filter((a) => a.startsWith("-") && a !== "--strict");
  if (unknown.length) {
    console.error(`Unknown option ${unknown.join(", ")}. Usage: npm run clippings:check -- [keys...] [--strict]`);
    process.exit(1);
  }
  const only = args.filter((a) => !a.startsWith("-"));
  const items = collectItems(only);
  if (items.length === 0) {
    console.error(only.length ? `No clippings, critics or reading links for ${only.join(", ")}.` : "No clippings found.");
    process.exit(1);
  }

  const urls = [...new Set(items.map((i) => i.url))];
  console.log(`Checking ${items.length} items on ${urls.length} distinct URLs (${CONCURRENCY} at a time)...`);
  const pages = new Map<string, FetchOutcome>();
  let done = 0;
  await pool(urls, CONCURRENCY, async (url) => {
    pages.set(url, await fetchPage(url));
    done++;
    if (done % 10 === 0 || done === urls.length) console.log(`  ${done}/${urls.length} URLs`);
  });

  const results: Result[] = items.map((item) => {
    const page = pages.get(item.url)!;
    const verdict = verdictFor(item, page);
    return { ...item, ...verdict, httpStatus: page.httpStatus, finalUrl: page.finalUrl };
  });

  const counts: Record<CheckStatus, number> = { ok: 0, "quote-missing": 0, dead: 0, blocked: 0 };
  for (const r of results) counts[r.status]++;

  const date = new Date().toISOString().slice(0, 10);
  const reportDir = path("./reports/");
  mkdirSync(reportDir, { recursive: true });
  // A run limited to some pairs gets its own file so that it never overwrites the day's full report.
  const reportFile = `${reportDir}check-${date}${only.length ? "-partial" : ""}.json`;
  writeFileSync(reportFile, `${JSON.stringify({ checkedAt: new Date().toISOString(), counts, results }, null, 2)}\n`);

  for (const status of ["dead", "quote-missing", "blocked"] as const) {
    const group = results.filter((r) => r.status === status);
    if (group.length === 0) continue;
    console.log(`\n${status.toUpperCase()} (${group.length})`);
    for (const r of group) console.log(`  ${r.key}  ${r.kind}  ${r.ref.slice(0, 48)}\n    ${r.url}\n    ${r.detail}`);
  }
  console.log(
    `\n${results.length} items: ${counts.ok} ok, ${counts["quote-missing"]} quote-missing, ${counts.dead} dead, ${counts.blocked} blocked (could not check).`,
  );
  console.log(`Report: ${reportFile}`);
  if (strict && (counts.dead > 0 || counts["quote-missing"] > 0)) process.exit(1);
}

await main();
