/**
 * What the landing hero's timeline shows at each width, as plain numbers, so it can be tested. The geometry itself (the posters' spacing, the
 * panels, the line) is CSS sized from the stage's box (hero-stage.tsx and the variables its section sets); only what depends on the pairing's
 * data is here: how many posters fit, and so what "+N more" says.
 */

import { moreFilms, type HeroPairing } from "@/lib/hero-scenes";

/**
 * The most posters each width shows. Its CSS breakpoints are Tailwind's `sm` (640px) and `lg` (1024px); hero-stage.tsx hides the posters past
 * the count with them, and sets `--cap` to the same numbers for the row's centring.
 */
export const POSTER_CAPS = { phone: 3, tablet: 4, desktop: 5 } as const;
export type PosterWidth = keyof typeof POSTER_CAPS;
export const POSTER_WIDTHS: readonly PosterWidth[] = ["phone", "tablet", "desktop"];

/** How many of the pairing's posters `width` shows: the first ones, so the dropped ones are the newest films. */
export function postersShown(pairing: HeroPairing, width: PosterWidth): number {
  return Math.min(pairing.posters.length, POSTER_CAPS[width]);
}

/** The "+N more" hint of a pairing at a width: every shared film the posters do not show; null when they show them all. */
export function moreText(pairing: HeroPairing, width: PosterWidth): string | null {
  const more = moreFilms(pairing, POSTER_CAPS[width]);
  return more > 0 ? `+${more} more` : null;
}

/** The hint at every width, for the label that has all three and lets CSS pick (so the server's markup is right whatever the visitor's screen). */
export function moreTexts(pairing: HeroPairing): Record<PosterWidth, string | null> {
  return { phone: moreText(pairing, "phone"), tablet: moreText(pairing, "tablet"), desktop: moreText(pairing, "desktop") };
}
