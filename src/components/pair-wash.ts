"use client";

import { useEffect, useSyncExternalStore, type CSSProperties } from "react";

/**
 * A colour as a soft glow background (`QUOTE_GLOW_IMAGE`). The colours are registered `<color>` custom properties, so a change (the other speaker's quote)
 * eases from one colour to the next; where registration is missing they change at once, as they do when the visitor asks for less motion.
 */
export const PAIR_WASH_A = "--pair-wash-a";
export const PAIR_WASH_B = "--pair-wash-b";
/** About as long as a quote's speaker change takes. */
export const PAIR_WASH_MS = 800;

let registered = false;
/** Registers the two colours (once, and only once something asks for the wash). */
export function registerPairWash() {
  if (registered) return;
  registered = true;
  for (const name of [PAIR_WASH_A, PAIR_WASH_B]) {
    try {
      CSS.registerProperty({ name, syntax: "<color>", inherits: false, initialValue: "transparent" });
    } catch {
      // Registered already (a hot reload), or not supported: then the colours swap without easing.
    }
  }
}

/** The wash's transition: none when the visitor asks for less motion, so the colours swap at once. */
export function pairWashTransition(reduced: boolean, names: readonly string[] = [PAIR_WASH_A, PAIR_WASH_B]): string {
  return reduced ? "" : names.map((name) => `${name} ${PAIR_WASH_MS}ms ease-in-out`).join(", ");
}

/**
 * The quotes' variant: one colour (the speaker's), as if the quote were lit from below: an ellipse rising from the bottom centre, as faint as the
 * pair's wash and gone by about 70% of the height. It rides the first of the pair's registered colours, so it eases as they do.
 */
export const QUOTE_GLOW_IMAGE = `radial-gradient(ellipse 85% 100% at 50% 100%, color-mix(in srgb, var(${PAIR_WASH_A}) 16%, transparent), transparent 70%)`;

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";
function subscribeReduced(onChange: () => void) {
  const query = window.matchMedia(REDUCED_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
/** Whether the visitor asks for less motion; false on the server and in the hydrating render. */
export const useReducedMotion = () =>
  useSyncExternalStore(subscribeReduced, () => window.matchMedia(REDUCED_QUERY).matches, () => false);

function useWashStyle(colors: readonly string[] | null, image: string, names: readonly string[]): CSSProperties | undefined {
  const reduced = useReducedMotion();
  const on = colors !== null;
  useEffect(() => {
    if (on) registerPairWash();
  }, [on]);
  if (!colors) return undefined;
  return {
    backgroundImage: image,
    transition: pairWashTransition(reduced, names) || undefined,
    ...Object.fromEntries(names.map((name, i) => [name, colors[i]])),
  } as CSSProperties;
}

/** The quotes' glow (`QUOTE_GLOW_IMAGE`) as an element's style: `color` is the speaker's, or null for no style at all. */
export function useQuoteGlowStyle(color: string | null): CSSProperties | undefined {
  return useWashStyle(color === null ? null : [color], QUOTE_GLOW_IMAGE, [PAIR_WASH_A]);
}
