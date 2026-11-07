/**
 * Where the browser's perspective puts things, worked out from numbers instead of read from the DOM (a layout read
 * per poster per frame would be the one thing that makes a scene like this janky). The scroller has
 * `perspective: P` with its origin at its centre, a layer sits `Z` behind the screen plane, and its scale on
 * screen is `f = P / (P + Z)` (see `layerFactor`). With the viewport `W` by `H` scrolled to `S`, a point at document
 * (`x`, `y`) on that layer lands at
 *
 *   screen_y = (y - S) f + (H / 2)(1 - f)        screen_x = (x - W / 2) f + W / 2
 *
 * and a size `s` becomes `s f`. Whatever the layer, the point at the viewport's centre (`y = S + H / 2`) stays at
 * `H / 2`: the layers all agree on the "focus line", and drift apart from it, which is the parallax.
 */

/** Screen y (px from the viewport's top) of document y `y` on a layer of factor `f`, with the scroller at `scrollTop`. */
export function projectY(y: number, scrollTop: number, viewportH: number, f: number): number {
  return (y - scrollTop) * f + (viewportH / 2) * (1 - f);
}

/** Screen x (px from the viewport's left) of document x `x` (px from the left of the scroll area) on a layer of factor `f`. */
export function projectX(x: number, viewportW: number, f: number): number {
  return (x - viewportW / 2) * f + viewportW / 2;
}

/**
 * The document y range whose posters are on screen, or within `buffer` px of it (screen px), on a layer of factor `f`:
 * the inverse of `projectY` at the viewport's top and bottom edges, moved out by the buffer.
 */
export function visibleDocRange(scrollTop: number, viewportH: number, f: number, buffer: number): { from: number; to: number } {
  const docY = (screenY: number) => scrollTop + (screenY - (viewportH / 2) * (1 - f)) / f;
  return { from: docY(-buffer), to: docY(viewportH + buffer) };
}

/**
 * How much a poster at screen distance `distance` from the focus (the pointer, or the centre band) is in focus, 0 to 1:
 * 1 within 0.35 of `radius`, 0 from `radius` on, a smoothstep between.
 */
export function focusWeight(distance: number, radius: number): number {
  if (!(radius > 0)) return 0;
  const inner = radius * 0.35;
  const t = Math.min(1, Math.max(0, (radius - Math.abs(distance)) / (radius - inner)));
  return t * t * (3 - 2 * t);
}

/**
 * Screen distance (px) from a poster's centre to the focus: the pointer when there is one, else the horizontal band
 * through the middle of the viewport (a finger has no hover; the posters sharpen as they scroll through the middle).
 */
export function focusDistance(screenX: number, screenY: number, viewportH: number, pointer: { x: number; y: number } | null): number {
  return pointer ? Math.hypot(screenX - pointer.x, screenY - pointer.y) : Math.abs(screenY - viewportH / 2);
}

/**
 * The fallback for a browser that does not parallax perspective layers by scrolling: a layer drawn flat at
 * `translateZ(0)`, its posters pre-scaled by `f` about the viewport's centre, is moved by this much (px, down) per
 * frame, so the screen geometry is the one `projectY` gives.
 */
export function jsLayerTranslate(scrollTop: number, viewportH: number, f: number): number {
  return (1 - f) * (scrollTop + viewportH / 2);
}
