import { describe, expect, it } from "vitest";
import { describeShortcutTarget, isApplePlatform, isPeopleShortcut, peopleKeyAction, shortcutHint, shortcutKeys, type PeopleKeyEvent, type PeopleKeyTarget } from "@/lib/people-shortcut";
import type { ElementLike } from "@/lib/hero-keys";

const MAC = { mac: true, open: false, target: null };
const OTHER = { mac: false, open: false, target: null };

const plain: PeopleKeyTarget = { typing: false, inPeopleDialog: false, inOtherModal: false };
const target = (overrides: Partial<PeopleKeyTarget>): PeopleKeyTarget => ({ ...plain, ...overrides });
const press = (key: string, overrides: Partial<PeopleKeyEvent> = {}): PeopleKeyEvent => ({ key, ...overrides });

describe("isApplePlatform", () => {
  it("is Command on a Mac, an iPad or an iPhone, by either platform string", () => {
    for (const platform of ["macOS", "MacIntel", "MacPPC", "iPad", "iPhone", "iPod touch"]) expect(isApplePlatform(platform), platform).toBe(true);
  });

  it("is Control elsewhere, and when the platform is not known", () => {
    for (const platform of ["Windows", "Win32", "Linux", "Linux x86_64", "Android", "CrOS", "", null, undefined]) expect(isApplePlatform(platform), String(platform)).toBe(false);
  });
});

describe("shortcutHint and shortcutKeys", () => {
  it("name the shortcut the way the platform writes it: ⌘K on a Mac, Ctrl K elsewhere", () => {
    expect(shortcutHint(true)).toBe("⌘K");
    expect(shortcutHint(false)).toBe("Ctrl K");
    expect(shortcutKeys(true)).toBe("Meta+K");
    expect(shortcutKeys(false)).toBe("Control+K");
  });
});

describe("isPeopleShortcut: which keys", () => {
  it("is Command+K on a Mac and Control+K elsewhere", () => {
    expect(isPeopleShortcut(press("k", { metaKey: true }), true)).toBe(true);
    expect(isPeopleShortcut(press("k", { ctrlKey: true }), false)).toBe(true);
  });

  it("is not the other platform's modifier", () => {
    expect(isPeopleShortcut(press("k", { ctrlKey: true }), true)).toBe(false);
    expect(isPeopleShortcut(press("k", { metaKey: true }), false)).toBe(false);
    // Both held is neither platform's shortcut.
    expect(isPeopleShortcut(press("k", { metaKey: true, ctrlKey: true }), true)).toBe(false);
    expect(isPeopleShortcut(press("k", { metaKey: true, ctrlKey: true }), false)).toBe(false);
  });

  it("is not K alone, nor with Shift or Alt as well", () => {
    expect(isPeopleShortcut(press("k"), true)).toBe(false);
    expect(isPeopleShortcut(press("k"), false)).toBe(false);
    expect(isPeopleShortcut(press("k", { metaKey: true, shiftKey: true }), true)).toBe(false);
    expect(isPeopleShortcut(press("k", { ctrlKey: true, altKey: true }), false)).toBe(false);
  });

  it("is not another letter", () => {
    for (const key of ["j", "l", "p", "/", "Enter", "Control", "Meta"]) {
      expect(isPeopleShortcut(press(key, { metaKey: true }), true), key).toBe(false);
      expect(isPeopleShortcut(press(key, { ctrlKey: true }), false), key).toBe(false);
    }
  });

  it("reads the letter as typed: Caps Lock's K counts", () => {
    expect(isPeopleShortcut(press("K", { metaKey: true }), true)).toBe(true);
    expect(isPeopleShortcut(press("K", { ctrlKey: true }), false)).toBe(true);
  });
});

describe("peopleKeyAction: the shortcut", () => {
  it("toggles from the page itself, with a target that is not a field, or with none", () => {
    expect(peopleKeyAction(press("k", { metaKey: true }), MAC)).toBe("toggle");
    expect(peopleKeyAction(press("k", { ctrlKey: true }), OTHER)).toBe("toggle");
    expect(peopleKeyAction(press("k", { metaKey: true }), { ...MAC, target: plain })).toBe("toggle");
  });

  it("is nothing for the other platform's modifier", () => {
    expect(peopleKeyAction(press("k", { ctrlKey: true }), MAC)).toBeNull();
    expect(peopleKeyAction(press("k", { metaKey: true }), OTHER)).toBeNull();
  });

  it("is not ours while a text field or textarea elsewhere has focus", () => {
    expect(peopleKeyAction(press("k", { metaKey: true }), { ...MAC, target: target({ typing: true }) })).toBeNull();
    expect(peopleKeyAction(press("k", { ctrlKey: true }), { ...OTHER, target: target({ typing: true }) })).toBeNull();
    // Open or closed: an overlay's own field is the exception, not any field.
    expect(peopleKeyAction(press("k", { ctrlKey: true }), { ...OTHER, open: true, target: target({ typing: true }) })).toBeNull();
  });

  it("closes the open overlay from its own field, and from anything else in it", () => {
    const inside = target({ typing: true, inPeopleDialog: true, inOtherModal: true });
    expect(peopleKeyAction(press("k", { metaKey: true }), { ...MAC, open: true, target: inside })).toBe("toggle");
    expect(peopleKeyAction(press("k", { ctrlKey: true }), { ...OTHER, open: true, target: target({ inPeopleDialog: true }) })).toBe("toggle");
  });

  it("does not open over another modal dialog (the film or person panel)", () => {
    expect(peopleKeyAction(press("k", { metaKey: true }), { ...MAC, target: target({ inOtherModal: true }) })).toBeNull();
  });

  it("leaves a key something else handled, and an IME composition, alone", () => {
    expect(peopleKeyAction(press("k", { metaKey: true, defaultPrevented: true }), MAC)).toBeNull();
    expect(peopleKeyAction(press("k", { metaKey: true, isComposing: true }), MAC)).toBeNull();
  });

  it("takes a held shortcut without toggling again", () => {
    expect(peopleKeyAction(press("k", { metaKey: true, repeat: true }), MAC)).toBe("swallow");
  });
});

describe("peopleKeyAction: Escape", () => {
  const open = { ...MAC, open: true };

  it("closes the open overlay", () => {
    expect(peopleKeyAction(press("Escape"), open)).toBe("close");
    expect(peopleKeyAction(press("Escape"), { ...open, target: target({ typing: true, inPeopleDialog: true }) })).toBe("close");
  });

  it("is nothing while it is closed", () => {
    expect(peopleKeyAction(press("Escape"), MAC)).toBeNull();
  });

  it("is the field's first (its text, its list) and another modal dialog's own", () => {
    expect(peopleKeyAction(press("Escape", { defaultPrevented: true }), open)).toBeNull();
    expect(peopleKeyAction(press("Escape"), { ...open, target: target({ inOtherModal: true }) })).toBeNull();
  });

  it("is not Escape with a modifier", () => {
    for (const modifier of ["shiftKey", "altKey", "ctrlKey", "metaKey"] as const) expect(peopleKeyAction(press("Escape", { [modifier]: true }), open), modifier).toBeNull();
  });
});

/** A plain-object element, as hero-keys.test.ts builds them. */
function el(tagName: string, attributes: Record<string, string> = {}, props: Partial<ElementLike> = {}, parent: ElementLike | null = null): ElementLike {
  return {
    tagName: tagName.toUpperCase(),
    parentElement: parent,
    getAttribute: (name) => attributes[name] ?? null,
    hasAttribute: (name) => name in attributes,
    ...props,
  };
}

describe("describeShortcutTarget", () => {
  it("is null for no element", () => {
    expect(describeShortcutTarget(null)).toBeNull();
  });

  it("calls text inputs, textareas and contenteditable elements typing, and buttons, checkboxes and the page not", () => {
    expect(describeShortcutTarget(el("input", {}, { type: "text" }))!.typing).toBe(true);
    expect(describeShortcutTarget(el("input", { role: "combobox" }, { type: "text" }))!.typing).toBe(true);
    expect(describeShortcutTarget(el("input", {}))!.typing).toBe(true);
    expect(describeShortcutTarget(el("input", { type: "search" }))!.typing).toBe(true);
    expect(describeShortcutTarget(el("textarea"))!.typing).toBe(true);
    expect(describeShortcutTarget(el("div", {}, { isContentEditable: true }))!.typing).toBe(true);
    expect(describeShortcutTarget(el("span", {}, {}, el("div", { contenteditable: "true" })))!.typing).toBe(true);
    expect(describeShortcutTarget(el("input", {}, { type: "checkbox" }))!.typing).toBe(false);
    expect(describeShortcutTarget(el("input", {}, { type: "range" }))!.typing).toBe(false);
    expect(describeShortcutTarget(el("button"))!.typing).toBe(false);
    expect(describeShortcutTarget(el("body"))!.typing).toBe(false);
    expect(describeShortcutTarget(el("div", { contenteditable: "false" }))!.typing).toBe(false);
  });

  it("finds the overlay's own dialog up the tree, and another modal dialog apart from it", () => {
    const overlay = el("div", { "data-people-overlay": "", "aria-modal": "true", role: "dialog" });
    const field = describeShortcutTarget(el("input", {}, { type: "text" }, el("div", {}, {}, overlay)))!;
    // The overlay is itself aria-modal, and is not "another" modal dialog.
    expect(field).toEqual({ typing: true, inPeopleDialog: true, inOtherModal: false });
    const panel = el("div", { "aria-modal": "true", role: "dialog" });
    expect(describeShortcutTarget(el("div", {}, {}, panel))).toEqual({ typing: false, inPeopleDialog: false, inOtherModal: true });
    expect(describeShortcutTarget(el("button"))).toEqual({ typing: false, inPeopleDialog: false, inOtherModal: false });
  });
});
