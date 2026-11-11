"use client";

import { useEffect, type KeyboardEvent, type RefObject } from "react";

/** What Tab can land on inside a modal dialog (an element with `tabindex="-1"` is focusable by script only). */
export const FOCUSABLE_SELECTOR =
  "a[href]:not([tabindex='-1']), button:not([disabled]):not([tabindex='-1']), input:not([disabled]):not([tabindex='-1']), select:not([disabled]):not([tabindex='-1']), textarea:not([disabled]):not([tabindex='-1']), [tabindex]:not([tabindex='-1'])";

/**
 * What a modal dialog does to the page behind it, for as long as `active`: the page's scroll is locked (without shifting the layout when the scrollbar
 * disappears) and everything else on the body is unreachable by keyboard, pointer and assistive technology. `rootRef` is the dialog's portal root,
 * which stays live. Making the page inert blurs whatever has focus: read the opener before this runs, and hand focus back after its cleanup (a
 * dialog's effects declared after this one are cleaned up after it). Shared by the slide-out panels (`SidePanel`) and the people overlay (`PeopleOverlay`).
 */
export function useModalPage(rootRef: RefObject<HTMLElement | null>, active: boolean) {
  // Lock page scroll without shifting the layout when the scrollbar disappears.
  useEffect(() => {
    if (!active) return;
    const { body, documentElement } = document;
    const previous = { overflow: body.style.overflow, paddingRight: body.style.paddingRight };
    const scrollbar = window.innerWidth - documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
    return () => {
      body.style.overflow = previous.overflow;
      body.style.paddingRight = previous.paddingRight;
    };
  }, [active]);

  // Everything else on the page is unreachable (keyboard, pointer and assistive tech) while open.
  useEffect(() => {
    if (!active) return;
    const root = rootRef.current;
    const inerted: Element[] = [];
    for (const child of Array.from(document.body.children)) {
      const skip =
        child === root ||
        child.hasAttribute("inert") ||
        child.tagName.includes("-") || // custom elements, e.g. the Next dev overlay
        ["SCRIPT", "STYLE", "LINK", "TEMPLATE", "NOSCRIPT"].includes(child.tagName);
      if (skip) continue;
      child.setAttribute("inert", "");
      inerted.push(child);
    }
    return () => inerted.forEach((child) => child.removeAttribute("inert"));
  }, [active, rootRef]);
}

/**
 * Keeps Tab inside a modal dialog: Tab on the last control goes to the first, Shift+Tab on the first goes to the last. `panel` is the dialog (it
 * takes focus but is not in the tab order); `scroller`, when there is one, is the scroll container inside it that takes focus too (so that the arrow keys scroll it).
 * From the dialog, Shift+Tab has nothing before it to go to: wrap. From the scroll container, Tab goes to the first control inside it, or wraps when there is
 * none; Shift+Tab goes to the control before it.
 */
export function trapTab(event: KeyboardEvent<HTMLElement>, panel: HTMLElement | null, scroller: HTMLElement | null = null) {
  if (event.key !== "Tab" || !panel) return;
  const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  if (focusable.length === 0) {
    event.preventDefault();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;
  const tabsOutOfScroller = scroller !== null && active === scroller && !focusable.some((element) => scroller.contains(element));
  if (event.shiftKey && (active === first || active === panel)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || tabsOutOfScroller)) {
    event.preventDefault();
    first.focus();
  }
}
