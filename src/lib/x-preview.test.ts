import { describe, expect, it } from "vitest";
import { X_PREVIEW_PRESETS, onOrigin, parseMetaTags, previewMeta, previewProblems, previewTarget, withMotion } from "@/lib/x-preview";

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
