/**
 * A small in-memory cache: at most `maxSize` entries (the least recently used goes first) and
 * each one is forgotten `ttlMs` after it was stored. `now` is injectable for tests.
 */
export class TtlCache<K, V> {
  private readonly entries = new Map<K, { value: V; expires: number }>();

  constructor(
    private readonly maxSize: number,
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  get(key: K): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expires <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    // Re-insert so the Map's order is least recently used first.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: K, value: V): void {
    this.entries.delete(key);
    this.entries.set(key, { value, expires: this.now() + this.ttlMs });
    while (this.entries.size > this.maxSize) this.entries.delete(this.entries.keys().next().value as K);
  }

  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }
}
