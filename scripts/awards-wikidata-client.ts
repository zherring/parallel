// A small, polite client for the Wikidata Query Service, used by refresh-awards.ts.
//
// Wikimedia asks for a descriptive User-Agent, few parallel requests, and backing off when told
// to: HTTP 429 (with Retry-After) means stop sending for a while, 5xx and network errors are
// retried with growing waits. A query that times out on the server (HTTP 504, or a "timeout"
// message) is not retried as is, since sending the same query again only burns the quota: it
// throws QueryTimeout so the caller can ask for fewer films at a time.
import type { SparqlBinding } from "../src/lib/awards-wikidata";

export const DEFAULT_ENDPOINT = "https://query.wikidata.org/sparql";
export const USER_AGENT = "ParallelBot/0.1 (https://github.com/zherring/parallel)";
/** Wikimedia's etiquette: no more than 2 requests in flight. */
const MAX_IN_FLIGHT = 2;
const MAX_ATTEMPTS = 5;
const REQUEST_TIMEOUT_MS = 70_000;
const MAX_WAIT_MS = 120_000;

export class QueryTimeout extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QueryTimeout";
  }
}

export interface WikidataStats {
  /** HTTP requests sent, retries included. */
  requests: number;
  retries: number;
}

export interface WikidataClient {
  endpoint: string;
  stats: WikidataStats;
  query(sparql: string): Promise<SparqlBinding[]>;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function createWikidataClient(endpoint = process.env.WDQS_ENDPOINT || DEFAULT_ENDPOINT): WikidataClient {
  const stats: WikidataStats = { requests: 0, retries: 0 };
  let active = 0;
  const waiting: (() => void)[] = [];
  /** A 429 pauses every caller: the service bans clients that keep sending while throttled. */
  let pausedUntil = 0;

  async function limited<T>(task: () => Promise<T>): Promise<T> {
    while (active >= MAX_IN_FLIGHT) await new Promise<void>((resolve) => waiting.push(resolve));
    active++;
    try {
      return await task();
    } finally {
      active--;
      waiting.shift()?.();
    }
  }

  async function attempt(sparql: string): Promise<SparqlBinding[]> {
    for (let n = 1; ; n++) {
      if (pausedUntil > Date.now()) await sleep(pausedUntil - Date.now());
      stats.requests++;
      let status = 0;
      let retryAfterMs = 0;
      let detail = "network error";
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "User-Agent": USER_AGENT,
            Accept: "application/sparql-results+json",
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ query: sparql }).toString(),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        status = res.status;
        if (res.ok) {
          const json = (await res.json()) as { results?: { bindings?: SparqlBinding[] } };
          const bindings = json.results?.bindings;
          if (!Array.isArray(bindings)) throw new Error("the endpoint answered without a results list");
          return bindings;
        }
        const text = (await res.text()).slice(0, 300).replace(/\s+/g, " ");
        detail = `HTTP ${status}: ${text}`;
        if (status === 504 || /timeout|timed out/i.test(text)) throw new QueryTimeout(detail);
        if (status !== 429 && status < 500) throw new Error(`Wikidata query failed (${detail})`);
        retryAfterMs = Number(res.headers.get("retry-after")) * 1000 || 0;
      } catch (error) {
        if (error instanceof QueryTimeout || (status !== 0 && status !== 429 && status < 500)) throw error;
        if (status === 0 && error instanceof DOMException && error.name === "TimeoutError") {
          throw new QueryTimeout("no answer within the request timeout");
        }
        if (status === 0 && !(error instanceof TypeError)) throw error; // not a network error: a bug
      }
      if (n >= MAX_ATTEMPTS) throw new Error(`Wikidata query failed after ${n} attempts (${detail})`);
      stats.retries++;
      const wait = Math.min(Math.max(retryAfterMs, 5_000 * 2 ** (n - 1)), MAX_WAIT_MS) + Math.random() * 500;
      if (status === 429) pausedUntil = Math.max(pausedUntil, Date.now() + wait);
      else await sleep(wait);
    }
  }

  return { endpoint, stats, query: (sparql) => limited(() => attempt(sparql)) };
}
