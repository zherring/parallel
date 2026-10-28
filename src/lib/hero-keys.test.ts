import { describe, expect, it } from "vitest";
import {
  describeKeyTarget,
  heroKeyAction,
  type ElementLike,
  type HeroKeyEvent,
  type HeroKeyTarget,
} from "@/lib/hero-keys";

const VISIBLE = { heroVisible: true };

/** A target that uses no arrow keys: a plain button, say. */
const plain: HeroKeyTarget = {
  tag: "button",
  inputType: "",
  editable: false,
  hasText: false,
  expanded: false,
  inOpenCombobox: false,
  inOverlay: false,
  roles: [],
};
const target = (overrides: Partial<HeroKeyTarget>): HeroKeyTarget => ({ ...plain, ...overrides });
const press = (key: string, overrides: Partial<HeroKeyEvent> = {}): HeroKeyEvent => ({ key, target: plain, ...overrides });
const action = (event: HeroKeyEvent, context = VISIBLE) => heroKeyAction(event, context);

describe("heroKeyAction: which keys", () => {
  it("ArrowLeft is Previous and ArrowRight is Next", () => {
    expect(action(press("ArrowLeft"))).toBe("prev");
    expect(action(press("ArrowRight"))).toBe("next");
  });

  it("is nothing for any other key", () => {
    for (const key of ["ArrowUp", "ArrowDown", "Home", "End", "Enter", " ", "Tab", "Escape", "a", "Left", "Right", "PageUp"]) {
      expect(action(press(key)), key).toBeNull();
    }
  });

  it("acts with no target at all (focus on the page itself)", () => {
    expect(action({ key: "ArrowRight", target: null })).toBe("next");
    expect(action({ key: "ArrowLeft", target: null })).toBe("prev");
  });
});

describe("heroKeyAction: events that are not ours", () => {
  it("ignores Ctrl, Meta, Alt and Shift, alone or together", () => {
    for (const modifier of ["ctrlKey", "metaKey", "altKey", "shiftKey"] as const) {
      expect(action(press("ArrowRight", { [modifier]: true })), modifier).toBeNull();
      expect(action(press("ArrowLeft", { [modifier]: true })), modifier).toBeNull();
    }
    expect(action(press("ArrowRight", { ctrlKey: true, shiftKey: true }))).toBeNull();
  });

  it("ignores a key something else already handled", () => {
    expect(action(press("ArrowRight", { defaultPrevented: true }))).toBeNull();
  });

  it("ignores a key in an IME composition", () => {
    expect(action(press("ArrowLeft", { isComposing: true }))).toBeNull();
  });

  it("ignores a held key repeating, so holding the arrow does not flick through scenes", () => {
    expect(action(press("ArrowRight", { repeat: true }))).toBeNull();
  });

  it("explicit false flags are the same as missing ones", () => {
    const event = press("ArrowRight", {
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      defaultPrevented: false,
      isComposing: false,
      repeat: false,
    });
    expect(action(event)).toBe("next");
  });
});

describe("heroKeyAction: the hero out of view", () => {
  it("does nothing when the hero is not at least partly in the viewport", () => {
    expect(action(press("ArrowRight"), { heroVisible: false })).toBeNull();
    expect(action(press("ArrowLeft"), { heroVisible: false })).toBeNull();
    expect(action({ key: "ArrowRight", target: null }, { heroVisible: false })).toBeNull();
  });
});

describe("heroKeyAction: text fields", () => {
  const field = (inputType: string, overrides: Partial<HeroKeyTarget> = {}) =>
    target({ tag: "input", inputType, ...overrides });

  it("an empty field lets the arrows through: there is no caret to move", () => {
    for (const type of ["text", "search", "email", "url", "tel", "password", "number"]) {
      expect(action(press("ArrowRight", { target: field(type) })), type).toBe("next");
      expect(action(press("ArrowLeft", { target: field(type) })), type).toBe("prev");
    }
  });

  it("the search combobox, empty and closed, lets them through", () => {
    const search = field("text", { roles: ["combobox"], expanded: false });
    expect(action(press("ArrowRight", { target: search }))).toBe("next");
  });

  it("a field with text, or a selection, keeps them for the caret", () => {
    for (const type of ["text", "search", "email", "url", "tel", "password", "number"]) {
      const typed = field(type, { hasText: true });
      expect(action(press("ArrowRight", { target: typed })), type).toBeNull();
      expect(action(press("ArrowLeft", { target: typed })), type).toBeNull();
    }
  });

  it("a textarea works the same way", () => {
    expect(action(press("ArrowLeft", { target: target({ tag: "textarea" }) }))).toBe("prev");
    expect(action(press("ArrowLeft", { target: target({ tag: "textarea", hasText: true }) }))).toBeNull();
  });

  it("a contenteditable always keeps them", () => {
    expect(action(press("ArrowLeft", { target: target({ tag: "div", editable: true }) }))).toBeNull();
  });

  it("inputs whose arrows mean something else keep them even when empty", () => {
    for (const type of ["range", "radio", "date", "datetime-local", "month", "week", "time"]) {
      expect(action(press("ArrowRight", { target: field(type) })), type).toBeNull();
    }
  });

  it("inputs with no arrow use do not", () => {
    for (const type of ["checkbox", "button", "submit", "reset", "file", "color", "image"]) {
      expect(action(press("ArrowRight", { target: field(type) })), type).toBe("next");
    }
  });
});

describe("heroKeyAction: widgets that use the arrows", () => {
  it("ignores a <select>", () => {
    expect(action(press("ArrowRight", { target: target({ tag: "select" }) }))).toBeNull();
  });

  it("ignores tabs and tab lists (the genre tabs)", () => {
    expect(action(press("ArrowRight", { target: target({ roles: ["tab", "tablist"] }) }))).toBeNull();
    expect(action(press("ArrowLeft", { target: target({ roles: ["tab"] }) }))).toBeNull();
    expect(action(press("ArrowLeft", { target: target({ roles: ["tablist"] }) }))).toBeNull();
  });

  it("ignores listboxes and options (the suggestions)", () => {
    expect(action(press("ArrowRight", { target: target({ roles: ["option", "listbox"] }) }))).toBeNull();
    expect(action(press("ArrowRight", { target: target({ roles: ["listbox"] }) }))).toBeNull();
  });

  it("ignores menus and their items", () => {
    expect(action(press("ArrowRight", { target: target({ roles: ["menuitem", "menu"] }) }))).toBeNull();
    expect(action(press("ArrowRight", { target: target({ roles: ["menu"] }) }))).toBeNull();
    expect(action(press("ArrowRight", { target: target({ roles: ["menuitemradio", "menubar"] }) }))).toBeNull();
  });

  it("ignores radio groups, sliders, spinbuttons, trees, grids and toolbars", () => {
    for (const role of ["radiogroup", "radio", "slider", "spinbutton", "tree", "treeitem", "grid", "treegrid", "gridcell", "toolbar"]) {
      expect(action(press("ArrowLeft", { target: target({ roles: [role] }) })), role).toBeNull();
    }
  });

  it("ignores an open combobox, wherever focus is inside it, and any control that is expanded", () => {
    const open = target({ tag: "input", inputType: "text", roles: ["combobox"], expanded: true, inOpenCombobox: true });
    expect(action(press("ArrowLeft", { target: open }))).toBeNull();
    expect(action(press("ArrowRight", { target: target({ expanded: true }) }))).toBeNull();
    expect(action(press("ArrowRight", { target: target({ inOpenCombobox: true }) }))).toBeNull();
  });

  it("ignores anything in a dialog, modal or popover", () => {
    expect(action(press("ArrowRight", { target: target({ inOverlay: true }) }))).toBeNull();
  });

  it("does not ignore a plain link, a button, a list or a region", () => {
    for (const roles of [[], ["link"], ["button"], ["list", "listitem"], ["region"], ["status"], ["navigation"]]) {
      expect(action(press("ArrowRight", { target: target({ roles }) })), roles.join()).toBe("next");
    }
  });
});

// ---------------------------------------------------------------------------------------------
// describeKeyTarget: reading a (fake) element
// ---------------------------------------------------------------------------------------------

interface Fake extends ElementLike {
  attrs: Record<string, string>;
}
function el(tag: string, attrs: Record<string, string> = {}, extra: Partial<ElementLike> = {}, parent: ElementLike | null = null): Fake {
  return {
    tagName: tag.toUpperCase(),
    parentElement: parent,
    attrs,
    getAttribute: (name) => attrs[name] ?? null,
    hasAttribute: (name) => name in attrs,
    ...extra,
  };
}

describe("describeKeyTarget", () => {
  it("is nothing for no element", () => {
    expect(describeKeyTarget(null)).toBeNull();
  });

  it("reads the tag, input type, text and roles of the element and its ancestors", () => {
    const tablist = el("div", { role: "tablist" });
    const tab = el("button", { role: "tab", "aria-selected": "true" }, {}, tablist);
    expect(describeKeyTarget(tab)).toMatchObject({ tag: "button", inputType: "", roles: ["tab", "tablist"], hasText: false });
  });

  it("reads an input's type from the element, or its attribute, and defaults to text", () => {
    expect(describeKeyTarget(el("input", {}, { type: "search" }))!.inputType).toBe("search");
    expect(describeKeyTarget(el("input", { type: "Email" }))!.inputType).toBe("email");
    expect(describeKeyTarget(el("input"))!.inputType).toBe("text");
    expect(describeKeyTarget(el("button", {}, { type: "button" }))!.inputType).toBe("");
  });

  it("an input has text when its value is not empty, or when something is selected", () => {
    expect(describeKeyTarget(el("input", {}, { value: "ste", selectionStart: 3, selectionEnd: 3 }))!.hasText).toBe(true);
    expect(describeKeyTarget(el("input", {}, { value: "", selectionStart: 0, selectionEnd: 0 }))!.hasText).toBe(false);
    expect(describeKeyTarget(el("input", {}, { value: "", selectionStart: 0, selectionEnd: 2 }))!.hasText).toBe(true);
    expect(describeKeyTarget(el("textarea", {}, { value: "x" }))!.hasText).toBe(true);
    // Types without a selection report null, or throw on older engines; an empty value is still empty.
    expect(describeKeyTarget(el("input", {}, { value: "", selectionStart: null, selectionEnd: null }))!.hasText).toBe(false);
    const throwing = el("input", {}, { value: "" });
    Object.defineProperty(throwing, "selectionStart", {
      get() {
        throw new Error("InvalidStateError");
      },
    });
    expect(describeKeyTarget(throwing)!.hasText).toBe(false);
  });

  it("a button has no text however its value reads", () => {
    expect(describeKeyTarget(el("button", {}, { value: "go" }))!.hasText).toBe(false);
  });

  it("flags aria-expanded on the element and an open combobox anywhere up the tree", () => {
    expect(describeKeyTarget(el("button", { "aria-expanded": "true" }))!.expanded).toBe(true);
    expect(describeKeyTarget(el("button", { "aria-expanded": "false" }))!.expanded).toBe(false);
    const combo = el("div", { role: "combobox", "aria-expanded": "true" });
    expect(describeKeyTarget(el("input", {}, {}, combo))!.inOpenCombobox).toBe(true);
    const closed = el("div", { role: "combobox", "aria-expanded": "false" });
    expect(describeKeyTarget(el("input", {}, {}, closed))!.inOpenCombobox).toBe(false);
    // The search input itself: role combobox and expanded.
    const search = el("input", { role: "combobox", "aria-expanded": "true" }, { type: "text", value: "" });
    expect(describeKeyTarget(search)).toMatchObject({ expanded: true, inOpenCombobox: true });
  });

  it("flags dialogs, modals and popovers up the tree", () => {
    expect(describeKeyTarget(el("button", {}, {}, el("dialog")))!.inOverlay).toBe(true);
    expect(describeKeyTarget(el("button", {}, {}, el("div", { role: "dialog" })))!.inOverlay).toBe(true);
    expect(describeKeyTarget(el("button", {}, {}, el("div", { role: "alertdialog" })))!.inOverlay).toBe(true);
    expect(describeKeyTarget(el("button", {}, {}, el("div", { "aria-modal": "true" })))!.inOverlay).toBe(true);
    expect(describeKeyTarget(el("button", {}, {}, el("div", { popover: "" })))!.inOverlay).toBe(true);
    expect(describeKeyTarget(el("button", {}, {}, el("div")))!.inOverlay).toBe(false);
  });

  it("flags contenteditable on the element or an ancestor", () => {
    expect(describeKeyTarget(el("div", {}, { isContentEditable: true }))!.editable).toBe(true);
    expect(describeKeyTarget(el("span", {}, {}, el("div", { contenteditable: "true" })))!.editable).toBe(true);
    expect(describeKeyTarget(el("span", {}, {}, el("div", { contenteditable: "" })))!.editable).toBe(true);
    expect(describeKeyTarget(el("div", { contenteditable: "false" }))!.editable).toBe(false);
  });

  it("takes the first role of a role list, case-insensitively", () => {
    expect(describeKeyTarget(el("div", { role: "TabList presentation" }))!.roles).toEqual(["tablist"]);
  });

  it("feeds the rules the way the page needs: the empty search drives the hero, typed text and open lists do not", () => {
    const empty = el("input", { role: "combobox", "aria-expanded": "false", "aria-label": "Search people" }, { type: "text", value: "", selectionStart: 0, selectionEnd: 0 });
    const typed = el("input", { role: "combobox", "aria-expanded": "false" }, { type: "text", value: "ste", selectionStart: 3, selectionEnd: 3 });
    const open = el("input", { role: "combobox", "aria-expanded": "true" }, { type: "text", value: "", selectionStart: 0, selectionEnd: 0 });
    const genreTab = el("button", { role: "tab" }, {}, el("div", { role: "tablist" }));
    const link = el("a", { href: "/p/x" });
    expect(action(press("ArrowRight", { target: describeKeyTarget(empty) }))).toBe("next");
    expect(action(press("ArrowLeft", { target: describeKeyTarget(typed) }))).toBeNull();
    expect(action(press("ArrowLeft", { target: describeKeyTarget(open) }))).toBeNull();
    expect(action(press("ArrowRight", { target: describeKeyTarget(genreTab) }))).toBeNull();
    expect(action(press("ArrowLeft", { target: describeKeyTarget(link) }))).toBe("prev");
  });
});
