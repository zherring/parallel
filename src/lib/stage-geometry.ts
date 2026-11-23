/**
 * The landing hero stage's sideways geometry, written once: the gutter on each side of the screen, the seam between the halves, and how far in from the screen's edges the stage's
 * decoration box is (`--core-pad`). The CSS gets them from here (hero.tsx sets `--gutter`, `--seam-phone` and `--seam-wide` on the section, hero-stage.tsx `--core-pad` on the stage; hero-stage.css
 * picks the seam by width and derives the rest), and so do the numbers that must follow it, which a browser cannot be asked for before it has laid the page out: how many columns of
 * posters a montage draws (backdrop-posters.ts `extensionColumnsFor`) and the tablet figure's size (hero-layout.ts `tabletFigure`). A leaf with no imports, so that the poster script can have it.
 */

/** The gutter: `GUTTER.vw` percent of the screen's width, from `min` to `max` px. */
export const GUTTER = { min: 12, vw: 5, max: 88 } as const;
/** The seam between the halves, px: `phone` below `SM_WIDTH`, `wide` from it up. */
export const SEAM = { phone: 6, wide: 12 } as const;
/** Tailwind's `sm` (40rem), the width from which the seam is `SEAM.wide` (hero-stage.css has the same breakpoint). */
export const SM_WIDTH = 640;
/** Up to this width of the stage the decoration box is inset by the gutter; past it by the gutter and half of what is left. */
export const CORE_PAD_FROM = 1600;

/** `--gutter` on the section. */
export const GUTTER_CSS = `clamp(${GUTTER.min}px, ${GUTTER.vw}vw, ${GUTTER.max}px)`;
/** `--core-pad` on the stage (`cqw`: the stage is a size container as wide as the screen), from `--gutter`. */
export const CORE_PAD_CSS = `max(var(--gutter), calc((100cqw - ${CORE_PAD_FROM}px) / 2 + var(--gutter)))`;
/** What the section sets for its CSS: the gutter, and the two seams that hero-stage.css chooses between by width. */
export const SECTION_GEOMETRY = {
  "--gutter": GUTTER_CSS,
  "--seam-phone": `${SEAM.phone}px`,
  "--seam-wide": `${SEAM.wide}px`,
} as const;

/** The gutter on a screen `width` px wide, in px. */
export function gutterAt(width: number): number {
  return Math.min(GUTTER.max, Math.max(GUTTER.min, (GUTTER.vw / 100) * width));
}

/** The seam on a screen `width` px wide, in px. */
export function seamAt(width: number): number {
  return width >= SM_WIDTH ? SEAM.wide : SEAM.phone;
}

/** How far in from the screen's edges the stage's decoration box is on a screen `width` px wide, in px: `--core-pad`. */
export function corePadAt(width: number): number {
  const gutter = gutterAt(width);
  return Math.max(gutter, (width - CORE_PAD_FROM) / 2 + gutter);
}
