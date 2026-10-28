"use client";

import { useEffect, useMemo, useRef } from "react";
import { DollarSign, Star, StarHalf, Trophy } from "lucide-react";
import {
  filmMetricsDisplay,
  type AwardsDisplay,
  type RatingDisplay,
  type RevenueDisplay,
} from "@/lib/film-metrics";
import type { FilmMetricsState } from "./use-film-metrics";

/** Every row is one 16px line (icons included) so reserved and final rows take the same room. */
const ROW = "flex items-start gap-2 text-xs leading-4";
const ICON = "size-4 shrink-0 text-muted";

const Dot = () => (
  <span aria-hidden className="text-muted">
    {" ·"}
  </span>
);

/** A piece of a row that stays on one line; `more` ends it with the separator and lets the row wrap after it. */
function Chunk({ children, more = false }: { children: React.ReactNode; more?: boolean }) {
  return (
    <>
      <span className="whitespace-nowrap">
        {children}
        {more && <Dot />}
      </span>
      {more && " "}
    </>
  );
}

function RevenueRow({ revenue }: { revenue: RevenueDisplay }) {
  return (
    <li className={ROW}>
      <DollarSign aria-hidden className={ICON} />
      <p className="min-w-0">
        <span className="sr-only">Box office: </span>
        <Chunk more={revenue.multiple !== null}>
          <span className="font-semibold text-strong">{revenue.amount}</span>
          <span className="text-muted"> {revenue.label}</span>
        </Chunk>
        {revenue.multiple && (
          <Chunk>
            <span className="font-semibold text-strong">{revenue.multiple}</span>
            <span className="text-muted"> budget</span>
          </Chunk>
        )}
      </p>
    </li>
  );
}

/** Five stars in half-star steps: filled ones bright, the empty rest (and the empty half) muted outlines. */
export function Stars({ stars }: { stars: RatingDisplay["stars"] }) {
  const star = "size-3.5 shrink-0";
  return (
    <span aria-hidden className="mt-px flex h-3.5 shrink-0 gap-px">
      {Array.from({ length: stars.full }, (_, i) => (
        <Star key={`full-${i}`} className={`${star} text-strong`} fill="currentColor" />
      ))}
      {stars.half > 0 && (
        <span className={`relative ${star}`}>
          <Star className={`absolute inset-0 ${star} text-muted`} />
          <StarHalf className={`absolute inset-0 ${star} text-strong`} fill="currentColor" />
        </span>
      )}
      {Array.from({ length: stars.empty }, (_, i) => (
        <Star key={`empty-${i}`} className={`${star} text-muted`} />
      ))}
    </span>
  );
}

function RatingRow({ rating }: { rating: RatingDisplay }) {
  return (
    // On a card too narrow for stars and text side by side, the text drops under the stars.
    <li className={`${ROW} flex-wrap gap-y-0.5`}>
      <Stars stars={rating.stars} />
      <p className="min-w-0">
        <span className="sr-only">Rating: </span>
        <Chunk more>
          <span className="font-semibold tabular-nums text-strong">{rating.score}</span>
          <span className="sr-only"> out of 10</span>
        </Chunk>
        <Chunk more>
          <span className="text-muted">{rating.votesLabel}</span>
          {rating.fewRatings && <span className="sr-only"> ({rating.votes} votes)</span>}
        </Chunk>
        <Chunk>
          <span className="text-muted">{rating.source}</span>
        </Chunk>
      </p>
    </li>
  );
}

function AwardsRow({ awards }: { awards: AwardsDisplay }) {
  return (
    <li className={ROW}>
      <Trophy aria-hidden className={ICON} />
      <p className="min-w-0">
        <span className="sr-only">Awards: </span>
        {awards.parts.map((part, index) => (
          <span key={part}>
            {index > 0 && " "}
            <span className="font-semibold text-strong">{part}</span>
            {index < awards.parts.length - 1 && <Dot />}
          </span>
        ))}
      </p>
    </li>
  );
}

/** Placeholder rows that hold the space of the real ones while the request is out. */
function Skeleton() {
  const bar = "h-2 rounded-full bg-border";
  return (
    <div aria-hidden className="flex flex-col gap-1.5 motion-safe:animate-pulse">
      {["w-28", "w-36", "w-24"].map((width) => (
        <div key={width} className={ROW}>
          <span className="flex size-4 shrink-0 items-center justify-center">
            <span className="size-3 rounded-sm bg-border" />
          </span>
          <span className="flex h-4 items-center">
            <span className={`${bar} ${width}`} />
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * The metric rows at the foot of the film card: box office, rating, awards, left aligned, each
 * left out when it has nothing to show. While the request is pending three placeholder rows
 * reserve the space; a failed request shows nothing. The rows are plain text next to the
 * credits, so they are part of the tooltip's description for assistive technology (the icons and
 * the placeholders are hidden from it). Fades in once data replaces the placeholders, unless the
 * user prefers reduced motion.
 */
export function FilmMetricsRows({ state, today }: { state: FilmMetricsState; today: string }) {
  const display = useMemo(
    () => (state.status === "ready" ? filmMetricsDisplay(state.metrics, today) : null),
    [state, today],
  );
  const listRef = useRef<HTMLUListElement>(null);
  const sawPending = useRef(false);

  const status = state.status;
  useEffect(() => {
    if (status === "pending") {
      sawPending.current = true;
      return;
    }
    const list = listRef.current;
    if (!sawPending.current || !list) return;
    sawPending.current = false;
    if (typeof list.animate !== "function" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    list.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: "ease-out" });
  }, [status]);

  if (state.status === "pending") return <Skeleton />;
  if (!display || (!display.revenue && !display.rating && !display.awards)) return null;

  return (
    <ul ref={listRef} className="flex flex-col gap-1.5">
      {display.revenue && <RevenueRow revenue={display.revenue} />}
      {display.rating && <RatingRow rating={display.rating} />}
      {display.awards && <AwardsRow awards={display.awards} />}
    </ul>
  );
}
