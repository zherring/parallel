/**
 * `count` of `items` picked at random, one per genre while distinct genres remain: shuffle, take
 * the first item of each genre in shuffled order, then fill any remainder from what is left.
 * Returns fewer than `count` only when there are fewer items. Never mutates `items`.
 * `random` returns a number in [0, 1), like Math.random; tests inject a seeded one.
 */
export function pickFeatured<T extends { genre: string }>(
  items: readonly T[],
  count: number,
  random: () => number = Math.random,
): T[] {
  const shuffled = [...items];
  // Fisher-Yates
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const picked: T[] = [];
  const genres = new Set<string>();
  const rest: T[] = [];
  for (const item of shuffled) {
    if (picked.length < count && !genres.has(item.genre)) {
      genres.add(item.genre);
      picked.push(item);
    } else {
      rest.push(item);
    }
  }
  return [...picked, ...rest.slice(0, Math.max(0, count - picked.length))];
}

/**
 * The same shape of sample without any randomness, for the server-rendered markup: the first
 * item of each genre in the order the genres first appear, then the second of each, and so on,
 * up to `count`.
 */
export function defaultFeatured<T extends { genre: string }>(items: readonly T[], count: number): T[] {
  const byGenre = new Map<string, T[]>();
  for (const item of items) byGenre.set(item.genre, [...(byGenre.get(item.genre) ?? []), item]);

  const lists = [...byGenre.values()];
  const picked: T[] = [];
  for (let round = 0; picked.length < count; round++) {
    const before = picked.length;
    for (const list of lists) {
      if (picked.length < count && round < list.length) picked.push(list[round]);
    }
    if (picked.length === before) break; // every list is used up
  }
  return picked;
}
