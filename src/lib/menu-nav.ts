/**
 * Index of the menu item to focus after `key` while the item at `current` has focus (-1 when
 * focus is not on an item), among `count` items. Arrow keys wrap around; Home and End jump to
 * the ends. Null for keys that do not move focus.
 */
export function menuIndex(key: string, current: number, count: number): number | null {
  if (count <= 0) return null;
  const last = count - 1;
  switch (key) {
    case "ArrowDown":
      return current < 0 || current >= last ? 0 : current + 1;
    case "ArrowUp":
      return current <= 0 ? last : current - 1;
    case "Home":
      return 0;
    case "End":
      return last;
    default:
      return null;
  }
}
