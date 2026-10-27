/**
 * Pure helpers for the avatar dock: which lane is most in view, and where to scroll to bring
 * a lane to the top. Lane boxes are the ones from `stackLanes` (y from the first lane's top).
 */

import { AXIS_HEIGHT, type LaneBox } from "@/lib/timeline-layout";

/**
 * Index of the lane with the most pixels inside the scroller's visible lane area (below the
 * sticky axis header). Ties go to the earlier lane; -1 when there are no lanes.
 */
export function mostVisibleLane(
  boxes: readonly LaneBox[],
  scrollTop: number,
  clientHeight: number,
  headerHeight: number = AXIS_HEIGHT,
): number {
  const visibleStart = scrollTop + headerHeight;
  const visibleEnd = scrollTop + clientHeight;
  let best = -1;
  let bestOverlap = -1;
  boxes.forEach((box, index) => {
    const start = headerHeight + box.top;
    const overlap = Math.max(0, Math.min(start + box.height, visibleEnd) - Math.max(start, visibleStart));
    if (overlap > bestOverlap) {
      best = index;
      bestOverlap = overlap;
    }
  });
  return best;
}

/**
 * scrollTop that puts the lane's top edge just under the sticky axis header. The browser
 * clamps it, so the last lanes simply scroll as far as they can.
 */
export function laneScrollTop(boxes: readonly LaneBox[], index: number): number {
  return Math.max(0, boxes[index]?.top ?? 0);
}
