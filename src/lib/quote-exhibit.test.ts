import { describe, expect, it } from "vitest";
import { exhibitSpaceAction, nextExhibitIndex, quoteExhibitAttributedContext, quoteExhibitContextParts, quoteExhibitPeople, quoteExhibitQuoteSearch } from "./quote-exhibit";
import type { PairCritics } from "./critics";

describe("the Quotes deck", () => {
  const critics: PairCritics = {
    people: [{ id: 488, name: "Steven Spielberg" }, { id: 491, name: "John Williams" }],
    critics: [], reading: [],
  };

  it("uses the page's actual portraits and palette order for a pair without artists' quotes", () => {
    const people = quoteExhibitPeople(null, critics, [{ id: 491, profilePath: "/john.jpg" }, { id: 488, profilePath: "/steven.jpg" }]);
    expect(people).toEqual([
      { id: 488, name: "Steven Spielberg", profilePath: "/steven.jpg", slot: 1 },
      { id: 491, name: "John Williams", profilePath: "/john.jpg", slot: 0 },
    ]);
  });

  it("supports reading-only pairs and missing headshots, without inventing a pair", () => {
    expect(quoteExhibitPeople(null, { ...critics, reading: [{ title: "A book", author: null, publication: "Publisher", date: "2020", url: "https://example.com", paywalled: true }] }, [])?.map((person) => person.profilePath)).toEqual([null, null]);
    expect(quoteExhibitPeople(null, null, [])).toBeNull();
  });

  it("keeps display settings when the active quote changes", () => {
    const params = new URLSearchParams(quoteExhibitQuoteSearch("?view=clippings&exhibit=photograph&from=1980&to=2000&quote=old&utm_source=test", "new"));
    expect(Object.fromEntries(params)).toEqual({ view: "clippings", from: "1980", to: "2000", quote: "new", utm_source: "test" });
  });

  it("advances in order and wraps at either end, including one or no quotes", () => {
    expect(nextExhibitIndex(0, 4, 1)).toBe(1);
    expect(nextExhibitIndex(3, 4, 1)).toBe(0);
    expect(nextExhibitIndex(0, 4, -1)).toBe(3);
    expect(nextExhibitIndex(2, 4, -1)).toBe(1);
    expect(nextExhibitIndex(0, 1, 1)).toBe(0);
    expect(nextExhibitIndex(0, 0, -1)).toBe(0);
  });

  it("uses plain Space and Shift+Space, swallowing repeats instead of skipping more quotes", () => {
    expect(exhibitSpaceAction({ key: " " }, false)).toBe("next");
    expect(exhibitSpaceAction({ key: " ", shiftKey: true }, false)).toBe("previous");
    expect(exhibitSpaceAction({ key: " ", repeat: true }, false)).toBe("swallow");
    expect(exhibitSpaceAction({ key: "Enter" }, false)).toBeNull();
  });

  it("leaves controls, typing, dialogs, modified keys and IME composition alone", () => {
    expect(exhibitSpaceAction({ key: " " }, true)).toBeNull();
    for (const modifier of ["ctrlKey", "metaKey", "altKey", "isComposing", "defaultPrevented"] as const) {
      expect(exhibitSpaceAction({ key: " ", [modifier]: true }, false), modifier).toBeNull();
    }
  });
});

describe("people links in exhibition prose", () => {
  const people = [{ id: 1032, name: "Martin Scorsese" }, { id: 3661, name: "Thelma Schoonmaker" }];

  it("adds an inline speaker lead-in only when that person's name is missing", () => {
    const text = "Official transcript of her first Oscar acceptance speech.";
    expect(quoteExhibitAttributedContext(text, people[1], people)).toBe(`Thelma Schoonmaker — ${text}`);
    const named = "From Scorsese's tribute played before Thelma accepted the BAFTA Fellowship.";
    expect(quoteExhibitAttributedContext(named, people[0], people)).toBe(named);
    expect(quoteExhibitAttributedContext(named, people[1], people)).toBe(named);
    expect(quoteExhibitAttributedContext("Scorsese was in the room.", people[1], people)).toBe("Thelma Schoonmaker — Scorsese was in the room.");
    expect(quoteExhibitAttributedContext("", people[1], people)).toBe("Thelma Schoonmaker");
  });

  it("does not mistake a shared surname for a speaker's attribution", () => {
    const coens = [{ id: 1, name: "Joel Coen" }, { id: 2, name: "Ethan Coen" }];
    expect(quoteExhibitAttributedContext("Coen in an interview.", coens[0], coens)).toBe("Joel Coen — Coen in an interview.");
  });

  it("links full, first and family names without changing the prose or possessives", () => {
    const text = "From Scorsese's video tribute played before Thelma accepted the BAFTA Fellowship. Martin Scorsese spoke.";
    const parts = quoteExhibitContextParts(text, people);
    expect(parts.map((part) => part.text).join("")).toBe(text);
    expect(parts.filter((part) => part.person).map((part) => [part.text, part.person?.id])).toEqual([
      ["Scorsese", 1032], ["Thelma", 3661], ["Martin Scorsese", 1032],
    ]);
  });

  it("does not match inside other words, guess nicknames, or interpret text as markup", () => {
    const text = "Scorsesesque, Thelmas, Marty, <script>text</script>.";
    expect(quoteExhibitContextParts(text, people)).toEqual([{ text, person: null }]);
  });

  it("keeps ambiguous shared names plain and still links the full names", () => {
    const pair = [{ id: 1, name: "John Smith" }, { id: 2, name: "Jane Smith" }];
    const parts = quoteExhibitContextParts("Smith, John Smith and Jane Smith.", pair);
    expect(parts[0]).toEqual({ text: "Smith, ", person: null });
    expect(parts.filter((part) => part.person).map((part) => part.person?.id)).toEqual([1, 2]);
  });

  it("handles accented names and empty or unlinked prose", () => {
    const person = { id: 955, name: "Penélope Cruz" };
    expect(quoteExhibitContextParts("Penélope Cruz’s speech", [person])[0]).toEqual({ text: person.name, person });
    expect(quoteExhibitContextParts("No names here.", people)).toEqual([{ text: "No names here.", person: null }]);
    expect(quoteExhibitContextParts("No people.", [])).toEqual([{ text: "No people.", person: null }]);
    expect(quoteExhibitContextParts("", people)).toEqual([]);
  });
});
