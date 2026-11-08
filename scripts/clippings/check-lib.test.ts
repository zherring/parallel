import { describe, expect, it } from "vitest";
import {
  classifyFetch,
  classifyLink,
  classifyQuote,
  decodeEntities,
  htmlToText,
  looksLikeBotWall,
  missingSegments,
  decodeBody,
  normalizeForMatch,
  quoteCoverage,
  quoteSegments,
  redirectedToHomepage,
  type FetchOutcome,
} from "./check-lib";

const page = (body: string, over: Partial<FetchOutcome> = {}): FetchOutcome => ({
  httpStatus: 200,
  finalUrl: "https://example.com/a/b",
  contentType: "text/html",
  body,
  error: null,
  ...over,
});

describe("normalizeForMatch", () => {
  it("ignores case, quote style, dashes, ellipses and whitespace", () => {
    expect(normalizeForMatch("He said “Don’t — go…”\n  now")).toBe(normalizeForMatch('he said "Don\'t -- go..." now'));
  });
});

describe("decodeEntities / htmlToText", () => {
  it("decodes named, decimal and hex entities and leaves unknown ones", () => {
    expect(decodeEntities("a&nbsp;&amp;&nbsp;b &#8217; &#x2014; &bogus;")).toBe("a & b ’ — &bogus;");
  });
  it("drops scripts, styles and comments and turns tags into spaces", () => {
    const text = htmlToText("<style>p{}</style><script>var x='hidden'</script><!-- no --><p>Hello <em>there</em>, world</p>");
    expect(normalizeForMatch(text)).toBe("hello there world");
  });
});

describe("quoteSegments / missingSegments", () => {
  it("splits at ellipses and editorial brackets, skipping stretches too short to prove anything", () => {
    expect(quoteSegments("We cut it down to the essentials … and then the music came in [as he put it] at last")).toEqual([
      "we cut it down to the essentials",
      "and then the music came in",
    ]);
  });
  it("searches a short quote whole rather than skipping it", () => {
    expect(quoteSegments("Yes, absolutely")).toEqual(["yes absolutely"]);
  });
  it("finds a quote whose punctuation and quote marks differ from the page", () => {
    const text = htmlToText('<p>He asked, &ldquo;Will you join me?&rdquo; &mdash; and I said yes.</p>');
    expect(missingSegments("He asked, ‘Will you join me?’ - and I said yes.", [text])).toEqual([]);
  });
  it("requires every segment of an ellipsized quote", () => {
    const text = htmlToText("<p>The first part is here. Something else entirely. The last part is here too.</p>");
    expect(missingSegments("The first part is here … the last part is here too.", [text])).toEqual([]);
    expect(missingSegments("The first part is here … a part that is gone.", [text])).toEqual(["a part that is gone"]);
  });
});

describe("quoteCoverage / compact matching / decodeBody", () => {
  it("scores a quote that dropped an inline attribution as fully covered but still missing", () => {
    const html = "<p>John is much more of a chameleon as a composer, Spielberg said by phone. He reinvents himself with every picture.</p>";
    const quote = "John is much more of a chameleon as a composer. He reinvents himself with every picture.";
    expect(quoteCoverage(quote, htmlToText(html))).toBe(1);
    const verdict = classifyQuote(quote, html);
    expect(verdict.status).toBe("quote-missing");
    expect(verdict.detail).toContain("a dropped attribution?");
  });
  it("scores a rewritten quote low", () => {
    expect(quoteCoverage("Something quite different from anything on this page at all", "<p>Nothing to see here.</p>")).toBeLessThan(0.3);
  });
  it("matches across stray spaces in the page's own words", () => {
    expect(missingSegments("everything is scrapped and we start again", [htmlToText("<p>everything is scrapped and we start a gain</p>")])).toEqual([]);
  });
  it("ignores accents on either side", () => {
    expect(missingSegments("Penélope has done ballet when she was younger", [htmlToText("<p>Penelope has done ballet when she was younger</p>")])).toEqual([]);
  });
  it("decodes UTF-8, a declared charset, and undeclared windows-1252", () => {
    const utf8 = new TextEncoder().encode("<p>Almodóvar</p>");
    expect(decodeBody(utf8, "text/html")).toContain("Almodóvar");
    const latin1 = Uint8Array.from([...new TextEncoder().encode("<p>Almod"), 0xf3, ...new TextEncoder().encode("var</p>")]);
    expect(decodeBody(latin1, "text/html; charset=iso-8859-1")).toContain("Almodóvar");
    expect(decodeBody(latin1, "text/html")).toContain("Almodóvar");
    expect(decodeBody(Uint8Array.from([...new TextEncoder().encode('<meta charset="windows-1252"><p>Almod'), 0xf3, 0x76, 0x61, 0x72]), "text/html")).toContain("Almodóvar");
  });
});

describe("classifyFetch", () => {
  const url = "https://example.com/a/b";
  it("calls 404, 410 and DNS failures dead", () => {
    expect(classifyFetch(url, page("", { httpStatus: 404, body: null }))?.status).toBe("dead");
    expect(classifyFetch(url, page("", { httpStatus: 410, body: null }))?.status).toBe("dead");
    expect(classifyFetch(url, page("", { httpStatus: null, error: "ENOTFOUND", body: null }))?.status).toBe("dead");
  });
  it("calls 401, 403, 429, 5xx, timeouts and non-HTML blocked", () => {
    for (const httpStatus of [401, 403, 429, 503]) {
      expect(classifyFetch(url, page("", { httpStatus, body: null }))?.status).toBe("blocked");
    }
    expect(classifyFetch(url, page("", { httpStatus: null, error: "timeout after 15s", body: null }))?.status).toBe("blocked");
    expect(classifyFetch(url, page("", { contentType: "application/pdf", body: null }))?.status).toBe("blocked");
  });
  it("calls a deep link redirected to the front page dead, and a readable page undecided", () => {
    expect(classifyFetch(url, page("<p>x</p>", { finalUrl: "https://example.com/" }))?.status).toBe("dead");
    expect(classifyFetch(url, page("<p>x</p>"))).toBeNull();
  });
});

describe("classifyQuote / classifyLink", () => {
  const article = "<html><title>Interview</title><body><p>" + "Filler sentence about nothing. ".repeat(10) + "John is much more of a chameleon as a composer.</p></body></html>";
  it("is ok when the quote is on the page", () => {
    expect(classifyQuote("John is much more of a chameleon as a composer.", article).status).toBe("ok");
  });
  it("is quote-missing when it is not, naming what is missing", () => {
    const verdict = classifyQuote("He reinvents himself with every picture in a way nobody else does.", article);
    expect(verdict.status).toBe("quote-missing");
    expect(verdict.detail).toContain("he reinvents himself");
  });
  it("finds a quote that only exists in an embedded JSON blob", () => {
    const html = '<script id="__NEXT_DATA__">{"body":"John is much more of a chameleon as a composer, said Spielberg"}</script>';
    expect(classifyQuote("John is much more of a chameleon as a composer.", html).status).toBe("ok");
  });
  it("blames a bot wall or a not-found page rather than the quote", () => {
    const wall = "<html><title>Just a moment...</title><body>Enable JavaScript and cookies to continue</body></html>";
    expect(classifyQuote("A line that is not here at all, sorry.", wall).status).toBe("blocked");
    expect(classifyQuote("A line that is not here at all, sorry.", "<title>Page Not Found</title><p>Gone.</p>").status).toBe("dead");
  });
  it("treats a link with a readable page as ok, a challenge page as blocked and a not-found title as dead", () => {
    expect(classifyLink(article).status).toBe("ok");
    expect(classifyLink("<title>Just a moment...</title>").status).toBe("blocked");
    expect(classifyLink("<title>404 - Not Found</title>").status).toBe("dead");
  });
  it("does not mistake a long article that embeds a captcha form for a bot wall", () => {
    const long = `<p>${"word ".repeat(2000)}</p><div class="g-recaptcha" data-sitekey="x"></div>`;
    expect(looksLikeBotWall(long)).toBe(false);
  });
});

describe("redirectedToHomepage", () => {
  it("is true only for a deep link that lands on the same site's root", () => {
    expect(redirectedToHomepage("https://example.com/a/b", "https://www.example.com/")).toBe(true);
    expect(redirectedToHomepage("https://example.com/a/b", "https://example.com/a/c")).toBe(false);
    expect(redirectedToHomepage("https://example.com/", "https://example.com/")).toBe(false);
    expect(redirectedToHomepage("https://example.com/a", "https://other.com/")).toBe(false);
  });
});
