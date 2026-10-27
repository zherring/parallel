/**
 * Pure helpers for the lane avatars: which lane is most in view, and where to scroll to bring
 * a lane to the top. Lane boxes are the ones from `stackLanes` (y from the first lane's top,
 * which is the top of the scroller's content: the year axis is a sticky row under the last lane).
 */

import { AXIS_HEIGHT, type LaneBox } from "@/lib/timeline-layout";

/**
 * Index of the lane that is most in view: the one with the largest share of itself inside the
 * scroller's visible lane area (above the sticky axis at the bottom). A lane taller than that
 * area counts as fully in view when it fills it. Judging by share rather than pixels keeps a
 * short first lane from losing to a tall neighbour while both are completely on screen. Ties go
 * to the earlier lane; -1 when there are no lanes.
 */
export function mostVisibleLane(
  boxes: readonly LaneBox[],
  scrollTop: number,
  clientHeight: number,
  axisHeight: number = AXIS_HEIGHT,
): number {
  const visibleStart = scrollTop;
  const visibleEnd = scrollTop + clientHeight - axisHeight;
  const visibleHeight = Math.max(0, visibleEnd - visibleStart);
  let best = -1;
  let bestShare = -1;
  boxes.forEach((box, index) => {
    const overlap = Math.max(0, Math.min(box.top + box.height, visibleEnd) - Math.max(box.top, visibleStart));
    const room = Math.min(box.height, visibleHeight);
    const share = room > 0 ? overlap / room : 0;
    if (share > bestShare + 1e-9) {
      best = index;
      bestShare = share;
    }
  });
  return best;
}

/**
 * scrollTop that puts the lane's top edge at the top of the scroller. The browser clamps it,
 * so the last lanes simply scroll as far as they can (the axis stays under them).
 */
export function laneScrollTop(boxes: readonly LaneBox[], index: number): number {
  return Math.max(0, boxes[index]?.top ?? 0);
}
