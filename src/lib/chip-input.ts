import { normalizeQuery, type Move } from "@/lib/combobox";
import { MAX_PEOPLE, addState, dedupePeople, type PersonRef } from "@/lib/people-nav";
import { buildPeopleSlug } from "@/lib/slug";

/**
 * Pure logic for the person search field, in both of its modes.
 *
 * - "navigate": picking a result goes straight to the timeline (the original behaviour; used under
 *   the lanes and in the header on /p/ pages).
 * - "chips": an email-recipients style token field. Picking a result turns it into a chip, the
 *   text clears, and a separate "go" step opens the timeline built from the chips.
 *
 * Nothing here touches React or the DOM, so every keyboard rule is covered by unit tests.
 */
export type SearchMode = "navigate" | "chips";

/** A chip: the person plus what the chip needs to draw an avatar. */
export interface ChipPerson extends PersonRef {
  profilePath: string | null;
}

// ---------------------------------------------------------------------------------------------
// Chips: add, remove, destination
// ---------------------------------------------------------------------------------------------

export type AddChipOutcome<T extends PersonRef> =
  | { ok: true; chips: T[] }
  | { ok: false; reason: "duplicate" | "full"; chips: T[] };

/** Appends `picked`, or refuses (leaving the chips as they were) for a duplicate or a 5th chip. */
export function addChip<T extends PersonRef>(
  chips: readonly T[],
  picked: T,
): AddChipOutcome<T> {
  const state = addState(chips, picked.id);
  if (state === "in-view") return { ok: false, reason: "duplicate", chips: [...chips] };
  if (state === "full") return { ok: false, reason: "full", chips: [...chips] };
  return { ok: true, chips: [...chips, picked] };
}

export interface RemoveChipOutcome<T extends PersonRef> {
  chips: T[];
  removed: T | null;
}

/** Drops the chip with this id. `removed` is null when there was no such chip. */
export function removeChip<T extends PersonRef>(
  chips: readonly T[],
  id: number,
): RemoveChipOutcome<T> {
  const removed = chips.find((chip) => chip.id === id) ?? null;
  return { chips: chips.filter((chip) => chip.id !== id), removed };
}

/** Drops the last chip (what Backspace does in an empty field). */
export function removeLastChip<T extends PersonRef>(chips: readonly T[]): RemoveChipOutcome<T> {
  const last = chips[chips.length - 1];
  return last ? removeChip(chips, last.id) : { chips: [], removed: null };
}

/**
 * `/p/<slug>` for the chips, in the order they were added, or null when there are none. The
 * names are TMDB's own, so the slug text is already the canonical one the page expects.
 */
export function chipsHref(chips: readonly PersonRef[]): string | null {
  if (chips.length === 0) return null;
  return `/p/${buildPeopleSlug(dedupePeople(chips))}`;
}

// ---------------------------------------------------------------------------------------------
// Keyboard decisions
// ---------------------------------------------------------------------------------------------

/** Everything the key rules need to know about the field right now. */
export interface KeyContext {
  mode: SearchMode;
  /** Chips currently in the field (always 0 in navigate mode). */
  chipCount: number;
  /** The raw text in the input. */
  text: string;
  /** The "popup wanted" flag: set by focus and typing, cleared by Escape, blur and a commit. */
  open: boolean;
  /** The panel (suggestions, hints, errors) is on screen. */
  panelShown: boolean;
  /** Suggestion options are on screen. */
  listVisible: boolean;
  /** The suggestions answer the text currently typed (not stale results of an older query). */
  fresh: boolean;
  /** Index of the highlighted suggestion, or -1. */
  activeIndex: number;
  /** One flag per suggestion: true when it cannot be picked (already added, list full, stale). */
  disabled: readonly boolean[];
}

/** The slice of a keydown event the rules look at. */
export interface KeyInput {
  key: string;
  shiftKey?: boolean;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  /** An IME composition is in progress (the key belongs to the IME, not to us). */
  isComposing?: boolean;
  /** The key is auto-repeating because it is held down. */
  repeat?: boolean;
}

export type KeyAction =
  | { type: "none" }
  /** Show the panel (ArrowDown / ArrowUp while it is hidden). */
  | { type: "open" }
  | { type: "move"; direction: Move }
  /** Pick suggestion `index`: add a chip (chips mode) or navigate to it (navigate mode). */
  | { type: "commit"; index: number; source: "highlighted" | "top" }
  /** Open the timeline built from the chips. */
  | { type: "submit" }
  | { type: "remove-last" }
  /** Escape: hide the panel. */
  | { type: "close" }
  /** Escape with the panel already hidden: clear the typed text. */
  | { type: "clear" };

const NONE: KeyAction = { type: "none" };

/**
 * The suggestion a commit key would pick: the highlighted one when it is selectable, else the top
 * selectable one. Null when nothing can be picked (no list, stale list, or every row disabled).
 */
export function commitTarget(
  ctx: Pick<KeyContext, "listVisible" | "fresh" | "activeIndex" | "disabled">,
): { index: number; source: "highlighted" | "top" } | null {
  if (!ctx.listVisible || !ctx.fresh) return null;
  const { activeIndex, disabled } = ctx;
  if (activeIndex >= 0 && activeIndex < disabled.length && !disabled[activeIndex]) {
    return { index: activeIndex, source: "highlighted" };
  }
  const top = disabled.findIndex((flag) => !flag);
  return top >= 0 ? { index: top, source: "top" } : null;
}

/**
 * What a keydown does. The component maps the action to state changes and calls
 * `preventDefault()` for every action except "none"; a "none" leaves the browser alone.
 *
 * Focus rule for Tab: it is only ever intercepted when it commits a suggestion (chips mode, plain
 * Tab, a selectable suggestion on screen). With the list closed, with nothing selectable, or with
 * any modifier (Shift+Tab goes backwards), Tab is "none" and focus moves like it does anywhere
 * else, so keyboard users are never trapped in the field.
 */
export function decideKey(ctx: KeyContext, input: KeyInput): KeyAction {
  const chips = ctx.mode === "chips";
  // The IME owns its keys (Enter confirms a composition); never commit or submit under it.
  if (chips && input.isComposing) return NONE;

  switch (input.key) {
    case "ArrowDown":
    case "ArrowUp": {
      if (!ctx.panelShown) return { type: "open" };
      return { type: "move", direction: input.key === "ArrowDown" ? "next" : "prev" };
    }

    case "Home":
    case "End": {
      if (!ctx.listVisible || ctx.activeIndex < 0) return NONE;
      return { type: "move", direction: input.key === "Home" ? "first" : "last" };
    }

    case "Tab": {
      if (!chips) return NONE;
      if (input.shiftKey || input.altKey || input.ctrlKey || input.metaKey) return NONE;
      const target = commitTarget(ctx);
      return target ? { type: "commit", ...target } : NONE;
    }

    case "Enter": {
      const target = commitTarget(ctx);
      if (target) return { type: "commit", ...target };
      // Nothing to commit: with no pending text, Enter means "go" (chips mode only).
      if (chips && ctx.chipCount > 0 && normalizeQuery(ctx.text) === "") return { type: "submit" };
      return NONE;
    }

    case "Backspace": {
      // Only an empty field removes a chip, and a held key does not eat several in one go.
      const empty = ctx.text === "";
      return chips && ctx.chipCount > 0 && empty && !input.repeat ? { type: "remove-last" } : NONE;
    }

    case "Escape": {
      if (ctx.open) return { type: "close" };
      return ctx.text ? { type: "clear" } : NONE;
    }
  }
  return NONE;
}

// ---------------------------------------------------------------------------------------------
// Copy
// ---------------------------------------------------------------------------------------------

export const FULL_MESSAGE = `Up to ${MAX_PEOPLE} people`;

function selectedCount(count: number): string {
  return count === 0 ? "No people selected." : `${count} of ${MAX_PEOPLE} people selected.`;
}

/** Live-region text after a chip was added. */
export function addedMessage(name: string, count: number): string {
  const base = `Added ${name}. ${selectedCount(count)}`;
  return count >= MAX_PEOPLE ? `${base} ${FULL_MESSAGE}.` : base;
}

/** Live-region text after a chip was removed. */
export function removedMessage(name: string, count: number): string {
  return `Removed ${name}. ${selectedCount(count)}`;
}

/** Live-region text for a refused add. */
export function refusedMessage(reason: "duplicate" | "full", name: string): string {
  return reason === "full" ? `${FULL_MESSAGE}.` : `${name} is already selected.`;
}

export interface PlaceholderInput {
  mode: SearchMode;
  size: "hero" | "compact";
  /** People already on the timeline (navigate mode). */
  peopleInViewCount: number;
  /** Chips in the field (chips mode). */
  chipCount: number;
}

/**
 * Placeholder copy. `long` is the full sentence, `short` is for fields too narrow to hold it
 * (they are the same string when there is only one wording).
 */
export function placeholderCopy({ mode, size, peopleInViewCount, chipCount }: PlaceholderInput): {
  long: string;
  short: string;
} {
  if (mode === "chips" && chipCount > 0) {
    return chipCount >= MAX_PEOPLE
      ? { long: `${FULL_MESSAGE}. Press Enter to go`, short: `${FULL_MESSAGE}…` }
      : { long: "Add another person, or press Enter to go", short: "Add another person…" };
  }
  const text =
    mode === "navigate" && peopleInViewCount >= MAX_PEOPLE
      ? `Timeline is full (${MAX_PEOPLE} people)`
      : mode === "navigate" && peopleInViewCount > 0
        ? "Add a person…"
        : size === "hero"
          ? "Search any film artist…"
          : "Search people…";
  return { long: text, short: text };
}

/** Screen-reader instructions for the field (referenced by aria-describedby in chips mode). */
export const CHIPS_HINT =
  `Type a name, then press Tab or Enter to add the highlighted match, or the first one if none is highlighted. ` +
  `Up to ${MAX_PEOPLE} people. With the field empty, Enter shows the timeline and Backspace removes the last person. ` +
  `When there is nothing to add, Tab moves on as usual, and Shift plus Tab always does.`;
