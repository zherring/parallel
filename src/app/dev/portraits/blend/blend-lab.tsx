"use client";

import Link from "next/link";
import { useId, type CSSProperties } from "react";
import { BLEND_MODES, colorMix, MIX_SPACES, overlapColor, type BlendMode, type MixSpace } from "@/lib/color-blend";
import { PORTRAIT_PALETTE } from "@/lib/portrait-cuts";
import { ControlsPanel, createSettingsStore, Group, PANEL_W, PanelNote, pick, Segment } from "../controls-panel";

/** A mix method: a CSS blend mode, or color-mix in one of the spaces (the overlap only). */
const MIXES = [...BLEND_MODES, ...MIX_SPACES] as const;
type Mix = (typeof MIXES)[number];
const isSpace = (mix: Mix): mix is MixSpace => (MIX_SPACES as readonly string[]).includes(mix);

const BGS = ["dark", "light"] as const;
type Bg = (typeof BGS)[number];
/** The app's dark background, and a light one, since multiply and screen behave very differently on each. */
const BG_COLOR: Record<Bg, string> = { dark: "#14181c", light: "#f4f1ea" };
const INK: Record<Bg, { text: string; muted: string; line: string }> = {
  dark: { text: "#f4f1ea", muted: "#8a8780", line: "#2a2f35" },
  light: { text: "#14181c", muted: "#6b6860", line: "#d8d3c8" },
};

const SIZES = ["s", "m", "l"] as const;
type Size = (typeof SIZES)[number];
const RADIUS: Record<Size, number> = { s: 26, m: 38, l: 54 };

/** The app's shared / films-together green, to compare against. */
const APP_GREEN = "#00e054";

interface Settings {
  mix: Mix;
  opacity: number;
  bg: Bg;
  size: Size;
  open: boolean;
}

const DEFAULTS: Settings = { mix: "multiply", opacity: 1, bg: "dark", size: "m", open: true };

const parseOpacity = (value: unknown): number | null => {
  const n = typeof value === "number" ? value : value === null || value === undefined ? NaN : Number(value);
  return Number.isFinite(n) && n >= 0.5 && n <= 1 ? Math.round(n * 100) / 100 : null;
};

/** `?mix=`, `?opacity=`, `?bg=light`, `?size=`, then localStorage, then the defaults (see `createSettingsStore`). */
const { useSettings, setSettings } = createSettingsStore<Settings>({
  storageKey: "spike-portrait-blend-v1",
  defaults: DEFAULTS,
  read: (params, saved) => ({
    mix: pick(MIXES, params.get("mix")) ?? pick(MIXES, saved.mix) ?? DEFAULTS.mix,
    opacity: parseOpacity(params.get("opacity")) ?? parseOpacity(saved.opacity) ?? DEFAULTS.opacity,
    bg: pick(BGS, params.get("bg")) ?? pick(BGS, saved.bg) ?? DEFAULTS.bg,
    size: pick(SIZES, params.get("size")) ?? pick(SIZES, saved.size) ?? DEFAULTS.size,
  }),
  toParams: ({ mix, opacity, bg, size }) => ({
    mix: mix === DEFAULTS.mix ? null : mix,
    opacity: opacity === DEFAULTS.opacity ? null : String(opacity),
    bg: bg === DEFAULTS.bg ? null : bg,
    size: size === DEFAULTS.size ? null : size,
  }),
});

function pairsOf<T>(items: readonly T[]): [T, T][] {
  return items.flatMap((a, i) => items.slice(i + 1).map((b) => [a, b] as [T, T]));
}

function triplesOf<T>(items: readonly T[]): [T, T, T][] {
  return items.flatMap((a, i) => pairsOf(items.slice(i + 1)).map(([b, c]) => [a, b, c] as [T, T, T]));
}

const mixCss = (space: MixSpace, a: string, b: string, bShare = 50) => `color-mix(in ${space}, ${a}, ${b} ${bShare}%)`;

/** The overlap of `colors` (drawn in this order) as the page draws it, for the label. color-mix's centre mixes in thirds. */
function overlapHex(mix: Mix, colors: readonly string[], opacity: number, bg: string): string {
  if (!isSpace(mix)) return overlapColor(mix, colors, opacity, bg);
  const mixed = colors.length === 3 ? colorMix(mix, colorMix(mix, colors[0], colors[1]), colors[2], 1 / 3) : colorMix(mix, colors[0], colors[1]);
  return overlapColor("normal", [mixed], opacity, bg);
}

export function BlendLab() {
  const settings = useSettings();
  const { mix, opacity, bg, size } = settings;
  const ink = INK[bg];
  const r = RADIUS[size];
  const pairs = pairsOf(PORTRAIT_PALETTE);
  const triples = triplesOf(PORTRAIT_PALETTE);
  const venn = { mix, opacity, bg: BG_COLOR[bg], r };

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
        <h1 style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: 0 }}>Colour blends</h1>
        <span style={{ fontSize: 12, color: ink.muted }}>
          {isSpace(mix) ? `color-mix(in ${mix}) 50%` : `mix-blend-mode: ${mix}`} · opacity {opacity} · {bg} bg
        </span>
        <span data-app-green style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: ink.muted }}>
          <span style={{ width: 22, height: 22, borderRadius: 999, background: APP_GREEN, display: "inline-block" }} />
          app green <code>{APP_GREEN}</code>
        </span>
        <Link href="/dev/portraits/grid" style={{ fontSize: 12, color: ink.muted, marginLeft: "auto" }}>
          grid
        </Link>
        <Link href="/dev/portraits" style={{ fontSize: 12, color: ink.muted }}>
          ← contact sheet
        </Link>
      </header>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
        {PORTRAIT_PALETTE.map((color) => (
          <span key={color} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11 }}>
            <span style={{ width: 18, height: 18, borderRadius: 999, background: color, display: "inline-block" }} />
            <code>{color}</code>
          </span>
        ))}
      </div>

      <Matrix mix={mix} opacity={opacity} bg={BG_COLOR[bg]} ink={ink} />

      <h2 style={sectionTitle}>Pairs · {pairs.length}</h2>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${Math.max(150, r * 4)}px, 1fr))`, gap: 10 }}>
        {pairs.map(([a, b]) => (
          <figure key={`${a}${b}`} data-venn2 style={{ ...cell, borderColor: ink.line }}>
            <Venn colors={[a, b]} {...venn} />
            <figcaption style={{ fontSize: 10, lineHeight: 1.5, color: ink.muted }}>
              <code>{a}</code> + <code>{b}</code>
              <br />
              <Swatch color={overlapHex(mix, [a, b], opacity, BG_COLOR[bg])} ink={ink.text} />
            </figcaption>
          </figure>
        ))}
      </div>

      <h2 style={sectionTitle}>Triples · {triples.length}</h2>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${Math.max(150, r * 4)}px, 1fr))`, gap: 10 }}>
        {triples.map((colors) => (
          <figure key={colors.join("")} data-venn3 style={{ ...cell, borderColor: ink.line }}>
            <Venn colors={colors} {...venn} />
            <figcaption style={{ fontSize: 10, lineHeight: 1.5, color: ink.muted }}>
              <code>{colors.join(" ")}</code>
              <br />
              centre <Swatch color={overlapHex(mix, colors, opacity, BG_COLOR[bg])} ink={ink.text} approx={isSpace(mix)} />
            </figcaption>
          </figure>
        ))}
      </div>
      <Panel settings={settings} />
    </main>
  );
}

const sectionTitle: CSSProperties = { fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: "28px 0 10px" };
const cell: CSSProperties = { margin: 0, padding: 8, border: "1px solid", borderRadius: 6, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 };

function Swatch({ color, ink, approx = false }: { color: string; ink: string; approx?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: ink }}>
      <span style={{ width: 10, height: 10, borderRadius: 2, background: color, display: "inline-block" }} />
      <code>
        {approx ? "≈" : "="} {color}
      </code>
    </span>
  );
}

/**
 * 2 or 3 circles, each overlapping its neighbour by ~38% of the diameter. Blend modes: the circles in an isolated group, each with
 * `mix-blend-mode`, so they blend with each other but not the page. color-mix: plain circles, then each overlap drawn again as a clipped
 * shape filled with the mix (over a patch of page colour, so the opacity applies to the mix alone).
 */
function Venn({ colors, mix, opacity, bg, r }: { colors: readonly string[]; mix: Mix; opacity: number; bg: string; r: number }) {
  const uid = useId().replace(/:/g, "");
  const d = 2 * r * (1 - 0.38);
  const centres: [number, number][] =
    colors.length === 2
      ? [
          [r, r],
          [r + d, r],
        ]
      : [
          [r, r + (d * Math.sqrt(3)) / 2],
          [r + d, r + (d * Math.sqrt(3)) / 2],
          [r + d / 2, r],
        ];
  const width = 2 * r + d;
  const height = colors.length === 2 ? 2 * r : 2 * r + (d * Math.sqrt(3)) / 2;
  const circle = (i: number, props: Record<string, unknown> = {}, key: string | number = i) => <circle key={key} cx={centres[i][0]} cy={centres[i][1]} r={r} {...props} />;

  if (!isSpace(mix)) {
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
        <g style={{ isolation: "isolate" }}>{colors.map((color, i) => circle(i, { fill: color, opacity, style: { mixBlendMode: mix } }))}</g>
      </svg>
    );
  }

  const pairIdx = colors.length === 2 ? [[0, 1]] : [[0, 1], [0, 2], [1, 2]];
  const region = (fill: string, clip: string, i: number) => [
    circle(i, { fill: bg, clipPath: `url(#${clip})` }, "patch"),
    circle(i, { fill, opacity, clipPath: `url(#${clip})` }, "mix"),
  ];
  const centreMix = colors.length === 3 ? mixCss(mix, mixCss(mix, colors[0], colors[1]), colors[2], 33.333) : null;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <defs>
        {colors.map((_, i) => (
          <clipPath key={i} id={`${uid}c${i}`}>
            {circle(i)}
          </clipPath>
        ))}
        {/* The centre of three: circle 1 clipped to circle 0, used as the clip for circle 2. */}
        {colors.length === 3 && (
          <clipPath id={`${uid}c01`} clipPath={`url(#${uid}c0)`}>
            {circle(1)}
          </clipPath>
        )}
      </defs>
      {colors.map((color, i) => circle(i, { fill: color, opacity }))}
      {pairIdx.map(([i, j]) => (
        <g key={`${i}${j}`}>{region(mixCss(mix, colors[i], colors[j]), `${uid}c${i}`, j)}</g>
      ))}
      {centreMix && <g>{region(centreMix, `${uid}c01`, 2)}</g>}
    </svg>
  );
}

/** Rows are drawn first, columns on top (order matters for normal, overlay, hard-light, hue and the like); the diagonal is a colour on itself. */
function Matrix({ mix, opacity, bg, ink }: { mix: Mix; opacity: number; bg: string; ink: { text: string; muted: string; line: string } }) {
  const s = 26;
  return (
    <section data-matrix>
      <h2 style={{ ...sectionTitle, marginTop: 0 }}>Overlaps at a glance</h2>
      <table style={{ borderCollapse: "separate", borderSpacing: 3, fontSize: 9 }}>
        <thead>
          <tr>
            <th style={{ color: ink.muted, fontWeight: 400, textAlign: "left" }}>row ↓ · col on top →</th>
            {PORTRAIT_PALETTE.map((c) => (
              <th key={c}>
                <span style={{ width: s, height: 8, borderRadius: 2, background: c, display: "block" }} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PORTRAIT_PALETTE.map((row) => (
            <tr key={row}>
              <th style={{ textAlign: "right", paddingRight: 4, fontWeight: 400, color: ink.muted }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <code>{row}</code>
                  <span style={{ width: 8, height: s, borderRadius: 2, background: row, display: "inline-block" }} />
                </span>
              </th>
              {PORTRAIT_PALETTE.map((col) => {
                const hex = overlapHex(mix, [row, col], opacity, bg);
                return (
                  <td key={col} title={`${row} + ${col} = ${hex}`} style={{ width: s, height: s, background: hex, borderRadius: 3, opacity: row === col ? 0.35 : 1 }} />
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Panel({ settings }: { settings: Settings }) {
  return (
    <ControlsPanel label="Colour blend settings" open={settings.open} onToggle={() => setSettings({ open: !settings.open })}>
      <div style={{ marginBottom: 10 }}>
        <label htmlFor="blend-mix" style={labelStyle}>
          Mix method
        </label>
        <select
          id="blend-mix"
          value={settings.mix}
          onChange={(e) => setSettings({ mix: e.target.value as Mix })}
          style={{ width: "100%", font: "inherit", fontSize: 12, padding: "5px 6px", background: "#0d0f12", color: "#e5e7eb", border: "1px solid #3a3936", borderRadius: 6 }}
        >
          <optgroup label="Blend modes">
            {BLEND_MODES.map((mode: BlendMode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </optgroup>
          <optgroup label="Color-mix">
            {MIX_SPACES.map((space) => (
              <option key={space} value={space}>
                color-mix in {space} 50%
              </option>
            ))}
          </optgroup>
        </select>
      </div>
      <div style={{ marginBottom: 10 }}>
        <label htmlFor="blend-opacity" style={labelStyle}>
          Circle opacity · {settings.opacity.toFixed(2)}
        </label>
        <input
          id="blend-opacity"
          type="range"
          min={0.5}
          max={1}
          step={0.05}
          value={settings.opacity}
          onChange={(e) => setSettings({ opacity: Math.round(Number(e.target.value) * 100) / 100 })}
          style={{ width: "100%" }}
        />
      </div>
      <Group label="Background">
        {BGS.map((value) => (
          <Segment key={value} on={settings.bg === value} onClick={() => setSettings({ bg: value })}>
            {value === "dark" ? "Dark" : "Light"}
          </Segment>
        ))}
      </Group>
      <Group label="Circle size">
        {SIZES.map((value) => (
          <Segment key={value} on={settings.size === value} onClick={() => setSettings({ size: value })}>
            {value.toUpperCase()}
          </Segment>
        ))}
      </Group>
      <PanelNote>
        Blend modes blend the circles with each other only (an isolated group), so the background shows through just when the opacity is under 1.
        Hexes are computed with the W3C formulas; ≈ marks color-mix centres (mixed in thirds).
      </PanelNote>
    </ControlsPanel>
  );
}

const labelStyle: CSSProperties = { display: "block", color: "#9aa3ad", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 };
