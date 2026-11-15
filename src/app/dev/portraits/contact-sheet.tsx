"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { CutPortraitImage } from "@/components/cut-portrait-image";
import { tmdbImage } from "@/lib/images";
import { CUT_STROKE_WHITE, EDGE_POSITIONS, parseEdgePosition, polygonPoints, type EdgePosition, type PortraitCut } from "@/lib/portrait-cuts";
import { ControlsPanel, createSettingsStore, EDGE_LABELS, Group, PANEL_W, PanelNote, pick, Segment } from "./controls-panel";

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

/** Inside and colour are the owner's picks; the others stay for comparison. */
const DEFAULTS: Settings = { edge: "inside", outline: "color", open: true };

/**
 * The panel's settings (`?edge=`, `?outline=`, then localStorage, then the defaults; see `createSettingsStore`). The key is versioned: v2 came
 * with the new defaults, so choices saved under the old ones don't hide them.
 */
const { useSettings, setSettings } = createSettingsStore<Settings>({
  storageKey: "spike-portrait-sheet-v2",
  defaults: DEFAULTS,
  read: (params, saved) => ({
    edge: parseEdgePosition(params.get("edge")) ?? parseEdgePosition(saved.edge) ?? DEFAULTS.edge,
    outline: pick(OUTLINES, params.get("outline")) ?? pick(OUTLINES, saved.outline) ?? DEFAULTS.outline,
  }),
  toParams: ({ edge, outline }) => ({
    edge: edge === DEFAULTS.edge ? null : edge,
    outline: outline === DEFAULTS.outline ? null : outline,
  }),
});

/**
 * The contact sheet's grid and its slide-out panel. Columns: the original, then 20 vertices on a flat colour and on the montage, each with a
 * white and a colour outline ("Both") or with the one outline chosen. Every column follows the edge position. Each row is its own grid (same
 * columns) so it can hold back its images until it is near the viewport.
 */
export function ContactSheet({ rows }: { rows: { id: number; cut: PortraitCut }[] }) {
  const settings = useSettings();
  const { edge, outline } = settings;
  const tones: ("white" | "color")[] = outline === "both" ? ["white", "color"] : [outline];
  const headers = [
    "Original",
    ...tones.map((tone) => `20 · flat color · ${tone} outline`),
    ...tones.map((tone) => `20 · montage · ${tone} outline`),
  ];

  return (
    <>
      <div style={{ display: "grid", gap: 8, paddingRight: settings.open ? PANEL_W : 0 }}>
        <div style={{ ...rowGrid(headers.length), alignItems: "end" }}>
          <div />
          {headers.map((label) => (
            <div key={label} style={{ fontWeight: 600, color: "#555" }}>
              {label}
            </div>
          ))}
        </div>
        {rows.map(({ id, cut }) => (
          <Row key={id} id={id} cut={cut} edge={edge} tones={tones} columns={headers.length} />
        ))}
      </div>
      <Panel settings={settings} />
    </>
  );
}

function rowGrid(columns: number): CSSProperties {
  return { display: "grid", gridTemplateColumns: `140px repeat(${columns}, ${CELL}px)`, gap: 8, alignItems: "center" };
}

/**
 * True once the element is within a screen or so of the viewport, and then for good (as in the grid). SVG `<image>` has no `loading="lazy"`,
 * so a row holds back its portraits and the montage's 9 posters until then, instead of fetching every artist's images on load.
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

function Row({ id, cut, edge, tones, columns }: { id: number; cut: PortraitCut; edge: EdgePosition; tones: ("white" | "color")[]; columns: number }) {
  const [ref, near] = useNearViewport<HTMLDivElement>();
  const src = tmdbImage(cut.profilePath, "w500")!;
  const [w, h] = cut.size;
  const color = artistColor(id);
  const stroke = (tone: "white" | "color") => (tone === "color" ? color : CUT_STROKE_WHITE);
  const flat: Background = { kind: "flat", color };
  const montage: Background = { kind: "montage", posters: cut.posters, tint: color };
  return (
    <div ref={ref} data-row={id} style={rowGrid(columns)}>
      <div>
        <div style={{ fontWeight: 600 }}>
          {cut.name}
          {cut.flagged && (
            <span title={cut.flagReason} style={{ marginLeft: 6, fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "#b42318", border: "1px solid #e4a59f", borderRadius: 3, padding: "0 4px" }}>
              flagged
            </span>
          )}
        </div>
        <div style={{ color: "#777" }}>
          {id} · mask {Math.round(cut.coverage * 100)}%
        </div>
        {cut.model !== "birefnet-portrait" && <div style={{ color: "#b42318" }}>{cut.model} (fallback)</div>}
      </div>
      {near ? (
        <img src={src} alt={cut.name} loading="lazy" width={CELL} height={(CELL * h) / w} style={{ display: "block" }} />
      ) : (
        <div style={{ width: CELL, height: (CELL * h) / w, background: "#e7e2d8" }} />
      )}
      {tones.map((tone) => (
        <Cut key={`flat-${tone}`} id={`${id}-20-flat-${tone}`} cut={cut} near={near} background={flat} strokeColor={stroke(tone)} edge={edge} />
      ))}
      {tones.map((tone) => (
        <Cut key={`montage-${tone}`} id={`${id}-20-montage-${tone}`} cut={cut} near={near} background={montage} strokeColor={stroke(tone)} edge={edge} />
      ))}
    </div>
  );
}

/** `strokeColor` is the cut edge's colour (white, or the bg overlay's colour for the "color outline" columns). */
function Cut({ id, cut, near, background, strokeColor, edge }: { id: string; cut: PortraitCut; near: boolean; background: Background; strokeColor: string; edge: EdgePosition }) {
  const [w, h] = cut.size;
  const points = cut.variants["20"];
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
        {background.kind === "flat" ? <rect width={w} height={h} fill={background.color} /> : <Montage id={id} posters={near ? background.posters : []} w={w} h={h} />}
        <CutPortraitImage src={near ? tmdbImage(cut.profilePath, "w500") : null} points={points} w={w} h={h} clipId={`clip-${id}`} strokeColor={strokeColor} edgePosition={edge} />
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

const OUTLINE_LABELS: Record<Outline, string> = { white: "White", color: "Colour", both: "Both" };

function Panel({ settings }: { settings: Settings }) {
  return (
    <ControlsPanel label="Contact sheet settings" open={settings.open} onToggle={() => setSettings({ open: !settings.open })}>
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
      <PanelNote>Width stays on the rule; inside and outside draw it twice as wide and hide half.</PanelNote>
    </ControlsPanel>
  );
}
