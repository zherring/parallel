"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { creditsLine, type FilmCardContent } from "@/lib/film-credits";
import { tmdbImage } from "@/lib/images";
import { placePopover } from "@/lib/popover-position";

/** Hover time before the card opens (keyboard focus opens it at once). */
export const POPOVER_DELAY_MS = 120;
/** A scroll this soon after opening is the browser bringing a focused node into view: move the card, do not close it. */
const SETTLE_MS = 120;

/** The card's trigger: a film's poster card or node, and the lane it is in (null for the shared strip). */
export interface PopoverTarget {
  trigger: HTMLElement;
  filmId: number;
  laneIndex: number | null;
}

interface OpenState {
  target: PopoverTarget;
  openedAt: number;
}

/**
 * Which film card is open: one at a time, opened by hovering a trigger for POPOVER_DELAY_MS or
 * by focusing it, closed by leaving it, blur, Escape, any press, resize and scroll.
 * Every function is stable, so memoised cards never re-render for it.
 */
export function useFilmPopover() {
  const [open, setOpen] = useState<OpenState | null>(null);
  const openRef = useRef<OpenState | null>(null);
  const pending = useRef<PopoverTarget | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const commit = useCallback((next: OpenState | null) => {
    openRef.current = next;
    setOpen(next);
  }, []);

  const show = useCallback(
    (target: PopoverTarget, how: "hover" | "focus") => {
      window.clearTimeout(timer.current);
      pending.current = null;
      if (openRef.current?.target.trigger === target.trigger) return;
      // Moving from one trigger to the next while a card is open swaps it at once.
      if (how === "focus" || openRef.current) {
        commit({ target, openedAt: Date.now() });
        return;
      }
      pending.current = target;
      timer.current = window.setTimeout(() => {
        pending.current = null;
        commit({ target, openedAt: Date.now() });
      }, POPOVER_DELAY_MS);
    },
    [commit],
  );

  /** Closes the card (and cancels a pending open), but only for `trigger` when one is given. */
  const hide = useCallback(
    (trigger?: HTMLElement) => {
      if (pending.current && (!trigger || pending.current.trigger === trigger)) {
        window.clearTimeout(timer.current);
        pending.current = null;
      }
      if (openRef.current && (!trigger || openRef.current.target.trigger === trigger)) commit(null);
    },
    [commit],
  );

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const isOpen = open !== null;
  useEffect(() => {
    if (!isOpen) return;
    const close = () => hide();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") hide();
    };
    const onScroll = () => {
      const current = openRef.current;
      if (!current) return;
      // Re-measure instead of closing right after opening: focusing a node scrolls it into view.
      if (Date.now() - current.openedAt < SETTLE_MS) commit({ ...current, target: { ...current.target } });
      else hide();
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", close, true);
    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", close, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
    };
  }, [isOpen, hide, commit]);

  return { target: open?.target ?? null, show, hide };
}

interface FilmPopoverProps {
  id: string;
  target: PopoverTarget;
  content: FilmCardContent;
  /** Shared by every lane: the card gets a green outline. */
  lit: boolean;
  onDismiss: () => void;
}

/**
 * The hover card for a poster or node: a small poster, title, year and each person's credits on
 * the film. Rendered in a portal on the body with fixed positioning, because the timeline's
 * scroller clips anything that overflows it. Never interactive: it ignores the pointer and never
 * takes focus. The poster is only fetched while the card is open.
 */
export function FilmPopover({ id, target, content, lit, onDismiss }: FilmPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null);
  const animated = useRef(false);
  const poster = tmdbImage(content.posterPath, "w92");

  // Measure the card and its trigger, then place it before the first paint.
  useLayoutEffect(() => {
    const card = ref.current;
    if (!card) return;
    if (!target.trigger.isConnected) {
      onDismiss();
      return;
    }
    const { left, top } = placePopover(
      target.trigger.getBoundingClientRect(),
      { width: card.offsetWidth, height: card.offsetHeight },
      { width: document.documentElement.clientWidth, height: window.innerHeight },
    );
    setPlace({ left, top });
  }, [target, content, onDismiss]);

  // Fade in; none at all for reduced motion.
  const placed = place !== null;
  useEffect(() => {
    const card = ref.current;
    if (!placed || !card || animated.current) return;
    animated.current = true;
    if (typeof card.animate !== "function" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    card.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120, easing: "ease-out" });
  }, [placed]);

  return createPortal(
    <div
      ref={ref}
      id={id}
      role="tooltip"
      className={`pointer-events-none fixed z-[1000] flex w-72 max-w-[calc(100vw-1rem)] gap-3 rounded-lg border bg-surface p-3 text-left shadow-xl shadow-black/60 ${
        lit ? "border-lit" : "border-border"
      }`}
      style={{ left: place?.left ?? 0, top: place?.top ?? 0, visibility: place ? "visible" : "hidden" }}
    >
      {poster && (
        <img src={poster} alt="" width={48} height={72} decoding="async" className="h-[72px] w-12 shrink-0 rounded-[4px] object-cover" />
      )}
      <div className="min-w-0">
        <p className="break-words text-sm font-semibold leading-tight text-strong">{content.title}</p>
        <p className="text-xs tabular-nums text-muted">{content.year}</p>
        <ul className="mt-1.5 space-y-0.5 text-xs leading-snug text-body">
          {content.rows.map((row) => (
            <li key={row.personId}>{creditsLine(row)}</li>
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  );
}
