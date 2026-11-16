"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { tmdbImage } from "@/lib/images";
import { CutPortraitImage } from "@/components/cut-portrait-image";
import { CUT_STROKE_WHITE, EDGE_POSITIONS, PORTRAIT_PALETTE as PALETTE, parseEdgePosition, polygonPoints, type CutPoint, type EdgePosition, type PortraitCut } from "@/lib/portrait-cuts";
import { TEAR_SIZE, tearFor, type PortraitTestArtist } from "@/lib/portrait-tears";
import { ControlsPanel, createSettingsStore, EDGE_LABELS, Group, PANEL_W, PanelNote, pick, Segment } from "../controls-panel";

const MODES = ["Color", "Montage", "Mix"] as const;
type Mode = (typeof MODES)[number];
/** One card per artist, so no "Both": "color" strokes the edge in the card's own colour (the flat fill, or the montage's tint). */
const OUTLINES = ["white", "color"] as const;
type Outline = (typeof OUTLINES)[number];
const OUTLINE_LABELS: Record<Outline, string> = { white: "White", color: "Colour" };
/** Tear draws every card with its tear (`tearFor`), the cut artists too, to compare the two on the same faces. */
const SHAPES = ["cut", "tear"] as const;
type Shape = (typeof SHAPES)[number];
const SHAPE_LABELS: Record<Shape, string> = { cut: "Cut", tear: "Tear" };

interface Settings {
  edge: EdgePosition;
  outline: Outline;
  mode: Mode;
  shape: Shape;
  flaggedOnly: boolean;
  open: boolean;
}

/** Inside and colour are the owner's picks; the others stay for comparison. */
const DEFAULTS: Settings = { edge: "inside", outline: "color", mode: "Mix", shape: "cut", flaggedOnly: false, open: true };

/**
 * The panel's settings (`?edge=`, `?outline=`, `?bg=`, `?shape=tear`, `?flagged=1`, then localStorage, then the defaults; see
 * `createSettingsStore`). The key is versioned: v2 came with the new defaults, so choices saved under the old ones don't hide them.
 */
const { useSettings, setSettings } = createSettingsStore<Settings>({
  storageKey: "spike-portrait-grid-v2",
  defaults: DEFAULTS,
  read: (params, saved) => {
    const modeOf = (value: unknown) => MODES.find((m) => m.toLowerCase() === String(value).toLowerCase()) ?? null;
    const flagged = params.get("flagged");
    return {
      edge: parseEdgePosition(params.get("edge")) ?? parseEdgePosition(saved.edge) ?? DEFAULTS.edge,
      outline: pick(OUTLINES, params.get("outline")) ?? pick(OUTLINES, saved.outline) ?? DEFAULTS.outline,
      mode: modeOf(params.get("bg")) ?? modeOf(saved.mode) ?? DEFAULTS.mode,
      shape: pick(SHAPES, params.get("shape")) ?? pick(SHAPES, saved.shape) ?? DEFAULTS.shape,
      flaggedOnly: flagged !== null ? flagged === "1" : typeof saved.flaggedOnly === "boolean" ? saved.flaggedOnly : DEFAULTS.flaggedOnly,
    };
  },
  toParams: ({ edge, outline, mode, shape, flaggedOnly }) => ({
    edge: edge === DEFAULTS.edge ? null : edge,
    outline: outline === DEFAULTS.outline ? null : outline,
    bg: mode === DEFAULTS.mode ? null : mode.toLowerCase(),
    shape: shape === DEFAULTS.shape ? null : shape,
    flagged: flaggedOnly ? "1" : null,
  }),
});

/** By grid position: +3 per column, +2 per row (mod 8), so side-by-side, stacked and diagonal neighbors never share a color at any width. */
function colorAt(index: number, columns: number): string {
  return PALETTE[((index % columns) * 3 + Math.floor(index / columns) * 2) % PALETTE.length];
}

/** A card's photo and polygon: the cut's own, or the person's tear (viewBox `TEAR_SIZE`). */
interface CardShape {
  kind: Shape;
  id: number;
  name: string;
  profilePath: string;
  points: readonly CutPoint[];
  size: readonly [number, number];
  posters: string[];
}

const tearShape = ({ id, name, profilePath, posters }: Omit<CardShape, "kind" | "points" | "size">): CardShape => ({
  kind: "tear",
  id,
  name,
  profilePath,
  posters,
  points: tearFor(id),
  size: TEAR_SIZE,
});

export function PortraitGrid({ cards, testArtists }: { cards: { id: number; cut: PortraitCut }[]; testArtists: PortraitTestArtist[] }) {
  const settings = useSettings();
  const { edge, outline, mode, shape, flaggedOnly } = settings;
  const [columns, setColumns] = useState(1);
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

  const cardShape = ({ id, cut }: { id: number; cut: PortraitCut }): CardShape =>
    shape === "tear" ? tearShape({ id, ...cut }) : { kind: "cut", id, name: cut.name, profilePath: cut.profilePath, posters: cut.posters, points: cut.variants["20"], size: cut.size };
  const montageAt = (i: number) => mode === "Montage" || (mode === "Mix" && (Math.floor(i / columns) + (i % columns)) % 2 === 1);

  return (
    <main style={{ background: "#0d0d0f", color: "#f4f1ea", minHeight: "100vh", padding: `20px ${settings.open ? PANEL_W + 44 : 16}px 40px 16px`, fontFamily: "system-ui, sans-serif" }}>
      <header style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 16, marginBottom: 16 }}>
        <h1 style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: 0 }}>Portrait grid</h1>
        <span style={{ fontSize: 12, color: "#8a8780" }}>
          {cards.length + testArtists.length} artists · {cards.length} cut · {testArtists.length} with no cut (tear) · {flaggedCount} flagged · {shape === "tear" ? "tears on all" : "20-vertex cut"}
        </span>
        <Link href="/dev/portraits/stroke" style={{ fontSize: 12, color: "#8a8780", marginLeft: "auto" }}>
          stroke tuning
        </Link>
        <Link href="/dev/portraits" style={{ fontSize: 12, color: "#8a8780" }}>
          ← contact sheet
        </Link>
      </header>
      <div ref={grid} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 6 }}>
        {shown.map((card, i) => (
          <figure key={card.id} style={{ margin: 0 }}>
            <Card shape={cardShape(card)} color={colorAt(i, columns)} montage={montageAt(i)} edge={edge} outline={outline} />
            <Caption name={card.cut.name}>
              {card.cut.flagged && (
                <span title={card.cut.flagReason} style={tagStyle}>
                  fallback
                </span>
              )}
            </Caption>
          </figure>
        ))}
      </div>
      {!flaggedOnly && testArtists.length > 0 && (
        <section data-tear-section>
          <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: "28px 0 4px" }}>No cut yet: tear fallback</h2>
          <p style={{ fontSize: 12, color: "#8a8780", margin: "0 0 12px" }}>
            {testArtists.length} artists not in the cut list (<code>npm run portraits:testset</code>), each with tear <code>id % 16</code>, as the app draws anyone without a cut.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 6 }}>
            {testArtists.map((artist, i) => (
              <figure key={artist.id} style={{ margin: 0 }}>
                <Card shape={tearShape(artist)} color={colorAt(i, columns)} montage={montageAt(i)} edge={edge} outline={outline} />
                <Caption name={artist.name}>
                  <span title={`tear ${artist.id % 16}`} style={tagStyle}>
                    tear {artist.id % 16}
                  </span>
                </Caption>
              </figure>
            ))}
          </div>
        </section>
      )}
      <Panel settings={settings} />
    </main>
  );
}

const tagStyle = { flexShrink: 0, whiteSpace: "nowrap", fontSize: 9, letterSpacing: "0.06em", color: "#8a8780", border: "1px solid #3a3936", borderRadius: 3, padding: "0 4px" } as const;

function Caption({ name, children }: { name: string; children?: ReactNode }) {
  return (
    <figcaption style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", padding: "5px 1px 8px" }}>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
      {children}
    </figcaption>
  );
}

function Panel({ settings }: { settings: Settings }) {
  return (
    <ControlsPanel label="Portrait grid settings" open={settings.open} onToggle={() => setSettings({ open: !settings.open })}>
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
      <Group label="Background">
        {MODES.map((m) => (
          <Segment key={m} on={settings.mode === m} onClick={() => setSettings({ mode: m })}>
            {m}
          </Segment>
        ))}
      </Group>
      <Group label="Shape">
        {SHAPES.map((value) => (
          <Segment key={value} on={settings.shape === value} onClick={() => setSettings({ shape: value })}>
            {SHAPE_LABELS[value]}
          </Segment>
        ))}
      </Group>
      <Group label="Show">
        <Segment on={!settings.flaggedOnly} onClick={() => setSettings({ flaggedOnly: false })}>
          All
        </Segment>
        <Segment on={settings.flaggedOnly} onClick={() => setSettings({ flaggedOnly: true })}>
          Flagged only
        </Segment>
      </Group>
      <PanelNote>Colour outlines take the card&rsquo;s own colour (the flat fill, or the montage&rsquo;s tint). Tear puts the no-cut fallback on every card.</PanelNote>
    </ControlsPanel>
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

function Card({ shape, color, montage, edge, outline }: { shape: CardShape; color: string; montage: boolean; edge: EdgePosition; outline: Outline }) {
  const [ref, near] = useNearViewport<SVGSVGElement>();
  const { kind, id, name, profilePath, points, posters } = shape;
  const [w, h] = shape.size;
  // The shape is in the key: the polygon changes with Shape, and the clip path's id must follow it.
  const key = `g${id}-${kind}`;
  // The span is the size container the edge's width (`cutEdgeStroke`) is measured against.
  return (
    <span style={{ display: "block", containerType: "inline-size" }}>
      <svg ref={ref} viewBox={`0 0 ${w} ${h}`} style={{ display: "block", width: "100%", height: "auto", aspectRatio: `${w} / ${h}` }} role="img" aria-label={name}>
        <defs>
          <clipPath id={`clip-${key}`}>
            <polygon points={polygonPoints(points, w, h)} />
          </clipPath>
          {montage && <Duotone id={`duo-${key}`} tint={color} />}
        </defs>
        {montage ? <Montage id={key} posters={near ? posters : []} w={w} h={h} /> : <rect width={w} height={h} fill={color} />}
        <CutPortraitImage src={near ? tmdbImage(profilePath, "w500") : null} points={points} w={w} h={h} clipId={`clip-${key}`} strokeColor={outline === "color" ? color : CUT_STROKE_WHITE} edgePosition={edge} />
      </svg>
    </span>
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
