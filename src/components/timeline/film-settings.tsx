"use client";

import { Settings } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { placePopover, type Placement } from "@/lib/popover-position";
import { MINOR_TOGGLE_LABEL } from "@/lib/roles";
import { cn } from "./cn";

interface FilmSettingsProps {
  showAll: boolean;
  onShowAllChange: (checked: boolean) => void;
  includeMinor: boolean;
  onIncludeMinorChange: (checked: boolean) => void;
  /** The sentence to announce, politely, after the minor-credits checkbox changes (e.g. "Showing 43 films together"). */
  message: string;
}

/** Native, independently controlled checkboxes shared by either placement of the gear. */
export function FilmSettingsOptions({
  showAll, onShowAllChange, includeMinor, onIncludeMinorChange, message, posterHintId,
}: FilmSettingsProps & { posterHintId: string }) {
  // The live region is always in the DOM, so that it exists before its text changes; the text
  // waits for a change to the minor-credits checkbox, whose effect is usually out of sight.
  const [announced, setAnnounced] = useState(false);
  return (
    <div className="space-y-3">
      <label className="flex cursor-pointer items-start gap-2.5">
        <input type="checkbox" aria-label="Show all films" aria-describedby={posterHintId} checked={showAll} onChange={(event) => onShowAllChange(event.target.checked)} className="mt-0.5 size-4 shrink-0 cursor-pointer accent-accent-green" />
        <span>
          <span className="text-strong">Show all films</span>
          <span id={posterHintId} className="mt-0.5 block text-xs text-muted">Give every film a poster, adding rows as needed.</span>
        </span>
      </label>
      <label className="flex cursor-pointer items-start gap-2.5">
        <input type="checkbox" checked={includeMinor} onChange={(event) => { setAnnounced(true); onIncludeMinorChange(event.target.checked); }} className="mt-0.5 size-4 shrink-0 cursor-pointer accent-accent-green" />
        <span>{MINOR_TOGGLE_LABEL}</span>
      </label>
      <p role="status" aria-live="polite" className="min-h-4 text-xs text-muted">{announced ? message : ""}</p>
    </div>
  );
}

interface FilmSettingsPopupProps extends FilmSettingsProps {
  /** The gear's name and the pop-up's title; "Film settings" for the flat timeline's. */
  label?: string;
  /** Classes for the gear button, after the flat timeline's (so a view over a busier surface can restyle it). */
  buttonClassName?: string;
  /** The gear button, for what opens something from the sheet (the page bar's "People" row) to hand focus back to it. */
  buttonRef?: RefObject<HTMLButtonElement | null>;
  /**
   * Whether the pop-up scrolls (and is no taller than the screen), as the flat timeline's does. Off, nothing in it is clipped: a menu
   * that hangs from something inside it (the Share menu) shows in full.
   */
  scrollable?: boolean;
  /** More in the pop-up, over and under the film options (the page bar's views and layout, and Share and Export). A click inside an element with `data-close-sheet` closes the pop-up. */
  before?: ReactNode;
  after?: ReactNode;
}

/** Both film-display preferences in a small, non-modal pop-up; checkbox changes keep it open. */
export function FilmSettings({
  showAll, onShowAllChange, includeMinor, onIncludeMinorChange, message,
  label = "Film settings", buttonClassName, buttonRef: sharedButtonRef, scrollable = true, before, after,
}: FilmSettingsPopupProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<Placement | null>(null);
  const ownButtonRef = useRef<HTMLButtonElement>(null);
  const buttonRef = sharedButtonRef ?? ownButtonRef;
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  // Portal out of the timeline's clipping surface. Keep the pop-up aligned even when a preference
  // scrolls the track or changes the page's dimensions; don't dismiss while checking an option.
  useLayoutEffect(() => {
    if (!open) return;
    const button = buttonRef.current;
    const panel = panelRef.current;
    if (!button || !panel) return;
    const place = () => {
      const anchor = button.getBoundingClientRect();
      const size = panel.getBoundingClientRect();
      const next = placePopover(anchor, size, { width: window.innerWidth, height: window.innerHeight }, { gap: 8 });
      // placePopover only contributes `top` here: the pop-up is right-aligned to the gear by hand.
      next.left = Math.max(8, Math.min(anchor.right - size.width, window.innerWidth - size.width - 8));
      setPosition((previous) => previous?.left === next.left && previous.top === next.top ? previous : next);
    };
    place();
    // The first render is hidden until measured; make it focusable before moving focus inside.
    panel.style.visibility = "visible";
    panel.querySelector<HTMLElement>("input:not(:disabled), a[href], button:not(:disabled)")?.focus({ preventScroll: true });
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(place);
    observer?.observe(button);
    observer?.observe(panel);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      observer?.disconnect();
      // Closed: forget where it was, so reopening does not paint one frame at the stale spot.
      setPosition(null);
    };
  }, [open, buttonRef]);

  useEffect(() => {
    if (!open) return;
    const outside = (target: EventTarget | null) => target instanceof Node &&
      !buttonRef.current?.contains(target) && !panelRef.current?.contains(target);
    const dismiss = (event: PointerEvent | FocusEvent) => {
      if (outside(event.target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      buttonRef.current?.focus({ preventScroll: true });
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("focusin", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("focusin", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [open, buttonRef]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        title={label}
        onClick={() => setOpen((previous) => !previous)}
        className={cn("inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-(--bar-radius) bg-canvas text-muted hover:bg-surface hover:text-strong", buttonClassName)}
      >
        <Settings aria-hidden="true" className="size-4" />
      </button>
      {open && createPortal(
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label={label}
          className={cn(
            "fixed z-[90] w-80 max-w-[calc(100vw-1rem)] rounded-lg border border-border bg-canvas p-3 text-sm text-body shadow-xl shadow-black/40",
            scrollable && "max-h-[calc(100dvh-1rem)] overflow-y-auto",
          )}
          style={position ? { left: position.left, top: position.top } : { visibility: "hidden" }}
          // A choice that moves the page on (a view chosen in the sheet) closes it: the sheet would be left over the new view.
          onClick={(event) => {
            if (!(event.target instanceof Element) || !event.target.closest("[data-close-sheet]")) return;
            setOpen(false);
            buttonRef.current?.focus({ preventScroll: true });
          }}
        >
          {before}
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">Film settings</h2>
          <FilmSettingsOptions
            showAll={showAll}
            onShowAllChange={onShowAllChange}
            includeMinor={includeMinor}
            onIncludeMinorChange={onIncludeMinorChange}
            message={message}
            posterHintId={`${panelId}-posters`}
          />
          {after}
        </div>,
        document.body,
      )}
    </>
  );
}
