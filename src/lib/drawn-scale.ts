/**
 * The factor a scroller is drawn at, against its layout: 1 when it is drawn at its own size, under 1 when an ancestor scales it down (the pair embed draws its timeline smaller to
 * fit the frame, see `PairEmbed`). What is read from the screen (a pointer's travel, a rect) is in the drawn size and a scroller's `scrollLeft` is in its own: dividing the one by this
 * gives the other. A scroller with no box (`display: none`, not laid out) is 1.
 */
export function drawnScale(el: HTMLElement): number {
  const drawn = el.offsetWidth > 0 ? el.getBoundingClientRect().width / el.offsetWidth : 0;
  return drawn > 0 ? drawn : 1;
}
