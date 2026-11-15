import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import data from "@/lib/portrait-cuts.json";
import { tmdbImage } from "@/lib/images";
import { cutEdgePath, polygonPoints, PORTRAIT_IDS, VERTEX_COUNTS, type PortraitCut, type PortraitCuts, type VertexCount } from "@/lib/portrait-cuts";

export const metadata: Metadata = { title: "Portrait cuts (development)", robots: { index: false, follow: false } };

const CUTS = data as unknown as PortraitCuts;
const YELLOW = "#F7CB15";
const PALETTE = ["#E4572E", "#17BEBB", "#76B041", "#2E86AB", "#A23B72", "#F18F01", "#6A4C93", "#C73E1D", "#3BB273", "#1B998B", "#EF476F"];
const CELL = 120;

/** A simple deterministic color per artist. */
function artistColor(id: number): string {
  return PALETTE[id % PALETTE.length];
}

type Background = { kind: "flat"; color: string } | { kind: "montage"; posters: string[]; tint: string };

/**
 * Spike (zherring/spike-portraits): a contact sheet of the "cut-paper polygon" treatment on TMDB portraits, for judging the look. A
 * development-only page (a 404 in production), like /dev/x-preview. Points come from portrait-cuts.json (`npm run portraits:cut`); the
 * image is always the original TMDB URL, clipped in the browser.
 */
export default function PortraitsPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const rows = PORTRAIT_IDS.map((id) => [id, CUTS[id]] as const).filter((row): row is readonly [number, PortraitCut] => Boolean(row[1]));
  const headers = ["Original", "12 vertices", "20 vertices", "32 vertices", "20 · flat color", "20 · poster montage"];

  return (
    <main style={{ background: "#f4f1ea", color: "#111", minHeight: "100vh", padding: 16, fontFamily: "system-ui, sans-serif", fontSize: 12 }}>
      <h1 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 4px" }}>Portrait cuts (spike)</h1>
      <p style={{ margin: "0 0 12px", color: "#555" }}>
        {rows.length} artists · {rows[0]?.[1].model ?? "no data"} · regenerate with <code>npm run portraits:cut</code> · <Link href="/dev/portraits/grid">grid view →</Link>
      </p>
      <div style={{ display: "grid", gridTemplateColumns: `140px repeat(${headers.length}, ${CELL}px)`, gap: 8, alignItems: "center" }}>
        <div />
        {headers.map((label) => (
          <div key={label} style={{ fontWeight: 600, color: "#555" }}>
            {label}
          </div>
        ))}
        {rows.map(([id, cut]) => (
          <Row key={id} id={id} cut={cut} />
        ))}
      </div>
    </main>
  );
}

function Row({ id, cut }: { id: number; cut: PortraitCut }) {
  const src = tmdbImage(cut.profilePath, "w500")!;
  const [w, h] = cut.size;
  return (
    <>
      <div>
        <div style={{ fontWeight: 600 }}>{cut.name}</div>
        <div style={{ color: "#777" }}>
          {id} · mask {Math.round(cut.coverage * 100)}%
        </div>
        {cut.model !== "birefnet-portrait" && <div style={{ color: "#b42318" }}>{cut.model} (fallback)</div>}
      </div>
      <img src={src} alt={cut.name} width={CELL} height={(CELL * h) / w} style={{ display: "block" }} />
      {VERTEX_COUNTS.map((count) => (
        <Cut key={count} id={`${id}-${count}-y`} cut={cut} count={count} background={{ kind: "flat", color: YELLOW }} />
      ))}
      <Cut id={`${id}-20-flat`} cut={cut} count="20" background={{ kind: "flat", color: artistColor(id) }} />
      <Cut id={`${id}-20-montage`} cut={cut} count="20" background={{ kind: "montage", posters: cut.posters, tint: artistColor(id) }} />
    </>
  );
}

function Cut({ id, cut, count, background }: { id: string; cut: PortraitCut; count: VertexCount; background: Background }) {
  const [w, h] = cut.size;
  const points = cut.variants[count];
  const src = tmdbImage(cut.profilePath, "w500")!;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={CELL} height={(CELL * h) / w} style={{ display: "block", overflow: "hidden" }}>
      <defs>
        <clipPath id={`clip-${id}`}>
          <polygon points={polygonPoints(points, w, h)} />
        </clipPath>
        {background.kind === "montage" && <Duotone id={`duo-${id}`} tint={background.tint} />}
      </defs>
      {background.kind === "flat" ? <rect width={w} height={h} fill={background.color} /> : <Montage id={id} posters={background.posters} w={w} h={h} />}
      <image href={src} width={w} height={h} preserveAspectRatio="none" clipPath={`url(#clip-${id})`} />
      <path
        d={cutEdgePath(points, w, h)}
        fill="none"
        stroke="#fff"
        strokeWidth={3}
        strokeLinejoin="miter"
        strokeLinecap="square"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** A 3 × 3 grid of the artist's posters (a frame and a poster are both 2:3), duotoned dark so the face reads on top. */
function Montage({ id, posters, w, h }: { id: string; posters: string[]; w: number; h: number }) {
  const cw = w / 3;
  const ch = h / 3;
  return (
    <g filter={`url(#duo-${id})`}>
      <rect width={w} height={h} fill="#111" />
      {posters.slice(0, 9).map((path, i) => (
        <image
          key={path}
          href={tmdbImage(path, "w154")!}
          x={(i % 3) * cw}
          y={Math.floor(i / 3) * ch}
          width={cw}
          height={ch}
          preserveAspectRatio="xMidYMid slice"
        />
      ))}
    </g>
  );
}

/** Luminance mapped from near-black to a darkened version of the artist's color. */
function Duotone({ id, tint }: { id: string; tint: string }) {
  const dark = [0.06, 0.06, 0.08];
  const light = [1, 3, 5].map((at) => (parseInt(tint.slice(at, at + 2), 16) / 255) * 0.75);
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
