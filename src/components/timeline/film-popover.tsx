"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PersonAvatar } from "@/components/person-avatar";
import type { CreditsRow, FilmCardContent } from "@/lib/film-credits";
import { tmdbImage } from "@/lib/images";
import { placePopover, type Placement } from "@/lib/popover-position";
import { cn } from "./cn";
import { FilmMetricsRows } from "./film-metrics-rows";
import { useFilmMetrics } from "./use-film-metrics";

/** Hover time before the card opens (keyboard focus opens it at once). */
export const POPOVER_DELAY_MS = 120;
/** A scroll this soon after opening is the browser bringing a focused node into view: move the card, do not close it. */
const SETTLE_MS = 120;

/** The card's trigger: a film's poster card or node, and the lane it is in. */
export interface PopoverTarget {
  trigger: HTMLElement;
  filmId: number;
  laneIndex: number;
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
  /** Shared by every lane: the poster gets the green outline and glow of a lit film. */
  lit: boolean;
  /**
   * y in the viewport below which the card should not go (the top of the pinned control bar,
   * which would otherwise cover its lower part); the viewport's bottom edge when omitted.
   */
  bottomEdge?: () => number;
  onDismiss: () => void;
}

function RoleText({ row }: { row: CreditsRow }) {
  return (
    <>
      {row.roles.map((role, index) => (
        <span key={role.label}>
          {index > 0 && ", "}
          <span className="text-strong">{role.label}</span>
          {role.detail && <span className="text-body"> ({role.detail})</span>}
        </span>
      ))}
    </>
  );
}

/**
 * The film card shown while hovering or focusing a poster or node: poster on the left; on the
 * right the title, then one row per person on the timeline with a credit on the film (avatar
 * and roles), and at the foot the film's metrics (box office, rating, awards), which are fetched
 * once the card has stayed open for a moment and leave out whatever they have no data for.
 * Rendered in a portal on the body with fixed positioning, because the timeline's
 * scroller clips anything that overflows it. Never interactive: it ignores the pointer, so it
 * cannot cover the nodes around its trigger, and it never takes focus. The poster is only
 * fetched while the card is open.
 */
export function FilmPopover({ id, target, content, lit, bottomEdge, onDismiss }: FilmPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null);
  const side = useRef<{ trigger: HTMLElement; placement: Placement["placement"] } | null>(null);
  const animated = useRef(false);
  const poster = tmdbImage(content.posterPath, "w342");
  const metrics = useFilmMetrics(content.filmId, place !== null);

  // Measure the card and its trigger, then place it before the first paint. It runs again when the
  // metrics arrive (the card's height changes), still before paint: the card keeps its side of the
  // trigger, so the edge facing the trigger stays put and only the far edge moves.
  const metricsStatus = metrics.status;
  useLayoutEffect(() => {
    const card = ref.current;
    if (!card) return;
    if (!target.trigger.isConnected) {
      onDismiss();
      return;
    }
    const prefer = side.current?.trigger === target.trigger ? side.current.placement : undefined;
    const { left, top, placement } = placePopover(
      target.trigger.getBoundingClientRect(),
      { width: card.offsetWidth, height: card.offsetHeight },
      { width: document.documentElement.clientWidth, height: Math.min(window.innerHeight, bottomEdge?.() ?? window.innerHeight) },
      { prefer },
    );
    side.current = { trigger: target.trigger, placement };
    setPlace((current) => (current && current.left === left && current.top === top ? current : { left, top }));
  }, [target, content, metricsStatus, bottomEdge, onDismiss]);

  // Slide up from just below while fading in; no exit animation, and none at all for reduced motion.
  const placed = place !== null;
  useEffect(() => {
    const card = ref.current;
    if (!placed || !card || animated.current) return;
    animated.current = true;
    if (typeof card.animate !== "function" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    card.animate(
      [
        { opacity: 0, transform: "translateY(10px)" },
        { opacity: 1, transform: "none" },
      ],
      { duration: 160, easing: "ease-out" },
    );
  }, [placed]);

  return createPortal(
    <div
      ref={ref}
      id={id}
      role="tooltip"
      className="pointer-events-none fixed z-[1000] flex w-[min(26rem,calc(100vw-1rem))] gap-4 rounded-xl border border-border bg-surface p-4 text-left shadow-2xl shadow-black/60"
      style={{ left: place?.left ?? 0, top: place?.top ?? 0, visibility: place ? "visible" : "hidden" }}
    >
      <div
        className={cn(
          "relative h-[210px] w-[140px] shrink-0 overflow-hidden rounded-md bg-canvas",
          lit ? "shadow-lit" : "border border-strong/20",
        )}
      >
        {poster ? (
          <img src={poster} alt="" width={140} height={210} decoding="async" draggable={false} className="size-full object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center p-2 text-center text-xs font-medium leading-tight text-muted">
            <span className="line-clamp-6 break-words">{content.title}</span>
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div>
          <p className="break-words text-base font-semibold leading-tight text-strong">{content.title}</p>
          <p className="mt-0.5 text-xs tabular-nums text-muted">{content.year}</p>
        </div>
        {content.rows.length > 0 && (
          <ul className="flex flex-col gap-2.5">
            {content.rows.map((row) => (
              <li key={row.personId} className="flex items-start gap-2.5">
                <PersonAvatar name={row.name} profilePath={row.profilePath} size={28} className="mt-px" />
                <p className="min-w-0 pt-1 text-sm leading-snug">
                  <span className="sr-only">{row.name}: </span>
                  <RoleText row={row} />
                </p>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-auto empty:hidden">
          <FilmMetricsRows state={metrics} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
