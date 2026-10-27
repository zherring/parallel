import { describe, expect, it } from "vitest";
import {
  CHIPS_HINT,
  addChip,
  addedMessage,
  chipsHref,
  commitTarget,
  decideKey,
  placeholderCopy,
  refusedMessage,
  removeChip,
  removeLastChip,
  removedMessage,
  type ChipPerson,
  type KeyContext,
  type KeyInput,
} from "@/lib/chip-input";
import { MAX_PEOPLE } from "@/lib/people-nav";
import { parsePeopleSlug } from "@/lib/slug";

const person = (id: number, name: string): ChipPerson => ({ id, name, profilePath: null });
const spielberg = person(488, "Steven Spielberg");
const lucas = person(1, "George Lucas");
const williams = person(491, "John Williams");
const ford = person(3, "Harrison Ford");
const hamill = person(2, "Mark Hamill");

/** A chips-mode field with the list open on three selectable suggestions. */
function chipsCtx(overrides: Partial<KeyContext> = {}): KeyContext {
  return {
    mode: "chips",
    chipCount: 0,
    text: "georg",
    open: true,
    panelShown: true,
    listVisible: true,
    fresh: true,
    activeIndex: -1,
    disabled: [false, false, false],
    ...overrides,
  };
}

const navigateCtx = (overrides: Partial<KeyContext> = {}): KeyContext =>
  chipsCtx({ mode: "navigate", ...overrides });

const key = (name: string, extra: Partial<KeyInput> = {}): KeyInput => ({ key: name, ...extra });

describe("addChip", () => {
  it("appends in order without touching the input", () => {
    const start = [spielberg];
    const result = addChip(start, lucas);
    expect(result).toEqual({ ok: true, chips: [spielberg, lucas] });
    expect(start).toEqual([spielberg]);
  });

  it("refuses a duplicate and keeps the chips as they were", () => {
    const result = addChip([spielberg, lucas], { ...spielberg, name: "Steven Spielberg" });
    expect(result).toEqual({ ok: false, reason: "duplicate", chips: [spielberg, lucas] });
  });

  it("refuses a 5th chip", () => {
    const four = [spielberg, lucas, williams, ford];
    expect(four).toHaveLength(MAX_PEOPLE);
    expect(addChip(four, hamill)).toEqual({ ok: false, reason: "full", chips: four });
  });

  it("reports a duplicate before 'full' when the field is full", () => {
    const four = [spielberg, lucas, williams, ford];
    expect(addChip(four, lucas)).toMatchObject({ ok: false, reason: "duplicate" });
  });

  it("accepts the 4th chip", () => {
    expect(addChip([spielberg, lucas, williams], ford)).toMatchObject({ ok: true });
  });
});

describe("removeChip / removeLastChip", () => {
  it("removes one chip by id and reports it", () => {
    expect(removeChip([spielberg, lucas, williams], lucas.id)).toEqual({
      chips: [spielberg, williams],
      removed: lucas,
    });
  });

  it("is a no-op for an unknown id", () => {
    expect(removeChip([spielberg], 999)).toEqual({ chips: [spielberg], removed: null });
  });

  it("removes the last chip", () => {
    expect(removeLastChip([spielberg, lucas])).toEqual({ chips: [spielberg], removed: lucas });
  });

  it("removing from nothing is a no-op", () => {
    expect(removeLastChip([])).toEqual({ chips: [], removed: null });
  });
});

describe("chipsHref", () => {
  it("is null without chips", () => {
    expect(chipsHref([])).toBeNull();
  });

  it("opens the person's page for exactly one chip", () => {
    expect(chipsHref([spielberg])).toBe("/p/488-steven-spielberg");
  });

  it("joins chips in order", () => {
    expect(chipsHref([spielberg, lucas])).toBe("/p/488-steven-spielberg+1-george-lucas");
  });

  it("slugifies accents and punctuation like the rest of the app", () => {
    expect(chipsHref([person(955, "Penélope Cruz"), person(5, "Jean-Luc O'Brien")])).toBe(
      "/p/955-penelope-cruz+5-jean-luc-o-brien",
    );
  });

  it("produces slugs the page can parse", () => {
    const href = chipsHref([spielberg, lucas, williams, ford])!;
    expect(parsePeopleSlug(href.replace("/p/", ""))).toEqual({ ids: [488, 1, 491, 3] });
  });

  it("never exceeds four people or repeats one", () => {
    const href = chipsHref([spielberg, spielberg, lucas, williams, ford, hamill])!;
    expect(parsePeopleSlug(href.replace("/p/", ""))).toEqual({ ids: [488, 1, 491, 3] });
  });
});

describe("commitTarget", () => {
  it("prefers the highlighted suggestion", () => {
    expect(commitTarget(chipsCtx({ activeIndex: 2 }))).toEqual({ index: 2, source: "highlighted" });
  });

  it("falls back to the top selectable suggestion", () => {
    expect(commitTarget(chipsCtx())).toEqual({ index: 0, source: "top" });
    expect(commitTarget(chipsCtx({ disabled: [true, true, false] }))).toEqual({
      index: 2,
      source: "top",
    });
  });

  it("ignores a highlight that is no longer selectable", () => {
    expect(commitTarget(chipsCtx({ activeIndex: 0, disabled: [true, false, false] }))).toEqual({
      index: 1,
      source: "top",
    });
  });

  it("ignores a highlight that is out of range", () => {
    expect(commitTarget(chipsCtx({ activeIndex: 9 }))).toEqual({ index: 0, source: "top" });
  });

  it("is null with no list, a stale list, or nothing selectable", () => {
    expect(commitTarget(chipsCtx({ listVisible: false }))).toBeNull();
    expect(commitTarget(chipsCtx({ fresh: false }))).toBeNull();
    expect(commitTarget(chipsCtx({ disabled: [true, true, true] }))).toBeNull();
    expect(commitTarget(chipsCtx({ disabled: [] }))).toBeNull();
  });
});

describe("decideKey: Tab (chips mode)", () => {
  it("commits the highlighted suggestion", () => {
    expect(decideKey(chipsCtx({ activeIndex: 1 }), key("Tab"))).toEqual({
      type: "commit",
      index: 1,
      source: "highlighted",
    });
  });

  it("commits the top suggestion when nothing is highlighted", () => {
    expect(decideKey(chipsCtx(), key("Tab"))).toEqual({ type: "commit", index: 0, source: "top" });
  });

  it("skips disabled suggestions when taking the top one", () => {
    const ctx = chipsCtx({ disabled: [true, false, false] });
    expect(decideKey(ctx, key("Tab"))).toEqual({ type: "commit", index: 1, source: "top" });
  });

  it("moves focus normally when every suggestion is disabled", () => {
    expect(decideKey(chipsCtx({ disabled: [true, true, true] }), key("Tab"))).toEqual({
      type: "none",
    });
  });

  it("moves focus normally when the list is closed or has no results", () => {
    expect(decideKey(chipsCtx({ listVisible: false, panelShown: false, open: false }), key("Tab")))
      .toEqual({ type: "none" });
    expect(decideKey(chipsCtx({ listVisible: false, disabled: [] }), key("Tab"))).toEqual({
      type: "none",
    });
  });

  it("moves focus normally while the results are stale", () => {
    expect(decideKey(chipsCtx({ fresh: false, disabled: [true, true, true] }), key("Tab"))).toEqual(
      { type: "none" },
    );
  });

  it("moves focus normally with an empty field", () => {
    const empty = chipsCtx({ text: "", listVisible: false, disabled: [], chipCount: 2 });
    expect(decideKey(empty, key("Tab"))).toEqual({ type: "none" });
  });

  it("never intercepts Shift+Tab, even with suggestions on screen", () => {
    expect(decideKey(chipsCtx({ activeIndex: 1 }), key("Tab", { shiftKey: true }))).toEqual({
      type: "none",
    });
    expect(decideKey(chipsCtx(), key("Tab", { shiftKey: true }))).toEqual({ type: "none" });
  });

  it("leaves Tab with other modifiers to the browser", () => {
    for (const modifier of ["altKey", "ctrlKey", "metaKey"] as const) {
      expect(decideKey(chipsCtx(), key("Tab", { [modifier]: true }))).toEqual({ type: "none" });
    }
  });

  it("does not commit while an IME composition is in progress", () => {
    expect(decideKey(chipsCtx(), key("Tab", { isComposing: true }))).toEqual({ type: "none" });
  });

  it("only intercepts when it commits: every non-commit result is 'none'", () => {
    // Exhaustive over the state that matters: whenever Tab is not "commit" it is "none".
    for (const listVisible of [true, false]) {
      for (const fresh of [true, false]) {
        for (const disabled of [[], [true], [false], [true, false]]) {
          for (const activeIndex of [-1, 0, 1]) {
            const ctx = chipsCtx({ listVisible, fresh, disabled, activeIndex });
            const action = decideKey(ctx, key("Tab"));
            expect(["none", "commit"]).toContain(action.type);
            if (action.type === "commit") {
              expect(listVisible && fresh).toBe(true);
              expect(disabled[action.index]).toBe(false);
            }
          }
        }
      }
    }
  });
});

describe("decideKey: Enter", () => {
  it("commits the highlighted or top suggestion while the list is open", () => {
    expect(decideKey(chipsCtx({ activeIndex: 2 }), key("Enter"))).toEqual({
      type: "commit",
      index: 2,
      source: "highlighted",
    });
    expect(decideKey(chipsCtx(), key("Enter"))).toEqual({ type: "commit", index: 0, source: "top" });
  });

  it("prefers committing over submitting, even with chips already in the field", () => {
    expect(decideKey(chipsCtx({ chipCount: 2 }), key("Enter"))).toMatchObject({ type: "commit" });
  });

  it("submits when the text is empty and there is at least one chip", () => {
    const ctx = chipsCtx({
      text: "",
      chipCount: 1,
      listVisible: false,
      panelShown: false,
      disabled: [],
    });
    expect(decideKey(ctx, key("Enter"))).toEqual({ type: "submit" });
    expect(decideKey({ ...ctx, chipCount: 4 }, key("Enter"))).toEqual({ type: "submit" });
  });

  it("treats whitespace-only text as empty", () => {
    const ctx = chipsCtx({ text: "   ", chipCount: 2, listVisible: false, disabled: [] });
    expect(decideKey(ctx, key("Enter"))).toEqual({ type: "submit" });
  });

  it("does nothing with an empty field and no chips", () => {
    const ctx = chipsCtx({ text: "", chipCount: 0, listVisible: false, disabled: [] });
    expect(decideKey(ctx, key("Enter"))).toEqual({ type: "none" });
  });

  it("does not submit while text is pending but nothing is committable", () => {
    // Typed "xyz", no matches: Enter must not silently navigate away with the half-typed name.
    const noMatches = chipsCtx({ text: "xyz", chipCount: 2, listVisible: false, disabled: [] });
    expect(decideKey(noMatches, key("Enter"))).toEqual({ type: "none" });
    // Results still loading (stale): same.
    const stale = chipsCtx({ chipCount: 2, fresh: false, disabled: [true, true, true] });
    expect(decideKey(stale, key("Enter"))).toEqual({ type: "none" });
  });

  it("does nothing when the field is full and the pending text only matches disabled rows", () => {
    const full = chipsCtx({ chipCount: 4, disabled: [true, true, true] });
    expect(decideKey(full, key("Enter"))).toEqual({ type: "none" });
  });

  it("does not commit or submit under an IME composition", () => {
    expect(decideKey(chipsCtx(), key("Enter", { isComposing: true }))).toEqual({ type: "none" });
    const empty = chipsCtx({ text: "", chipCount: 1, listVisible: false, disabled: [] });
    expect(decideKey(empty, key("Enter", { isComposing: true }))).toEqual({ type: "none" });
  });
});

describe("decideKey: Backspace", () => {
  const emptyField = chipsCtx({ text: "", chipCount: 2, listVisible: false, disabled: [] });

  it("removes the last chip when the input is empty", () => {
    expect(decideKey(emptyField, key("Backspace"))).toEqual({ type: "remove-last" });
  });

  it("deletes text, not chips, when there is pending text", () => {
    expect(decideKey({ ...emptyField, text: "g" }, key("Backspace"))).toEqual({ type: "none" });
    expect(decideKey({ ...emptyField, text: " " }, key("Backspace"))).toEqual({ type: "none" });
  });

  it("does nothing without chips", () => {
    expect(decideKey({ ...emptyField, chipCount: 0 }, key("Backspace"))).toEqual({ type: "none" });
  });

  it("does not let a held key eat several chips", () => {
    expect(decideKey(emptyField, key("Backspace", { repeat: true }))).toEqual({ type: "none" });
  });

  it("does nothing during an IME composition", () => {
    expect(decideKey(emptyField, key("Backspace", { isComposing: true }))).toEqual({
      type: "none",
    });
  });
});

describe("decideKey: Escape and arrows", () => {
  it("Escape closes the list first", () => {
    expect(decideKey(chipsCtx(), key("Escape"))).toEqual({ type: "close" });
  });

  it("Escape with the list already closed clears pending text", () => {
    const closed = chipsCtx({ open: false, panelShown: false, listVisible: false });
    expect(decideKey(closed, key("Escape"))).toEqual({ type: "clear" });
  });

  it("Escape with the list closed and the input empty does nothing else", () => {
    const closed = chipsCtx({ open: false, panelShown: false, listVisible: false, text: "" });
    expect(decideKey({ ...closed, chipCount: 3 }, key("Escape"))).toEqual({ type: "none" });
  });

  it("ArrowDown and ArrowUp open a hidden panel, otherwise move", () => {
    const hidden = chipsCtx({ panelShown: false, open: false });
    expect(decideKey(hidden, key("ArrowDown"))).toEqual({ type: "open" });
    expect(decideKey(hidden, key("ArrowUp"))).toEqual({ type: "open" });
    expect(decideKey(chipsCtx(), key("ArrowDown"))).toEqual({ type: "move", direction: "next" });
    expect(decideKey(chipsCtx(), key("ArrowUp"))).toEqual({ type: "move", direction: "prev" });
  });

  it("Home and End only act on a highlighted option", () => {
    expect(decideKey(chipsCtx(), key("Home"))).toEqual({ type: "none" });
    expect(decideKey(chipsCtx({ activeIndex: 1 }), key("Home"))).toEqual({
      type: "move",
      direction: "first",
    });
    expect(decideKey(chipsCtx({ activeIndex: 1 }), key("End"))).toEqual({
      type: "move",
      direction: "last",
    });
  });

  it("ignores other keys", () => {
    expect(decideKey(chipsCtx(), key("a"))).toEqual({ type: "none" });
    expect(decideKey(chipsCtx(), key("ArrowLeft"))).toEqual({ type: "none" });
  });
});

// These lock the behaviour the field had before chips existed. Navigate mode never touches Tab,
// Backspace or "submit", and Enter keeps picking the highlighted (else the top selectable) result.
describe("decideKey: navigate mode is unchanged", () => {
  it("Enter picks the highlighted result, else the top selectable one", () => {
    expect(decideKey(navigateCtx({ activeIndex: 2 }), key("Enter"))).toEqual({
      type: "commit",
      index: 2,
      source: "highlighted",
    });
    expect(decideKey(navigateCtx(), key("Enter"))).toEqual({
      type: "commit",
      index: 0,
      source: "top",
    });
    expect(decideKey(navigateCtx({ disabled: [true, false, true] }), key("Enter"))).toEqual({
      type: "commit",
      index: 1,
      source: "top",
    });
  });

  it("Enter does nothing without a fresh, selectable list", () => {
    expect(decideKey(navigateCtx({ fresh: false }), key("Enter"))).toEqual({ type: "none" });
    expect(decideKey(navigateCtx({ listVisible: false }), key("Enter"))).toEqual({ type: "none" });
    expect(decideKey(navigateCtx({ disabled: [true, true, true] }), key("Enter"))).toEqual({
      type: "none",
    });
  });

  it("Enter never submits (there are no chips to submit)", () => {
    const empty = navigateCtx({ text: "", listVisible: false, disabled: [], chipCount: 0 });
    expect(decideKey(empty, key("Enter"))).toEqual({ type: "none" });
  });

  it("Tab and Shift+Tab are never intercepted", () => {
    expect(decideKey(navigateCtx({ activeIndex: 1 }), key("Tab"))).toEqual({ type: "none" });
    expect(decideKey(navigateCtx(), key("Tab"))).toEqual({ type: "none" });
    expect(decideKey(navigateCtx(), key("Tab", { shiftKey: true }))).toEqual({ type: "none" });
  });

  it("Backspace is never intercepted", () => {
    expect(decideKey(navigateCtx({ text: "", listVisible: false }), key("Backspace"))).toEqual({
      type: "none",
    });
  });

  it("arrows, Home/End and Escape behave as before", () => {
    expect(decideKey(navigateCtx(), key("ArrowDown"))).toEqual({ type: "move", direction: "next" });
    expect(decideKey(navigateCtx({ panelShown: false }), key("ArrowUp"))).toEqual({ type: "open" });
    expect(decideKey(navigateCtx({ activeIndex: 0 }), key("End"))).toEqual({
      type: "move",
      direction: "last",
    });
    expect(decideKey(navigateCtx(), key("Escape"))).toEqual({ type: "close" });
    expect(decideKey(navigateCtx({ open: false }), key("Escape"))).toEqual({ type: "clear" });
    expect(decideKey(navigateCtx({ open: false, text: "" }), key("Escape"))).toEqual({
      type: "none",
    });
  });

  it("does not apply the IME guard (Enter keeps its old meaning)", () => {
    expect(decideKey(navigateCtx(), key("Enter", { isComposing: true }))).toMatchObject({
      type: "commit",
    });
  });
});

describe("a whole session, driven by the key rules", () => {
  it("adds four people with Tab/Enter, refuses a fifth, then goes", () => {
    let chips: ChipPerson[] = [];
    const queue = [spielberg, lucas, williams, ford, hamill];

    for (const next of queue) {
      const full = chips.length >= MAX_PEOPLE;
      const ctx = chipsCtx({
        chipCount: chips.length,
        // The suggestion list shows `next` first; once full every row is disabled.
        disabled: [full],
      });
      const action = decideKey(ctx, key("Tab"));
      if (action.type === "commit") {
        const outcome = addChip(chips, next);
        expect(outcome.ok).toBe(true);
        chips = outcome.chips;
      } else {
        // The 5th person is not committable, so Tab is left alone and the chips do not change.
        expect(action).toEqual({ type: "none" });
        expect(addChip(chips, next)).toMatchObject({ ok: false, reason: "full" });
      }
    }
    expect(chips).toHaveLength(4);

    const emptyField = chipsCtx({
      text: "",
      chipCount: chips.length,
      listVisible: false,
      panelShown: false,
      disabled: [],
    });
    expect(decideKey(emptyField, key("Enter"))).toEqual({ type: "submit" });
    expect(chipsHref(chips)).toBe("/p/488-steven-spielberg+1-george-lucas+491-john-williams+3-harrison-ford");

    // Backspace in the empty field peels chips off from the end.
    expect(decideKey(emptyField, key("Backspace"))).toEqual({ type: "remove-last" });
    expect(removeLastChip(chips).chips.map((c) => c.name)).toEqual([
      "Steven Spielberg",
      "George Lucas",
      "John Williams",
    ]);
  });
});

describe("copy", () => {
  it("announces additions with the running count", () => {
    expect(addedMessage("Steven Spielberg", 1)).toBe(
      "Added Steven Spielberg. 1 of 4 people selected.",
    );
    expect(addedMessage("Harrison Ford", 4)).toBe(
      "Added Harrison Ford. 4 of 4 people selected. Up to 4 people.",
    );
  });

  it("announces removals, including the last one", () => {
    expect(removedMessage("George Lucas", 1)).toBe("Removed George Lucas. 1 of 4 people selected.");
    expect(removedMessage("George Lucas", 0)).toBe("Removed George Lucas. No people selected.");
  });

  it("announces refusals", () => {
    expect(refusedMessage("full", "Mark Hamill")).toBe("Up to 4 people.");
    expect(refusedMessage("duplicate", "Mark Hamill")).toBe("Mark Hamill is already selected.");
  });

  it("explains the keys to screen readers without a hard-to-follow 'trap'", () => {
    expect(CHIPS_HINT).toMatch(/Tab or Enter/);
    expect(CHIPS_HINT).toMatch(/Shift plus Tab always does/);
  });
});

describe("placeholderCopy", () => {
  const base = { peopleInViewCount: 0, chipCount: 0 };

  it("navigate mode keeps the original wording", () => {
    const nav = (peopleInViewCount: number, size: "hero" | "compact") =>
      placeholderCopy({ mode: "navigate", size, peopleInViewCount, chipCount: 0 }).long;
    expect(nav(0, "hero")).toBe("Search any film artist…");
    expect(nav(0, "compact")).toBe("Search people…");
    expect(nav(1, "compact")).toBe("Add a person…");
    expect(nav(3, "compact")).toBe("Add a person…");
    expect(nav(4, "compact")).toBe("Timeline is full (4 people)");
  });

  it("chips mode with no chips uses the same base wording", () => {
    expect(placeholderCopy({ ...base, mode: "chips", size: "hero" }).long).toBe(
      "Search any film artist…",
    );
    expect(placeholderCopy({ ...base, mode: "chips", size: "compact" }).long).toBe("Search people…");
  });

  it("switches to the add-another hint with 1 to 3 chips, with a shorter variant", () => {
    for (const chipCount of [1, 2, 3]) {
      const copy = placeholderCopy({ ...base, mode: "chips", size: "hero", chipCount });
      expect(copy.long).toBe("Add another person, or press Enter to go");
      expect(copy.short).toBe("Add another person…");
      expect(copy.short.length).toBeLessThan(copy.long.length);
    }
  });

  it("says the limit is reached at four chips", () => {
    const copy = placeholderCopy({ ...base, mode: "chips", size: "compact", chipCount: 4 });
    expect(copy.long).toBe("Up to 4 people. Press Enter to go");
    expect(copy.short).toBe("Up to 4 people…");
  });
});
