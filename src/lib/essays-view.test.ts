import { describe, expect, it } from "vitest";
import { essayByline, essayKindLabel, essayYear } from "@/lib/essays-view";

describe("essayKindLabel", () => {
  it("capitalises the kind as the data writes it", () => {
    expect(essayKindLabel("book chapter")).toBe("Book chapter");
    expect(essayKindLabel("academic")).toBe("Academic");
    expect(essayKindLabel("video essay")).toBe("Video essay");
  });

  it("copes with a kind it does not know", () => {
    expect(essayKindLabel(" podcast ")).toBe("Podcast");
    expect(essayKindLabel("")).toBe("");
  });
});

describe("essayYear", () => {
  it("reads the year of a year, a month or a day", () => {
    expect(essayYear({ date: "2013" })).toBe(2013);
    expect(essayYear({ date: "2017-01" })).toBe(2017);
    expect(essayYear({ date: "2024-02-10" })).toBe(2024);
  });

  it("is null for a date that is none of those", () => {
    expect(essayYear({ date: "" })).toBeNull();
    expect(essayYear({ date: "January 2017" })).toBeNull();
  });
});

describe("essayByline", () => {
  it("is the author, the publication and the year, the year alone of the date", () => {
    expect(essayByline({ author: "Jack Sullivan", publication: "A Companion", date: "2017-01" })).toEqual([
      "Jack Sullivan",
      "A Companion",
      "2017",
    ]);
  });

  it("leaves out what is missing", () => {
    expect(essayByline({ author: null, publication: "Kirkus Reviews", date: "2025" })).toEqual(["Kirkus Reviews", "2025"]);
    expect(essayByline({ author: "A. Writer", publication: "Prospect", date: "" })).toEqual(["A. Writer", "Prospect"]);
    expect(essayByline({ author: "  ", publication: "Prospect", date: "n.d." })).toEqual(["Prospect"]);
  });
});
