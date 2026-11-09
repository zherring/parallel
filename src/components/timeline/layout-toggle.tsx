"use client";

import { Focus, Layers, Rows2 } from "lucide-react";
import type { ReactNode } from "react";
import { LANES_ENABLED, type TrackMode } from "@/lib/film-prefs";
import { cn } from "./cn";

/** How the timeline of a page of films is drawn: the Depth view ("focus"), one track for everyone, or one lane each. */
export type Layout = "focus" | TrackMode;

interface Option {
  /** Shown next to the icon where there is room for it (the Depth view's settings). */
  label: string;
  /** What a screen reader names the button. The combined one keeps the name it always had. */
  ariaLabel: string;
  /** The tooltip: the layout and what it is. */
  title: string;
  icon: ReactNode;
}

const ICON = "size-4 shrink-0";
const OPTIONS: Record<Layout, Option> = {
  focus: {
    label: "Focus",
    ariaLabel: "Focus view",
    title: "Focus · the films as a scene in depth",
    icon: <Focus aria-hidden="true" className={ICON} />,
  },
  combined: {
    label: "Combined",
    ariaLabel: "Combined timeline",
    title: "Combined · one timeline for everyone",
    icon: <Layers aria-hidden="true" className={ICON} />,
  },
  separate: {
    label: "Lanes",
    ariaLabel: "Separate lanes",
    title: "Lanes · one lane for each person",
    icon: <Rows2 aria-hidden="true" className={ICON} />,
  },
};

/** One person has no choice between a shared track and lanes: the flat timeline is just that, "Timeline". */
const SOLO_COMBINED: Option = { ...OPTIONS.combined, label: "Timeline", ariaLabel: "Timeline", title: "Timeline · the flat timeline" };

interface LayoutToggleProps {
  layout: Layout;
  /** Several people: Focus and Combined (and Lanes, when they are on offer). One person: Focus and the flat Timeline (carried as "combined"). */
  several: boolean;
  /** Whether the Lanes option is offered to several people; the parked default is `LANES_ENABLED` (off). A test turns it on. */
  lanes?: boolean;
  onChange: (layout: Layout) => void;
  /** Words beside the icons, for where there is room (the Depth view's settings sheet). */
  labelled?: boolean;
  className?: string;
}

/**
 * The timeline's layout as one small segmented control: Focus (the Depth view) and Combined (one track for everyone), and Lanes
 * (one lane each) where they are on offer (parked for now, see `LANES_ENABLED`). Each option is an icon button with a title and an aria-label, and the current one is pressed. It floats over
 * the flat timeline's top-right corner and sits in the top right of the Depth view; choosing a layout other than the one
 * the page is in is for the page to act on (`onChange`): the flat page navigates to Focus, the Depth view to the flat timeline.
 */
export function LayoutToggle({ layout, several, lanes = LANES_ENABLED, onChange, labelled = false, className }: LayoutToggleProps) {
  const layouts: readonly Layout[] = several && lanes ? ["focus", "combined", "separate"] : ["focus", "combined"];
  return (
    <div role="group" aria-label="Timeline layout" className={cn("inline-flex shrink-0 items-center gap-0.5 rounded-md bg-canvas p-0.5", className)}>
      {layouts.map((id) => {
        const option = id === "combined" && !several ? SOLO_COMBINED : OPTIONS[id];
        const selected = id === layout;
        return (
          <button
            key={id}
            type="button"
            aria-label={option.ariaLabel}
            aria-pressed={selected}
            title={option.title}
            onClick={() => onChange(id)}
            className={cn(
              "inline-flex h-7 min-w-7 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded text-sm font-medium transition-colors motion-reduce:transition-none",
              labelled ? "flex-1 px-2.5" : "w-7",
              selected ? "bg-border text-strong" : "text-muted hover:bg-surface hover:text-strong",
            )}
          >
            <span className={selected ? "text-accent-green" : undefined}>{option.icon}</span>
            {labelled && option.label}
          </button>
        );
      })}
    </div>
  );
}
