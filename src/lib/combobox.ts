export const MIN_QUERY_LENGTH = 2;
export const MAX_QUERY_LENGTH = 100;

/** Trims and collapses inner whitespace so "brad   pitt " and "brad pitt" are one query. */
export function normalizeQuery(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

export type Move = "next" | "prev" | "first" | "last";

/**
 * The next active option index for keyboard navigation, skipping disabled options. "next" and
 * "prev" wrap around. `current` may be -1 (nothing active). Returns -1 when nothing is selectable.
 */
export function moveActive(disabled: readonly boolean[], current: number, move: Move): number {
  const count = disabled.length;
  const selectable = (i: number) => !disabled[i];
  if (!disabled.some((_, i) => selectable(i))) return -1;

  if (move === "first") return disabled.findIndex((_, i) => selectable(i));
  if (move === "last") {
    for (let i = count - 1; i >= 0; i--) if (selectable(i)) return i;
  }

  const step = move === "next" ? 1 : -1;
  let index = current;
  for (let tries = 0; tries < count; tries++) {
    index = index === -1 ? (step === 1 ? 0 : count - 1) : (index + step + count) % count;
    if (selectable(index)) return index;
  }
  return -1;
}
