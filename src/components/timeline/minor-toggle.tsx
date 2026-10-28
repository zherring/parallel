"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { MINOR_TOGGLE_LABEL } from "@/lib/roles";

interface MinorToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  /**
   * What to say after it is toggled: "Showing 43 films together". The checkbox sits under the
   * panels, so its effect is usually above the fold: the message is a polite live region, and it
   * is shown (quietly) beside the checkbox for everyone else.
   */
  message: string;
}

/**
 * "Include shorts, music videos, cameos & uncredited": the one filter of the page, for the
 * lanes and the table alike, so it sits under the panels (both tabs).
 *
 * Because it is below what it filters, toggling it can make the content above grow or shrink and
 * move the checkbox: the scroll position is corrected after the change so that the checkbox stays
 * exactly where it was on screen (no jump), whether or not the browser does its own scroll anchoring.
 */
export function MinorToggle({ checked, onChange, message }: MinorToggleProps) {
  const labelRef = useRef<HTMLLabelElement>(null);
  /** Where the checkbox was on screen when it was toggled, until the new content is laid out. */
  const topBefore = useRef<number | null>(null);
  const [toggled, setToggled] = useState(false);

  function change(next: boolean) {
    topBefore.current = labelRef.current?.getBoundingClientRect().top ?? null;
    setToggled(true);
    onChange(next);
  }

  // After the render that follows a toggle (every render, but it only acts once per toggle).
  useLayoutEffect(() => {
    const before = topBefore.current;
    topBefore.current = null;
    const label = labelRef.current;
    if (before === null || !label) return;
    const moved = label.getBoundingClientRect().top - before;
    if (Math.abs(moved) >= 1) window.scrollBy(0, moved);
  });

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <label ref={labelRef} className="flex max-w-xl cursor-pointer items-start gap-2 text-sm text-body">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => change(event.target.checked)}
          className="mt-0.5 size-4 shrink-0 cursor-pointer accent-accent-green"
        />
        <span>{MINOR_TOGGLE_LABEL}</span>
      </label>
      <p role="status" aria-live="polite" className="min-h-4 text-xs text-muted">
        {toggled ? message : ""}
      </p>
    </div>
  );
}
