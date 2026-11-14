import { describe, expect, it } from "vitest";
import { X_PREVIEW_PRESETS, isLoopbackHost, onOrigin, parseMetaTags, previewFetchOrigin, previewMeta, previewProblems, previewTarget, withMotion } from "@/lib/x-preview";

describe("previewTarget", () => {
  it("takes a /p/ path, a URL of one, or the people as the address writes them", () => {
    expect(previewTarget("/p/488-steven-spielberg+491-john-williams")).toBe("/p/488-steven-spielberg+491-john-williams");
    expect(previewTarget("https://parallel.zachherring.com/p/488+491?view=table")).toBe("/p/488+491?view=table");
    expect(previewTarget("488+491")).toBe("/p/488+491");
    expect(previewTarget("488 491")).toBe("/p/488+491");
    expect(previewTarget("/p/488+491/q/john-is-much-more-of-a")).toBe("/p/488+491/q/john-is-much-more-of-a");
  });

  it("is null for anything that is not a pair or a quote (no other path of this server is fetched)", () => {
    for (const input of ["", "   ", null, undefined, "/api/search?q=a", "/embed/p/488+491", "//evil.example/p/1+2", "https://evil.example/", "javascript:alert(1)", "/p/", "488;+491"]) {
      expect(previewTarget(input), String(input)).toBeNull();
    }
  });

  it("accepts every preset", () => {
    for (const preset of X_PREVIEW_PRESETS) expect(previewTarget(preset.target)).toBe(preset.target);
  });
});

const HTML = `<head>
<meta name="twitter:card" content="player"/>
<meta name="twitter:player" content="https://parallel.zachherring.com/embed/p/488-steven-spielberg+491-john-williams"/>
<meta name="twitter:player:width" content="1200"/><meta name="twitter:player:height" content="630"/>
<meta name="twitter:title" content="Spielberg &amp; Williams: films made together"/>
<meta name="twitter:image" content="https://parallel.zachherring.com/p/488-steven-spielberg%2B491-john-williams/opengraph-image?abc"/>
<meta property="og:title" content="It&#x27;s &quot;them&quot;"/>
<meta name="description" content="not a social tag"/>
</head>`;

describe("parseMetaTags and previewMeta", () => {
  it("reads the twitter and og tags, decoded, in order, and no others", () => {
    const tags = parseMetaTags(HTML);
    expect(tags.map((tag) => tag.name)).toEqual(["twitter:card", "twitter:player", "twitter:player:width", "twitter:player:height", "twitter:title", "twitter:image", "og:title"]);
    expect(tags.find((tag) => tag.name === "twitter:title")?.content).toBe("Spielberg & Williams: films made together");
    expect(tags.find((tag) => tag.name === "og:title")?.content).toBe('It\'s "them"');
  });

  it("names the frame, its size and the picture", () => {
    const meta = previewMeta(parseMetaTags(HTML));
    expect(meta).toMatchObject({ card: "player", playerWidth: 1200, playerHeight: 630, image: "https://parallel.zachherring.com/p/488-steven-spielberg%2B491-john-williams/opengraph-image?abc" });
    expect(meta.player).toBe("https://parallel.zachherring.com/embed/p/488-steven-spielberg+491-john-williams");
    expect(previewProblems(meta)).toEqual([]);
  });

  it("says what is wrong with a page that sends no player", () => {
    const problems = previewProblems(previewMeta(parseMetaTags('<meta name="twitter:card" content="summary_large_image"/>')));
    expect(problems.join(" ")).toMatch(/not "player"/);
    expect(problems.join(" ")).toMatch(/twitter:player is missing/);
    expect(problems.join(" ")).toMatch(/twitter:image is missing/);
  });
});

describe("character references that name no character", () => {
  it("are left as written, and the ones that do are decoded (String.fromCodePoint throws outside 0 to 0x10ffff)", () => {
    const html = '<meta name="twitter:title" content="a &#x110000; b &#999999999; c &#x1F600; d &#65; e &#x41;"/>';
    expect(() => parseMetaTags(html)).not.toThrow();
    expect(parseMetaTags(html)[0].content).toBe("a &#x110000; b &#999999999; c \u{1F600} d A e A");
    // The edges of the range: the last code point is one, the one after it is not.
    expect(parseMetaTags('<meta name="og:title" content="&#x10ffff;"/>')[0].content).toBe("\u{10FFFF}");
    expect(parseMetaTags('<meta name="og:title" content="&#x110000;"/>')[0].content).toBe("&#x110000;");
  });
});

describe("isLoopbackHost and previewFetchOrigin", () => {
  it("knows this machine by 127.0.0.1, localhost or ::1, on any port", () => {
    for (const host of ["127.0.0.1", "127.0.0.1:3000", "127.0.0.1:3110", "localhost", "localhost:3102", "LOCALHOST:8080", "[::1]", "[::1]:3000", "::1"]) {
      expect(isLoopbackHost(host), host).toBe(true);
    }
  });

  it("is false for any other host, however much it looks like this one, and for none", () => {
    for (const host of ["evil.example", "evil.example:3000", "127.0.0.1.evil.example", "localhost.evil.example", "evil.example/127.0.0.1", "127.0.0.1@evil.example", "evil@127.0.0.1", "127.0.0.2", "10.0.0.5:3000", "0.0.0.0", "192.168.1.20:3000", "[::2]", "::1:3000", "127.0.0.1:", "127.0.0.1:99999999", "", " ", null, undefined]) {
      expect(isLoopbackHost(host), String(host)).toBe(false);
    }
  });

  it("is the request's own origin where its host is this machine", () => {
    expect(previewFetchOrigin("127.0.0.1:3110", null, undefined)).toBe("http://127.0.0.1:3110");
    expect(previewFetchOrigin("localhost:3000", "http", "4000")).toBe("http://localhost:3000");
    expect(previewFetchOrigin("[::1]:3000", null, undefined)).toBe("http://[::1]:3000");
    expect(previewFetchOrigin("::1", null, undefined)).toBe("http://[::1]");
    expect(previewFetchOrigin("localhost:3000", "https", undefined)).toBe("https://localhost:3000");
  });

  it("takes only http or https as the scheme, and https only from a loopback host", () => {
    expect(previewFetchOrigin("127.0.0.1:3000", "file", undefined)).toBe("http://127.0.0.1:3000");
    expect(previewFetchOrigin("127.0.0.1:3000", "http://evil.example/#", undefined)).toBe("http://127.0.0.1:3000");
    expect(previewFetchOrigin("evil.example", "https", undefined)).toBe("http://127.0.0.1:3000");
  });

  it("is this machine's own address on the server's port for any other host, never the host that was sent", () => {
    expect(previewFetchOrigin("evil.example", null, undefined)).toBe("http://127.0.0.1:3000");
    expect(previewFetchOrigin("evil.example:80", "https", "3456")).toBe("http://127.0.0.1:3456");
    expect(previewFetchOrigin("127.0.0.1.evil.example", null, "3456")).toBe("http://127.0.0.1:3456");
    expect(previewFetchOrigin(null, null, undefined)).toBe("http://127.0.0.1:3000");
    // A PORT that is not a port is not put in a URL.
    expect(previewFetchOrigin("evil.example", null, "3000/evil")).toBe("http://127.0.0.1:3000");
    expect(previewFetchOrigin("evil.example", null, "")).toBe("http://127.0.0.1:3000");
  });
});

describe("onOrigin and withMotion", () => {
  it("moves a URL to the preview's own origin and keeps its path as it is (a + in the people stays one)", () => {
    expect(onOrigin("https://parallel.zachherring.com/embed/p/1+2", "http://127.0.0.1:3110")).toBe("http://127.0.0.1:3110/embed/p/1+2");
    expect(onOrigin("https://parallel.zachherring.com/p/a%2Bb/opengraph-image?h", "http://127.0.0.1:3110")).toBe("http://127.0.0.1:3110/p/a%2Bb/opengraph-image?h");
    expect(onOrigin(null, "http://127.0.0.1:3110")).toBeNull();
  });

  it("adds ?motion=reduce, or & to a query, only when asked for", () => {
    expect(withMotion("/embed/p/1+2", false)).toBe("/embed/p/1+2");
    expect(withMotion("/embed/p/1+2", true)).toBe("/embed/p/1+2?motion=reduce");
    expect(withMotion("/embed/p/1+2?x=1", true)).toBe("/embed/p/1+2?x=1&motion=reduce");
  });
});
