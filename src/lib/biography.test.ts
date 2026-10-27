import { describe, expect, it } from "vitest";
import {
  MAX_BIOGRAPHY_CHARS,
  bioSnippet,
  capBiography,
  formatLifeDate,
  lifeLine,
  normalizeBiography,
  splitParagraphs,
} from "@/lib/biography";

describe("normalizeBiography", () => {
  it("returns null for missing, empty and whitespace-only text", () => {
    expect(normalizeBiography(undefined)).toBeNull();
    expect(normalizeBiography(null)).toBeNull();
    expect(normalizeBiography("")).toBeNull();
    expect(normalizeBiography(" \r\n \t\n ")).toBeNull();
  });

  it("trims and normalizes line endings", () => {
    expect(normalizeBiography("  First.\r\n\r\nSecond.\rThird.  \r\n")).toBe("First.\n\nSecond.\nThird.");
  });

  it("collapses runs of blank lines and horizontal whitespace", () => {
    expect(normalizeBiography("One    two.\n \n\n\n  \nThree.")).toBe("One two.\n\nThree.");
  });

  it("keeps short text as is", () => {
    expect(normalizeBiography("Born in Denver.")).toBe("Born in Denver.");
  });

  it("caps long text", () => {
    const text = normalizeBiography("Word ".repeat(2000));
    expect(text).not.toBeNull();
    expect(text!.length).toBeLessThanOrEqual(MAX_BIOGRAPHY_CHARS);
    expect(text!.endsWith("…")).toBe(true);
  });
});

describe("capBiography", () => {
  it("leaves text within the limit untouched", () => {
    expect(capBiography("Short.", 100)).toBe("Short.");
    expect(capBiography("x".repeat(100), 100)).toBe("x".repeat(100));
  });

  it("cuts at the last paragraph break when that keeps at least half", () => {
    const text = `${"a".repeat(60)}.\n\n${"b".repeat(30)}.\n\n${"c".repeat(60)}.`;
    expect(capBiography(text, 110)).toBe(`${"a".repeat(60)}.\n\n${"b".repeat(30)}. …`);
  });

  it("falls back to a sentence boundary when the paragraph break is too early", () => {
    const text =
      "Intro.\n\nThis is the first sentence of a long paragraph. This is the second sentence of it. And the third goes on past the limit of the cap.";
    const capped = capBiography(text, 100);
    expect(capped).toBe("Intro.\n\nThis is the first sentence of a long paragraph. This is the second sentence of it. …");
    expect(capped.length).toBeLessThanOrEqual(100);
  });

  it("falls back to a word boundary with no sentence end, never cutting mid-word", () => {
    const text = "alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigma";
    const capped = capBiography(text, 40);
    expect(capped.endsWith("…")).toBe(true);
    expect(capped.length).toBeLessThanOrEqual(40);
    const words = capped.slice(0, -1).split(" ");
    for (const word of words) expect(text.split(" ")).toContain(word);
  });

  it("hard-cuts a single unbroken token as a last resort", () => {
    expect(capBiography("x".repeat(200), 50)).toBe(`${"x".repeat(48)}…`);
  });

  it("does not treat abbreviations as sentence ends when cutting", () => {
    const text = "He worked with Dr. Smith and J. R. R. Tolkien on many things over many years of work together. ".repeat(3);
    const capped = capBiography(text, 120);
    expect(capped).not.toMatch(/\b(Dr|J|R)\. …$/);
    expect(capped.length).toBeLessThanOrEqual(120);
  });
});

describe("bioSnippet", () => {
  const bio =
    "David Andrew Leo Fincher (born August 28, 1962) is an American film director. He is known for his dark, stylish thrillers, including Seven and Fight Club, and for his work on television.";

  it("returns short text whole", () => {
    expect(bioSnippet("A short bio.", 150)).toBe("A short bio.");
  });

  it("flattens whitespace and paragraph breaks", () => {
    expect(bioSnippet("One line.\n\nNext   paragraph.", 150)).toBe("One line. Next paragraph.");
  });

  it("keeps whole sentences up to the limit, without an ellipsis", () => {
    expect(bioSnippet(bio, 150)).toBe("David Andrew Leo Fincher (born August 28, 1962) is an American film director.");
    expect(bioSnippet(bio, 200)).toBe(bio);
  });

  it("does not split on abbreviations, initials or dates", () => {
    const text =
      "Dr. J. R. R. Tolkien was born Jan. 3, 1892, in Bloemfontein, and wrote The Hobbit. He then taught at Oxford for many years.";
    expect(bioSnippet(text, 100)).toBe("Dr. J. R. R. Tolkien was born Jan. 3, 1892, in Bloemfontein, and wrote The Hobbit.");
  });

  it("cuts a long first sentence at a word and adds an ellipsis", () => {
    const long =
      "Toshiro Mifune was a Japanese actor who appeared in almost 170 feature films over a career that lasted more than half a century, most famously with Akira Kurosawa";
    const snippet = bioSnippet(long, 100);
    expect(snippet.endsWith("…")).toBe(true);
    expect(snippet.length).toBeLessThanOrEqual(100);
    expect(long.startsWith(snippet.slice(0, -1))).toBe(true);
    // Whole words only: the text after the cut starts at a word boundary.
    expect(long.charAt(snippet.length - 1)).toBe(" ");
  });

  it("drops trailing punctuation before the ellipsis", () => {
    const text = "Alpha beta gamma, delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigma tau upsilon";
    expect(bioSnippet(text, 18)).toBe("Alpha beta gamma…");
  });

  it("is empty for empty text", () => {
    expect(bioSnippet("   ", 150)).toBe("");
  });
});

describe("splitParagraphs", () => {
  it("splits on blank lines and drops empties", () => {
    expect(splitParagraphs("One.\n\nTwo.\n  \n\nThree.\n")).toEqual(["One.", "Two.", "Three."]);
  });

  it("joins single line breaks inside a paragraph", () => {
    expect(splitParagraphs("A line\nwrapped here.\n\nNext.")).toEqual(["A line wrapped here.", "Next."]);
  });

  it("returns no paragraphs for blank text", () => {
    expect(splitParagraphs(" \n\n ")).toEqual([]);
  });
});

describe("formatLifeDate and lifeLine", () => {
  it("formats full dates, bare years and junk", () => {
    expect(formatLifeDate("1962-08-28")).toBe("August 28, 1962");
    expect(formatLifeDate("1910-03-01")).toBe("March 1, 1910");
    expect(formatLifeDate("1962")).toBe("1962");
    expect(formatLifeDate("1962-13-01")).toBe("1962");
    expect(formatLifeDate("n/a")).toBeNull();
    expect(formatLifeDate(null)).toBeNull();
  });

  it("builds the born/died line", () => {
    expect(lifeLine({ birthday: "1962-08-28", deathday: null })).toBe("Born August 28, 1962");
    expect(lifeLine({ birthday: "1910-03-23", deathday: "1998-09-06" })).toBe(
      "Born March 23, 1910 · Died September 6, 1998",
    );
    expect(lifeLine({ birthday: null, deathday: "1998-09-06" })).toBe("Died September 6, 1998");
    expect(lifeLine({ birthday: null, deathday: null })).toBe("");
  });
});
