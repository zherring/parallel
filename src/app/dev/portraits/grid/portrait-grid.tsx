"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { tmdbImage } from "@/lib/images";
import { cutEdgePath, polygonPoints, type PortraitCut } from "@/lib/portrait-cuts";

/** Eight saturated, screen-print-poster colors that sit well together on a near-black page. */
const PALETTE = ["#E63B2E", "#F2C230", "#2E5EAA", "#F28C28", "#1F9E89", "#E5487D", "#6B4BA1", "#3E9E4F"];
const MODES = ["Color", "Montage", "Mix"] as const;
type Mode = (typeof MODES)[number];

/** By grid position: +3 per column, +2 per row (mod 8), so side-by-side, stacked and diagonal neighbors never share a color at any width. */
function colorAt(index: number, columns: number): string {
  return PALETTE[((index % columns) * 3 + Math.floor(index / columns) * 2) % PALETTE.length];
}

export function PortraitGrid({ cards }: { cards: { id: number; cut: PortraitCut }[] }) {
  const [mode, setMode] = useState<Mode>("Mix");
  const [columns, setColumns] = useState(1);
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const flaggedCount = cards.filter(({ cut }) => cut.flagged).length;
  const shown = flaggedOnly ? cards.filter(({ cut }) => cut.flagged) : cards;
  const grid = useRef<HTMLDivElement>(null);

  // Mix is a true checkerboard, so it needs the grid's live column count.
  useEffect(() => {
    const element = grid.current;
    if (!element) return;
    const measure = () => setColumns(getComputedStyle(element).gridTemplateColumns.split(" ").length || 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const montageAt = (i: number) => mode === "Montage" || (mode === "Mix" && (Math.floor(i / columns) + (i % columns)) % 2 === 1);

  return (
    <main style={{ background: "#0d0d0f", color: "#f4f1ea", minHeight: "100vh", padding: "20px 16px 40px", fontFamily: "system-ui, sans-serif" }}>
      <header style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 16, marginBottom: 16 }}>
        <h1 style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: 0 }}>Portrait grid</h1>
        <span style={{ fontSize: 12, color: "#8a8780" }}>{cards.length} artists · {flaggedCount} flagged · 20-vertex cut</span>
        <div role="group" aria-label="Background" style={{ display: "flex", border: "1px solid #3a3936", borderRadius: 999, overflow: "hidden" }}>
          {MODES.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              style={{
                font: "inherit",
                fontSize: 12,
                fontWeight: 600,
                padding: "5px 14px",
                border: 0,
                cursor: "pointer",
                background: mode === m ? "#f4f1ea" : "transparent",
                color: mode === m ? "#0d0d0f" : "#cfccc4",
              }}
            >
              {m}
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-pressed={flaggedOnly}
          onClick={() => setFlaggedOnly((on) => !on)}
          style={{
            font: "inherit",
            fontSize: 12,
            fontWeight: 600,
            padding: "5px 14px",
            border: "1px solid #3a3936",
            borderRadius: 999,
            cursor: "pointer",
            background: flaggedOnly ? "#f4f1ea" : "transparent",
            color: flaggedOnly ? "#0d0d0f" : "#cfccc4",
          }}
        >
          Flagged only
        </button>
        <Link href="/dev/portraits" style={{ fontSize: 12, color: "#8a8780", marginLeft: "auto" }}>
          ← contact sheet
        </Link>
      </header>
      <div ref={grid} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 6 }}>
        {shown.map(({ id, cut }, i) => (
          <figure key={id} style={{ margin: 0 }}>
            <Card id={id} cut={cut} color={colorAt(i, columns)} montage={montageAt(i)} />
            <figcaption style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", padding: "5px 1px 8px" }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cut.name}</span>
              {cut.flagged && (
                <span title={cut.flagReason} style={{ fontSize: 9, letterSpacing: "0.06em", color: "#8a8780", border: "1px solid #3a3936", borderRadius: 3, padding: "0 4px" }}>
                  fallback
                </span>
              )}
            </figcaption>
          </figure>
        ))}
      </div>
    </main>
  );
}

/**
 * True once the element is within a screen or so of the viewport, and then for good. SVG `<image>` has no `loading="lazy"`, so the cards
 * hold back their portrait and the montage's 9 posters until then, instead of fetching ~10 images × every artist on load.
 */
function useNearViewport<T extends Element>() {
  const ref = useRef<T>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element || near) return;
    const observer = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setNear(true), { rootMargin: "600px 0px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [near]);
  return [ref, near] as const;
}

function Card({ id, cut, color, montage }: { id: number; cut: PortraitCut; color: string; montage: boolean }) {
  const [ref, near] = useNearViewport<SVGSVGElement>();
  const [w, h] = cut.size;
  const points = cut.variants["20"];
  const key = `g${id}`;
  return (
    <svg ref={ref} viewBox={`0 0 ${w} ${h}`} style={{ display: "block", width: "100%", height: "auto", aspectRatio: `${w} / ${h}` }} role="img" aria-label={cut.name}>
      <defs>
        <clipPath id={`clip-${key}`}>
          <polygon points={polygonPoints(points, w, h)} />
        </clipPath>
        {montage && <Duotone id={`duo-${key}`} tint={color} />}
      </defs>
      {montage ? <Montage id={key} posters={near ? cut.posters : []} w={w} h={h} /> : <rect width={w} height={h} fill={color} />}
      {near && <image href={tmdbImage(cut.profilePath, "w500")!} width={w} height={h} preserveAspectRatio="none" clipPath={`url(#clip-${key})`} />}
      <path d={cutEdgePath(points, w, h)} fill="none" stroke="#fff" strokeWidth={3} strokeLinejoin="miter" strokeLinecap="square" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** The artist's 3 × 3 poster grid, duotoned from near-black to a dark version of the card's color so the face reads on top. */
function Montage({ id, posters, w, h }: { id: string; posters: string[]; w: number; h: number }) {
  const cw = w / 3;
  const ch = h / 3;
  return (
    <g filter={`url(#duo-${id})`}>
      <rect width={w} height={h} fill="#111" />
      {posters.slice(0, 9).map((path, i) => (
        <image key={path} href={tmdbImage(path, "w154")!} x={(i % 3) * cw} y={Math.floor(i / 3) * ch} width={cw} height={ch} preserveAspectRatio="xMidYMid slice" />
      ))}
    </g>
  );
}

function Duotone({ id, tint }: { id: string; tint: string }) {
  const dark = [0.05, 0.05, 0.06];
  const light = [1, 3, 5].map((at) => (parseInt(tint.slice(at, at + 2), 16) / 255) * 0.7);
  const row = (c: number) => {
    const span = light[c] - dark[c];
    return `${0.2126 * span} ${0.7152 * span} ${0.0722 * span} 0 ${dark[c]}`;
  };
  return (
    <filter id={id} colorInterpolationFilters="sRGB">
      <feColorMatrix type="matrix" values={`${row(0)} ${row(1)} ${row(2)} 0 0 0 1 0`} />
    </filter>
  );
}
