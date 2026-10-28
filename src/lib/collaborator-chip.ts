import type { CollaboratorSuggestion } from "@/lib/types";

/** "1 film", "4 films". */
export function filmCountLabel(count: number): string {
  return `${count} ${count === 1 ? "film" : "films"}`;
}

/** What a screen reader says for a chip: "Add Steven Spielberg: 4 films together, Director". */
export function chipLabel(s: Pick<CollaboratorSuggestion, "name" | "sharedCount" | "roles">): string {
  const together = `${filmCountLabel(s.sharedCount)} together`;
  return `Add ${s.name}: ${[together, s.roles].filter(Boolean).join(", ")}`;
}

/** "Together in Jaws, Duel and 1941", or null when there are no titles to name. */
export function chipDescription(s: Pick<CollaboratorSuggestion, "titles">): string | null {
  if (s.titles.length === 0) return null;
  return `Together in ${new Intl.ListFormat("en", { style: "long", type: "conjunction" }).format(s.titles)}`;
}

export interface EdgeFades {
  /** More chips hidden past the start of the row. */
  start: boolean;
  /** More chips hidden past the end of the row. */
  end: boolean;
}

/**
 * Which edges of a horizontally scrolling row have more content behind them, from its scroll
 * position and sizes. A pixel of slack absorbs the fractional scroll positions of zoomed pages.
 */
export function edgeFades(scrollLeft: number, clientWidth: number, scrollWidth: number): EdgeFades {
  const slack = 1;
  return {
    start: scrollLeft > slack,
    end: scrollLeft + clientWidth < scrollWidth - slack,
  };
}

/** Width of the soft edge where chips fade out, in px. */
export const FADE_WIDTH = 32;

/**
 * A CSS mask that fades out the edges with more chips behind them, or undefined when nothing is
 * hidden. A mask (not an overlay gradient) so the fade needs no knowledge of the page background.
 */
export function fadeMask({ start, end }: EdgeFades): string | undefined {
  if (!start && !end) return undefined;
  const left = start ? `transparent 0, #000 ${FADE_WIDTH}px` : "#000 0, #000 0";
  const right = end ? `#000 calc(100% - ${FADE_WIDTH}px), transparent 100%` : "#000 100%, #000 100%";
  return `linear-gradient(to right, ${left}, ${right})`;
}

/** How far the arrow buttons scroll the row: most of a screenful, so a chip stays in view for context. */
export function scrollStep(clientWidth: number): number {
  return Math.max(120, Math.round(clientWidth * 0.8));
}
