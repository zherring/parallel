"use client";

import { useEffect, useState } from "react";
import { BaconModeBadge } from "@/components/bacon-mode-badge";

/** Whether the frame has already come in during this visit: it does so once, not each time a view of the page is opened (each one is a page of its own). */
let entered = false;

/**
 * Kevin Bacon mode's tell on the widths with no room for the bar's capsule (under `lg`, where the bar has no "Kevin Bacon mode ×" and the way out is a row of the
 * gear's sheet): the screen is framed in the mode's orange, with a small plaque set into the frame's left edge, like a picture frame's or a broadcast bug.
 *
 * The frame is decoration: a line along the edge of the screen that takes no pointer events, no room and no part of the layout (it is `fixed`, and drawn
 * over everything but the panels and dialogs, `z-[35]`), and is hidden from assistive technology. It sits inside the safe areas (a notch, the home indicator) and
 * never closer to the edge than 3px, where the page's own controls are 12px or more away from it, and the Films view's year rail (4px from the right edge) ends
 * where the line begins. The plaque is the one control: the same link as the bar's capsule and the sheet's row (`BaconModeBadge`), "Leave Kevin Bacon mode". It
 * is on the left edge, which is free on every view (the bar is at the top, the minimap and the zoom at the bottom, the year rail and the panels at the right),
 * and under the bar (`z-[25]`), so that the pill's open field, the hero's band, the gear's sheet and the panels cover it instead of meeting it.
 */
export function BaconFrame() {
  // The first mount of the visit comes in (see globals.css); the next ones are there already. The server renders the first: it has no visit.
  const [enter] = useState(() => !entered);
  useEffect(() => {
    entered = true;
  }, []);
  return (
    <>
      <div aria-hidden="true" data-bacon-frame data-enter={enter ? "" : undefined} className="pointer-events-none fixed z-[35] rounded-2xl border-2 border-accent-orange lg:hidden" />
      <BaconModeBadge plaque enter={enter} className="fixed z-[25] lg:hidden" />
    </>
  );
}
