import type { CSSProperties } from "react";
import type { Dot, Strip } from "@/lib/hero-layout";

/**
 * The one timeline line of the product, a 1px white line at the stage's `--line-y`, running over both halves and on past them `--reach` (the gutters of the
 * "panels" layout, the whole way to the screen's edge in "wide"), fading to nothing at both ends over `--fade`: the mask is opaque from there in, so over the
 * panels it reads against the montage and only the ends carry the fade. The first reveal draws it outward from the middle (`drawLine`, which finds it by
 * `data-line`). It never moves after that. Its parent is the stage's link, whose box is the panels', hence the negative inset.
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
 * The films on the line, as dots across the axis (the year of the first film of either person at its left end, the last at its right, each film by its year,
 * hero-layout.ts `stripOf`): each person's own films in their colour in a lane hugging the line (the first person's above it, the second's below it), the
 * films they made together in white on the line itself, a little larger, ringed in the page's colour and over the lanes' dots, as the made-together films
 * are on a pair's page. Several films of one person in a year sit nudged apart into a small cluster (`Dot.nudge`). It spans the axis between the year
 * caps (`--axis-pad` in from the panels' outer edges); `data-dot` and `data-x` are what hero-motion.ts pops in, left to right.
 */
export function TimelineStrip({ strip, colors }: { strip: Strip; colors: readonly [string, string] }) {
  const dots = (list: readonly Dot[], className: string, style: (dot: Dot) => CSSProperties) =>
    list.map((dot, index) => (
      <span
        key={index}
        data-dot=""
        data-x={dot.x.toFixed(3)}
        className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full ${className}`}
        style={{ left: `calc(${(dot.x * 100).toFixed(3)}% + ${dot.nudge}px)`, ...style(dot) }}
      />
    ));
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-(--axis-pad) top-(--line-y) h-0">
      {strip.own.map((own, lane) =>
        dots(own, "size-(--dot)", () => ({ top: lane === 0 ? "calc(-1 * var(--lane))" : "var(--lane)", backgroundColor: colors[lane] })),
      )}
      {dots(strip.together, "size-(--dot-together) bg-white shadow-[0_0_0_1.5px_var(--bg)]", () => ({ top: 0 }))}
    </div>
  );
}
