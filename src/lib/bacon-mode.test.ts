import { describe, expect, it } from "vitest";
import {
  BACON,
  BACON_MODE_MAX,
  MODE_ROLES,
  MODE_SUBJECT_IDS,
  allCheckedForMode,
  baconFullRule,
  baconModeOffer,
  baconPageHref,
  baconPlaceholder,
  carryBaconMode,
  isBaconPage,
  orderForMode,
  searchWithoutBaconMode,
  teamOption,
  togetherNote,
  withBaconMode,
  workedWithBacon,
} from "@/lib/bacon-mode";
import { depthSearch } from "@/lib/depth-url";
import { NOTHING_PENDING, canRestore, hasRoom, stageAdd } from "@/lib/pending-people";
import { addChip } from "@/lib/chip-input";
import { addState, carriedPeopleHref, isTimelineFull } from "@/lib/people-nav";
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

describe("the mode in a page's address", () => {
  it("is on only when the address says so and he is on the page", () => {
    expect(isBaconPage({ mode: "bacon" }, [BACON.id, 31])).toBe(true);
    expect(isBaconPage("?view=table&mode=bacon", [31, BACON.id])).toBe(true);
    expect(isBaconPage({ mode: ["bacon", "x"] }, [BACON.id])).toBe(true);
    expect(isBaconPage({ mode: "bacon" }, [31, 488])).toBe(false);
    expect(isBaconPage({}, [BACON.id, 31])).toBe(false);
    expect(isBaconPage({ mode: "other" }, [BACON.id])).toBe(false);
  });

  it("goes along to another page of people while he stays, and not to a page without him", () => {
    const here = [BACON.id, 31];
    expect(carryBaconMode("/p/4724-kevin-bacon+31-tom-hanks", "?mode=bacon", here)).toBe("/p/4724-kevin-bacon+31-tom-hanks?mode=bacon");
    expect(carryBaconMode("/p/31-tom-hanks+4724-kevin-bacon?view=table", "mode=bacon&view=table", here)).toBe("/p/31-tom-hanks+4724-kevin-bacon?view=table&mode=bacon");
    expect(carryBaconMode("/p/4724?view=depth#x", "?mode=bacon", here)).toBe("/p/4724?view=depth&mode=bacon#x");
    expect(carryBaconMode("/p/31-tom-hanks", "?mode=bacon", here)).toBe("/p/31-tom-hanks");
    // 47240 and 14724 are other people.
    expect(carryBaconMode("/p/47240-someone+14724-other", "?mode=bacon", here)).toBe("/p/47240-someone+14724-other");
    expect(carryBaconMode("/", "?mode=bacon", here)).toBe("/");
    expect(carryBaconMode("/p/4724-kevin-bacon+31-tom-hanks", "?view=table", here)).toBe("/p/4724-kevin-bacon+31-tom-hanks");
  });

  it("is not carried from a page he is not on, whatever its address says: a stale ?mode=bacon does not start the mode", () => {
    expect(carryBaconMode("/p/4724-kevin-bacon+31-tom-hanks", "?mode=bacon", [31, 488])).toBe("/p/4724-kevin-bacon+31-tom-hanks");
    expect(carryBaconMode("/p/4724-kevin-bacon+31-tom-hanks", "?mode=bacon", [])).toBe("/p/4724-kevin-bacon+31-tom-hanks");
  });

  it("goes along with the view when a lane's person is removed, and stays out of the home page", () => {
    const team = [{ id: BACON.id, name: BACON.name }, { id: 6159, name: "Ron Howard" }, { id: 339, name: "Brian Grazer" }];
    // Removing the other person keeps the mode and the view; removing him takes the mode with him.
    expect(carriedPeopleHref("/p/4724-kevin-bacon+339-brian-grazer", "view=table&mode=bacon", team)).toBe("/p/4724-kevin-bacon+339-brian-grazer?view=table&mode=bacon");
    expect(carriedPeopleHref("/p/6159-ron-howard+339-brian-grazer", "view=table&mode=bacon", team)).toBe("/p/6159-ron-howard+339-brian-grazer?view=table");
    // A page with a stale mode in its address and no Bacon in it is an ordinary page.
    expect(carriedPeopleHref("/p/6159-ron-howard", "view=table&mode=bacon", [team[1], team[2]])).toBe("/p/6159-ron-howard?view=table");
    expect(carriedPeopleHref("/", "view=table&mode=bacon", [team[0]])).toBe("/");
  });

  it("opens a name's own page in the mode only for him, and takes no view along", () => {
    const team = [BACON.id, 6159, 339];
    expect(carryBaconMode("/p/4724-kevin-bacon", "view=depth&mode=bacon", team)).toBe("/p/4724-kevin-bacon?mode=bacon");
    expect(carryBaconMode("/p/6159-ron-howard", "view=depth&mode=bacon", team)).toBe("/p/6159-ron-howard");
  });

  it("is written once, and taken out without touching the rest of the query", () => {
    expect(withBaconMode("/p/4724-kevin-bacon?mode=bacon")).toBe("/p/4724-kevin-bacon?mode=bacon");
    expect(searchWithoutBaconMode("view=timeline&mode=bacon&from=1990")).toBe("?view=timeline&from=1990");
    expect(searchWithoutBaconMode("?mode=bacon")).toBe("");
  });

  it("stays on the way to the Films view, which takes nothing else but the period", () => {
    expect(depthSearch("?view=table&sort=year&mode=bacon&from=1990&to=2000")).toBe("?from=1990&to=2000&view=depth&mode=bacon");
    expect(depthSearch("?view=table&sort=year")).toBe("?view=depth");
  });

  it("opens the field's chips as a page in the mode", () => {
    expect(baconPageHref([BACON, { id: 31, name: "Tom Hanks" }])).toBe("/p/4724-kevin-bacon+31-tom-hanks?mode=bacon");
  });

  it("puts a team page back as it was: the one removed can be restored up to the three, but no one new joins it", () => {
    const team = [{ id: BACON.id, name: BACON.name }, { id: 6159, name: "Ron Howard" }, { id: 339, name: "Brian Grazer" }];
    const newcomer = { id: 500, name: "Tom Cruise", profilePath: null };
    const without = { added: [], removed: [339] };
    // The mode's cap is two, and the page has two left: a new person is refused, the one who left can come back.
    expect(hasRoom(team, without, BACON_MODE_MAX)).toBe(false);
    expect(canRestore(team, without, BACON_MODE_MAX)).toBe(true);
    expect(stageAdd(team, without, newcomer, BACON_MODE_MAX)).toBe(without);
    expect(stageAdd(team, without, { id: 339, name: "Brian Grazer", profilePath: null }, BACON_MODE_MAX).removed).toEqual([]);
    // Nothing to restore past the three: the page itself is not over its size.
    expect(canRestore(team, NOTHING_PENDING, BACON_MODE_MAX)).toBe(false);
    // A new person staged in place of one who left is the second person: the one who left cannot come back beside them.
    const swapped = { added: [newcomer], removed: [6159, 339] };
    expect(canRestore(team, swapped, BACON_MODE_MAX)).toBe(false);
    expect(stageAdd(team, swapped, { id: 339, name: "Brian Grazer", profilePath: null }, BACON_MODE_MAX)).toBe(swapped);
    // A pair's page is as before: both may come back, never more than two.
    const pair = team.slice(0, 2);
    expect(canRestore(pair, { added: [], removed: [6159] }, BACON_MODE_MAX)).toBe(true);
    expect(canRestore(pair, { added: [newcomer], removed: [6159] }, BACON_MODE_MAX)).toBe(false);
    // The ordinary page: four.
    expect(canRestore(team, without)).toBe(true);
  });

  it("holds two people on the page too", () => {
    const page = [{ id: BACON.id, name: BACON.name }, { id: 31, name: "Tom Hanks" }];
    const extra = { id: 500, name: "Tom Cruise", profilePath: null };
    expect(hasRoom(page, NOTHING_PENDING, BACON_MODE_MAX)).toBe(false);
    expect(stageAdd(page, NOTHING_PENDING, extra, BACON_MODE_MAX)).toBe(NOTHING_PENDING);
    const without = { added: [], removed: [31] };
    expect(hasRoom(page, without, BACON_MODE_MAX)).toBe(true);
    expect(stageAdd(page, without, extra, BACON_MODE_MAX).added).toEqual([extra]);
    // The ordinary page still takes four.
    expect(stageAdd(page, NOTHING_PENDING, extra).added).toEqual([extra]);
  });

  it("says what a full field means where it is", () => {
    expect(baconPlaceholder(2, true).long).toBe("Kevin Bacon mode is full");
    expect(baconPlaceholder(1, true).long).toBe("Who has worked with Kevin Bacon?");
    expect(baconFullRule(true)).toContain("Remove the other person");
    expect(baconFullRule(false)).toContain("Press Enter");
  });
});

describe("the people a mode is about", () => {
  it("are the ones the server answers for: Kevin Bacon alone", () => {
    expect(MODE_SUBJECT_IDS).toEqual([4724]);
  });

  it("have every result of a search checked unless one has no count; he has none of his own", () => {
    expect(allCheckedForMode([person(31, "Tom Hanks", 2), person(500, "Tom Cruise", 0)])).toBe(true);
    expect(allCheckedForMode([person(31, "Tom Hanks", 2), person(500, "Tom Cruise", null)])).toBe(false);
    expect(allCheckedForMode([person(31, "Tom Hanks", 2), person(500, "Tom Cruise")])).toBe(false);
    expect(allCheckedForMode([kevin, person(31, "Tom Hanks", 2)])).toBe(true);
    expect(allCheckedForMode([{ id: 7, together: null }], 7)).toBe(true);
  });
});

describe("the kinds of work the mode's own lists are made of", () => {
  it("are acting and directing: not the crew around the films", () => {
    expect([...MODE_ROLES].sort()).toEqual(["actor", "director"]);
    for (const crew of ["composer", "cinematographer", "costume-designer", "editor", "writer", "producer", "production-designer"]) {
      expect(MODE_ROLES).not.toContain(crew);
    }
  });
});

describe("a team as an option", () => {
  it("is a row of the two that opens the three of them, in the mode", () => {
    const option = teamOption({
      people: [{ id: 6159, name: "Ron Howard", profilePath: "/rh.jpg" }, { id: 339, name: "Brian Grazer", profilePath: null }],
      sharedCount: 2,
      titles: ["Apollo 13", "Frost/Nixon"],
    });
    expect(option.href).toBe("/p/4724-kevin-bacon+6159-ron-howard+339-brian-grazer?mode=bacon");
    expect(option.people.map((person) => person.name)).toEqual(["Ron Howard", "Brian Grazer"]);
    expect(option.blurb).toBe("Apollo 13, Frost/Nixon");
    expect(togetherNote(option.sharedCount)).toBe("2 films with Kevin Bacon");
  });
});
