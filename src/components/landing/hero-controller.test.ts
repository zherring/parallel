import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHeroController, type Cause, type Preload } from "@/components/landing/hero-controller";
import type { NavDirection } from "@/lib/hero-history";
import { MIN_RESUME_MS, SCENE_MS, sceneOf, type HeroPairing, type HeroPerson, type Scene, type Transition } from "@/lib/hero-scenes";

/** Small deterministic generator (mulberry32), like the one in hero-scenes.test.ts. */
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const person = (id: number): HeroPerson => ({ id, name: `Person ${id}`, profilePath: `/p${id}.jpg` });
function pairing(a: number, b: number): HeroPairing {
  const [low, high] = a < b ? [a, b] : [b, a];
  return {
    key: `${low}+${high}`,
    sharedCount: 4,
    people: [person(a), person(b)],
    posters: [1, 2, 3].map((n) => ({ path: `/f${a}-${b}-${n}.jpg`, title: `Film ${n}`, year: 2000 + n })),
  };
}
const POOL: HeroPairing[] = [];
for (let a = 1; a <= 8; a++) for (let b = a + 1; b <= 8; b++) POOL.push(pairing(a, b));

interface Shown {
  transition: Transition;
  direction: NavDirection;
  cause: Cause;
}

/** A controller whose image loading the test decides: instantly, never, or when told. */
function setup(options: { load?: (scene: Scene) => "now" | "fail" | "later" } = {}) {
  const shown: Shown[] = [];
  const loads: { scene: Scene; cancelled: boolean; settle: (ok: boolean) => void }[] = [];
  const controller = createHeroController({
    pool: POOL,
    initial: sceneOf(POOL[0]),
    rng: () => 0.5, // a scene lasts SCENE_MS exactly
    preload: (scene): Preload => {
      let settle: (ok: boolean) => void = () => {};
      const ready = new Promise<boolean>((resolve) => {
        settle = resolve;
      });
      const record = { scene, cancelled: false, settle };
      loads.push(record);
      const mode = options.load?.(scene) ?? "now";
      if (mode === "now") settle(true);
      if (mode === "fail") settle(false);
      return {
        ready,
        cancel: () => {
          record.cancelled = true;
          settle(false);
        },
      };
    },
    onTransition: (transition, direction, cause) => shown.push({ transition, direction, cause }),
  });
  return { controller, shown, loads };
}

const flush = () => vi.advanceTimersByTimeAsync(0);
const keyOf = (shown: Shown) => shown.transition.scene.pairing.key;

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("the automatic rotation", () => {
  it("swaps after a scene's time, again and again, only while it runs", async () => {
    const { controller, shown } = setup();
    await vi.advanceTimersByTimeAsync(SCENE_MS * 3);
    expect(shown).toHaveLength(0); // not running yet

    controller.setRunning(true);
    await vi.advanceTimersByTimeAsync(SCENE_MS - 1);
    expect(shown).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(shown).toHaveLength(1);
    expect(shown[0]).toMatchObject({ direction: "next", cause: "auto" });
    await vi.advanceTimersByTimeAsync(SCENE_MS);
    expect(shown).toHaveLength(2);
    controller.dispose();
  });

  it("keeps the time left when paused, and waits at least the minimum after resuming", async () => {
    const { controller, shown } = setup();
    controller.setRunning(true);
    await vi.advanceTimersByTimeAsync(2000); // 3200 left
    controller.setRunning(false);
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    expect(shown).toHaveLength(0);

    controller.setRunning(true);
    await vi.advanceTimersByTimeAsync(SCENE_MS - 2000 - 1);
    expect(shown).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(shown).toHaveLength(1);

    // Paused with 100ms left: the swap does not come sooner than the minimum.
    await vi.advanceTimersByTimeAsync(SCENE_MS - 100);
    controller.setRunning(false);
    controller.setRunning(true);
    await vi.advanceTimersByTimeAsync(MIN_RESUME_MS - 1);
    expect(shown).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(shown).toHaveLength(2);
    controller.dispose();
  });

  it("loads the next scene's images ahead, and waits for them if they are late", async () => {
    let late = false;
    const { controller, shown, loads } = setup({ load: () => (late ? "later" : "now") });
    late = true;
    controller.setRunning(true);
    await vi.advanceTimersByTimeAsync(SCENE_MS - 1000); // the lead
    expect(loads).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1000 + 3000); // the swap is due and still waiting
    expect(shown).toHaveLength(0);
    loads[0].settle(true);
    await flush();
    expect(shown).toHaveLength(1);
    expect(loads).toHaveLength(1); // the plan was kept, not made twice
    controller.dispose();
  });

  it("holds a swap that is waiting when paused, and shows that same scene when it resumes", async () => {
    let late = true;
    const { controller, shown, loads } = setup({ load: () => (late ? "later" : "now") });
    controller.setRunning(true);
    await vi.advanceTimersByTimeAsync(SCENE_MS + 100);
    controller.setRunning(false);
    loads[0].settle(true); // the images arrive while paused
    await flush();
    expect(shown).toHaveLength(0);

    late = false;
    controller.setRunning(true);
    await vi.advanceTimersByTimeAsync(MIN_RESUME_MS);
    expect(shown).toHaveLength(1);
    expect(loads).toHaveLength(1);
    expect(keyOf(shown[0])).toBe(loads[0].scene.pairing.key);
    controller.dispose();
  });

  it("skips a new scene whose images will not load and shows another, and does not try it again", async () => {
    let loadsSoFar = 0;
    const { controller, shown, loads } = setup({ load: () => (loadsSoFar++ === 0 ? "fail" : "now") });
    controller.setRunning(true);
    for (let i = 0; i < 40; i++) await vi.advanceTimersByTimeAsync(SCENE_MS);
    const broken = loads[0].scene.pairing.key;
    expect(loads.length).toBeGreaterThan(2);
    expect(shown.length).toBeGreaterThan(30);
    expect(shown.map(keyOf)).not.toContain(broken);
    expect(loads.slice(1).map((load) => load.scene.pairing.key)).not.toContain(broken);
    controller.dispose();
  });
});

describe("Previous and Next", () => {
  it("works without the rotation running, and leaves it not running", async () => {
    const { controller, shown } = setup();
    controller.go("next");
    await flush();
    expect(shown).toHaveLength(1);
    expect(shown[0]).toMatchObject({ direction: "next", cause: "manual" });
    await vi.advanceTimersByTimeAsync(SCENE_MS * 5);
    expect(shown).toHaveLength(1); // no timer was started
    controller.dispose();
  });

  it("shows the scene at once when its images are loaded", async () => {
    const { controller, shown } = setup();
    controller.setRunning(true);
    controller.go("next");
    await flush();
    expect(shown).toHaveLength(1);
    controller.dispose();
  });

  it("restarts the rotation's timer: no automatic swap within a full scene's time after a press", async () => {
    const { controller, shown } = setup();
    controller.setRunning(true);
    await vi.advanceTimersByTimeAsync(SCENE_MS - 200); // an automatic swap is about to happen
    controller.go("next");
    await flush();
    expect(shown.map((s) => s.cause)).toEqual(["manual"]);

    await vi.advanceTimersByTimeAsync(SCENE_MS - 1);
    expect(shown).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(shown.map((s) => s.cause)).toEqual(["manual", "auto"]);

    // And again for Previous.
    await vi.advanceTimersByTimeAsync(SCENE_MS - 500);
    controller.go("prev");
    await flush();
    expect(shown).toHaveLength(3);
    await vi.advanceTimersByTimeAsync(SCENE_MS - 1);
    expect(shown).toHaveLength(3);
    await vi.advanceTimersByTimeAsync(1);
    expect(shown).toHaveLength(4);
    controller.dispose();
  });

  it("keeps a paused rotation paused, and gives it a full scene's time when it resumes", async () => {
    const { controller, shown } = setup();
    controller.setRunning(true);
    await vi.advanceTimersByTimeAsync(4000); // 1200 left
    controller.setRunning(false);
    controller.go("next");
    await flush();
    expect(shown).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    expect(shown).toHaveLength(1); // still paused

    controller.setRunning(true);
    await vi.advanceTimersByTimeAsync(SCENE_MS - 1);
    expect(shown).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(shown.map((s) => s.cause)).toEqual(["manual", "auto"]);
    controller.dispose();
  });

  it("next three times, previous three times: the same scenes in reverse, then a fresh one", async () => {
    const { controller, shown } = setup();
    for (let i = 0; i < 3; i++) {
      controller.go("next");
      await flush();
    }
    for (let i = 0; i < 3; i++) {
      controller.go("prev");
      await flush();
    }
    expect(shown).toHaveLength(6);
    const forward = shown.slice(0, 3).map(keyOf);
    expect(shown.slice(3, 5).map(keyOf)).toEqual([forward[1], forward[0]]);
    expect(keyOf(shown[5])).toBe(POOL[0].key);
    expect(shown.slice(3).every((s) => s.direction === "prev")).toBe(true);

    controller.go("prev"); // at the start: a fresh scene
    await flush();
    expect(shown).toHaveLength(7);
    expect(shown[6].direction).toBe("prev");
    expect(keyOf(shown[6])).not.toBe(POOL[0].key);
    expect(forward).not.toContain(keyOf(shown[6]));
    controller.dispose();
  });

  it("drops an automatic swap that is waiting for its images: only the press is shown", async () => {
    const { controller, shown, loads } = setup({ load: (scene) => (scene.pairing.key === POOL[0].key ? "now" : "later") });
    controller.setRunning(true);
    await vi.advanceTimersByTimeAsync(SCENE_MS + 50); // swap due, images not here
    expect(loads).toHaveLength(1);
    expect(shown).toHaveLength(0);

    controller.go("prev"); // a different plan: the automatic one is cancelled
    await flush();
    expect(loads[0].cancelled).toBe(true);
    expect(loads).toHaveLength(2);
    loads[1].settle(true);
    await flush();
    expect(shown.map((s) => s.cause)).toEqual(["manual"]);
    expect(shown[0].direction).toBe("prev");

    loads[0].settle(true); // late news of the dropped plan changes nothing
    await vi.advanceTimersByTimeAsync(SCENE_MS - 1);
    expect(shown).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(shown.map((s) => s.cause)).toEqual(["manual", "auto"]);
    controller.dispose();
  });

  it("starts no timer while a press waits for its images, and counts the time from when it shows", async () => {
    let late = true;
    const { controller, shown, loads } = setup({ load: () => (late ? "later" : "now") });
    controller.setRunning(true);
    await vi.advanceTimersByTimeAsync(3000);
    controller.go("next");
    await vi.advanceTimersByTimeAsync(SCENE_MS * 2); // the old timer would have fired
    expect(shown).toHaveLength(0);

    late = false; // later scenes load at once
    loads[0].settle(true);
    await flush();
    expect(shown).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(SCENE_MS - 1);
    expect(shown).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(shown).toHaveLength(2);
    controller.dispose();
  });

  it("collapses two presses while the scene loads into one change, not two", async () => {
    const { controller, shown, loads } = setup({ load: () => "later" });
    controller.go("next");
    controller.go("next");
    await flush();
    expect(loads).toHaveLength(1); // the same plan
    loads[0].settle(true);
    await flush();
    expect(shown).toHaveLength(1);
    controller.dispose();
  });

  it("the last of two different presses wins while the scene loads", async () => {
    const { controller, shown, loads } = setup({ load: () => "later" });
    controller.go("next");
    controller.go("prev");
    await flush();
    expect(loads).toHaveLength(2);
    expect(loads[0].cancelled).toBe(true);
    loads[1].settle(true);
    await flush();
    expect(shown).toHaveLength(1);
    expect(shown[0].direction).toBe("prev");
    controller.dispose();
  });

  it("loads the next scene's images when warmed, and Next then uses them", async () => {
    const { controller, shown, loads } = setup();
    controller.warm();
    controller.warm();
    expect(loads).toHaveLength(1);
    controller.go("next");
    await flush();
    expect(loads).toHaveLength(1);
    expect(shown).toHaveLength(1);
    expect(keyOf(shown[0])).toBe(loads[0].scene.pairing.key);
    controller.dispose();
  });

  it("skips a new scene whose images will not load, and a scene seen before is shown even if they are slow", async () => {
    const failing = new Set<string>();
    const { controller, shown } = setup({ load: (scene) => (failing.has(scene.pairing.key) ? "fail" : "now") });
    controller.go("next");
    await flush();
    const first = keyOf(shown[0]);
    failing.add(first); // it will not load again
    controller.go("next");
    await flush();
    controller.go("prev"); // back to a scene shown before, whose images now fail
    await flush();
    expect(keyOf(shown[2])).toBe(first);
    controller.dispose();
  });
});

describe("dispose", () => {
  it("stops everything: no timers, no pending swap", async () => {
    const { controller, shown, loads } = setup({ load: () => "later" });
    controller.setRunning(true);
    await vi.advanceTimersByTimeAsync(SCENE_MS + 10);
    expect(loads).toHaveLength(1);
    controller.dispose();
    expect(loads[0].cancelled).toBe(true);
    await vi.advanceTimersByTimeAsync(SCENE_MS * 5);
    controller.go("next");
    controller.warm();
    await flush();
    expect(shown).toHaveLength(0);
    expect(loads).toHaveLength(1);
  });
});

describe("determinism", () => {
  it("shows the same trail for the same seed", async () => {
    const run = async (seed: number) => {
      const shown: string[] = [];
      const controller = createHeroController({
        pool: POOL,
        initial: sceneOf(POOL[0]),
        rng: seeded(seed),
        preload: () => ({ ready: Promise.resolve(true), cancel: () => {} }),
        onTransition: (transition, direction) => shown.push(`${direction}:${transition.scene.pairing.key}`),
      });
      controller.setRunning(true);
      for (let i = 0; i < 6; i++) {
        controller.go(i % 3 === 2 ? "prev" : "next");
        await vi.advanceTimersByTimeAsync(2000);
      }
      controller.dispose();
      return shown;
    };
    expect(await run(5)).toEqual(await run(5));
    expect(await run(5)).not.toEqual(await run(6));
  });
});
