"use client";

import Link from "next/link";
import { useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { TreatedPortrait } from "@/components/treated-portrait";
import type { PortraitMode } from "@/components/use-portrait-mode";
import { PERSON_COLORS, personHex } from "@/lib/person-colors";
import { CUT_STROKE_RATIO } from "@/lib/portrait-cuts";

export interface TunerArtist {
  id: number;
  name: string;
  profilePath: string;
}

/** Every size the treated portrait is drawn at, with where it comes from. Width drives the line; height is the box it fills. */
const SIZES = [
  { key: "hero-phone", label: "Hero phone", w: 56, h: 80, ring: true, rounded: true, where: "Pair hero under 640px: h-20 w-14 (pair-hero-body.tsx), with the ring" },
  { key: "hero", label: "Hero", w: 76, h: 112, ring: true, rounded: true, where: "Pair hero: h-28 w-[4.75rem] (pair-hero-body.tsx), with the ring" },
  { key: "contact", label: "Contact", w: 120, h: 180, ring: false, rounded: false, where: "/dev/portraits contact sheet cells (CELL = 120)" },
  { key: "grid", label: "Grid", w: 150, h: 225, ring: false, rounded: false, where: "/dev/portraits/grid cards: minmax(150px, 1fr), so 150px and up" },
  {
    key: "quotes-phone",
    label: "Quotes phone",
    w: 170,
    h: 228,
    ring: false,
    rounded: false,
    where: "Quotes under 48rem on a 390px phone: (100vw − 3rem − 2px) / 2 per portrait (quote-exhibit.css)",
  },
  { key: "quotes", label: "Quotes", w: 303, h: 404, ring: false, rounded: false, where: "Quotes on desktop: the 3:2 panel capped at 38rem, halved less the 2px gap (quote-exhibit.css)" },
  {
    key: "quotes-max",
    label: "Quotes max",
    w: 358,
    h: 478,
    ring: false,
    rounded: false,
    where: "Quotes just under the 48rem breakpoint (767px window): the largest a portrait gets (quote-exhibit.css)",
  },
] as const;

type SizeKey = (typeof SIZES)[number]["key"];
type Pick = { stroke: number; ring: number };
type Picks = Record<SizeKey, Pick>;
type Fit = { a: number; p: number } | null;

const STORAGE_KEY = "spike-portrait-stroke";
const MAX_PX = 8;
const linear = (w: number) => round2(w * CUT_STROKE_RATIO);

function defaultPicks(): Picks {
  return Object.fromEntries(SIZES.map((s) => [s.key, { stroke: linear(s.w), ring: linear(s.w) }])) as Picks;
}

function readPicks(): Picks {
  const picks = defaultPicks();
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<Record<string, Partial<Pick>>>;
    for (const s of SIZES) {
      const entry = saved[s.key];
      if (typeof entry?.stroke === "number") picks[s.key].stroke = entry.stroke;
      if (typeof entry?.ring === "number") picks[s.key].ring = entry.ring;
    }
  } catch {
    // No storage, or junk in it: start from the linear rule.
  }
  return picks;
}

function savePicks(picks: Picks) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(picks));
  } catch {
    // Storage off: the picks last until reload.
  }
}

/** Least squares on log–log: width = a × size^p. Null with fewer than two positive picks. */
function fit(points: { size: number; px: number }[]): Fit {
  const pts = points.filter((pt) => pt.px > 0).map((pt) => [Math.log(pt.size), Math.log(pt.px)] as const);
  if (pts.length < 2) return null;
  const n = pts.length;
  const mx = pts.reduce((sum, [x]) => sum + x, 0) / n;
  const my = pts.reduce((sum, [, y]) => sum + y, 0) / n;
  const sxx = pts.reduce((sum, [x]) => sum + (x - mx) ** 2, 0);
  if (sxx === 0) return null;
  const p = pts.reduce((sum, [x, y]) => sum + (x - mx) * (y - my), 0) / sxx;
  return { a: Math.exp(my - p * mx), p };
}

const atFit = (f: Fit, size: number) => (f ? round2(f.a * size ** f.p) : null);

function round2(v: number) {
  return Math.round(v * 100) / 100;
}

const subscribe = () => () => {};

/** Client-only (the picks live in localStorage), so the server renders nothing and there is no hydration mismatch. */
export function StrokeTuner({ artists }: { artists: TunerArtist[] }) {
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return mounted ? <Tuner artists={artists} /> : null;
}

function Tuner({ artists }: { artists: TunerArtist[] }) {
  const [picks, setPicksState] = useState<Picks>(readPicks);
  const [selected, setSelected] = useState<SizeKey | "all">("hero");
  const [artistId, setArtistId] = useState(artists.some((a) => a.id === 5026) ? 5026 : (artists[0]?.id ?? 0));
  const [mode, setMode] = useState<PortraitMode>("montage");
  const [outline, setOutline] = useState<"white" | "color">("white");
  const [slot, setSlot] = useState(0);
  const [preview, setPreview] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [editing, setEditing] = useState<SizeKey>("hero");

  const artist = artists.find((a) => a.id === artistId) ?? artists[0];
  const setPicks = (next: Picks) => {
    setPicksState(next);
    savePicks(next);
  };
  const setPick = (key: SizeKey, field: keyof Pick, value: number) => {
    const clamped = Math.min(MAX_PX, Math.max(0, round2(value)));
    if (Number.isNaN(clamped)) return;
    setPicks({ ...picks, [key]: { ...picks[key], [field]: clamped } });
  };

  const strokeFit = fit(SIZES.map((s) => ({ size: s.w, px: picks[s.key].stroke })));
  const ringFit = fit(SIZES.map((s) => ({ size: s.w, px: picks[s.key].ring })));
  const shown = (s: (typeof SIZES)[number]): Pick =>
    preview ? { stroke: atFit(strokeFit, s.w) ?? picks[s.key].stroke, ring: atFit(ringFit, s.w) ?? picks[s.key].ring } : picks[s.key];

  const choose = (key: SizeKey | "all") => {
    setSelected(key);
    if (key !== "all") setEditing(key);
  };

  const copy = async () => {
    const json = JSON.stringify(
      {
        sizes: Object.fromEntries(SIZES.map((s) => [s.key, { width: s.w, ...picks[s.key] }])),
        fit: { stroke: strokeFit && { a: round6(strokeFit.a), p: round6(strokeFit.p) }, ring: ringFit && { a: round6(ringFit.a), p: round6(ringFit.p) } },
      },
      null,
      2,
    );
    try {
      await navigator.clipboard.writeText(json);
      setCopied("Copied");
    } catch {
      window.prompt("Copy the values", json);
      setCopied(null);
    }
  };

  const editSize = SIZES.find((s) => s.key === editing)!;
  if (!artist) return <main style={mainStyle}>No cuts in portrait-cuts.json.</main>;

  const portrait = (s: (typeof SIZES)[number]) => {
    const px = shown(s);
    return (
      <TreatedPortrait
        key={`${artist.id}-${s.key}`}
        mode={mode}
        personId={artist.id}
        slot={slot}
        name={artist.name}
        profilePath={artist.profilePath}
        imageSize={s.w > 150 ? "w780" : "w185"}
        posterSize={s.w > 150 ? "w185" : "w92"}
        rounded={s.rounded}
        ringColor={s.ring ? personHex(slot) : undefined}
        strokePx={px.stroke}
        ringPx={px.ring}
        outline={outline}
        className="h-full w-full"
      />
    );
  };

  return (
    <main style={mainStyle}>
      <header style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <h1 style={{ fontSize: 16, fontWeight: 600, margin: "0 12px 0 0" }}>Portrait stroke tuning (spike)</h1>
        <Link href="/dev/portraits" style={linkStyle}>
          contact sheet
        </Link>
        <Link href="/dev/portraits/grid" style={linkStyle}>
          grid
        </Link>
      </header>

      <Row label="Size">
        {SIZES.map((s) => (
          <Pill key={s.key} on={selected === s.key} onClick={() => choose(s.key)}>
            {s.label} {s.w}
          </Pill>
        ))}
        <Pill on={selected === "all"} onClick={() => choose("all")}>
          All sizes
        </Pill>
      </Row>
      <Row label="Artist">
        <select value={artist.id} onChange={(e) => setArtistId(Number(e.target.value))} style={selectStyle}>
          {artists.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.id})
            </option>
          ))}
        </select>
        <Pill on={artist.id === 5026} onClick={() => setArtistId(5026)}>
          Kurosawa
        </Pill>
        <Pill on={artist.id === 7450} onClick={() => setArtistId(7450)}>
          Mifune
        </Pill>
      </Row>
      <Row label="Look">
        {(["montage", "color"] as const).map((m) => (
          <Pill key={m} on={mode === m} onClick={() => setMode(m)}>
            {m === "montage" ? "Montage" : "Color"}
          </Pill>
        ))}
        <span style={{ width: 12 }} />
        <Pill on={outline === "white"} onClick={() => setOutline("white")}>
          White edge
        </Pill>
        <Pill on={outline === "color"} onClick={() => setOutline("color")}>
          Colour edge
        </Pill>
        <span style={{ width: 12 }} />
        {PERSON_COLORS.map((c, i) => (
          <button
            key={c.name}
            type="button"
            title={`Tint: ${c.name}`}
            aria-pressed={slot === i}
            onClick={() => setSlot(i)}
            style={{ width: 22, height: 22, borderRadius: 999, background: c.hex, border: slot === i ? "2px solid #f4f1ea" : "2px solid transparent", cursor: "pointer" }}
          />
        ))}
      </Row>

      <section
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-end",
          justifyContent: "center",
          gap: 28,
          minHeight: 520,
          padding: "32px 12px",
          margin: "12px 0",
          background: "var(--bg)",
          borderRadius: 8,
          border: "1px solid #2a2f35",
        }}
      >
        {(selected === "all" ? SIZES : SIZES.filter((s) => s.key === selected)).map((s) => (
          <figure key={s.key} style={{ margin: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={() => setEditing(s.key)}
              title="Edit this size"
              style={{
                all: "unset",
                cursor: "pointer",
                display: "block",
                width: s.w,
                height: s.h,
                padding: s.ring ? 18 : 6,
                borderRadius: 6,
                outline: selected === "all" && editing === s.key ? "1px dashed #6b7280" : "none",
              }}
            >
              <span style={{ display: "flex", width: s.w, height: s.h }}>{portrait(s)}</span>
            </button>
            <figcaption style={{ fontSize: 11, color: "#9aa3ad", textAlign: "center", maxWidth: Math.max(s.w + 12, 120) }}>
              <strong style={{ color: "#e5e7eb" }}>
                {s.label} · {s.w}×{s.h}
              </strong>
              <br />
              edge {shown(s).stroke}px · ring {shown(s).ring}px
              {selected !== "all" && (
                <>
                  <br />
                  {s.where}
                </>
              )}
            </figcaption>
          </figure>
        ))}
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
        <section style={panelStyle}>
          <h2 style={h2Style}>
            {editSize.label} · {editSize.w}px{preview && <span style={{ color: "#d0a845", fontWeight: 400 }}> (previewing the fitted rule; the sliders edit the picks)</span>}
          </h2>
          <Control label="Cut edge" value={picks[editing].stroke} reference={linear(editSize.w)} onChange={(v) => setPick(editing, "stroke", v)} />
          <Control label="Ring" value={picks[editing].ring} reference={linear(editSize.w)} onChange={(v) => setPick(editing, "ring", v)} />
          <p style={{ margin: "8px 0 0", color: "#9aa3ad", fontSize: 11 }}>
            Linear rule: {round2(CUT_STROKE_RATIO * 1000) / 1000} × width (1.2px at 76). The ring is a gap and a band of this width each; only the hero draws it.
          </p>
        </section>

        <section style={panelStyle}>
          <h2 style={h2Style}>Curve</h2>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
            <thead>
              <tr style={{ color: "#9aa3ad", textAlign: "right" }}>
                <th style={{ textAlign: "left", ...cell }}>Size</th>
                <th style={cell}>Edge</th>
                <th style={cell}>fit</th>
                <th style={cell}>linear</th>
                <th style={cell}>Ring</th>
                <th style={cell}>fit</th>
                <th style={cell}>linear</th>
              </tr>
            </thead>
            <tbody>
              {SIZES.map((s) => (
                <tr key={s.key} onClick={() => choose(s.key)} style={{ textAlign: "right", cursor: "pointer", background: editing === s.key ? "#1f252c" : undefined }}>
                  <td style={{ textAlign: "left", ...cell }}>
                    {s.label} {s.w}
                  </td>
                  <td style={cell}>{picks[s.key].stroke}</td>
                  <td style={{ ...cell, color: "#9aa3ad" }}>{atFit(strokeFit, s.w) ?? "–"}</td>
                  <td style={{ ...cell, color: "#6b7280" }}>{linear(s.w)}</td>
                  <td style={cell}>{picks[s.key].ring}</td>
                  <td style={{ ...cell, color: "#9aa3ad" }}>{atFit(ringFit, s.w) ?? "–"}</td>
                  <td style={{ ...cell, color: "#6b7280" }}>{linear(s.w)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ margin: "10px 0 4px" }}>
            Edge: <code>{formatFit(strokeFit)}</code>
          </p>
          <p style={{ margin: "0 0 10px" }}>
            Ring: <code>{formatFit(ringFit)}</code>
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <Pill on={preview} onClick={() => setPreview((on) => !on)}>
              Preview fitted rule
            </Pill>
            <Pill on={false} onClick={copy}>
              Copy values
            </Pill>
            <Pill on={false} onClick={() => setPicks(defaultPicks())}>
              Reset all to linear
            </Pill>
            {copied && <span style={{ color: "#9aa3ad", fontSize: 11 }}>{copied}</span>}
          </div>
        </section>
      </div>
    </main>
  );
}

function Control({ label, value, reference, onChange }: { label: string; value: number; reference: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", margin: "8px 0" }}>
      <span style={{ width: 64 }}>{label}</span>
      <input type="range" min={0} max={MAX_PX} step={0.1} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ flex: "1 1 120px", minWidth: 0 }} />
      <input
        type="number"
        min={0}
        max={MAX_PX}
        step={0.1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: 64, font: "inherit", background: "#0d0f12", color: "#e5e7eb", border: "1px solid #3a3f45", borderRadius: 4, padding: "2px 4px" }}
      />
      <span style={{ color: "#9aa3ad", fontSize: 11 }}>px · linear {reference}</span>
      <button type="button" onClick={() => onChange(reference)} disabled={value === reference} style={{ ...pillBase, padding: "2px 8px", opacity: value === reference ? 0.4 : 1 }}>
        reset to linear
      </button>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginBottom: 8 }}>
      <span style={{ width: 48, color: "#9aa3ad", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      {children}
    </div>
  );
}

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} style={{ ...pillBase, background: on ? "#f4f1ea" : "transparent", color: on ? "#0d0d0f" : "#cfccc4" }}>
      {children}
    </button>
  );
}

function formatFit(f: Fit) {
  return f ? `width = ${round6(f.a)} × size^${round2(f.p * 100) / 100}` : "needs two sizes above 0";
}

function round6(v: number) {
  return Math.round(v * 1e6) / 1e6;
}

const mainStyle: CSSProperties = { background: "#0d0f12", color: "#e5e7eb", minHeight: "100vh", padding: "20px 16px 40px", fontFamily: "system-ui, sans-serif", fontSize: 13 };
const linkStyle: CSSProperties = { fontSize: 12, color: "#9aa3ad" };
const selectStyle: CSSProperties = { font: "inherit", fontSize: 12, background: "#0d0f12", color: "#e5e7eb", border: "1px solid #3a3f45", borderRadius: 6, padding: "4px 6px", maxWidth: "100%" };
const panelStyle: CSSProperties = { border: "1px solid #2a2f35", borderRadius: 8, padding: 12, minWidth: 0 };
const h2Style: CSSProperties = { fontSize: 13, fontWeight: 600, margin: "0 0 6px" };
const cell: CSSProperties = { padding: "3px 6px", borderBottom: "1px solid #22272d" };
const pillBase: CSSProperties = { font: "inherit", fontSize: 12, fontWeight: 600, padding: "5px 12px", border: "1px solid #3a3936", borderRadius: 999, cursor: "pointer" };
