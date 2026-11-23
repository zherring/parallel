// The rules of a touch drag that follows the finger and then either snaps to its action or springs back: the hero's swipe between
// pairings and the panel's pull to dismiss. Pure, so the thresholds are tested without a browser; the components move the pixels.

/** A finger's position along the drag's axis at a moment, in CSS pixels and milliseconds. */
export interface SwipeSample {
  t: number;
  pos: number;
}

/** How far back the release speed looks: a finger that stopped before lifting was not flung. */
const VELOCITY_WINDOW_MS = 100;

/**
 * The finger's speed as it lifts, in px/ms along the axis (signed), from the samples of the last 100ms before `now`. Zero when it
 * rested before lifting, or with fewer than two samples.
 */
export function releaseVelocity(samples: readonly SwipeSample[], now: number): number {
  const recent = samples.filter((sample) => now - sample.t <= VELOCITY_WINDOW_MS);
  if (recent.length < 2) return 0;
  const first = recent[0];
  const last = recent[recent.length - 1];
  const elapsed = last.t - first.t;
  return elapsed > 0 ? (last.pos - first.pos) / elapsed : 0;
}

export interface SwipeRelease {
  /** How far the thing has been dragged from rest, signed, in px. */
  offset: number;
  /** The finger's speed as it lifted, signed, in px/ms (`releaseVelocity`). */
  velocity: number;
  /** The size of the thing along the axis, in px: the distance that counts as "far" is a share of it. */
  extent: number;
}

/** Past this share of the extent, letting go completes the action. */
export const SWIPE_DISTANCE_RATIO = 0.25;
/** However large the thing, this many px is far enough (a tall sheet does not need a quarter of the screen). */
export const SWIPE_DISTANCE_MAX = 140;
/** A flick: this fast (px/ms) in the direction of the drag completes it from a short distance. */
export const SWIPE_FLICK_VELOCITY = 0.4;
/** A flick still has to have gone somewhere. */
export const SWIPE_FLICK_MIN_DISTANCE = 12;

/** The distance past which letting go completes the action, for something `extent` px long. */
export const swipeThreshold = (extent: number): number => Math.min(SWIPE_DISTANCE_MAX, extent * SWIPE_DISTANCE_RATIO);

/**
 * What letting go does: 1 or -1 completes the action in that direction (the sign of the offset), 0 springs back. Far enough
 * completes it unless the finger was moving back as it lifted (a change of mind); a flick completes it from close by.
 */
export function swipeOutcome({ offset, velocity, extent }: SwipeRelease): -1 | 0 | 1 {
  if (offset === 0) return 0;
  const dir = offset > 0 ? 1 : -1;
  const distance = Math.abs(offset);
  const along = velocity * dir; // positive: still going the way it was dragged
  if (along <= -SWIPE_FLICK_VELOCITY) return 0;
  if (distance >= swipeThreshold(extent)) return dir;
  if (along >= SWIPE_FLICK_VELOCITY && distance >= SWIPE_FLICK_MIN_DISTANCE) return dir;
  return 0;
}

/** Whether the drag is past the point where letting go (at rest) would complete it: the cue shown while the finger is down. */
export const swipeArmed = (offset: number, extent: number): boolean => Math.abs(offset) >= swipeThreshold(extent);

/** Which way a touch that has started to move is going: along x, along y, or not yet far enough to tell. */
export function swipeAxis(dx: number, dy: number, slop: number): "x" | "y" | null {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < slop) return null;
  return Math.abs(dx) > Math.abs(dy) ? "x" : "y";
}
