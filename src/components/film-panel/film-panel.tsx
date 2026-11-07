"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { Spinner } from "@/components/spinner";
import { errorMessage } from "@/lib/api-client";
import type { PersonRow } from "@/lib/film-people";
import { extendedPeopleHref } from "@/lib/people-nav";
import { FilmContent } from "./film-content";
import { useFilmDetails } from "./use-film-details";

export interface FilmPanelProps {
  /** TMDB movie id to show; null keeps the panel closed. */
  filmId: number | null;
  /** People already on the timeline, so the panel can mark them and offer "add" for everyone else. */
  peopleInView: { id: number; name: string }[];
  onClose: () => void;
}

const TRIGGER_SELECTOR = "button, a[href], [role='button'], [tabindex]";
const FOCUSABLE_SELECTOR =
  "a[href]:not([tabindex='-1']), button:not([disabled]):not([tabindex='-1']), input:not([disabled]):not([tabindex='-1']), select:not([disabled]):not([tabindex='-1']), textarea:not([disabled]):not([tabindex='-1']), [tabindex]:not([tabindex='-1'])";

/** Safari and Firefox on macOS do not focus a button on click, so remember what was pressed. */
let lastPressed: Element | null = null;

const subscribeNothing = () => () => {};

export function FilmPanel({ filmId, peopleInView, onClose }: FilmPanelProps) {
  const mounted = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );

  useEffect(() => {
    const remember = (event: PointerEvent) => {
      lastPressed = event.target instanceof Element ? event.target.closest(TRIGGER_SELECTOR) : null;
    };
    document.addEventListener("pointerdown", remember, true);
    return () => document.removeEventListener("pointerdown", remember, true);
  }, []);

  // The dialog stays mounted for as long as its exit animation takes: `filmId` going back to null starts it (`closing`),
  // and the dialog says when it is over (`exited`). Each opening is a dialog of its own (`session`), so a film opened
  // while the last one is still sliding away does not inherit its state.
  const [shown, setShown] = useState<{ filmId: number | null; session: number; closing: boolean }>({
    filmId: null,
    session: 0,
    closing: false,
  });
  if (filmId !== null) {
    // A different film while the dialog is open stays in the same dialog (it starts at the top); one opened after
    // (or during) a close is a new dialog.
    if (shown.filmId === null || shown.closing) setShown({ filmId, session: shown.session + 1, closing: false });
    else if (shown.filmId !== filmId) setShown({ ...shown, filmId });
  } else if (shown.filmId !== null && !shown.closing) {
    setShown({ ...shown, closing: true });
  }
  const exited = useCallback(() => {
    setShown((current) => (current.closing ? { ...current, filmId: null, closing: false } : current));
  }, []);

  if (shown.filmId === null || !mounted) return null;
  return createPortal(
    <FilmDialog
      key={shown.session}
      filmId={shown.filmId}
      peopleInView={peopleInView}
      closing={shown.closing}
      onExited={exited}
      onClose={onClose}
    />,
    document.body,
  );
}

function FilmDialog({
  filmId,
  peopleInView,
  closing,
  onExited,
  onClose,
}: {
  filmId: number;
  peopleInView: FilmPanelProps["peopleInView"];
  /** The panel was closed: it slides out (and the page is the visitor's again at once), then `onExited` removes it. */
  closing: boolean;
  onExited: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const titleId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const onExitedRef = useRef(onExited);
  const openerRef = useRef<Element | null>(null);
  const { state, retry } = useFilmDetails(filmId);

  const [addingId, setAddingId] = useState<number | null>(null);
  const [isAdding, startAdding] = useTransition();
  const wasAdding = useRef(false);

  useEffect(() => {
    onCloseRef.current = onClose;
    onExitedRef.current = onExited;
  });

  // Close once an "Add" navigation has finished, so the new lane is visible.
  useEffect(() => {
    if (wasAdding.current && !isAdding) onCloseRef.current();
    wasAdding.current = isAdding;
  }, [isAdding]);

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

  // And back out the way it came when it is closed (X, Escape, a press outside, or the parent letting go of the film).
  // The dialog stays until the animation ends and `onExited` removes it; with reduced motion that is at once.
  useLayoutEffect(() => {
    if (!closing) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onExitedRef.current();
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
        if (!cancelled) onExitedRef.current();
      },
      () => {},
    );
    return () => {
      cancelled = true;
      animations.forEach((animation) => animation.cancel());
    };
  }, [closing]);

  // Focus in on open. This must run before the inert effect below: making the page inert blurs
  // whatever has focus, so the opener has to be read first.
  useEffect(() => {
    const active = document.activeElement;
    openerRef.current = active && active !== document.body ? active : lastPressed;
    panelRef.current?.focus({ preventScroll: true });
  }, []);

  // Lock page scroll without shifting the layout when the scrollbar disappears.
  useEffect(() => {
    if (closing) return;
    const { body, documentElement } = document;
    const previous = { overflow: body.style.overflow, paddingRight: body.style.paddingRight };
    const scrollbar = window.innerWidth - documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
    return () => {
      body.style.overflow = previous.overflow;
      body.style.paddingRight = previous.paddingRight;
    };
  }, [closing]);

  // Everything else on the page is unreachable (keyboard, pointer and assistive tech) while open.
  useEffect(() => {
    if (closing) return;
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
  }, [closing]);

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

  // A different film starts at the top.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [filmId]);

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

  function add(person: PersonRow) {
    const href = extendedPeopleHref(peopleInView, { id: person.id, name: person.name }, window.location.search);
    if (!href) return;
    setAddingId(person.id);
    startAdding(() => router.push(href));
  }

  const loading = state.status === "loading";

  return (
    // While it slides away the page underneath is live again: presses go through to it.
    <div
      ref={rootRef}
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
        aria-busy={loading || undefined}
        tabIndex={-1}
        onKeyDown={trapTab}
        className="absolute inset-x-0 bottom-0 flex max-h-[90dvh] flex-col rounded-t-2xl border-t border-border bg-canvas shadow-2xl shadow-black/60 outline-none! md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[30rem] md:rounded-none md:border-l md:border-t-0"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border py-1.5 pl-4 pr-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Film</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close film details"
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
          {state.status === "success" && (
            <FilmContent
              film={state.film}
              titleId={titleId}
              peopleInView={peopleInView}
              addingId={isAdding ? addingId : null}
              onAdd={add}
              scrollRef={scrollRef}
            />
          )}
          {state.status === "loading" && <FilmSkeleton titleId={titleId} />}
          {state.status === "error" && (
            <div role="alert" className="py-10 text-center">
              <h2 id={titleId} className="text-lg font-semibold text-strong">
                Couldn’t load this film
              </h2>
              <p className="mx-auto mt-2 max-w-xs text-sm text-body">
                {errorMessage(state.error, "film")}
              </p>
              <div className="mt-5 flex justify-center gap-3">
                {state.error !== "not-found" && (
                  <button
                    type="button"
                    onClick={retry}
                    className="rounded-md bg-accent-green px-4 py-2 text-sm font-semibold text-on-accent hover:bg-accent-green-hover"
                  >
                    Try again
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md border border-border px-4 py-2 text-sm font-medium text-strong hover:bg-surface"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilmSkeleton({ titleId }: { titleId: string }) {
  const bar = "rounded bg-surface";
  return (
    <div role="status">
      <h2 id={titleId} className="sr-only">
        Loading film details
      </h2>
      <div aria-hidden="true" className="motion-safe:animate-pulse">
        <div className="flex gap-4">
          <div className={`aspect-[2/3] w-28 shrink-0 rounded-md sm:w-32 ${bar}`} />
          <div className="flex-1 space-y-3 pt-1">
            <div className={`h-6 w-3/4 ${bar}`} />
            <div className={`h-4 w-1/2 ${bar}`} />
            <div className={`h-4 w-2/3 ${bar}`} />
          </div>
        </div>
        <div className="mt-5 space-y-2">
          <div className={`h-3 w-full ${bar}`} />
          <div className={`h-3 w-full ${bar}`} />
          <div className={`h-3 w-4/5 ${bar}`} />
        </div>
        <div className="-mx-4 mt-8 flex gap-6 border-b border-border px-4">
          <div className="-mb-px border-b-2 border-surface px-0.5 pb-2.5 pt-3">
            <div className={`h-3.5 w-9 ${bar}`} />
          </div>
          <div className="border-b-2 border-transparent px-0.5 pb-2.5 pt-3">
            <div className={`h-3.5 w-9 ${bar}`} />
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className={`h-10 w-10 shrink-0 rounded-full ${bar}`} />
              <div className="flex-1 space-y-2">
                <div className={`h-3 w-1/3 ${bar}`} />
                <div className={`h-3 w-1/2 ${bar}`} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-6 flex items-center justify-center gap-2 text-sm text-muted">
        <Spinner /> Loading…
      </p>
    </div>
  );
}
