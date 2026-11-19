"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { FilmDot } from "@/components/timeline/film-dot";
import { YearTick } from "@/components/timeline/year-tick";
import { axisFraction, dotScale, labelYears, type Strip } from "@/lib/hero-layout";

/**
 * The one timeline line of the product, a 1px white line at the stage's `--line-y`, running over both halves and on past them `--reach` (the gutters of the
 * "panels" layout, the whole way to the screen's edge in "wide"), fading to nothing at both ends over `--fade`: the mask is opaque from there in, so over the
 * panels it reads against the montage and only the ends carry the fade. The first reveal draws it outward from the middle (`drawLine`, which finds it by
 * `data-line`). It never moves after that. Its parent is the stage's decoration box (hero-stage.tsx `Backdrop`), whose box is the panels', hence the negative inset.
 */
export function TimelineLine() {
  return (
    <div
      data-line=""
      aria-hidden="true"
      className="pointer-events-none absolute -inset-x-(--reach) top-(--line-y) h-px -translate-y-1/2 bg-white/60 [mask-image:linear-gradient(to_right,transparent,#000_var(--fade),#000_calc(100%-var(--fade)),transparent)]"
    />
  );
}

/**
 * The films on the line, drawn the way the pair page's timeline draws them (`FilmDot`, `YearTick`): every film a dot on the line itself, each person's own in
 * their colour and the films they made together larger and white, ringed in the page's colour and over the rest (the year of the first film of either person at the
 * axis's left end, the last at its right, each film by its year, hero-layout.ts `stripOf`). Under a crowded axis (a long career on a phone) the dots are smaller
 * (`dotScale`). Over the line, the years between the caps' (`labelYears`, thinned by the room they have). It spans the axis between the year caps: the
 * band (`--band-w`, hero-layout.ts `BAND`: half the screen, centred on the seam, wider on a narrow one) less `--axis-pad` at each end, which is the
 * caps' room, so the line is the only thing that runs out to the screen's edges. The size of the dots and the years labelled come from that axis's width, so
 * they follow the band. `data-dot` and `data-x` are what hero-motion.ts pops in, left to right.
 */
export function TimelineStrip({ strip, colors }: { strip: Strip; colors: readonly [string, string] }) {
  const root = useRef<HTMLDivElement>(null);
  // The axis's width in px (the band's, less the caps' room), for the size of the dots and which years fit; 0 (full-size dots, no years) for the server's markup and until it is measured.
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const measure = () => setWidth(Math.round(element.getBoundingClientRect().width));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const scale = dotScale(strip.axis, width);
  const dot = (fraction: number, index: number, tone: "plain" | "lit", fill: string) => (
    <FilmDot
      key={`${tone}-${fill}-${index}`}
      data-dot=""
      data-shared={tone === "lit" ? "" : undefined}
      data-x={fraction.toFixed(3)}
      className="[transform-box:fill-box] origin-center"
      x={`${(fraction * 100).toFixed(3)}%`}
      y={0.5}
      tone={tone}
      colored
      palette
      fill={fill}
      scale={scale}
    />
  );
  return (
    <div ref={root} aria-hidden="true" className="pointer-events-none absolute left-1/2 top-(--line-y) h-0 w-(--axis-w) -translate-x-1/2">
      <svg className="absolute left-0 top-0 h-px w-full -translate-y-1/2 overflow-visible">
        {strip.own.map((fractions, lane) => fractions.map((fraction, index) => dot(fraction, index, "plain", colors[lane])))}
        {strip.together.map((fraction, index) => dot(fraction, index, "lit", "#fff"))}
      </svg>
      <div className="absolute inset-x-0 bottom-[9px]">
        {labelYears(strip.axis, width).map((year) => (
          <YearTick key={year} tick={{ kind: "year", label: String(year) }} x={`${(axisFraction(year, strip.axis) * 100).toFixed(3)}%`} above mark={false} labelClass="text-white/75 [text-shadow:0_1px_6px_rgb(0_0_0/0.85)]" />
        ))}
      </div>
    </div>
  );
}
