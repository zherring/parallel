import { describe, expect, it } from "vitest";
import {
  HISTORY_CAP,
  currentScene,
  startHistory,
  stepHistory,
  type HeroHistory,
  type HistoryStep,
  type NavDirection,
} from "@/lib/hero-history";
import { RECENT_WINDOW, sceneOf, type HeroPairing, type HeroPerson } from "@/lib/hero-scenes";

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

/** Every pair among twelve people: singles and full swaps are always on offer. */
const POOL: HeroPairing[] = [];
for (let a = 1; a <= 12; a++) for (let b = a + 1; b <= 12; b++) POOL.push(pairing(a, b));

const keys = (history: HeroHistory) => history.scenes.map((scene) => scene.pairing.key);
const keyNow = (history: HeroHistory) => currentScene(history).pairing.key;

/** Takes `direction` and returns the step; fails the test when there is none. */
function take(history: HeroHistory, direction: NavDirection, rng: () => number, pool = POOL): HistoryStep {
  const step = stepHistory(history, direction, pool, rng);
  if (!step) throw new Error(`no ${direction} step`);
  return step;
}

describe("stepHistory: next", () => {
  it("makes a new scene at the end of the history, appends it and moves onto it", () => {
    const start = startHistory(sceneOf(POOL[0]));
    const step = take(start, "next", seeded(1));
    expect(step.fresh).toBe(true);
    expect(step.history.scenes).toHaveLength(2);
    expect(step.history.index).toBe(1);
    expect(step.history.scenes[0]).toBe(start.scenes[0]);
    expect(step.history.scenes[1]).toBe(step.transition.scene);
    expect(keyNow(step.history)).not.toBe(keyNow(start));
  });

  it("follows the history instead of making a scene when the visitor went back", () => {
    const rng = seeded(2);
    let history = startHistory(sceneOf(POOL[0]));
    for (let i = 0; i < 3; i++) history = take(history, "next", rng).history;
    const shown = keys(history);
    history = take(history, "prev", rng).history;
    history = take(history, "prev", rng).history;
    expect(history.index).toBe(1);

    const step = take(history, "next", () => {
      throw new Error("a scene seen before needs no randomness");
    });
    expect(step.fresh).toBe(false);
    expect(step.history.index).toBe(2);
    expect(step.history.scenes).toBe(history.scenes);
    expect(keys(step.history)).toEqual(shown);
    expect(keyNow(step.history)).toBe(shown[2]);
  });

  it("is null when the pool has nothing but the current pairing", () => {
    const only = startHistory(sceneOf(POOL[0]));
    expect(stepHistory(only, "next", [POOL[0]], seeded(1))).toBeNull();
    expect(stepHistory(only, "next", [], seeded(1))).toBeNull();
  });

  it("never changes the history it is given", () => {
    const start = startHistory(sceneOf(POOL[0]));
    const before = JSON.stringify(start);
    take(start, "next", seeded(3));
    take(start, "prev", seeded(3));
    expect(JSON.stringify(start)).toBe(before);
  });
});

describe("stepHistory: prev", () => {
  it("goes one scene back in the history", () => {
    const rng = seeded(4);
    let history = startHistory(sceneOf(POOL[5]));
    for (let i = 0; i < 4; i++) history = take(history, "next", rng).history;
    const step = take(history, "prev", rng);
    expect(step.fresh).toBe(false);
    expect(step.history.index).toBe(history.index - 1);
    expect(step.history.scenes).toBe(history.scenes);
    expect(step.transition.scene).toBe(history.scenes[history.index - 1]);
  });

  it("at the start makes a fresh scene, puts it in front, and is never the scene on screen", () => {
    const start = startHistory(sceneOf(POOL[0]));
    const step = take(start, "prev", seeded(5));
    expect(step.fresh).toBe(true);
    expect(step.history.index).toBe(0);
    expect(step.history.scenes).toHaveLength(2);
    expect(step.history.scenes[1]).toBe(start.scenes[0]);
    expect(step.history.scenes[0]).toBe(step.transition.scene);
    expect(keyNow(step.history)).not.toBe(keyNow(start));
  });

  it("is null at the start of a pool of one", () => {
    expect(stepHistory(startHistory(sceneOf(POOL[0])), "prev", [POOL[0]], seeded(1))).toBeNull();
  });

  it("lets Next come back to where it started: the new scene's slots fit the old one", () => {
    // After Previous made a scene in front, Next must be playable as the same kind of swap.
    for (let seed = 1; seed <= 60; seed++) {
      const rng = seeded(seed);
      const start = startHistory(sceneOf(POOL[seed % POOL.length]));
      const back = take(start, "prev", rng);
      const forward = take(back.history, "next", rng);
      expect(forward.fresh).toBe(false);
      expect(forward.transition.scene).toBe(start.scenes[0]);
      expect(forward.transition.kind).toBe(back.transition.kind);
    }
  });

  it("does not offer a scene that Next would bring back within the next few", () => {
    const rng = seeded(6);
    let history = startHistory(sceneOf(POOL[0]));
    for (let i = 0; i < 6; i++) history = take(history, "next", rng).history;
    while (history.index > 0) history = take(history, "prev", rng).history;
    const upcoming = history.scenes.slice(1, RECENT_WINDOW).map((scene) => scene.pairing.key);
    for (let seed = 1; seed <= 100; seed++) {
      const step = take(history, "prev", seeded(seed));
      expect(upcoming).not.toContain(keyNow(step.history));
    }
  });
});

describe("walking back and forth", () => {
  it("next three times, previous three times: the same three scenes in reverse, then a fresh one", () => {
    const rng = seeded(7);
    const start = startHistory(sceneOf(POOL[0]));
    let history = start;
    const forward: string[] = [];
    for (let i = 0; i < 3; i++) {
      history = take(history, "next", rng).history;
      forward.push(keyNow(history));
    }

    const backward: string[] = [];
    for (let i = 0; i < 3; i++) {
      history = take(history, "prev", rng).history;
      backward.push(keyNow(history));
    }
    expect(backward).toEqual([forward[1], forward[0], keyNow(start)]);
    expect(history.index).toBe(0);

    const fresh = take(history, "prev", rng);
    expect(fresh.fresh).toBe(true);
    expect(forward).not.toContain(keyNow(fresh.history));
    expect(fresh.history.scenes).toHaveLength(5);
  });

  it("returns the very same scene objects, so a scene looks the same each time it is shown", () => {
    const rng = seeded(8);
    let history = startHistory(sceneOf(POOL[1]));
    history = take(history, "next", rng).history;
    const second = currentScene(history);
    history = take(history, "next", rng).history;
    history = take(history, "prev", rng).history;
    expect(currentScene(history)).toBe(second);
    expect(second.people.map((p) => p.id)).toEqual(history.scenes[1].people.map((p) => p.id));
  });

  it("never shows the same pairing twice in a row, whichever way and however long it goes", () => {
    const rng = seeded(9);
    const choose = seeded(10);
    let history = startHistory(sceneOf(POOL[2]));
    for (let i = 0; i < 3000; i++) {
      const direction: NavDirection = choose() < 0.5 ? "prev" : "next";
      const before = keyNow(history);
      const step = take(history, direction, rng);
      expect(keyNow(step.history), `step ${i}`).not.toBe(before);
      expect(step.transition.scene).toBe(currentScene(step.history));
      expect(step.history.index).toBeGreaterThanOrEqual(0);
      expect(step.history.index).toBeLessThan(step.history.scenes.length);
      // Neighbours in the history never share a key, so every step is a real change.
      step.history.scenes.forEach((scene, at) => {
        if (at > 0) expect(scene.pairing.key).not.toBe(step.history.scenes[at - 1].pairing.key);
      });
      history = step.history;
    }
  });

  it("is deterministic for a seed", () => {
    const run = (seed: number) => {
      const rng = seeded(seed);
      const choose = seeded(seed + 1);
      let history = startHistory(sceneOf(POOL[0]));
      const trail: string[] = [];
      for (let i = 0; i < 50; i++) {
        history = take(history, choose() < 0.4 ? "prev" : "next", rng).history;
        trail.push(`${history.index}:${keyNow(history)}`);
      }
      return trail;
    };
    expect(run(3)).toEqual(run(3));
    expect(run(3)).not.toEqual(run(4));
  });
});

describe("the history cap", () => {
  it("keeps the latest HISTORY_CAP scenes when Next adds past it, and the screen stays on the newest", () => {
    const rng = seeded(11);
    let history = startHistory(sceneOf(POOL[0]));
    const trail: string[] = [keyNow(history)];
    for (let i = 0; i < HISTORY_CAP + 15; i++) {
      history = take(history, "next", rng).history;
      trail.push(keyNow(history));
    }
    expect(HISTORY_CAP).toBe(30);
    expect(history.scenes).toHaveLength(HISTORY_CAP);
    expect(history.index).toBe(HISTORY_CAP - 1);
    expect(keys(history)).toEqual(trail.slice(-HISTORY_CAP));
  });

  it("goes back through all of what it kept, then makes a fresh scene at the start", () => {
    const rng = seeded(12);
    let history = startHistory(sceneOf(POOL[0]));
    for (let i = 0; i < HISTORY_CAP + 5; i++) history = take(history, "next", rng).history;
    const kept = keys(history);
    for (let at = HISTORY_CAP - 2; at >= 0; at--) {
      const step = take(history, "prev", rng);
      expect(step.fresh).toBe(false);
      expect(keyNow(step.history)).toBe(kept[at]);
      history = step.history;
    }
    expect(history.index).toBe(0);
    const fresh = take(history, "prev", rng);
    expect(fresh.fresh).toBe(true);
    expect(fresh.history.scenes).toHaveLength(HISTORY_CAP);
    expect(fresh.history.index).toBe(0);
    expect(keys(fresh.history).slice(1)).toEqual(kept.slice(0, HISTORY_CAP - 1));
  });

  it("never grows past the cap, going back and forth for a long time", () => {
    const rng = seeded(13);
    const choose = seeded(14);
    let history = startHistory(sceneOf(POOL[0]));
    for (let i = 0; i < 2000; i++) {
      history = take(history, choose() < 0.5 ? "prev" : "next", rng).history;
      expect(history.scenes.length).toBeLessThanOrEqual(HISTORY_CAP);
    }
  });
});

describe("repeat avoidance", () => {
  it("a new scene at the end avoids the scenes just before the current one, as the rotation does", () => {
    const rng = seeded(15);
    let history = startHistory(sceneOf(POOL[0]));
    for (let i = 0; i < 400; i++) {
      const step = take(history, "next", rng);
      const { scenes, index } = step.history;
      const earlier = scenes.slice(Math.max(0, index - (RECENT_WINDOW - 1)), index).map((scene) => scene.pairing.key);
      expect(earlier).not.toContain(scenes[index].pairing.key);
      history = step.history;
    }
  });
});
