"use client";

import { Layers, Rows2 } from "lucide-react";

/** One track for everyone, or one lane each (the timeline as it was). */
export type TrackMode = "combined" | "separate";

interface TrackModeToggleProps {
  mode: TrackMode;
  onChange: (mode: TrackMode) => void;
}

/**
 * One icon button floating over the timeline's top-right corner. The icon shows the current
 * layout; the tooltip describes the other layout that pressing it will switch to.
 */
export function TrackModeToggle({ mode, onChange }: TrackModeToggleProps) {
  const combined = mode === "combined";
  return (
    <button
      type="button"
      aria-label="Combined timeline"
      aria-pressed={combined}
      title={combined ? "Combined layout · Switch to separate lanes" : "Separate lanes · Switch to combined layout"}
      onClick={() => onChange(combined ? "separate" : "combined")}
      className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md bg-canvas text-muted hover:bg-surface hover:text-strong transition-colors motion-reduce:transition-none"
    >
      {combined ? <Layers aria-hidden="true" className="size-4" /> : <Rows2 aria-hidden="true" className="size-4" />}
    </button>
  );
}
