import { describe, expect, it } from "vitest";
import raw from "@/lib/clippings.json";
import type { ClippingsData } from "@/lib/clippings";
import { truncateQuote } from "@/lib/clippings-view";
import {
  ATTRIBUTION_FONT_SIZES,
  ATTRIBUTION_WIDTH,
  QUOTE_CARD_MAX_CHARS,
  QUOTE_FONT_SIZES,
  QUOTE_LINE_HEIGHT,
  QUOTE_TEXT_HEIGHT,
  QUOTE_TEXT_WIDTH,
  attributionFontSize,
  quoteCardType,
  quoteLineCount,
  splitQuoteTail,
} from "@/lib/og-quote";

describe("attributionFontSize", () => {
  it("sets a short credit in the largest size, as the cards of artists always were", () => {
    expect(attributionFontSize("\u2014 Steven Spielberg on John Williams")).toBe(ATTRIBUTION_FONT_SIZES[0]);
    expect(attributionFontSize("\u2014 Alfred Hitchcock on Bernard Herrmann")).toBe(ATTRIBUTION_FONT_SIZES[0]);
    expect(attributionFontSize("\u2014 Neil Sinyard on Hitchcock & Herrmann")).toBe(ATTRIBUTION_FONT_SIZES[0]);
  });

  it("steps down for a longer credit, so that it stays clear of the wordmark", () => {
    expect(attributionFontSize("\u2014 Florence Scott-Anderton on Spielberg & Williams")).toBeLessThan(ATTRIBUTION_FONT_SIZES[0]);
    expect(attributionFontSize("\u2014 K. J. Donnelly and Steven Rawle on Hitchcock & Herrmann")).toBe(22);
  });

  it("never grows with the text, and ends at the smallest size however long it is", () => {
    let last = Infinity;
    for (let n = 1; n <= 120; n += 1) {
      const size = attributionFontSize("x".repeat(n));
      expect(size).toBeLessThanOrEqual(last);
      last = size;
    }
    expect(attributionFontSize("x".repeat(500))).toBe(ATTRIBUTION_FONT_SIZES[ATTRIBUTION_FONT_SIZES.length - 1]);
  });

  it("fits the width it is given at the size it picks, for anything that fits at all", () => {
    for (const text of ["\u2014 A on B", "\u2014 Rebecca Keegan on Spielberg & Williams", "\u2014 Nicolas Magenham on Hitchcock & Herrmann"]) {
      expect(Array.from(text).length * attributionFontSize(text) * 0.55).toBeLessThanOrEqual(ATTRIBUTION_WIDTH);
    }
  });
});

describe("quoteLineCount", () => {
  it("is one line for a few words, and counts nothing but words", () => {
    expect(quoteLineCount("Short.", 64)).toBe(1);
    expect(quoteLineCount("", 64)).toBe(1);
    expect(quoteLineCount("   ", 64)).toBe(1);
  });

  it("takes more lines at a larger size", () => {
    const text = "The quick brown fox jumps over the lazy dog and keeps on running";
    expect(quoteLineCount(text, 72)).toBeGreaterThan(quoteLineCount(text, 37));
  });

  it("breaks between words and never splits one that fits a line", () => {
    // 10 characters a line at width 100 and size 20 (a character is 10px wide): two words of 6 do not share a line.
    expect(quoteLineCount("abcdef ghijkl", 20, 100)).toBe(2);
    expect(quoteLineCount("abcd efgh", 20, 100)).toBe(1);
  });

  it("counts the lines a word longer than a whole line fills", () => {
    // 5 characters a line: a 12-character word fills 3 lines.
    expect(quoteLineCount("abcdefghijkl", 20, 50)).toBe(3);
    expect(quoteLineCount("ab abcdefghijkl", 20, 50)).toBe(4);
  });
});

describe("quoteCardType", () => {
  it("sets a short quote at the largest size", () => {
    expect(quoteCardType("Not great.").fontSize).toBe(QUOTE_FONT_SIZES[0]);
  });

  it("steps down as the quote grows, never up", () => {
    let last = Infinity;
    for (let length = 10; length <= 400; length += 10) {
      const { fontSize } = quoteCardType("lorem ".repeat(Math.ceil(length / 6)).slice(0, length));
      expect(fontSize).toBeLessThanOrEqual(last);
      last = fontSize;
    }
    expect(last).toBe(QUOTE_FONT_SIZES[QUOTE_FONT_SIZES.length - 1]);
  });

  it("falls back to the smallest size for text that fits at none", () => {
    expect(quoteCardType("word ".repeat(500)).fontSize).toBe(QUOTE_FONT_SIZES[QUOTE_FONT_SIZES.length - 1]);
  });

  it("uses one line height throughout", () => {
    expect(quoteCardType("Short.").lineHeight).toBe(QUOTE_LINE_HEIGHT);
    expect(quoteCardType("word ".repeat(60)).lineHeight).toBe(QUOTE_LINE_HEIGHT);
  });

  it("gives every quote of clippings.json a size at which it fits the text column, as cut for the card", () => {
    const data: ClippingsData = raw;
    let count = 0;
    for (const entry of Object.values(data)) {
      for (const clipping of entry.clippings) {
        const text = `${truncateQuote(clipping.quote, QUOTE_CARD_MAX_CHARS)}”`;
        const { fontSize, lineHeight } = quoteCardType(text);
        expect(quoteLineCount(text, fontSize) * fontSize * lineHeight, clipping.id).toBeLessThanOrEqual(QUOTE_TEXT_HEIGHT);
        count += 1;
      }
    }
    expect(count).toBeGreaterThan(30);
  });

  it("keeps the text column inside the card, and the smallest size legible", () => {
    expect(QUOTE_FONT_SIZES[QUOTE_FONT_SIZES.length - 1]).toBeGreaterThanOrEqual(36);
    expect(QUOTE_TEXT_WIDTH).toBeLessThanOrEqual(1200 - 2 * 80);
  });
});

describe("splitQuoteTail", () => {
  it("keeps the last two words together, for the closing mark to sit beside", () => {
    expect(splitQuoteTail("a b c d")).toEqual({ words: ["a", "b"], tail: "c d" });
  });

  it("is all tail for a quote of one or two words", () => {
    expect(splitQuoteTail("Solo")).toEqual({ words: [], tail: "Solo" });
    expect(splitQuoteTail("Two words")).toEqual({ words: [], tail: "Two words" });
  });

  it("folds whitespace, and loses no word", () => {
    const quote = "  Steven   would\nbring me  these\tscenes ";
    const { words, tail } = splitQuoteTail(quote);
    expect([...words, tail].join(" ")).toBe("Steven would bring me these scenes");
  });

  it("always keeps at least one word in the tail", () => {
    expect(splitQuoteTail("a b c", 0).tail).toBe("c");
    expect(splitQuoteTail("", 2)).toEqual({ words: [], tail: "" });
  });
});
