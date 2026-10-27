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

const Separator = () => (
  <span aria-hidden className="text-muted">
    {" · "}
  </span>
);

function RevenueRow({ revenue }: { revenue: RevenueDisplay }) {
  return (
    <li className={ROW}>
      <DollarSign aria-hidden className={ICON} />
      <p className="min-w-0">
        <span className="sr-only">Box office: </span>
        <span className="font-semibold text-strong">{revenue.amount}</span>
        <span className="text-muted"> {revenue.label}</span>
        {revenue.multiple && (
          <>
            <Separator />
            <span className="font-semibold text-strong">{revenue.multiple}</span>
            <span className="text-muted"> budget</span>
          </>
        )}
      </p>
    </li>
  );
}

/** Five stars in half-star steps: filled ones bright, the empty rest (and the empty half) muted outlines. */
function Stars({ stars }: { stars: RatingDisplay["stars"] }) {
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
    <li className={ROW}>
      <Stars stars={rating.stars} />
      <p className="min-w-0">
        <span className="sr-only">Rating: </span>
        <span className="font-semibold tabular-nums text-strong">{rating.score}</span>
        <span className="sr-only"> out of 10</span>
        <Separator />
        <span className="text-muted">{rating.fewRatings ? `few ratings (${rating.votes})` : rating.votesLabel}</span>
        <Separator />
        <span className="text-muted">{rating.source}</span>
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
            {index > 0 && <Separator />}
            <span className="font-semibold text-strong">{part}</span>
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
export function FilmMetricsRows({ state }: { state: FilmMetricsState }) {
  const display = useMemo(
    () => (state.status === "ready" ? filmMetricsDisplay(state.metrics, new Date()) : null),
    [state],
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
