// Pure helpers for the Clippings link check (no network or file access); `check-links.ts` does the fetching.

/** What the check says about one quote or link. Only dead and quote-missing fail a --strict run. */
export type CheckStatus = "ok" | "quote-missing" | "dead" | "blocked";

/** What came back from fetching one URL, reduced to what classification needs. */
export interface FetchOutcome {
  /** HTTP status of the final response, or null when there was none (DNS failure, timeout, ...). */
  httpStatus: number | null;
  /** The URL after redirects. */
  finalUrl: string;
  contentType: string;
  /** The body, when it was HTML or text and was read. */
  body: string | null;
  /** A network-level failure: the Node error code (ENOTFOUND, ETIMEDOUT, ...) or its message. */
  error: string | null;
}

export interface Verdict {
  status: CheckStatus;
  detail: string;
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ldquo: "“",
  rdquo: "”",
  lsquo: "‘",
  rsquo: "’",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  shy: "",
  eacute: "é",
  egrave: "è",
  agrave: "à",
  aacute: "á",
  iacute: "í",
  oacute: "ó",
  uacute: "ú",
  ntilde: "ñ",
  ccedil: "ç",
  uuml: "ü",
  ouml: "ö",
  auml: "ä",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (whole, body: string) => {
    if (body[0] === "#") {
      const code = body[1].toLowerCase() === "x" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[body.toLowerCase()] ?? whole;
  });
}

/** The visible text of an HTML page, roughly: scripts, styles and comments removed, tags turned into spaces, entities decoded. */
export function htmlToText(html: string): string {
  const stripped = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|template|svg)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]*>/g, " ");
  return decodeEntities(stripped);
}

/**
 * Everything textual in the page including script blobs (Next.js data, JSON-LD), for pages that render their
 * article client-side: tags removed, JSON string escapes undone, entities decoded.
 */
export function htmlToLooseText(html: string): string {
  const unescaped = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\\u([0-9a-f]{4})/gi, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\(["'\\/])/g, "$1")
    .replace(/\\[nrt]/g, " ");
  return decodeEntities(unescaped);
}

/**
 * Text reduced to what survives the usual differences between a quote and the page it came from: case,
 * curly or straight quotes and apostrophes, dashes, ellipses, whitespace and any other punctuation all
 * become single spaces, and accents are dropped (a page often spells "Penélope" without one).
 */
export function normalizeForMatch(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Segments shorter than this many words are too generic to prove anything and are not searched for. */
const MIN_SEGMENT_WORDS = 3;

/**
 * The stretches of a quote that must each appear on the page: the quote split at "…", "..." and [editorial
 * brackets] (where the editor, not the page, wrote the words), normalized. A quote with no stretch long enough
 * is searched for whole.
 */
export function quoteSegments(quote: string): string[] {
  const parts = quote
    .split(/…|\.{3}|\[[^\]]*\]/)
    .map(normalizeForMatch)
    .filter(Boolean);
  const long = parts.filter((p) => p.split(" ").length >= MIN_SEGMENT_WORDS);
  if (long.length > 0) return long;
  const whole = normalizeForMatch(quote.replace(/…|\.{3}|\[[^\]]*\]/g, " "));
  return whole ? [whole] : [];
}

/** True when `seg` is in `page`, even if the page breaks words with stray spaces ("fre quently", as in OCR'd or badly hyphenated text). */
function pageHas(page: string, pageCompact: string, seg: string): boolean {
  return page.includes(seg) || pageCompact.includes(seg.replaceAll(" ", ""));
}

/** The segments of `quote` not found in `pageTexts` (any one of which may hold it); empty means the quote is still there. */
export function missingSegments(quote: string, pageTexts: readonly string[]): string[] {
  const pages = pageTexts.map(normalizeForMatch).map((page) => ({ page, compact: page.replaceAll(" ", "") }));
  return quoteSegments(quote).filter((seg) => !pages.some(({ page, compact }) => pageHas(page, compact, seg)));
}

/**
 * How much of the quote is on the page, 0 to 1: the share of its words that sit in runs of at least three words
 * the page also has, in order. A quote that dropped an inline attribution ("he said") scores high; one that has
 * been rewritten or removed scores low. Only a hint for whoever reads the report.
 */
export function quoteCoverage(quote: string, pageText: string): number {
  const page = normalizeForMatch(pageText);
  const words = normalizeForMatch(quote.replace(/…|\.{3}|\[[^\]]*\]/g, " ")).split(" ").filter(Boolean);
  if (words.length === 0) return 0;
  let covered = 0;
  let i = 0;
  while (i < words.length) {
    // Longest run starting at i that the page has (a prefix of a found run is found too, so this can bisect).
    let lo = 0;
    let hi = words.length - i;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (page.includes(words.slice(i, i + mid).join(" "))) lo = mid;
      else hi = mid - 1;
    }
    if (lo >= MIN_SEGMENT_WORDS) {
      covered += lo;
      i += lo;
    } else {
      i++;
    }
  }
  return covered / words.length;
}

/**
 * Page bytes as text. The charset comes from the Content-Type header or a <meta> tag; a page that declares none and is not
 * valid UTF-8 is read as windows-1252 (old sites often are), so accents survive and a quote with one still matches.
 */
export function decodeBody(bytes: Uint8Array, contentType: string): string {
  const fromHeader = /charset\s*=\s*["']?([\w-]+)/i.exec(contentType)?.[1];
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 4096));
  const fromMeta = /<meta[^>]+charset\s*=\s*["']?([\w-]+)/i.exec(head)?.[1];
  const declared = fromHeader ?? fromMeta;
  if (declared) {
    try {
      return new TextDecoder(declared).decode(bytes);
    } catch {
      // An unknown label: fall through to guessing.
    }
  }
  const utf8 = new TextDecoder("utf-8").decode(bytes);
  return utf8.includes("\ufffd") ? new TextDecoder("windows-1252").decode(bytes) : utf8;
}

const BOT_WALL = [
  /just a moment\.\.\./i,
  /cf-chl|challenge-platform|cf-browser-verification/i,
  /attention required!? \|? ?cloudflare/i,
  /enable javascript and cookies to continue/i,
  /verify you are (a )?human|are you a robot|press (&amp; )?hold to confirm/i,
  /px-captcha|g-recaptcha|h-captcha|data-sitekey/i,
  /pardon our interruption|request unsuccessful\. incapsula/i,
  /<title>\s*access denied/i,
  /<title>\s*(403|forbidden)\b/i,
];

/** A challenge page has next to no visible text; an article that merely embeds a captcha form has plenty. */
const BOT_WALL_MAX_TEXT = 4000;

/** True when the HTML looks like a bot challenge or access-denied page rather than the article. */
export function looksLikeBotWall(html: string): boolean {
  return BOT_WALL.some((re) => re.test(html)) && htmlToText(html).trim().length < BOT_WALL_MAX_TEXT;
}

/** True when the page's <title> says the page does not exist, whatever the HTTP status said. */
export function looksLikeSoftNotFound(html: string): boolean {
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  if (!title) return false;
  return /\b(404|page not found|not found|no longer available|does(?:n['’]t| not) exist|page unavailable)\b/i.test(decodeEntities(title));
}

/** True when a redirect sent a deep link to the site's front page, which is how many sites say "gone". */
export function redirectedToHomepage(originalUrl: string, finalUrl: string): boolean {
  try {
    const from = new URL(originalUrl);
    const to = new URL(finalUrl);
    const depth = (u: URL) => u.pathname.split("/").filter(Boolean).length;
    return depth(from) >= 1 && depth(to) === 0 && from.hostname.replace(/^www\./, "") === to.hostname.replace(/^www\./, "");
  } catch {
    return false;
  }
}

const DEAD_CODES = new Set(["ENOTFOUND"]);

/**
 * What the fetch alone says, before any quote is looked for: dead (404, 410, DNS failure, a redirect to the
 * front page, a "not found" title), blocked (401/403/429, other errors, a bot wall, a non-HTML file the
 * check cannot read), or `null` when there is a readable page to look in.
 */
export function classifyFetch(url: string, f: FetchOutcome): Verdict | null {
  if (f.error) {
    const dns = DEAD_CODES.has(f.error);
    return { status: dns ? "dead" : "blocked", detail: dns ? "DNS lookup failed" : `network error: ${f.error}` };
  }
  const code = f.httpStatus ?? 0;
  if (code === 404 || code === 410) return { status: "dead", detail: `HTTP ${code}` };
  if (code === 401 || code === 403 || code === 429) return { status: "blocked", detail: `HTTP ${code}` };
  if (code >= 400) return { status: "blocked", detail: `HTTP ${code}` };
  if (f.body === null) return { status: "blocked", detail: `not HTML (${f.contentType || "unknown type"}), text not checked` };
  if (redirectedToHomepage(url, f.finalUrl)) return { status: "dead", detail: `redirected to the front page (${f.finalUrl})` };
  return null;
}

/** The verdict for a quote, given a readable page: ok, or quote-missing (dead / blocked when the page itself is not the article). */
export function classifyQuote(quote: string, body: string): Verdict {
  const missing = missingSegments(quote, [htmlToText(body)]);
  if (missing.length === 0) return { status: "ok", detail: "quote found" };
  if (missingSegments(quote, [htmlToLooseText(body)]).length === 0) return { status: "ok", detail: "quote found in the page's embedded data" };
  if (looksLikeBotWall(body)) return { status: "blocked", detail: "bot wall or access-denied page" };
  if (looksLikeSoftNotFound(body)) return { status: "dead", detail: "page says it was not found" };
  const share = Math.round(quoteCoverage(quote, htmlToText(body)) * 100);
  const hint = share === 100 ? "all its words are on the page, split by others (a dropped attribution? add … or [..])" : `${share}% of its words are on the page`;
  const more = missing.length > 1 ? ` (+${missing.length - 1} more)` : "";
  return { status: "quote-missing", detail: `not found as written: "${missing[0].slice(0, 80)}"${more}; ${hint}` };
}

/** The verdict for a link with no quote to look for. */
export function classifyLink(body: string): Verdict {
  if (looksLikeBotWall(body)) return { status: "blocked", detail: "bot wall or access-denied page" };
  if (looksLikeSoftNotFound(body)) return { status: "dead", detail: "page says it was not found" };
  return { status: "ok", detail: "reachable" };
}
