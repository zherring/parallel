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

/** What `fitMenu` decides for a menu that hangs from its button. */
export interface MenuFit {
  /** The menu opens above its button (it does not fit below, and there is more room above). */
  up: boolean;
  /** The tallest it may be, px: the room on the side it opens to (a taller menu scrolls inside this). */
  maxHeight: number;
}

/**
 * Which side of its button a menu of `height` opens to, and how tall it may be there, so that every item of it is on the screen or one scroll away: below, as menus
 * usually do, unless it does not fit there and has more room above (the rule `placePopover` has for a card); and never taller than the room on that side,
 * which is the viewport's height less the button, the `gap` to it and the `margin` to the screen's edge. A menu with room on neither side takes the roomier one and scrolls.
 */
export function fitMenu(
  button: Pick<Box, "top" | "bottom">,
  height: number,
  viewportHeight: number,
  { gap = POPOVER_GAP, margin = POPOVER_MARGIN }: { gap?: number; margin?: number } = {},
): MenuFit {
  const roomBelow = Math.max(0, Math.floor(viewportHeight - margin - (button.bottom + gap)));
  const roomAbove = Math.max(0, Math.floor(button.top - gap - margin));
  const up = roomBelow < height && (roomAbove >= height || roomAbove > roomBelow);
  return { up, maxHeight: up ? roomAbove : roomBelow };
}

/** Like Math.min(Math.max(v, min), max), but `min` wins when the range is empty (box larger than the viewport). */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}
