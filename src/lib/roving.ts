/**
 * Pure helpers for a roving tabindex over a row of nodes: only one node of a lane is a tab
 * stop, and the arrow keys move focus along the line.
 */

/**
 * Index to focus after `key` while the node at `current` has focus, among `count` nodes in
 * left-to-right order. Stops at both ends (no wrapping). Null for keys that do not move focus.
 */
export function rovingIndex(key: string, current: number, count: number): number | null {
  if (count <= 0) return null;
  const last = count - 1;
  switch (key) {
    case "ArrowRight":
      return Math.min(last, Math.max(0, current) + 1);
    case "ArrowLeft":
      return Math.max(0, Math.min(last, current) - 1);
    case "Home":
      return 0;
    case "End":
      return last;
    default:
      return null;
  }
}

/**
 * The id of the lane's single tab stop among the films that are only a node in that lane
 * (the others have a poster card in the lane, which is a tab stop of its own, so a film is
 * never two controls in one lane): the one last focused if it is still there, else the
 * first. Null when there are none.
 */
export function tabStopId(ids: readonly number[], stored: number | undefined): number | null {
  if (ids.length === 0) return null;
  return stored !== undefined && ids.includes(stored) ? stored : ids[0];
}

/**
 * Ids of the films of a lane that are only a node on its line, in the lane's order: the set
 * the roving tab stop and the arrow keys move through. A film with a poster card in the lane
 * is left out, because the card is its control there (the node under it is only a mouse
 * target); a film that is a card in one lane and just a node in another is in the second
 * lane's set only.
 */
export function nodeOnlyIds(items: readonly { film: { id: number }; overflow: boolean }[]): number[] {
  return items.filter((item) => item.overflow).map((item) => item.film.id);
}
