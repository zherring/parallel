import { describe, expect, it } from "vitest";
import {
  BACON,
  BACON_MODE_MAX,
  baconModeOffer,
  baconPlaceholder,
  orderForMode,
  togetherNote,
  workedWithBacon,
} from "@/lib/bacon-mode";
import { addChip } from "@/lib/chip-input";
import { addState, isTimelineFull } from "@/lib/people-nav";
import { searchSections } from "@/lib/search-sections";
import type { PairingSearchResult, PersonSearchResult } from "@/lib/types";

const person = (id: number, name: string, together?: number | null): PersonSearchResult => ({
  id,
  name,
  profilePath: `/${id}.jpg`,
  knownFor: "Acting",
  knownForTitles: [],
  ...(together === undefined ? {} : { together }),
});
const kevin = person(BACON.id, BACON.name);
const costner = person(1269, "Kevin Costner");

describe("baconModeOffer", () => {
  it("is offered when he is the first result of a field with no chips", () => {
    expect(baconModeOffer([kevin, costner], { chipCount: 0, active: false })).toEqual({
      mode: "bacon",
      person: { id: BACON.id, name: BACON.name, profilePath: `/${BACON.id}.jpg` },
    });
  });

  it("is not offered below another first result, with chips in the field, in the mode, or for no results", () => {
    expect(baconModeOffer([costner, kevin], { chipCount: 0, active: false })).toBeNull();
    expect(baconModeOffer([kevin], { chipCount: 1, active: false })).toBeNull();
    expect(baconModeOffer([kevin], { chipCount: 0, active: true })).toBeNull();
    expect(baconModeOffer([], { chipCount: 0, active: false })).toBeNull();
  });
});

describe("the mode's results", () => {
  it("lets in only people known to share a film with him", () => {
    expect(workedWithBacon(person(1, "A", 3))).toBe(true);
    expect(workedWithBacon(person(1, "A", 0))).toBe(false);
    expect(workedWithBacon(person(1, "A", null))).toBe(false);
    expect(workedWithBacon(person(1, "A"))).toBe(false);
  });

  it("lists the people who can be added first, each group in the search's order", () => {
    const list = [person(1, "A", 0), person(2, "B", 2), person(3, "C", null), person(4, "D", 1)];
    expect(orderForMode(list).map((result) => result.id)).toEqual([2, 4, 1, 3]);
  });

  it("says how many films, none, or that it could not be checked", () => {
    expect(togetherNote(1)).toBe("1 film with Kevin Bacon");
    expect(togetherNote(4)).toBe("4 films with Kevin Bacon");
    expect(togetherNote(0)).toBe("No films with Kevin Bacon");
    expect(togetherNote(null)).toBe("Could not check for films with Kevin Bacon");
  });
});

describe("the mode's cap", () => {
  const chips = [{ id: BACON.id, name: BACON.name }];

  it("holds him and one other person", () => {
    expect(isTimelineFull(chips, BACON_MODE_MAX)).toBe(false);
    const added = addChip(chips, { id: 2, name: "B" }, BACON_MODE_MAX);
    expect(added.ok).toBe(true);
    expect(isTimelineFull(added.chips, BACON_MODE_MAX)).toBe(true);
    expect(addChip(added.chips, { id: 3, name: "C" }, BACON_MODE_MAX)).toMatchObject({ ok: false, reason: "full" });
    expect(addState(added.chips, 3, BACON_MODE_MAX)).toBe("full");
    expect(addState(added.chips, 2, BACON_MODE_MAX)).toBe("in-view");
  });

  it("leaves the ordinary field at four", () => {
    const two = [...chips, { id: 2, name: "B" }];
    expect(isTimelineFull(two)).toBe(false);
    expect(addChip(two, { id: 3, name: "C" }).ok).toBe(true);
  });

  it("asks for a co-worker, then for Enter", () => {
    expect(baconPlaceholder(1).long).toBe("Who has worked with Kevin Bacon?");
    expect(baconPlaceholder(2).long).toBe("Press Enter to see their films together");
  });
});

describe("searchSections with the mode's row", () => {
  const offer = baconModeOffer([kevin, costner], { chipCount: 0, active: false })!;

  it("puts the row straight after him and the others under More artists, with or without pairings of his", () => {
    const sections = searchSections("kevin bacon", [kevin, costner], [], "all", offer);
    expect(sections.map((section) => [section.key, section.startIndex])).toEqual([["matches", 0], ["mode", 1], ["more-artists", 2]]);
    expect(sections.flatMap((section) => section.options)).toEqual([kevin, offer, costner]);

    const pairing: PairingSearchResult = { href: "/p/x", people: [kevin, costner], blurb: "", sharedCount: 2 };
    const others: PairingSearchResult = { href: "/p/y", people: [costner, person(9, "Z")], blurb: "", sharedCount: 2 };
    expect(searchSections("kevin", [kevin, costner], [pairing, others], "all", offer).map((section) => section.key))
      .toEqual(["matches", "mode", "pairings", "more-artists"]);
  });

  it("keeps the row out of the Artists and Pairings tabs", () => {
    expect(searchSections("kevin bacon", [kevin, costner], [], "artists", offer).flatMap((section) => section.options)).toEqual([kevin, costner]);
    expect(searchSections("kevin bacon", [kevin, costner], [], "pairings", offer)).toEqual([]);
  });
});
