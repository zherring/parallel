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
 * The id of the lane's single tab stop: the one last focused if it is still in the lane,
 * else the first of `preferredIds` (films shared by every lane) that is, else the first node.
 * Null for an empty lane.
 */
export function tabStopId(
  ids: readonly number[],
  stored: number | undefined,
  preferredIds: ReadonlySet<number>,
): number | null {
  if (ids.length === 0) return null;
  if (stored !== undefined && ids.includes(stored)) return stored;
  return ids.find((id) => preferredIds.has(id)) ?? ids[0];
}
