"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { pickOpener } from "@/lib/panel-opener";
import { trapTab, useModalPage } from "./modal-page";

const TRIGGER_SELECTOR = "button, a[href], [role='button'], [tabindex]";

/** Safari and Firefox on macOS do not focus a button on click, so remember what was pressed. */
let lastPressed: Element | null = null;

/** The control a view said opened the panel that is about to mount (see `rememberOpener`); the panel takes it as it opens. */
let saidOpener: Element | null = null;

const subscribeNothing = () => () => {};

/**
 * Says which control is opening a panel, for the panel to hand focus back to when it closes, however it is closed (Escape, its close button, a press
 * outside it, or another film opened and closed after it). Call it from the handler of the press that opens the panel, with the control itself (the click's
 * `currentTarget`: a pointer's click and a key's alike), just before the state that shows the panel changes. It beats what the panel can find out for itself
 * when it opens (the focused element, the control last pressed): in Safari, which does not focus a button on a click, the focused element is the scroller
 * round it, and the scene's poster would be lost. It is good for the one press: the next pointer press or key forgets it, and the panel that takes it clears it.
 */
export function rememberOpener(opener: Element | null): void {
  saidOpener = opener;
}

/**
 * Remembers the control that was last pressed, for a panel to hand focus back to when it closes.
 * Call it once, from a component that is mounted while every panel is closed (the people page's
 * view): the press that opens a panel happens before the panel exists, so a panel cannot do it itself.
 */
export function useRememberPressed() {
  useEffect(() => {
    const remember = (event: PointerEvent) => {
      lastPressed = event.target instanceof Element ? event.target.closest(TRIGGER_SELECTOR) : null;
      saidOpener = null;
    };
    // A key is a press of its own: what was said of the last one does not carry over to it (its click, if it opens a panel, says it again).
    const forget = () => {
      saidOpener = null;
    };
    document.addEventListener("pointerdown", remember, true);
    document.addEventListener("keydown", forget, true);
    return () => {
      document.removeEventListener("pointerdown", remember, true);
      document.removeEventListener("keydown", forget, true);
    };
  }, []);
}

/**
 * Keeps a panel's dialog around while it slides out. Give it what the panel shows (a film's id, a person's entry; null while it is closed):
 * `shown` is that, held for as long as the exit animation takes after it goes back to null (`closing`), and the dialog says when it is over
 * (`exited`, from the shell's `onExited`), which lets go of it. Each opening is a dialog of its own (`session`, for a `key`), so something opened
 * while the last one is still sliding away does not inherit its state; something else while the panel is open stays in the same dialog.
 */
export function useSlideOut<T>(target: T | null) {
  const [held, setHeld] = useState<{ value: T | null; session: number; closing: boolean }>({
    value: null,
    session: 0,
    closing: false,
  });
  // Derived while rendering, from the target: the dialog is told in the same pass (no effect, so no frame of the old state).
  if (target !== null) {
    if (held.value === null || held.closing) setHeld({ value: target, session: held.session + 1, closing: false });
    else if (held.value !== target) setHeld({ ...held, value: target });
  } else if (held.value !== null && !held.closing) {
    setHeld({ ...held, closing: true });
  }
  const exited = useCallback(() => {
    setHeld((current) => (current.closing ? { ...current, value: null, closing: false } : current));
  }, []);
  return { shown: held.value, session: held.session, closing: held.closing, exited };
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
  /** The panel was closed: it slides out (and the page is the visitor's again at once), then `onExited` removes it. See `useSlideOut`. */
  closing?: boolean;
  onExited?: () => void;
  /** The content, with the heading id to name the dialog by and the scroll container. */
  children: (slots: SidePanelSlots) => ReactNode;
}

/**
 * The slide-out panel the film and person details share. Render it only while it is open (or sliding
 * out: see `useSlideOut`): it is a modal dialog in a portal on the page's body, a sheet from the right
 * (md and up) or from the bottom, over a dimmed backdrop. It slides in and, once `closing`, back out
 * (neither for visitors who prefer reduced motion), takes focus, makes the rest of the page inert and
 * locks its scroll, closes on Esc or a click on the backdrop and hands focus back to the control that
 * opened it, as soon as it starts to slide away.
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

function SidePanelDialog({ label, closeLabel, onClose, busy, contentKey, closing = false, onExited, children }: SidePanelProps) {
  const titleId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const onExitedRef = useRef(onExited);
  // Chosen once, as the panel opens (a ref that has not been chosen yet is `undefined`: the effect runs twice in development, and the second run must not choose again).
  const openerRef = useRef<Element | null | undefined>(undefined);

  useEffect(() => {
    onCloseRef.current = onClose;
    onExitedRef.current = onExited;
  });

  // Slide in from the right (md and up) or up from the bottom, and fade the backdrop. Skipped entirely
  // for visitors who prefer reduced motion.
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

  // And back out the way it came when it is closed (X, Escape, a press outside, or the parent letting go of the content).
  // The dialog stays until the animation ends and `onExited` removes it; with reduced motion that is at once.
  useLayoutEffect(() => {
    if (!closing) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onExitedRef.current?.();
      return;
    }
    const toSide = window.matchMedia("(min-width: 48rem)").matches;
    const animations = [
      backdropRef.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: "ease-in", fill: "forwards" }),
      panelRef.current?.animate(
        [{ transform: "none" }, { transform: toSide ? "translateX(100%)" : "translateY(100%)" }],
        { duration: 200, easing: "cubic-bezier(0.4, 0, 1, 1)", fill: "forwards" },
      ),
    ].filter((animation) => animation !== undefined);
    let cancelled = false;
    // A cancelled animation (reopened, unmounted) rejects: nothing to do then.
    Promise.all(animations.map((animation) => animation.finished)).then(
      () => {
        if (!cancelled) onExitedRef.current?.();
      },
      () => {},
    );
    return () => {
      cancelled = true;
      animations.forEach((animation) => animation.cancel());
    };
  }, [closing]);

  // Focus in on open. This must run before the inert effect below: making the page inert blurs
  // whatever has focus, so the opener has to be read first. Focus goes to the scroll container, not
  // the dialog: the arrow keys, Space and Page Down scroll whatever is focused, so a long biography
  // scrolls from the first key press.
  useEffect(() => {
    if (openerRef.current === undefined) {
      openerRef.current = pickOpener({ said: saidOpener, active: document.activeElement, body: document.body, pressed: lastPressed });
      saidOpener = null;
    }
    (scrollRef.current ?? panelRef.current)?.focus({ preventScroll: true });
  }, []);

  // The page behind is locked and inert while open (the opener was read above: making it inert blurs whatever has focus).
  useModalPage(rootRef, !closing);

  useEffect(() => {
    if (closing) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      onCloseRef.current();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [closing]);

  // Different content starts at the top.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [contentKey]);

  // Focus back to the opener on close, as soon as the panel starts to slide away (the page is the visitor's again
  // then, not when the animation ends). Declared last on purpose: cleanups run in declaration order, so by now the
  // page is no longer inert and can take focus again. Unmounting without having been closed does the same.
  useEffect(() => {
    if (closing) return;
    return () => {
      const opener = openerRef.current;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, [closing]);

  return (
    // While it slides away the page underneath is live again: presses go through to it.
    <div
      ref={rootRef}
      data-side-panel
      inert={closing || undefined}
      className={closing ? "pointer-events-none fixed inset-0 z-50" : "fixed inset-0 z-50"}
    >
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
        onKeyDown={(event) => trapTab(event, panelRef.current, scrollRef.current)}
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

        <div
          ref={scrollRef}
          data-side-panel-scroll
          tabIndex={-1}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-8 pt-5 outline-none!"
        >
          {children({ titleId, scrollRef })}
        </div>
      </div>
    </div>
  );
}
