/**
 * Lets at most `limit` tasks run at once; the rest wait in arrival order. A waiter can give up
 * through an AbortSignal (its place in the line is freed and `run` rejects with the signal's
 * reason), so a caller that has already timed out never holds up, or takes a slot from, the others.
 */
export class Semaphore {
  private active = 0;
  private readonly waiting: Array<() => void> = [];

  constructor(readonly limit: number) {
    if (!Number.isInteger(limit) || limit < 1) throw new RangeError("Semaphore limit must be a positive integer");
  }

  /** Runs `task` once a slot is free and gives the slot back when it settles, however it settles. */
  async run<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    await this.acquire(signal);
    try {
      return await task();
    } finally {
      this.release();
    }
  }

  private acquire(signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) return Promise.reject(signal.reason);
    if (this.active < this.limit) {
      this.active++;
      return Promise.resolve();
    }
    return new Promise<void>((resolve, reject) => {
      const grant = () => {
        signal?.removeEventListener("abort", onAbort);
        resolve();
      };
      const onAbort = () => {
        const index = this.waiting.indexOf(grant);
        if (index !== -1) this.waiting.splice(index, 1);
        reject(signal?.reason);
      };
      this.waiting.push(grant);
      signal?.addEventListener("abort", onAbort, { once: true });
    });
  }

  private release(): void {
    // Hand the slot straight to the next waiter (so `active` stays put), or free it.
    const next = this.waiting.shift();
    if (next) next();
    else this.active--;
  }
}
