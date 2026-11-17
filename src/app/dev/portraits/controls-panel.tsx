"use client";

import { useSyncExternalStore, type CSSProperties, type ReactNode } from "react";

export const PANEL_W = 236;

/** Every page's settings carry the panel's own open/closed state. */
export interface PanelSettings {
  open: boolean;
}

interface StoreOptions<S extends PanelSettings> {
  /** The localStorage key: one per page, as the pages' options differ. */
  storageKey: string;
  defaults: S;
  /** The settings from the address and the saved choice; each value falls back address → saved → default. */
  read: (params: URLSearchParams, saved: Partial<S>) => Omit<S, "open">;
  /** The query params for these settings; null drops the param (the default). */
  toParams: (settings: S) => Record<string, string | null>;
}

/**
 * A page's panel settings: the address wins, then this browser's last choice (localStorage), then the defaults. Kept in a module store so
 * the server and the hydrating render use the defaults and the saved view shows right after. Each change is saved and written to the
 * address with replaceState.
 */
export function createSettingsStore<S extends PanelSettings>({ storageKey, defaults, read, toParams }: StoreOptions<S>) {
  let current: S | null = null;
  const listeners = new Set<() => void>();

  function getSettings(): S {
    if (current) return current;
    let saved: Partial<S> = {};
    try {
      saved = JSON.parse(localStorage.getItem(storageKey) ?? "{}") as Partial<S>;
    } catch {
      // No storage, or junk in it: the defaults.
    }
    const open = typeof saved.open === "boolean" ? saved.open : defaults.open;
    current = { ...read(new URLSearchParams(window.location.search), saved), open } as S;
    return current;
  }

  function setSettings(patch: Partial<S>) {
    const next = { ...getSettings(), ...patch };
    current = next;
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Storage off: the choice lasts until reload.
    }
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries(toParams(next))) {
      if (value === null) url.searchParams.delete(key);
      else url.searchParams.set(key, value);
    }
    window.history.replaceState(window.history.state, "", url);
    listeners.forEach((listener) => listener());
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function useSettings(): S {
    return useSyncExternalStore(subscribe, getSettings, () => defaults);
  }

  return { useSettings, setSettings };
}

/** The first of `options` equal to `value`, or null. */
export function pick<T extends string>(options: readonly T[], value: unknown): T | null {
  return options.find((option) => option === value) ?? null;
}

/** Fixed to the right edge, 64px from the top; the tab on its left slides it in and out. Styled as the stroke tuner's controls. */
export function ControlsPanel({ label, open, onToggle, children }: { label: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <aside
      aria-label={label}
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
        onClick={onToggle}
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
      {children}
    </aside>
  );
}

/** A labelled segmented control: one `Segment` per option. */
export function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ color: "#9aa3ad", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{label}</div>
      <div role="group" aria-label={label} style={{ display: "flex", border: "1px solid #3a3936", borderRadius: 999, overflow: "hidden" }}>
        {children}
      </div>
    </div>
  );
}

export function Segment({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} style={{ ...segmentBase, background: on ? "#f4f1ea" : "transparent", color: on ? "#0d0d0f" : "#cfccc4" }}>
      {children}
    </button>
  );
}

const segmentBase: CSSProperties = { flex: 1, font: "inherit", fontSize: 12, fontWeight: 600, padding: "5px 8px", border: "none", cursor: "pointer" };

export const EDGE_LABELS = { inside: "Inside", center: "Center", outside: "Outside" } as const;

export function PanelNote({ children }: { children: ReactNode }) {
  return <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: 11 }}>{children}</p>;
}
