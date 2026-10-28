"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type { AwardsDisplay, RatingDisplay, RevenueDisplay } from "@/lib/film-metrics";
import { Stars } from "./film-metrics-rows";

/**
 * The contents of the Rating, Box office and Awards cells of the "films together" table. Each
 * cell is one of: a placeholder while its film is loading, a quiet dash when the film has
 * nothing to show, or the numbers. The words and thresholds come from `src/lib/film-metrics.ts`;
 * these only lay them out.
 */

/** Gentle fade-in for cells that fill in after loading, unless the visitor prefers reduced motion. */
function FadeIn({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof element.animate !== "function") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    element.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: "ease-out" });
  }, []);
  return <div ref={ref}>{children}</div>;
}

/** A quiet "nothing here", spoken as "No data" rather than as a dash. */
export function Dash() {
  return (
    <>
      <span aria-hidden className="text-muted">
        —
      </span>
      <span className="sr-only">No data</span>
    </>
  );
}

/** Bars that hold the room of the real cell while its film loads; hidden from assistive technology (the table says it is busy). */
export function CellSkeleton({ widths }: { widths: readonly string[] }) {
  return (
    <div aria-hidden className="flex flex-col gap-1.5 py-0.5 motion-safe:animate-pulse">
      {widths.map((width) => (
        <span key={width} className={`block h-2 rounded-full bg-border ${width}`} />
      ))}
    </div>
  );
}

export function RatingCell({ rating }: { rating: RatingDisplay }) {
  return (
    <FadeIn>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Stars stars={rating.stars} />
        <p className="whitespace-nowrap tabular-nums">
          <span className="font-semibold text-strong">{rating.score}</span>
          <span className="sr-only"> out of 10</span>
          <span className="text-muted"> {rating.votesLabel}</span>
          {rating.fewRatings && <span className="sr-only"> ({rating.votes} votes)</span>}
        </p>
      </div>
    </FadeIn>
  );
}

export function BoxOfficeCell({ revenue }: { revenue: RevenueDisplay }) {
  return (
    <FadeIn>
      <p className="tabular-nums">
        <span className="font-semibold text-strong">{revenue.amount}</span>
        <span className="sr-only"> {revenue.label}</span>
      </p>
      {revenue.multiple && (
        <p className="text-xs tabular-nums text-muted">
          {revenue.multiple} <span>budget</span>
        </p>
      )}
    </FadeIn>
  );
}

export function AwardsCell({ awards }: { awards: AwardsDisplay }) {
  return (
    <FadeIn>
      <ul className="space-y-0.5">
        {awards.parts.map((part, index) => (
          <li key={part} className={index === 0 ? "font-semibold text-strong" : "text-body"}>
            {part}
          </li>
        ))}
      </ul>
    </FadeIn>
  );
}
