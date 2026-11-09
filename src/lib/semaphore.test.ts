import { describe, expect, it } from "vitest";
import { Semaphore } from "@/lib/semaphore";

/** A task that stays running until `finish` is called. */
function gate<T = void>() {
  let finish!: (value: T) => void;
  let fail!: (reason: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    finish = resolve;
    fail = reject;
  });
  return { promise, finish, fail };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("Semaphore", () => {
  it("rejects a limit that is not a positive integer", () => {
    expect(() => new Semaphore(0)).toThrow(RangeError);
    expect(() => new Semaphore(1.5)).toThrow(RangeError);
  });

  it("never runs more than `limit` tasks at once and runs them all", async () => {
    const semaphore = new Semaphore(3);
    let running = 0;
    let peak = 0;
    const gates = Array.from({ length: 10 }, () => gate());
    const done = gates.map((g) =>
      semaphore.run(async () => {
        running++;
        peak = Math.max(peak, running);
        await g.promise;
        running--;
      }),
    );

    await tick();
    expect(semaphore.inFlight).toBe(3);
    expect(semaphore.queued).toBe(7);

    for (const g of gates) {
      g.finish();
      await tick();
      expect(running).toBeLessThanOrEqual(3);
    }
    await Promise.all(done);
    expect(peak).toBe(3);
    expect(semaphore.inFlight).toBe(0);
    expect(semaphore.queued).toBe(0);
  });

  it("starts waiting tasks in arrival order", async () => {
    const semaphore = new Semaphore(1);
    const order: number[] = [];
    const first = gate();
    const all = [
      semaphore.run(() => first.promise),
      ...[1, 2, 3].map((n) => semaphore.run(async () => void order.push(n))),
    ];
    await tick();
    expect(order).toEqual([]);
    first.finish();
    await Promise.all(all);
    expect(order).toEqual([1, 2, 3]);
  });

  it("gives the slot back when a task throws, and passes the error on", async () => {
    const semaphore = new Semaphore(1);
    await expect(semaphore.run(() => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
    expect(semaphore.inFlight).toBe(0);
    await expect(semaphore.run(async () => "after")).resolves.toBe("after");
  });

  it("returns what the task returns", async () => {
    await expect(new Semaphore(2).run(async () => 42)).resolves.toBe(42);
  });

  it("lets a waiter give up through its signal without losing or leaking a slot", async () => {
    const semaphore = new Semaphore(1);
    const holder = gate();
    const running = semaphore.run(() => holder.promise);

    const controller = new AbortController();
    const abandoned = semaphore.run(async () => "never", controller.signal).catch((e: unknown) => e);
    const patient = semaphore.run(async () => "patient");
    await tick();
    expect(semaphore.queued).toBe(2);

    controller.abort(new Error("gave up"));
    expect(await abandoned).toEqual(new Error("gave up"));
    expect(semaphore.queued).toBe(1);

    holder.finish();
    await running;
    await expect(patient).resolves.toBe("patient");
    expect(semaphore.inFlight).toBe(0);
  });

  it("rejects at once, without taking a slot, for a signal that has already aborted", async () => {
    const semaphore = new Semaphore(1);
    const reason = new Error("already");
    await expect(semaphore.run(async () => "x", AbortSignal.abort(reason))).rejects.toBe(reason);
    expect(semaphore.inFlight).toBe(0);
  });
});
