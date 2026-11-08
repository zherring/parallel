"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

const TRIGGER_SELECTOR = "button, a[href], [role='button'], [tabindex]";
const FOCUSABLE_SELECTOR =
  "a[href]:not([tabindex='-1']), button:not([disabled]):not([tabindex='-1']), input:not([disabled]):not([tabindex='-1']), select:not([disabled]):not([tabindex='-1']), textarea:not([disabled]):not([tabindex='-1']), [tabindex]:not([tabindex='-1'])";

/** Safari and Firefox on macOS do not focus a button on click, so remember what was pressed. */
let lastPressed: Element | null = null;

const subscribeNothing = () => () => {};

/**
 * Remembers the control that was last pressed, for the panel to hand focus back to when it closes.
 * Call it from a component that is mounted while the panel is closed: the press that opens a panel
 * happens before the panel exists.
 */
export function useRememberPressed() {
  useEffect(() => {
    const remember = (event: PointerEvent) => {
      lastPressed = event.target instanceof Element ? event.target.closest(TRIGGER_SELECTOR) : null;
    };
    document.addEventListener("pointerdown", remember, true);
    return () => document.removeEventListener("pointerdown", remember, true);
  }, []);
}

/** What a panel's content is handed by the shell. */
export interface SidePanelSlots {
  /** The id for the content's heading: it names the dialog. */
  titleId: string;
  /** The panel's scroll container, for content that sticks to its top (the film's Cast/Crew tabs). */
  scrollRef: RefObject<HTMLDivElement | null>;
}

export interface SidePanelProps {
  /** The small label in the header, over the content: "Film", "Person". */
  label: string;
  /** What the header's close button says to assistive technology: "Close film details". */
  closeLabel: string;
  onClose: () => void;
  /** The content is still loading: the dialog says so to assistive technology. */
  busy?: boolean;
  /** Starts the content at the top again whenever it changes (a different film, a different person). */
  contentKey?: string | number;
  /** The content, with the heading id to name the dialog by and the scroll container. */
  children: (slots: SidePanelSlots) => ReactNode;
}

/**
 * The slide-out panel the film and person details share. Render it only while it is open: it is a
 * modal dialog in a portal on the page's body, a sheet from the right (md and up) or from the
 * bottom, over a dimmed backdrop. It slides in (no exit animation, and none at all for visitors who
 * prefer reduced motion), takes focus, makes the rest of the page inert and locks its scroll, closes
 * on Esc or a click on the backdrop and hands focus back to the control that opened it.
 */
export function SidePanel(props: SidePanelProps) {
  const mounted = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
  if (!mounted) return null;
  return createPortal(<SidePanelDialog {...props} />, document.body);
}

function SidePanelDialog({ label, closeLabel, onClose, busy, contentKey, children }: SidePanelProps) {
  const titleId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const openerRef = useRef<Element | null>(null);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Slide in from the right (md and up) or up from the bottom, and fade the backdrop. There is no
  // exit animation. Skipped entirely for visitors who prefer reduced motion.
  useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const fromSide = window.matchMedia("(min-width: 48rem)").matches;
    backdropRef.current?.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 180,
      easing: "ease-out",
    });
    panelRef.current?.animate(
      [{ transform: fromSide ? "translateX(100%)" : "translateY(100%)" }, { transform: "none" }],
      { duration: 240, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
    );
  }, []);

  // Focus in on open. This must run before the inert effect below: making the page inert blurs
  // whatever has focus, so the opener has to be read first.
  useEffect(() => {
    const active = document.activeElement;
    openerRef.current = active && active !== document.body ? active : lastPressed;
    panelRef.current?.focus({ preventScroll: true });
  }, []);

  // Lock page scroll without shifting the layout when the scrollbar disappears.
  useEffect(() => {
    const { body, documentElement } = document;
    const previous = { overflow: body.style.overflow, paddingRight: body.style.paddingRight };
    const scrollbar = window.innerWidth - documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
    return () => {
      body.style.overflow = previous.overflow;
      body.style.paddingRight = previous.paddingRight;
    };
  }, []);

  // Everything else on the page is unreachable (keyboard, pointer and assistive tech) while open.
  useEffect(() => {
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
  }, []);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      onCloseRef.current();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Different content starts at the top.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [contentKey]);

  // Focus back to the opener on close. Declared last on purpose: unmount cleanups run in
  // declaration order, so by now the page is no longer inert and can take focus again.
  useEffect(() => {
    return () => {
      const opener = openerRef.current;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  function trapTab(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === panel)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div ref={rootRef} className="fixed inset-0 z-50">
      <div
        ref={backdropRef}
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-black/70"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={busy || undefined}
        tabIndex={-1}
        onKeyDown={trapTab}
        className="absolute inset-x-0 bottom-0 flex max-h-[90dvh] flex-col rounded-t-2xl border-t border-border bg-canvas shadow-2xl shadow-black/60 outline-none! md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[30rem] md:rounded-none md:border-l md:border-t-0"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border py-1.5 pl-4 pr-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="flex h-9 w-9 items-center justify-center rounded-md text-body hover:bg-surface hover:text-strong"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="h-5 w-5"
            >
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-8 pt-5">
          {children({ titleId, scrollRef })}
        </div>
      </div>
    </div>
  );
}
