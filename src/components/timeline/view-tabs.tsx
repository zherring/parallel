"use client";

import type { MouseEvent } from "react";

/** A plain left click, with no modifier key: the one a page may take over. A click that opens the link elsewhere (a new tab, a new window) is the browser's. */
export function isPlainClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

/**
 * The `onClick` of a link to a view the page shows in place (the flat page's views are panels of the page, see `useViewTab`): a plain click
 * chooses the view here instead of following the link. None without `choose`, and the link then navigates.
 */
export function inPlace(choose: (() => void) | undefined): ((event: MouseEvent<HTMLAnchorElement>) => void) | undefined {
  if (!choose) return undefined;
  return (event) => {
    if (!isPlainClick(event)) return;
    event.preventDefault();
    choose();
  };
}
