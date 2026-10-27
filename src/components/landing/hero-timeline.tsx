"use client";

import { useLayoutEffect, useRef } from "react";
import { redraw } from "@/components/landing/hero-motion";

/** Where the stage's pieces sit, in the stage's own 380 x 446 coordinates. */
export const STAGE = {
  width: 380,
  height: 446,
  person: [
    { left: 6, top: 4, tilt: -7 },
    { left: 168, top: 26, tilt: 4 },
  ],
  poster: [
    { left: 86, top: 326, tilt: -3 },
    { left: 152, top: 322, tilt: 1 },
    { left: 218, top: 328, tilt: 4 },
  ],
  personSize: { width: 190, height: 250 },
  posterSize: { width: 76, height: 114 },
} as const;

/** The timeline line runs through the middle of the posters. */
export const LINE_Y = 383;

const POSTER_X = STAGE.poster.map((poster) => poster.left + STAGE.posterSize.width / 2);
const BUS_Y = 302;

const CONNECTOR = [
  // From under each person down to the bus...
  `M100 250C100 282 ${POSTER_X[0]} 270 ${POSTER_X[0]} ${BUS_Y}`,
  `M268 270C268 290 ${POSTER_X[2]} 284 ${POSTER_X[2]} ${BUS_Y}`,
  // ...which runs across above the posters, with a drop onto each one.
  `M${POSTER_X[0]} ${BUS_Y}V326M${POSTER_X[0]} ${BUS_Y}H${POSTER_X[2]}V328`,
  `M${POSTER_X[1]} ${BUS_Y}V322`,
].join("");

/**
 * The one timeline line of the product, running across the whole hero and fading out at both
 * ends, with a few small nodes on it. The posters sit on it. It is a plain element in the page's
 * flow of layers (not part of the scaled stage) so it can be as wide as the screen; `y` places it
 * at the posters' middle.
 */
export function TimelineLine() {
  const dot = "radial-gradient(circle, rgb(74 88 106) 0 2px, transparent 2.6px)";
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute left-1/2 h-3 w-[min(100vw,1600px)] -translate-x-1/2 -translate-y-1/2 [mask-image:linear-gradient(to_right,transparent,#000_22%,#000_78%,transparent)]"
      style={{
        top: `calc(var(--s) * ${LINE_Y}px)`,
        backgroundImage: [
          "linear-gradient(rgb(136 153 170 / 0.34), rgb(136 153 170 / 0.34))",
          dot,
          dot,
        ].join(","),
        backgroundSize: "100% 1px, 137px 100%, 211px 100%",
        backgroundPosition: "0 50%, 23px 0, 91px 0",
        backgroundRepeat: "no-repeat, repeat-x, repeat-x",
      }}
    />
  );
}

/**
 * The thin green connector from the people down to the posters, and the lit nodes on it. When
 * the scene changes the connector draws itself again and the lit nodes pulse once.
 */
export function HeroConnector({ seq, reduced }: { seq: number; reduced: boolean }) {
  const ref = useRef<SVGSVGElement>(null);

  useLayoutEffect(() => {
    const svg = ref.current;
    if (seq === 0 || !svg) return;
    const animations = redraw(svg, { reduced });
    return () => animations.forEach((animation) => animation.cancel());
  }, [seq, reduced]);

  return (
    <svg
      ref={ref}
      width={STAGE.width}
      height={STAGE.height}
      viewBox={`0 0 ${STAGE.width} ${STAGE.height}`}
      fill="none"
      aria-hidden="true"
      className="pointer-events-none absolute left-0 top-0 overflow-visible"
    >
      <path
        data-connector=""
        d={CONNECTOR}
        pathLength={1}
        stroke="var(--lit)"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="1"
        strokeDashoffset="0"
        opacity="0.75"
      />
      {POSTER_X.map((x) => (
        <g key={x} data-pulse="" style={{ transformBox: "fill-box", transformOrigin: "center" }}>
          <circle cx={x} cy={BUS_Y} r="8" fill="var(--lit)" opacity="0.14" />
          <circle cx={x} cy={BUS_Y} r="3.2" fill="var(--lit)" />
        </g>
      ))}
    </svg>
  );
}
