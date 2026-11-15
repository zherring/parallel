"use client";

import { useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { CutPortraitImage } from "@/components/cut-portrait-image";
import { tmdbImage } from "@/lib/images";
import { CUT_STROKE_WHITE, EDGE_POSITIONS, VERTEX_COUNTS, parseEdgePosition, polygonPoints, type EdgePosition, type PortraitCut, type VertexCount } from "@/lib/portrait-cuts";

const YELLOW = "#F7CB15";
const PALETTE = ["#E4572E", "#17BEBB", "#76B041", "#2E86AB", "#A23B72", "#F18F01", "#6A4C93", "#C73E1D", "#3BB273", "#1B998B", "#EF476F"];
const CELL = 120;

/** A simple deterministic color per artist. */
function artistColor(id: number): string {
  return PALETTE[id % PALETTE.length];
}

type Background = { kind: "flat"; color: string } | { kind: "montage"; posters: string[]; tint: string };

const OUTLINES = ["white", "color", "both"] as const;
type Outline = (typeof OUTLINES)[number];
interface Settings {
  edge: EdgePosition;
  outline: Outline;
  open: boolean;
}

const DEFAULTS: Settings = { edge: "center", outline: "both", open: true };
const STORAGE_KEY = "spike-portrait-sheet";

/**
 * The panel's settings: the address (`?edge=`, `?outline=`) wins, then this browser's last choice (localStorage), then the defaults. Kept in
 * a module store so the server and the hydrating render use the defaults and the saved view shows right after.
 */
let current: Settings | null = null;
const listeners = new Set<() => void>();

function readSettings(): Settings {
  let saved: Partial<Settings> = {};
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<Settings>;
  } catch {
    // No storage, or junk in it: the defaults.
  }
  const params = new URLSearchParams(window.location.search);
  const outlineOf = (value: unknown) => OUTLINES.find((o) => o === value) ?? null;
  return {
    edge: parseEdgePosition(params.get("edge")) ?? parseEdgePosition(saved.edge) ?? DEFAULTS.edge,
    outline: outlineOf(params.get("outline")) ?? outlineOf(saved.outline) ?? DEFAULTS.outline,
    open: typeof saved.open === "boolean" ? saved.open : DEFAULTS.open,
  };
}

function getSettings(): Settings {
  current ??= readSettings();
  return current;
}

function setSettings(patch: Partial<Settings>) {
  const next = { ...getSettings(), ...patch };
  current = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage off: the choice lasts until reload.
  }
  const url = new URL(window.location.href);
  if (next.edge === DEFAULTS.edge) url.searchParams.delete("edge");
  else url.searchParams.set("edge", next.edge);
  if (next.outline === DEFAULTS.outline) url.searchParams.delete("outline");
  else url.searchParams.set("outline", next.outline);
  window.history.replaceState(window.history.state, "", url);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * The contact sheet's grid and its slide-out panel. Columns: the original, 12/20/32 vertices on yellow, then 20 vertices on a flat colour and
 * on the montage, each with a white and a colour outline ("Both") or with the one outline chosen. Every column follows the edge position; the
 * yellow ones also take the outline colour when it is White or Colour (the artist's colour, as yellow on yellow would vanish).
 */
export function ContactSheet({ rows }: { rows: { id: number; cut: PortraitCut }[] }) {
  const settings = useSyncExternalStore(subscribe, getSettings, () => DEFAULTS);
  const { edge, outline } = settings;
  const tones: ("white" | "color")[] = outline === "both" ? ["white", "color"] : [outline];
  const headers = [
    "Original",
    ...VERTEX_COUNTS.map((count) => `${count} vertices`),
    ...tones.map((tone) => `20 · flat color · ${tone} outline`),
    ...tones.map((tone) => `20 · montage · ${tone} outline`),
  ];

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: `140px repeat(${headers.length}, ${CELL}px)`, gap: 8, alignItems: "center", paddingRight: settings.open ? PANEL_W : 0 }}>
        <div />
        {headers.map((label) => (
          <div key={label} style={{ fontWeight: 600, color: "#555" }}>
            {label}
          </div>
        ))}
        {rows.map(({ id, cut }) => (
          <Row key={id} id={id} cut={cut} edge={edge} outline={outline} tones={tones} />
        ))}
      </div>
      <Panel settings={settings} />
    </>
  );
}

function Row({ id, cut, edge, outline, tones }: { id: number; cut: PortraitCut; edge: EdgePosition; outline: Outline; tones: ("white" | "color")[] }) {
  const src = tmdbImage(cut.profilePath, "w500")!;
  const [w, h] = cut.size;
  const color = artistColor(id);
  const stroke = (tone: "white" | "color") => (tone === "color" ? color : CUT_STROKE_WHITE);
  const flat: Background = { kind: "flat", color };
  const montage: Background = { kind: "montage", posters: cut.posters, tint: color };
  return (
    <>
      <div>
        <div style={{ fontWeight: 600 }}>{cut.name}</div>
        <div style={{ color: "#777" }}>
          {id} · mask {Math.round(cut.coverage * 100)}%
        </div>
        {cut.model !== "birefnet-portrait" && <div style={{ color: "#b42318" }}>{cut.model} (fallback)</div>}
      </div>
      <img src={src} alt={cut.name} loading="lazy" width={CELL} height={(CELL * h) / w} style={{ display: "block" }} />
      {VERTEX_COUNTS.map((count) => (
        <Cut key={count} id={`${id}-${count}-y`} cut={cut} count={count} background={{ kind: "flat", color: YELLOW }} strokeColor={stroke(outline === "color" ? "color" : "white")} edge={edge} />
      ))}
      {tones.map((tone) => (
        <Cut key={`flat-${tone}`} id={`${id}-20-flat-${tone}`} cut={cut} count="20" background={flat} strokeColor={stroke(tone)} edge={edge} />
      ))}
      {tones.map((tone) => (
        <Cut key={`montage-${tone}`} id={`${id}-20-montage-${tone}`} cut={cut} count="20" background={montage} strokeColor={stroke(tone)} edge={edge} />
      ))}
    </>
  );
}

/** `strokeColor` is the cut edge's colour (white, or the bg overlay's colour for the "color outline" columns). */
function Cut({ id, cut, count, background, strokeColor, edge }: { id: string; cut: PortraitCut; count: VertexCount; background: Background; strokeColor: string; edge: EdgePosition }) {
  const [w, h] = cut.size;
  const points = cut.variants[count];
  // The span is the size container the edge's width (`cutEdgeStroke`) is measured against.
  return (
    <span style={{ display: "block", width: CELL, containerType: "inline-size" }}>
      <svg viewBox={`0 0 ${w} ${h}`} width={CELL} height={(CELL * h) / w} style={{ display: "block", overflow: "hidden" }}>
        <defs>
          <clipPath id={`clip-${id}`}>
            <polygon points={polygonPoints(points, w, h)} />
          </clipPath>
          {background.kind === "montage" && <Duotone id={`duo-${id}`} tint={background.tint} />}
        </defs>
        {background.kind === "flat" ? <rect width={w} height={h} fill={background.color} /> : <Montage id={id} posters={background.posters} w={w} h={h} />}
        <CutPortraitImage src={tmdbImage(cut.profilePath, "w500")} points={points} w={w} h={h} clipId={`clip-${id}`} strokeColor={strokeColor} edgePosition={edge} />
      </svg>
    </span>
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

const PANEL_W = 236;
const EDGE_LABELS: Record<EdgePosition, string> = { inside: "Inside", center: "Center", outside: "Outside" };
const OUTLINE_LABELS: Record<Outline, string> = { white: "White", color: "Colour", both: "Both" };

/** Fixed to the right edge; the tab on its left slides it in and out. Styled as the stroke tuner's controls. */
function Panel({ settings }: { settings: Settings }) {
  const { open } = settings;
  return (
    <aside
      aria-label="Contact sheet settings"
      style={{
        position: "fixed",
        top: 64,
        right: 0,
        width: PANEL_W,
        zIndex: 10,
        transform: open ? "none" : `translateX(${PANEL_W}px)`,
        transition: "transform 180ms ease",
        background: "#0d0f12",
        color: "#e5e7eb",
        border: "1px solid #2a2f35",
        borderRight: "none",
        borderRadius: "8px 0 0 8px",
        padding: 12,
        fontSize: 12,
        boxShadow: "0 6px 24px rgba(0,0,0,0.25)",
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setSettings({ open: !open })}
        title={open ? "Hide the panel" : "Show the panel"}
        style={{
          position: "absolute",
          top: 10,
          left: -28,
          width: 28,
          height: 36,
          font: "inherit",
          fontSize: 13,
          background: "#0d0f12",
          color: "#cfccc4",
          border: "1px solid #2a2f35",
          borderRight: "none",
          borderRadius: "6px 0 0 6px",
          cursor: "pointer",
        }}
      >
        {open ? "›" : "‹"}
      </button>
      <Group label="Edge">
        {EDGE_POSITIONS.map((position) => (
          <Segment key={position} on={settings.edge === position} onClick={() => setSettings({ edge: position })}>
            {EDGE_LABELS[position]}
          </Segment>
        ))}
      </Group>
      <Group label="Outline">
        {OUTLINES.map((o) => (
          <Segment key={o} on={settings.outline === o} onClick={() => setSettings({ outline: o })}>
            {OUTLINE_LABELS[o]}
          </Segment>
        ))}
      </Group>
      <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: 11 }}>Width stays on the rule; inside and outside draw it twice as wide and hide half.</p>
    </aside>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ color: "#9aa3ad", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{label}</div>
      <div role="group" aria-label={label} style={{ display: "flex", border: "1px solid #3a3936", borderRadius: 999, overflow: "hidden" }}>
        {children}
      </div>
    </div>
  );
}

function Segment({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} style={{ ...segmentBase, background: on ? "#f4f1ea" : "transparent", color: on ? "#0d0d0f" : "#cfccc4" }}>
      {children}
    </button>
  );
}

const segmentBase: CSSProperties = { flex: 1, font: "inherit", fontSize: 12, fontWeight: 600, padding: "5px 8px", border: "none", cursor: "pointer" };
