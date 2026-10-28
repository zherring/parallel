"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createKeycapPress, type KeycapPress } from "@/components/landing/keycap-press";
import type { NavDirection } from "@/lib/hero-history";

/**
 * Which of the hero's keycaps is down right now (null for none), and `press`, which pushes one
 * down for a moment (see keycap-press.ts). Called for a click on a cap and for an arrow key alike,
 * so the matching cap moves whichever way the visitor stepped.
 */
export function useKeycapPress(): { pressed: NavDirection | null; press: (direction: NavDirection) => void } {
  const [pressed, setPressed] = useState<NavDirection | null>(null);
  const tracker = useRef<KeycapPress | null>(null);

  useEffect(() => {
    const created = createKeycapPress(setPressed);
    tracker.current = created;
    return () => {
      created.dispose();
      tracker.current = null;
    };
  }, []);

  const press = useCallback((direction: NavDirection) => tracker.current?.press(direction), []);
  return { pressed, press };
}
