"use client";

import { useLayoutEffect, useRef } from "react";
import { redraw } from "@/components/landing/hero-motion";

/** Where the stage's pieces sit, in the stage's own 380 x 484 coordinates. */
export const STAGE = {
  width: 380,
  height: 484,
  person: [
    { left: 8, top: 18, tilt: -7 },
    { left: 166, top: 46, tilt: 4 },
  ],
  poster: [
    { left: 22, top: 366, tilt: -3 },
    { left: 86, top: 362, tilt: 1 },
    { left: 150, top: 368, tilt: 4 },
  ],
  personSize: { width: 190, height: 250 },
  posterSize: { width: 76, height: 114 },
} as const;

const LANES = [326, 348] as const;
const SHARED_X = STAGE.poster.map((poster) => poster.left + STAGE.posterSize.width / 2);
// Films that are not shared: small quiet nodes along each lane, clear of the lit ones.
const QUIET_NODES: readonly (readonly number[])[] = [
  [-86, -34, 14, 96, 232, 292, 344, 410],
  [-70, -12, 36, 158, 214, 270, 322, 388],
];

const CONNECTOR = [
  // From under each portrait down to its lane...
  "M100 254C100 296 60 296 60 326",
  "M262 282C262 326 188 322 188 348",
  // ...and from the lit nodes straight down to the posters.
  `M${SHARED_X[0]} 326V372`,
  `M${SHARED_X[1]} 326V368`,
  `M${SHARED_X[2]} 326V374`,
].join("");

/**
 * The product in miniature, behind the cards: two faint lanes with a node per film, the shared
 * films lit green, and a thin green connector from the people to the posters. When the scene
 * changes the connector draws itself again and the lit nodes pulse once.
 */
export function HeroLanes({ seq, reduced }: { seq: number; reduced: boolean }) {
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
      <defs>
        <linearGradient id="hero-lane-fade" gradientUnits="userSpaceOnUse" x1="-110" y1="0" x2="500" y2="0">
          <stop offset="0" stopColor="#8899aa" stopOpacity="0" />
          <stop offset="0.22" stopColor="#8899aa" stopOpacity="0.32" />
          <stop offset="0.7" stopColor="#8899aa" stopOpacity="0.32" />
          <stop offset="1" stopColor="#8899aa" stopOpacity="0" />
        </linearGradient>
      </defs>

      {LANES.map((y) => (
        <line key={y} x1="-110" x2="500" y1={y} y2={y} stroke="url(#hero-lane-fade)" strokeWidth="1" />
      ))}
      {LANES.map((y, lane) =>
        QUIET_NODES[lane].map((x) => <circle key={`${y}-${x}`} cx={x} cy={y} r="2" fill="#4a586a" />)
      )}

      <path
        data-connector=""
        d={CONNECTOR}
        pathLength={1}
        stroke="var(--lit)"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeDasharray="1"
        strokeDashoffset="0"
        opacity="0.75"
      />

      {LANES.flatMap((y) =>
        SHARED_X.map((x) => (
          <g
            key={`${y}-${x}`}
            data-pulse=""
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
          >
            <circle cx={x} cy={y} r="8" fill="var(--lit)" opacity="0.14" />
            <circle cx={x} cy={y} r="3.2" fill="var(--lit)" />
          </g>
        )),
      )}
    </svg>
  );
}
