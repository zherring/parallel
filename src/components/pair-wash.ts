"use client";

import { useEffect, useSyncExternalStore, type CSSProperties } from "react";

/**
 * The quotes' glow: the speaker's colour as a soft glow from below (`QUOTE_GLOW_IMAGE`). The colour is a registered `<color>` custom property (`QUOTE_GLOW_COLOR`), so a
 * change (the other speaker's quote) eases from one colour to the next; where registration is missing it changes at once, as it does when the visitor asks for less motion.
 */
export const QUOTE_GLOW_COLOR = "--quote-glow-color";
/** About as long as a quote's speaker change takes. */
export const QUOTE_GLOW_MS = 800;

let registered = false;
/** Registers the glow's colour (once, and only once something asks for the glow). */
export function registerQuoteGlow() {
  if (registered) return;
  registered = true;
  try {
    CSS.registerProperty({ name: QUOTE_GLOW_COLOR, syntax: "<color>", inherits: false, initialValue: "transparent" });
  } catch {
    // Registered already (a hot reload), or not supported: then the colour swaps without easing.
  }
}

/** The glow's transition: none when the visitor asks for less motion, so the colour swaps at once. */
export function quoteGlowTransition(reduced: boolean): string {
  return reduced ? "" : `${QUOTE_GLOW_COLOR} ${QUOTE_GLOW_MS}ms ease-in-out`;
}

/** The glow as a background: one colour (the speaker's), as if the quote were lit from below: an ellipse rising from the bottom centre, faint, and gone by about 70% of the height. */
export const QUOTE_GLOW_IMAGE = `radial-gradient(ellipse 85% 100% at 50% 100%, color-mix(in srgb, var(${QUOTE_GLOW_COLOR}) 16%, transparent), transparent 70%)`;

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";
function subscribeReduced(onChange: () => void) {
  const query = window.matchMedia(REDUCED_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
/** Whether the visitor asks for less motion; false on the server and in the hydrating render. */
export const useReducedMotion = () =>
  useSyncExternalStore(subscribeReduced, () => window.matchMedia(REDUCED_QUERY).matches, () => false);

/** The quotes' glow (`QUOTE_GLOW_IMAGE`) as an element's style: `color` is the speaker's, or null for no style at all. */
export function useQuoteGlowStyle(color: string | null): CSSProperties | undefined {
  const reduced = useReducedMotion();
  const on = color !== null;
  useEffect(() => {
    if (on) registerQuoteGlow();
  }, [on]);
  if (color === null) return undefined;
  return { backgroundImage: QUOTE_GLOW_IMAGE, transition: quoteGlowTransition(reduced) || undefined, [QUOTE_GLOW_COLOR]: color } as CSSProperties;
}
