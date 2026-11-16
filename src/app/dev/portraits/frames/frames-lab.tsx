"use client";

import Link from "next/link";
import { useId, type CSSProperties, type ReactNode } from "react";
import { PORTRAIT_PALETTE } from "@/lib/portrait-cuts";
import { ControlsPanel, createSettingsStore, Group, PANEL_W, PanelNote, pick, Segment } from "../controls-panel";

const STYLES = ["rough", "clean", "both"] as const;
type FrameStyle = (typeof STYLES)[number];

const BGS = ["dark", "light"] as const;
type Bg = (typeof BGS)[number];
/** The app's dark background, and a light one, as on /dev/portraits/blend. */
const BG_COLOR: Record<Bg, string> = { dark: "#14181c", light: "#f4f1ea" };
const INK: Record<Bg, { text: string; muted: string; line: string }> = {
  dark: { text: "#f4f1ea", muted: "#8a8780", line: "#2a2f35" },
  light: { text: "#14181c", muted: "#6b6860", line: "#d8d3c8" },
};

const SIZES = ["s", "m", "l"] as const;
type Size = (typeof SIZES)[number];
/** The poster's width in px; it is 2:3. */
const POSTER_W: Record<Size, number> = { s: 56, m: 84, l: 120 };

/** Placeholder poster: dark on the dark bg, white on the light bg (it only needs to stand apart from the overlap edge). */
const POSTER_FILL: Record<"dark" | "light", string> = { dark: "#111827", light: "#fff" };

interface Settings {
  style: FrameStyle;
  /** How far each shape extends past the poster, in % of the poster's width. */
  margin: number;
  /** How far apart the two shapes are on each axis, in % of the poster's width. */
  offset: number;
  /** Rough only: how ragged the cut is, 0–100. */
  jitter: number;
  seed: number;
  bg: Bg;
  size: Size;
  open: boolean;
}

/** Zach's picks (2026-11-16): jitter follows the size (smaller posters get more), margin 10%, offset 3%. */
const JITTER_BY_SIZE: Record<Size, number> = { s: 35, m: 25, l: 20 };
const DEFAULTS: Settings = { style: "rough", margin: 10, offset: 3, jitter: JITTER_BY_SIZE.m, seed: 1, bg: "dark", size: "m", open: true };
/** The overlap is white on the dark bg and black on the light one. */
const OVERLAP: Record<Bg, string> = { dark: "#fff", light: "#000" };

const RANGES = { margin: [2, 40], offset: [0, 30], jitter: [0, 100] } as const;

const parseInt0 = (value: unknown, [min, max]: readonly [number, number]): number | null => {
  const n = typeof value === "number" ? value : value === null || value === undefined || value === "" ? NaN : Number(value);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};

/** `?style=`, `?margin=`, `?offset=`, `?jitter=`, `?seed=`, `?bg=`, `?size=`, then localStorage, then the defaults. */
const { useSettings, setSettings } = createSettingsStore<Settings>({
  storageKey: "spike-portrait-frames-v2",
  defaults: DEFAULTS,
  read: (params, saved) => {
    const size = pick(SIZES, params.get("size")) ?? pick(SIZES, saved.size) ?? DEFAULTS.size;
    return {
      style: pick(STYLES, params.get("style")) ?? pick(STYLES, saved.style) ?? DEFAULTS.style,
      margin: parseInt0(params.get("margin"), RANGES.margin) ?? parseInt0(saved.margin, RANGES.margin) ?? DEFAULTS.margin,
      offset: parseInt0(params.get("offset"), RANGES.offset) ?? parseInt0(saved.offset, RANGES.offset) ?? DEFAULTS.offset,
      jitter: parseInt0(params.get("jitter"), RANGES.jitter) ?? parseInt0(saved.jitter, RANGES.jitter) ?? JITTER_BY_SIZE[size],
      seed: parseInt0(params.get("seed"), [0, 1e9]) ?? parseInt0(saved.seed, [0, 1e9]) ?? DEFAULTS.seed,
      bg: pick(BGS, params.get("bg")) ?? pick(BGS, saved.bg) ?? DEFAULTS.bg,
      size,
    };
  },
  toParams: (s) => ({
    style: s.style === DEFAULTS.style ? null : s.style,
    margin: s.margin === DEFAULTS.margin ? null : String(s.margin),
    offset: s.offset === DEFAULTS.offset ? null : String(s.offset),
    jitter: s.jitter === JITTER_BY_SIZE[s.size] ? null : String(s.jitter),
    seed: s.seed === DEFAULTS.seed ? null : String(s.seed),
    bg: s.bg === DEFAULTS.bg ? null : s.bg,
    size: s.size === DEFAULTS.size ? null : s.size,
  }),
});

function pairsOf<T>(items: readonly T[]): [T, T][] {
  return items.flatMap((a, i) => items.slice(i + 1).map((b) => [a, b] as [T, T]));
}

/** mulberry32, seeded from a string (FNV-1a). */
function prng(key: string): () => number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 0x01000193);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Pt = [number, number];
interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const rectPoints = ({ x0, y0, x1, y1 }: Box): Pt[] => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];

/**
 * A cut-paper polygon around `box`: the 4 corners jittered and 4–10 more points along the edges pushed mostly outward (no spikes).
 * `w` is the poster width, for scale.
 */
function roughPoints(box: Box, w: number, jitter: number, rand: () => number): Pt[] {
  const j = (jitter / 100) * w * 0.12;
  const between = (lo: number, hi: number) => lo + rand() * (hi - lo);
  const corners: Pt[] = rectPoints(box);
  const normals: Pt[] = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ];
  const extras = [0, 0, 0, 0];
  const extraCount = 4 + Math.floor(rand() * 7);
  for (let i = 0; i < extraCount; i++) extras[Math.floor(rand() * 4)]++;

  const points: Pt[] = [];
  for (let e = 0; e < 4; e++) {
    const [ax, ay] = corners[e];
    const [bx, by] = corners[(e + 1) % 4];
    const [nx, ny] = normals[e];
    const at = (t: number, out: number): Pt => [ax + (bx - ax) * t + nx * out, ay + (by - ay) * t + ny * out];
    points.push([ax + between(-j, j), ay + between(-j, j)]);
    const marks: { t: number; pts: Pt[] }[] = [];
    for (let k = 0; k < extras[e]; k++) {
      const t = between(0.12, 0.88);
      marks.push({ t, pts: [at(t, between(-0.4 * j, j))] });
    }
    marks.sort((m, n) => m.t - n.t).forEach((m) => points.push(...m.pts));
  }
  return points;
}

interface Frame {
  a: Pt[];
  b: Pt[];
  view: Box;
}

/** Shape A (first colour) nudged up-left, shape B down-right; each is the poster box (0,0)–(w,1.5w) grown by the margin. */
function frameFor(colors: [string, string], style: "clean" | "rough", s: Settings, w: number): Frame {
  const h = w * 1.5;
  const m = (s.margin / 100) * w;
  const o = (s.offset / 100) * w;
  const grow = (dx: number, dy: number): Box => ({ x0: -m + dx, y0: -m + dy, x1: w + m + dx, y1: h + m + dy });
  const boxA = grow(-o / 2, -o / 2);
  const boxB = grow(o / 2, o / 2);
  const a = style === "clean" ? rectPoints(boxA) : roughPoints(boxA, w, s.jitter, prng(`${colors[0]}${colors[1]}:a:${s.seed}`));
  const b = style === "clean" ? rectPoints(boxB) : roughPoints(boxB, w, s.jitter, prng(`${colors[0]}${colors[1]}:b:${s.seed}`));
  const all = [...a, ...b];
  const pad = 2;
  return {
    a,
    b,
    view: {
      x0: Math.min(...all.map((p) => p[0])) - pad,
      y0: Math.min(...all.map((p) => p[1])) - pad,
      x1: Math.max(...all.map((p) => p[0])) + pad,
      y1: Math.max(...all.map((p) => p[1])) + pad,
    },
  };
}

const toPath = (pts: Pt[]) => pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");

/**
 * Stack: shape B in colour B, shape A in colour A, then shape B again in white clipped to shape A (the true intersection), then the poster.
 * No blend modes.
 */
function FramedPoster({ colors, style, settings, w }: { colors: [string, string]; style: "clean" | "rough"; settings: Settings; w: number }) {
  const uid = useId().replace(/:/g, "");
  const { a, b, view } = frameFor(colors, style, settings, w);
  const h = w * 1.5;
  const vw = view.x1 - view.x0;
  const vh = view.y1 - view.y0;
  return (
    <svg width={vw} height={vh} viewBox={`${view.x0} ${view.y0} ${vw} ${vh}`} aria-hidden data-frame={style}>
      <defs>
        <clipPath id={`${uid}a`}>
          <polygon points={toPath(a)} />
        </clipPath>
      </defs>
      <polygon points={toPath(b)} fill={colors[1]} />
      <polygon points={toPath(a)} fill={colors[0]} />
      <polygon points={toPath(b)} fill={OVERLAP[settings.bg]} clipPath={`url(#${uid}a)`} data-overlap />
      <rect x={0} y={0} width={w} height={h} fill={POSTER_FILL[settings.bg]} />
      <text x={w / 2} y={h / 2} fill="#6b7280" fontSize={Math.max(10, w * 0.14)} textAnchor="middle" dominantBaseline="middle" fontFamily="system-ui, sans-serif">
        poster
      </text>
    </svg>
  );
}

export function FramesLab() {
  const settings = useSettings();
  const { style, bg, size } = settings;
  const ink = INK[bg];
  const w = POSTER_W[size];
  const pairs = pairsOf(PORTRAIT_PALETTE);
  const styles: ("clean" | "rough")[] = style === "both" ? ["clean", "rough"] : [style];
  const cellMin = Math.round(w * 1.9 * styles.length + 24);

  return (
    <main
      style={{
        background: BG_COLOR[bg],
        color: ink.text,
        minHeight: "100vh",
        padding: `20px ${settings.open ? PANEL_W + 44 : 16}px 40px 16px`,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <header style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16, marginBottom: 16 }}>
        <h1 style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: 0 }}>Overlap frames</h1>
        <span style={{ fontSize: 12, color: ink.muted }}>
          {style} · margin {settings.margin}% · offset {settings.offset}%{style !== "clean" ? ` · jitter ${settings.jitter} · seed ${settings.seed}` : ""} · overlap = {OVERLAP[bg]}
        </span>
        <Link href="/dev/portraits/blend" style={{ fontSize: 12, color: ink.muted, marginLeft: "auto" }}>
          blends
        </Link>
        <Link href="/dev/portraits" style={{ fontSize: 12, color: ink.muted }}>
          ← contact sheet
        </Link>
      </header>

      <h2 style={sectionTitle}>Pairs · {pairs.length}</h2>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${cellMin}px, 1fr))`, gap: 10 }}>
        {pairs.map((pair) => (
          <figure key={pair.join("")} data-frame-pair style={{ ...cell, borderColor: ink.line }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, flex: 1 }}>
              {styles.map((st) => (
                <FramedPoster key={st} colors={pair} style={st} settings={settings} w={w} />
              ))}
            </div>
            <figcaption style={{ fontSize: 10, lineHeight: 1.5, color: ink.muted }}>
              <code>{pair[0]}</code> + <code>{pair[1]}</code>
            </figcaption>
          </figure>
        ))}
      </div>
      <Panel settings={settings} />
    </main>
  );
}

const sectionTitle: CSSProperties = { fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: "8px 0 10px" };
const cell: CSSProperties = { margin: 0, padding: 10, border: "1px solid", borderRadius: 6, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 };
const labelStyle: CSSProperties = { display: "block", color: "#9aa3ad", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 };

function Slider({ id, label, value, range, onChange }: { id: string; label: ReactNode; value: number; range: readonly [number, number]; onChange: (n: number) => void }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label htmlFor={id} style={labelStyle}>
        {label}
      </label>
      <input id={id} type="range" min={range[0]} max={range[1]} step={1} value={value} onChange={(e) => onChange(Math.round(Number(e.target.value)))} style={{ width: "100%" }} />
    </div>
  );
}

function Panel({ settings }: { settings: Settings }) {
  const rough = settings.style !== "clean";
  return (
    <ControlsPanel label="Overlap frame settings" open={settings.open} onToggle={() => setSettings({ open: !settings.open })}>
      <Group label="Style">
        {STYLES.map((value) => (
          <Segment key={value} on={settings.style === value} onClick={() => setSettings({ style: value })}>
            {value[0].toUpperCase() + value.slice(1)}
          </Segment>
        ))}
      </Group>
      <Slider id="frames-margin" label={`Margin · ${settings.margin}%`} value={settings.margin} range={RANGES.margin} onChange={(margin) => setSettings({ margin })} />
      <Slider id="frames-offset" label={`Offset · ${settings.offset}%`} value={settings.offset} range={RANGES.offset} onChange={(offset) => setSettings({ offset })} />
      {rough && (
        <>
          <Slider id="frames-jitter" label={`Jitter · ${settings.jitter}`} value={settings.jitter} range={RANGES.jitter} onChange={(jitter) => setSettings({ jitter })} />
          <div style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={() => setSettings({ seed: settings.seed + 1 })}
              style={{ font: "inherit", fontSize: 12, fontWeight: 600, padding: "5px 12px", background: "#f4f1ea", color: "#0d0d0f", border: "none", borderRadius: 999, cursor: "pointer" }}
            >
              Reseed
            </button>
            <span style={{ color: "#9aa3ad", fontSize: 11 }}>seed {settings.seed}</span>
          </div>
        </>
      )}
      <Group label="Background">
        {BGS.map((value) => (
          <Segment key={value} on={settings.bg === value} onClick={() => setSettings({ bg: value })}>
            {value === "dark" ? "Dark" : "Light"}
          </Segment>
        ))}
      </Group>
      <Group label="Size">
        {SIZES.map((value) => (
          <Segment key={value} on={settings.size === value} onClick={() => setSettings({ size: value, jitter: JITTER_BY_SIZE[value] })}>
            {value.toUpperCase()}
          </Segment>
        ))}
      </Group>
      <PanelNote>
        Two shapes per pair, each the poster grown by the margin, offset up-left (first colour) and down-right (second). Where they overlap is
        white (black on the light bg): shape B clipped to shape A, no blend modes. Margin and offset are % of the poster width; the overlap band is margin − offset/2.
      </PanelNote>
    </ControlsPanel>
  );
}
