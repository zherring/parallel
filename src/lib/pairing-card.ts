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

/*
 * The two riffs on the cascade (`?cards=split` and `?cards=duo`, hero-variants.ts): the same box, a third of the card wide and as tall as it, whatever is drawn in it.
 */

/** The seam of the split tile: its angle from the horizontal (not 45: the line rises a little less steeply than a corner to corner), its width at rest and under the pointer (px), and how far each half moves on hover (px, along the diagonal's two axes). */
export const SPLIT_SEAM_ANGLE_DEG = 38;
export const SPLIT_SEAM_PX = 2.5;
export const SPLIT_SEAM_HOVER_PX = 4;
export const SPLIT_SHIFT_PX = 1.5;

/** The split's square tile in a box `width` x `height`: as big as fits, at the box's left and centred on its height. Nothing until the box has a size. */
export function splitLayout(width: number, height: number): { s: number; x: number; y: number } | null {
  if (!(width > 0) || !(height > 0)) return null;
  const s = Math.min(width, height);
  return { s: round(s), x: 0, y: round((height - s) / 2) };
}

/**
 * The clip of each half of a split tile of side `s`, as CSS polygons (px, over the tile and a little past it, so that a half moved on hover leaves no sliver at the tile's edge):
 * A's is the part above and to the left of the seam, B's the part below and to the right, with `seam` px between them. The seam runs from the lower left to the upper right
 * through the tile's middle, at `SPLIT_SEAM_ANGLE_DEG`.
 */
export function splitClips(s: number, seam: number): { a: string; b: string } {
  const slope = Math.tan((SPLIT_SEAM_ANGLE_DEG * Math.PI) / 180);
  // The seam's line through the middle: y = s / 2 - slope * (x - s / 2); the half-gap, measured down the vertical, is seam / 2 over cos(angle).
  const half = seam / 2 / Math.cos((SPLIT_SEAM_ANGLE_DEG * Math.PI) / 180);
  const pad = 6;
  const y = (x: number, offset: number) => round(s / 2 - slope * (x - s / 2) + offset);
  const left = -pad;
  const right = s + pad;
  const point = (x: number, yy: number) => `${round(x)}px ${yy}px`;
  const a = [point(left, -pad), point(right, -pad), point(right, y(right, -half)), point(left, y(left, -half))].join(", ");
  const b = [point(left, y(left, half)), point(right, y(right, half)), point(right, s + pad), point(left, s + pad)].join(", ");
  return { a: `polygon(${a})`, b: `polygon(${b})` };
}

/** The duo's figures stand on the box's bottom: a cut-out's photo is 2:3, and each is `DUO_STEP` of a figure's width further along than the one before (they overlap by the rest, as shoulders do). */
export const DUO_ASPECT = 2 / 3;
export const DUO_STEP = 0.62;
/** How far the figures lean apart on hover (px): the first to the left, the last to the right. */
export const DUO_LEAN_PX = 2;
/** The backdrop's share of the figures' height, from the box's bottom up, and the part of it (from the bottom) the page's colour covers. */
export const DUO_BACKDROP = 0.9;
export const DUO_MELT = 0.5;

export interface DuoLayout {
  /** A figure's height and width, px. */
  h: number;
  w: number;
  /** The figures' left edges (px from the box's left) and their lean on hover (px; the middle one of three does not move). */
  places: { x: number; lean: number }[];
  /** The figures' span across, px; the box's top of the backdrop (px from the box's top); and how far above the box's bottom they stand (px: the duo is centred on the box's height, and it melts into the card's own colour wherever it ends). */
  span: number;
  top: number;
  inset: number;
}

/** The duo of `count` people in a box `width` x `height`: the biggest figures that fit, side by side from the box's left, centred on its height (so a narrow box's smaller figures are not left at the bottom of a tall card). Nothing until the box has a size. */
export function duoLayout(width: number, height: number, count: number): DuoLayout | null {
  const n = Math.max(1, Math.floor(count));
  if (!(width > 0) || !(height > 0)) return null;
  const spanW = 1 + (n - 1) * DUO_STEP;
  const h = Math.min(height, width / spanW / DUO_ASPECT);
  const w = h * DUO_ASPECT;
  return {
    h: round(h),
    w: round(w),
    places: Array.from({ length: n }, (_, i) => ({
      x: round(i * DUO_STEP * w),
      lean: n === 1 ? 0 : round(-DUO_LEAN_PX + (i / (n - 1)) * 2 * DUO_LEAN_PX),
    })),
    span: round(spanW * w),
    top: round((height - h) / 2 + h * (1 - DUO_BACKDROP)),
    inset: round((height - h) / 2),
  };
}
