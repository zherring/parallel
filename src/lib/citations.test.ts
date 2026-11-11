import { describe, expect, it } from "vitest";
import { splitCitations } from "@/lib/citations";

describe("splitCitations", () => {
  it("cuts the text at each marker: text, citation, text", () => {
    expect(splitCitations("On his shoulder.[1] Then Dunkirk,[2] and more.", 2)).toEqual([
      { kind: "text", text: "On his shoulder." },
      { kind: "citation", n: 1 },
      { kind: "text", text: " Then Dunkirk," },
      { kind: "citation", n: 2 },
      { kind: "text", text: " and more." },
    ]);
  });

  it("makes adjacent markers two citations with nothing between them", () => {
    expect(splitCitations("Both agree.[1][2] Next.", 2)).toEqual([
      { kind: "text", text: "Both agree." },
      { kind: "citation", n: 1 },
      { kind: "citation", n: 2 },
      { kind: "text", text: " Next." },
    ]);
  });

  it("keeps a marker before punctuation where it stands: the text after it starts with the punctuation", () => {
    expect(splitCitations("A film[1], and another[2].", 2)).toEqual([
      { kind: "text", text: "A film" },
      { kind: "citation", n: 1 },
      { kind: "text", text: ", and another" },
      { kind: "citation", n: 2 },
      { kind: "text", text: "." },
    ]);
  });

  it("is a marker at the very start or end of the text, with no empty text beside it", () => {
    expect(splitCitations("[1]Start and end[2]", 2)).toEqual([
      { kind: "citation", n: 1 },
      { kind: "text", text: "Start and end" },
      { kind: "citation", n: 2 },
    ]);
  });

  it("is one text segment when there is no marker, and none for no text", () => {
    expect(splitCitations("No sources here.", 3)).toEqual([{ kind: "text", text: "No sources here." }]);
    expect(splitCitations("", 3)).toEqual([]);
  });

  it("leaves a marker that points at no source in the text as words: out of range, zero, or with no sources at all", () => {
    expect(splitCitations("Real[1] and stray[4] and zero[0].", 2)).toEqual([
      { kind: "text", text: "Real" },
      { kind: "citation", n: 1 },
      { kind: "text", text: " and stray[4] and zero[0]." },
    ]);
    expect(splitCitations("Only[1] words.", 0)).toEqual([{ kind: "text", text: "Only[1] words." }]);
  });

  it("does not take other brackets for citations", () => {
    expect(splitCitations("A [note] and [1a] and [ 1 ].", 3)).toEqual([{ kind: "text", text: "A [note] and [1a] and [ 1 ]." }]);
  });

  it("loses nothing: the segments read back as the text when every marker is kept as written", () => {
    const text = "Dead Ringers.[1] Early films,[2][3] and more.";
    const joined = splitCitations(text, 3)
      .map((part) => (part.kind === "text" ? part.text : `[${part.n}]`))
      .join("");
    expect(joined).toBe(text);
  });
});
