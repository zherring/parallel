import type { ElementLike } from "@/lib/hero-keys";

/**
 * The shortcut that opens the full-screen people search on a `/p/` page (see `PeopleOverlay`): Command+K on a Mac (and an iPad or iPhone with a
 * keyboard), Control+K everywhere else, from any view and whether the pair hero is open or collapsed. It is the site's one search shortcut: on a page
 * that has no people bar, it opens the universal search (see `UniversalSearch`) by the same rules (`searchKeyAction`). Pure, like the other key rules
 * (hero-keys.ts, chip-input.ts): the component reads the event and its target into plain values, and the rules decide here.
 */

/** The slice of a keydown event the rules look at. */
export interface PeopleKeyEvent {
  key: string;
  shiftKey?: boolean;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  defaultPrevented?: boolean;
  /** An IME composition is in progress (the key belongs to the IME). */
  isComposing?: boolean;
  /** The key is auto-repeating because it is held down. */
  repeat?: boolean;
}

/** What the rules need to know about the element the key was aimed at. */
export interface PeopleKeyTarget {
  /** A field the visitor types in: a textarea, a text-like input or a contenteditable element, or one inside it. */
  typing: boolean;
  /** The element is in the shortcut's own dialog (the people overlay's, or the universal search's: see `describeShortcutTarget`): its own search field, its rows, its close button. */
  inPeopleDialog: boolean;
  /** The element is in another modal dialog (the film or person panel), which the overlay does not open over. */
  inOtherModal: boolean;
}

export interface PeopleKeyContext {
  /** Whether the shortcut is Command (a Mac) rather than Control: see `isApplePlatform`. */
  mac: boolean;
  /** The overlay is open. */
  open: boolean;
  /** Null when nothing is known about the target (or it is the document). */
  target: PeopleKeyTarget | null;
}

/** What a keydown does: "toggle" opens the overlay or, when it is open, closes it; "close" is Escape; "swallow" is a held shortcut (taken, so the browser's own does not run, but not repeated). */
export type PeopleKeyAction = "toggle" | "close" | "swallow";

/** The platform's name as the browser says it: the newer `userAgentData` where there is one (Chromium), else the old `platform`. Reads `navigator`: call it in the browser only. */
export function platformName(): string {
  const { userAgentData } = navigator as Navigator & { userAgentData?: { platform?: string } };
  return userAgentData?.platform ?? navigator.platform;
}

/** Whether a platform name (`navigator.userAgentData.platform` or `navigator.platform`: "macOS", "MacIntel", "iPad", "Win32", "Linux x86_64") is Apple's: its shortcut key is Command. */
export function isApplePlatform(platform: string | null | undefined): boolean {
  return /^(mac|iphone|ipad|ipod)/i.test(platform ?? "");
}

/** The shortcut as a hint beside a control that does the same ("⌘K" on a Mac, "Ctrl K" elsewhere). */
export function shortcutHint(mac: boolean): string {
  return mac ? "⌘K" : "Ctrl K";
}

/** The shortcut as the `aria-keyshortcuts` of a control that does the same ("Meta+K" on a Mac, "Control+K" elsewhere). */
export function shortcutKeys(mac: boolean): string {
  return mac ? "Meta+K" : "Control+K";
}

/**
 * Command+K on a Mac, Control+K elsewhere, and nothing else: not the other platform's modifier (Control+K on a Mac is the text field's kill-line, and
 * Windows' Meta+K is the system's), and not with Shift or Alt as well. The letter is read as typed (`key`), so Caps Lock does not matter.
 */
export function isPeopleShortcut(event: PeopleKeyEvent, mac: boolean): boolean {
  if (event.key.toLowerCase() !== "k") return false;
  if (event.shiftKey || event.altKey) return false;
  return mac ? Boolean(event.metaKey) && !event.ctrlKey : Boolean(event.ctrlKey) && !event.metaKey;
}

/** Input types in which the visitor types text, so that Command+K or Control+K there is not ours. A checkbox, a button or a range is not one. */
const TYPING_INPUT_TYPES: ReadonlySet<string> = new Set(["text", "search", "email", "url", "tel", "password", "number"]);

/**
 * What the shortcut does for a keydown, or null when it is not ours. The shortcut is Command+K (Control+K): it opens the overlay, and while it is open it
 * closes it, from its own field too. It is not ours while the visitor types in a text field or textarea elsewhere, in a contenteditable element, or in another
 * modal dialog, or for a key something else already handled, an IME composition. Escape closes an open overlay, unless the field's own Escape (clearing its
 * text, closing its list) got it first (`defaultPrevented`) or the key is in another modal dialog, which Escape closes instead.
 */
export function peopleKeyAction(event: PeopleKeyEvent, context: PeopleKeyContext): PeopleKeyAction | null {
  if (event.defaultPrevented || event.isComposing) return null;
  const { target } = context;
  if (event.key === "Escape") {
    if (!context.open || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return null;
    return target && !target.inPeopleDialog && target.inOtherModal ? null : "close";
  }
  if (!isPeopleShortcut(event, context.mac)) return null;
  // Inside the overlay it is the way out, from its own field too; anywhere else another modal dialog or a text field is the visitor's.
  if (target && !target.inPeopleDialog && (target.inOtherModal || target.typing)) return null;
  return event.repeat ? "swallow" : "toggle";
}

/** The element's attribute that marks the people overlay's dialog (see `PeopleOverlay`). */
export const PEOPLE_DIALOG_ATTRIBUTE = "data-people-overlay";

/** The element's attribute that marks the universal search's dialog (see `UniversalSearch`): what `PEOPLE_DIALOG_ATTRIBUTE` is to the overlay. */
export const SEARCH_DIALOG_ATTRIBUTE = "data-universal-search";

/**
 * The element's attribute that marks a page's people bar (see `PeopleBar`; the site's header is hidden by the same attribute, in globals.css). A page that has
 * the bar has the people overlay, which has the shortcut.
 */
export const PEOPLE_BAR_ATTRIBUTE = "data-people-bar";

/** Where the key is for `searchKeyAction`: what `peopleKeyAction` knows, and whether the page has a people bar (see `PEOPLE_BAR_ATTRIBUTE`). */
export interface SearchKeyContext extends PeopleKeyContext {
  peopleBar: boolean;
}

/**
 * What the shortcut does for the site's universal search (see `UniversalSearch`): the people overlay's own rules (`peopleKeyAction`: the key is not ours
 * while the visitor types in a text field or sits in another modal dialog; held, it is swallowed, not repeated; Escape closes it unless the field's own
 * Escape got it first), except that a page with a people bar is the overlay's, and the shortcut is not taken there at all.
 */
export function searchKeyAction(event: PeopleKeyEvent, context: SearchKeyContext): PeopleKeyAction | null {
  return context.peopleBar ? null : peopleKeyAction(event, context);
}

/**
 * Reads what `peopleKeyAction` needs from the element the key was aimed at. `dialogAttribute` marks the dialog whose own keys they are: the people
 * overlay's, unless the universal search asks about its own (`SEARCH_DIALOG_ATTRIBUTE`).
 */
export function describeShortcutTarget(element: ElementLike | null, dialogAttribute: string = PEOPLE_DIALOG_ATTRIBUTE): PeopleKeyTarget | null {
  if (!element) return null;
  const tag = element.tagName.toLowerCase();
  let editable = false;
  let inPeopleDialog = false;
  let inOtherModal = false;
  for (let node: ElementLike | null = element; node; node = node.parentElement) {
    if (node.hasAttribute(dialogAttribute)) inPeopleDialog = true;
    else if (node.getAttribute("aria-modal") === "true") inOtherModal = true;
    if (node.isContentEditable === true || node.getAttribute("contenteditable") === "" || node.getAttribute("contenteditable") === "true") editable = true;
  }
  const inputType = tag === "input" ? (element.type ?? element.getAttribute("type") ?? "text").toLowerCase() : "";
  const typing = editable || tag === "textarea" || (tag === "input" && TYPING_INPUT_TYPES.has(inputType));
  return { typing, inPeopleDialog, inOtherModal };
}
