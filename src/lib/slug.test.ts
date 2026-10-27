import { describe, expect, it } from "vitest";
import { buildPeopleSlug, parsePeopleSlug, slugify } from "@/lib/slug";

describe("slugify", () => {
  it("lowercases, strips diacritics and collapses punctuation", () => {
    expect(slugify("Penélope Cruz")).toBe("penelope-cruz");
    expect(slugify("  Jean-Luc  Godard! ")).toBe("jean-luc-godard");
    expect(slugify("Lupita Nyong'o")).toBe("lupita-nyong-o");
  });

  it("returns an empty string when nothing alphanumeric remains", () => {
    expect(slugify("宮崎駿")).toBe("");
  });
});

describe("buildPeopleSlug", () => {
  it("joins id-name pairs with +", () => {
    expect(
      buildPeopleSlug([
        { id: 7467, name: "David Fincher" },
        { id: 1234, name: "Jeff Cronenweth" },
      ]),
    ).toBe("7467-david-fincher+1234-jeff-cronenweth");
  });

  it("handles diacritics and names with no latin letters", () => {
    expect(buildPeopleSlug([{ id: 955, name: "Penélope Cruz" }])).toBe("955-penelope-cruz");
    expect(buildPeopleSlug([{ id: 5714, name: "宮崎駿" }])).toBe("5714");
  });
});

describe("parsePeopleSlug", () => {
  it("parses a canonical slug", () => {
    expect(parsePeopleSlug("7467-david-fincher+1234-jeff-cronenweth")).toEqual({ ids: [7467, 1234] });
  });

  it("accepts bare ids", () => {
    expect(parsePeopleSlug("7467")).toEqual({ ids: [7467] });
    expect(parsePeopleSlug("7467+1234")?.ids).toEqual([7467, 1234]);
  });

  it("tolerates an encoded + separator", () => {
    expect(parsePeopleSlug("7467-david-fincher%2B1234-jeff")).toEqual({ ids: [7467, 1234] });
    expect(parsePeopleSlug("7467%2b1234")?.ids).toEqual([7467, 1234]);
  });

  it("decodes percent-encoded text and rejects malformed encoding", () => {
    expect(parsePeopleSlug("955-pen%C3%A9lope")).toEqual({ ids: [955] });
    expect(parsePeopleSlug("955-%E0%A4%A")).toBeNull();
  });

  it("dedupes ids, keeping the first segment, and reports the slug without duplicates", () => {
    expect(parsePeopleSlug("7467-a+1234-b+7467-c")).toEqual({
      ids: [7467, 1234],
      canonical: "7467-a+1234-b",
    });
    expect(parsePeopleSlug("7467-a%2B1234-b%2B7467-c")?.canonical).toBe("7467-a+1234-b");
  });

  it("allows up to four people and rejects more", () => {
    expect(parsePeopleSlug("1+2+3+4")?.ids).toEqual([1, 2, 3, 4]);
    expect(parsePeopleSlug("1+2+3+4+5")).toBeNull();
    expect(parsePeopleSlug("1+2+3+4+4")?.ids).toEqual([1, 2, 3, 4]);
  });

  it.each(["", "abc", "0", "-5", "007", "12abc", "1+", "+1", "1++2", "1+x", "99999999999", "1-a b+%", "1.5"])(
    "rejects %j",
    (slug) => {
      expect(parsePeopleSlug(slug)).toBeNull();
    },
  );
});
