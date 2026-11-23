/**
 * A genre's pairing card (src/components/landing/pairing-card.tsx) has its people as a cascade of portrait cards at its left, on the card's own surface: person A at the upper
 * left, turned a little to the left, B lower and to the right, turned a little the other way and drawn over A's bottom right, so the pair reads from the top left to the bottom
 * right and runs nearly the whole height of the card. The card's height is its text's, so the portraits are sized from the box they have (`cascadeLayout`, measured by
 * card-portraits.tsx); the box's width is a share of the card's (`CELL_CQW`), so the text beside it does not depend on them.
 */

/** A portrait card's width / height. */
export const PORTRAIT_ASPECT = 3 / 4;

/** The portraits' box is a third of the card's content width (`cqw`, the card is the container) wide, and the card's height tall less nothing: it goes `CELL_BLEED_PX` into the padding above and below. */
export const CELL_CQW = 34;
export const CELL_BLEED_PX = 8;

/** The least height of a card, px: its portraits are never tiny, whatever its text. */
export const CARD_MIN_HEIGHT_PX = { phone: 150, desktop: 160 } as const;

/** The tilt of each portrait, degrees (the sign alternates: A turned to the left, B to the right). */
const TILTS = [5, 4, 4.5, 3.5] as const;

/** How far each portrait is from the one before it, in portrait widths (`sx`) and heights (`sy`): a pair's covers the bottom right of A; three or four go less far each. */
const stepOf = (count: number): { sx: number; sy: number } => (count <= 2 ? { sx: 0.6, sy: 0.55 } : count === 3 ? { sx: 0.45, sy: 0.4 } : { sx: 0.35, sy: 0.3 });

/** How far the first portrait moves on hover (up and to the left, px), and the last (down and to the right); the ones between, in proportion. */
export const NUDGE_FIRST_PX = -2;
export const NUDGE_LAST_PX = 3;

/** Where one portrait of the cascade is (px from the box's top left), how it is turned, and how far it moves on hover (px, along both axes). */
export interface CascadePlace {
  x: number;
  y: number;
  /** Degrees, clockwise (A's is negative). */
  tilt: number;
  nudge: number;
}

export interface CascadeLayout {
  /** A portrait's width and height, px. */
  w: number;
  h: number;
  places: CascadePlace[];
}

const round = (value: number) => Math.round(value * 10) / 10;

/**
 * The cascade of `count` people in a box `width` x `height` px: the biggest portraits (at 3:4) that cascade inside it, the first at the box's left and the cascade centred on its
 * height (so a pair in a tall, narrow box is as wide as the box and shorter than it, and in a short, wide one as tall as the box: the card's height less nothing, the
 * pair running from its top to its bottom). Nothing until the box has a size.
 */
export function cascadeLayout(width: number, height: number, count: number): CascadeLayout | null {
  const n = Math.max(1, Math.floor(count));
  if (!(width > 0) || !(height > 0)) return null;
  const { sx, sy } = stepOf(n);
  const spanX = 1 + (n - 1) * sx;
  const spanY = 1 + (n - 1) * sy;
  const h = Math.min(height / spanY, width / spanX / PORTRAIT_ASPECT);
  const w = h * PORTRAIT_ASPECT;
  const top = (height - h * spanY) / 2;
  const places = Array.from({ length: n }, (_, i): CascadePlace => ({
    x: round(i * sx * w),
    y: round(top + i * sy * h),
    tilt: (i % 2 === 0 ? -1 : 1) * (TILTS[i] ?? TILTS[TILTS.length - 1]),
    nudge: n === 1 ? 0 : round(NUDGE_FIRST_PX + (i / (n - 1)) * (NUDGE_LAST_PX - NUDGE_FIRST_PX)),
  }));
  return { w: round(w), h: round(h), places };
}
