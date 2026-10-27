/**
 * Colour coding of the connections between lanes, for 3 or more people.
 *
 * A film shown in every lane is green and has no slot (`null`). A film shown in only some
 * lanes gets a slot that names a palette colour (`--conn-<slot + 1>` in globals.css), chosen
 * from the set of lanes alone, so the colour is the same at every zoom, with the minor
 * toggle on or off, and whichever films happen to be on screen.
 *
 * Pairs are numbered in colexicographic order, (0,1) (0,2) (1,2) (0,3) (1,3) (2,3), which
 * does not depend on how many lanes there are: adding a fourth person keeps the colours of
 * the first three pairs. With 4 lanes there are 6 pairs, one slot each. A subset of three
 * lanes (only possible with 4) shares the one remaining slot; which lanes it joins is
 * visible in the line itself.
 */

/** Slots 0 to 5 are the six pairs of up to four lanes. */
export const PAIR_SLOTS = 6;
/** Subsets of three or more lanes, none of them all of them. */
export const GROUP_SLOT = PAIR_SLOTS;
export const CONNECTION_SLOTS = PAIR_SLOTS + 1;

/** CSS colour of a slot (a token from globals.css). */
export function slotColor(slot: number): string {
  return `var(--conn-${Math.min(Math.max(0, slot), GROUP_SLOT) + 1})`;
}

/** Colexicographic index of the pair `a < b`; unique per pair, independent of the lane count. */
export function pairIndex(a: number, b: number): number {
  const [low, high] = a < b ? [a, b] : [b, a];
  return (high * (high - 1)) / 2 + low;
}

/**
 * Palette slot of a film shown in `lanes` (indexes of the lanes that show it) out of
 * `laneCount`: null for a film in every lane (green) or in fewer than two (no connector).
 */
export function connectionSlot(lanes: readonly number[], laneCount: number): number | null {
  const unique = [...new Set(lanes)].sort((a, b) => a - b);
  if (unique.length < 2 || unique.length >= laneCount) return null;
  if (unique.length === 2) return Math.min(pairIndex(unique[0], unique[1]), GROUP_SLOT);
  return GROUP_SLOT;
}

/** One chip of the legend: a colour and what it stands for. */
export interface LegendEntry {
  /** Stable React key and the identity used to emphasise one kind of connection. */
  key: string;
  /** null for the films every lane shares (green). */
  slot: number | null;
  /** The two lanes of a pair; null for everyone (green) and for the group slot. */
  lanes: [number, number] | null;
  /** Films of this kind on screen. */
  count: number;
}

/** Key of a connector, shared by the legend chips and the lines they emphasise. */
export function connectionKey(slot: number | null): string {
  return slot === null ? "all" : `slot-${slot}`;
}

/**
 * The legend for the connectors on screen: green first (when films are shared by every
 * lane), then one entry per slot in use, in slot order. Only for 3+ lanes.
 */
export function connectionLegend(
  connectors: readonly { lanes: readonly number[]; slot: number | null }[],
  laneCount: number,
): LegendEntry[] {
  if (laneCount < 3) return [];
  const byKey = new Map<string, LegendEntry>();
  for (const { lanes, slot } of connectors) {
    const key = connectionKey(slot);
    const entry = byKey.get(key);
    if (entry) {
      entry.count += 1;
      continue;
    }
    const pair = slot !== null && slot < PAIR_SLOTS && lanes.length === 2 ? ([lanes[0], lanes[1]] as [number, number]) : null;
    byKey.set(key, { key, slot, lanes: pair, count: 1 });
  }
  const rank = (entry: LegendEntry) => (entry.slot === null ? -1 : entry.slot);
  return [...byKey.values()].sort((a, b) => rank(a) - rank(b));
}
