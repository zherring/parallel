"use client";

import { useSyncExternalStore } from "react";

/** The visitor asked for less motion. */
export const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
/** A mouse or a pen that can hover, as opposed to a finger. */
export const FINE_POINTER = "(hover: hover) and (pointer: fine)";

/**
 * Whether a media query matches. False on the server and for the hydrating render, so the markup agrees with the
 * server's, and the real answer from the render after it.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
