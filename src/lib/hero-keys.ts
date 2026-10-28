import type { NavDirection } from "@/lib/hero-history";

/**
 * ArrowLeft and ArrowRight drive the landing hero (Previous and Next), from anywhere on the page
 * except where those keys already mean something. Pure, like the other key rules (chip-input.ts):
 * the hook reads the event and its target into plain values, and the rules decide here.
 */

/** What the rules need to know about the element that has focus (or is the key's target). */
export interface HeroKeyTarget {
  /** Lower-case tag name. */
  tag: string;
  /** An <input>'s type, lower-case ("text" when it has none); "" for anything else. */
  inputType: string;
  /** A contenteditable element or one inside it. */
  editable: boolean;
  /** A text field that holds text or has a selection: the arrow keys move its caret. */
  hasText: boolean;
  /** The element itself has aria-expanded="true": something it controls is open. */
  expanded: boolean;
  /** An element in its ancestry (itself included) is a combobox with aria-expanded="true". */
  inOpenCombobox: boolean;
  /** An element in its ancestry is a dialog, a modal or a popover. */
  inOverlay: boolean;
  /** The ARIA roles of the element and its ancestors. */
  roles: readonly string[];
}

/** The slice of a keydown event the rules look at. */
export interface HeroKeyEvent {
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
  /** Null when nothing is known about the target (or it is the document). */
  target: HeroKeyTarget | null;
}

export interface HeroKeyContext {
  /** The hero is at least partly in the viewport. */
  heroVisible: boolean;
}

/** Widgets that use the arrow keys themselves: tabs, listboxes, menus, trees, grids, sliders... */
const ARROW_ROLES: ReadonlySet<string> = new Set([
  "tablist",
  "tab",
  "listbox",
  "option",
  "menu",
  "menubar",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "radiogroup",
  "radio",
  "slider",
  "spinbutton",
  "tree",
  "treeitem",
  "grid",
  "treegrid",
  "gridcell",
  "toolbar",
]);

/** Text-like inputs, whose arrow keys move the caret once there is something to move through. */
const TEXT_INPUT_TYPES: ReadonlySet<string> = new Set(["text", "search", "email", "url", "tel", "password", "number"]);
/** Inputs that use the arrow keys for something else than a caret. */
const ARROW_INPUT_TYPES: ReadonlySet<string> = new Set([
  "range",
  "radio",
  "date",
  "datetime-local",
  "month",
  "week",
  "time",
]);

function usesArrows(target: HeroKeyTarget): boolean {
  if (target.inOverlay || target.expanded || target.inOpenCombobox || target.editable) return true;
  if (target.roles.some((role) => ARROW_ROLES.has(role))) return true;
  if (target.tag === "select") return true;
  if (target.tag === "textarea") return target.hasText;
  if (target.tag === "input") {
    if (TEXT_INPUT_TYPES.has(target.inputType)) return target.hasText;
    return ARROW_INPUT_TYPES.has(target.inputType);
  }
  return false;
}

/**
 * What a keydown does to the hero: "prev" for ArrowLeft, "next" for ArrowRight, or null when the
 * key is not ours. Not ours: any other key, a modifier held (Shift, Ctrl, Alt, Meta), a key
 * something else already handled (`defaultPrevented`), an IME composition, a held key repeating,
 * the hero out of view, and a target that uses the arrows: tabs, listboxes, menus, trees, grids,
 * sliders, radio groups, an open combobox or dropdown button, a dialog or popover, a <select>, a
 * contenteditable, and a text field with text in it or a selection (an empty one lets them
 * through: there is no caret to move). The caller calls `preventDefault()` only for a non-null
 * result.
 */
export function heroKeyAction(event: HeroKeyEvent, context: HeroKeyContext): NavDirection | null {
  const direction = event.key === "ArrowLeft" ? "prev" : event.key === "ArrowRight" ? "next" : null;
  if (!direction) return null;
  if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return null;
  if (event.defaultPrevented || event.isComposing || event.repeat) return null;
  if (!context.heroVisible) return null;
  if (event.target && usesArrows(event.target)) return null;
  return direction;
}

// ---------------------------------------------------------------------------------------------
// Reading an element
// ---------------------------------------------------------------------------------------------

/** The part of a DOM element `describeKeyTarget` reads, so tests can pass plain objects. */
export interface ElementLike {
  tagName: string;
  parentElement: ElementLike | null;
  getAttribute(name: string): string | null;
  hasAttribute(name: string): boolean;
  isContentEditable?: boolean;
  type?: string;
  value?: string;
  selectionStart?: number | null;
  selectionEnd?: number | null;
}

/** A text field's caret has nothing to move through when it is empty and nothing is selected. */
function holdsText(element: ElementLike): boolean {
  if (typeof element.value === "string" && element.value.length > 0) return true;
  try {
    const { selectionStart, selectionEnd } = element;
    return typeof selectionStart === "number" && typeof selectionEnd === "number" && selectionEnd > selectionStart;
  } catch {
    return false; // types without a selection (number, email in older browsers) throw
  }
}

/** Reads what `heroKeyAction` needs from the element the key was aimed at. */
export function describeKeyTarget(element: ElementLike | null): HeroKeyTarget | null {
  if (!element) return null;
  const tag = element.tagName.toLowerCase();
  const roles: string[] = [];
  let inOpenCombobox = false;
  let inOverlay = false;
  let editable = false;
  for (let node: ElementLike | null = element; node; node = node.parentElement) {
    const role = node.getAttribute("role")?.trim().toLowerCase().split(/\s+/)[0];
    if (role) roles.push(role);
    if (role === "combobox" && node.getAttribute("aria-expanded") === "true") inOpenCombobox = true;
    const nodeTag = node.tagName.toLowerCase();
    if (
      nodeTag === "dialog" ||
      role === "dialog" ||
      role === "alertdialog" ||
      node.getAttribute("aria-modal") === "true" ||
      node.hasAttribute("popover")
    ) {
      inOverlay = true;
    }
    if (node.isContentEditable === true || node.getAttribute("contenteditable") === "" || node.getAttribute("contenteditable") === "true") {
      editable = true;
    }
  }
  const isInput = tag === "input";
  return {
    tag,
    inputType: isInput ? (element.type ?? element.getAttribute("type") ?? "text").toLowerCase() : "",
    editable,
    hasText: (isInput || tag === "textarea") && holdsText(element),
    expanded: element.getAttribute("aria-expanded") === "true",
    inOpenCombobox,
    inOverlay,
    roles,
  };
}
