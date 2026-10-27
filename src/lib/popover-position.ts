/**
 * Pure placement for the film hover card: a fixed-position box next to a trigger, kept
 * inside the viewport. The card is portalled to the body (the timeline's scroller clips its
 * overflow), so the position is computed from the trigger's viewport rect.
 */

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Placement {
  /** Viewport coordinates of the card's top-left corner. */
  left: number;
  top: number;
  placement: "above" | "below";
}

export const POPOVER_GAP = 10;
export const POPOVER_MARGIN = 8;

/**
 * Centres the card under the trigger and flips it above when it does not fit below and
 * there is more room above. With too little room either way it takes the roomier side and
 * is clamped so it never leaves the viewport (a card taller than the viewport sticks to the top).
 *
 * `prefer` keeps the side the card already has while it still fits there. It is for re-placing a
 * card whose height changed after it opened (its metrics arrived): the card then never hops to
 * the other side of its trigger, the edge facing the trigger stays put and only the far edge moves.
 */
export function placePopover(
  trigger: Box,
  size: Size,
  viewport: Size,
  {
    gap = POPOVER_GAP,
    margin = POPOVER_MARGIN,
    prefer,
  }: { gap?: number; margin?: number; prefer?: Placement["placement"] } = {},
): Placement {
  const roomBelow = viewport.height - margin - (trigger.bottom + gap);
  const roomAbove = trigger.top - gap - margin;
  const keepsSide = prefer === "below" ? roomBelow >= size.height : prefer === "above" && roomAbove >= size.height;
  const below = keepsSide
    ? prefer === "below"
    : roomBelow >= size.height || (roomAbove < size.height && roomBelow >= roomAbove);
  const placement = below ? "below" : "above";

  const idealTop = below ? trigger.bottom + gap : trigger.top - gap - size.height;
  const top = clamp(idealTop, margin, viewport.height - margin - size.height);

  const centre = (trigger.left + trigger.right) / 2;
  const left = clamp(centre - size.width / 2, margin, viewport.width - margin - size.width);

  return { left: Math.round(left), top: Math.round(top), placement };
}

/** Like Math.min(Math.max(v, min), max), but `min` wins when the range is empty (box larger than the viewport). */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}
