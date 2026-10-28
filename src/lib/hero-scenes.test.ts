import { describe, expect, it } from "vitest";
import { HERO_POSTER_MIN } from "@/lib/examples";
import {
  DEFAULT_SCENE_KEY,
  MIN_RESUME_MS,
  NOT_PAUSED,
  RECENT_WINDOW,
  SCENE_JITTER_MS,
  SCENE_MS,
  SINGLE_SWAP_CHANCE,
  defaultScene,
  heroPool,
  isRunning,
  moreFilms,
  nextScene,
  pickFirstScene,
  resumeDelay,
  sceneDuration,
  sceneOf,
  transitionBetween,
  transitionTo,
  type HeroPairing,
  type HeroPerson,
  type Scene,
} from "@/lib/hero-scenes";

/** Small deterministic generator (mulberry32), like the seeded one in featured.test.ts. */
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

function pairing(a: number, b: number, posterCount = 3): HeroPairing {
  const [low, high] = a < b ? [a, b] : [b, a];
  return {
    key: `${low}+${high}`,
    sharedCount: 3 + a + b,
    people: [person(a), person(b)],
    posters: Array.from({ length: posterCount }, (_, i) => i + 1).map((n) => ({
      path: `/f${a}-${b}-${n}.jpg`,
      title: `Film ${n}`,
      year: 2000 + n,
    })),
  };
}

// Ford (3), Lucas (1), Spielberg (488), Williams (491), Hanks (31): a small chain.
const FORD_LUCAS = pairing(3, 1);
const FORD_SPIELBERG = pairing(3, 488);
const LUCAS_SPIELBERG = pairing(1, 488);
const SPIELBERG_WILLIAMS = pairing(488, 491);
const HANKS_SPIELBERG = pairing(31, 488);
const CHAIN = [FORD_LUCAS, FORD_SPIELBERG, LUCAS_SPIELBERG, SPIELBERG_WILLIAMS, HANKS_SPIELBERG];

/** Every pair among ten people: from any pairing, singles and full swaps are always on offer. */
const DENSE: HeroPairing[] = [];
for (let a = 1; a <= 10; a++) for (let b = a + 1; b <= 10; b++) DENSE.push(pairing(a, b));

/** Runs `steps` transitions from `start`, the way the component does, and returns them all. */
function walk(pool: HeroPairing[], start: HeroPairing, rng: () => number, steps: number) {
  const out: NonNullable<ReturnType<typeof nextScene>>[] = [];
  let scene = sceneOf(start);
  const recent: string[] = [];
  for (let i = 0; i < steps; i++) {
    const move = nextScene(scene, pool, rng, recent);
    if (!move) break;
    recent.push(scene.pairing.key);
    out.push(move);
    scene = move.scene;
  }
  return out;
}

describe("heroPool", () => {
  it("keeps pairings that share a person with another, and drops loners and ones without posters", () => {
    const loner = pairing(900, 901);
    const noPosters = { ...pairing(3, 77), posters: [] };
    const pool = heroPool([...CHAIN, loner, noPosters]);
    expect(pool.map((p) => p.key)).toEqual(CHAIN.map((p) => p.key));
  });

  it("wants at least HERO_POSTER_MIN posters, and takes up to five", () => {
    const short = pairing(3, 77, HERO_POSTER_MIN - 1);
    const full = pairing(3, 78, 5);
    const pool = heroPool([FORD_LUCAS, pairing(3, 76, HERO_POSTER_MIN), short, full]);
    expect(pool.map((p) => p.key)).toEqual([FORD_LUCAS.key, "3+76", "3+78"]);
  });
});

describe("moreFilms", () => {
  it("counts the shared films the collage has no poster for", () => {
    // Ford and Lucas: 11 films together, five posters shown.
    expect(moreFilms({ ...pairing(3, 1, 5), sharedCount: 11 })).toBe(6);
    expect(moreFilms({ ...pairing(3, 1, 5), sharedCount: 6 })).toBe(1);
  });

  it("is zero when every film is shown, however few there are", () => {
    // Ford and Spielberg: four films, four posters.
    expect(moreFilms({ ...pairing(3, 488, 4), sharedCount: 4 })).toBe(0);
    expect(moreFilms({ ...pairing(3, 488, 5), sharedCount: 5 })).toBe(0);
    expect(moreFilms({ ...pairing(3, 488, 3), sharedCount: 3 })).toBe(0);
  });

  it("never goes below zero if the data is off", () => {
    expect(moreFilms({ ...pairing(3, 1, 5), sharedCount: 4 })).toBe(0);
  });
});

describe("defaultScene", () => {
  it("is the fixed pairing the server markup carries, in its own order, whatever the pool order", () => {
    const scene = defaultScene([...CHAIN].reverse())!;
    expect(DEFAULT_SCENE_KEY).toBe("1+3");
    expect(scene.pairing.key).toBe(DEFAULT_SCENE_KEY);
    expect(scene.people.map((p) => p.id)).toEqual([3, 1]);
  });

  it("falls back to the first pairing, and to nothing for an empty pool", () => {
    expect(defaultScene([HANKS_SPIELBERG, FORD_SPIELBERG])!.pairing.key).toBe(HANKS_SPIELBERG.key);
    expect(defaultScene([])).toBeNull();
  });
});

describe("pickFirstScene", () => {
  it("picks one pairing of the pool, in its own order", () => {
    const scene = pickFirstScene(CHAIN, () => 0)!;
    expect(scene.pairing).toBe(CHAIN[0]);
    expect(scene.people.map((p) => p.id)).toEqual(CHAIN[0].people.map((p) => p.id));
    expect(pickFirstScene(CHAIN, () => 0.999999)!.pairing).toBe(CHAIN[CHAIN.length - 1]);
  });

  it("maps the roll straight onto the pool: the nth fifth of [0, 1) is the nth pairing", () => {
    CHAIN.forEach((pairing, index) => {
      expect(pickFirstScene(CHAIN, () => (index + 0.5) / CHAIN.length)!.pairing).toBe(pairing);
    });
  });

  it("is deterministic for a seed, and differs between seeds", () => {
    const keys = (seed: number) => {
      const rng = seeded(seed);
      return Array.from({ length: 20 }, () => pickFirstScene(DENSE, rng)!.pairing.key);
    };
    expect(keys(9)).toEqual(keys(9));
    expect(keys(9)).not.toEqual(keys(10));
  });

  it("is uniform over the pool: no pairing, Ford and Lucas included, is favoured", () => {
    const rng = seeded(4);
    const counts = new Map<string, number>();
    const draws = 45 * 400; // DENSE holds 45 pairings
    for (let i = 0; i < draws; i++) {
      const key = pickFirstScene(DENSE, rng)!.pairing.key;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    expect(counts.size).toBe(DENSE.length);
    for (const count of counts.values()) {
      expect(count).toBeGreaterThan(400 * 0.7);
      expect(count).toBeLessThan(400 * 1.3);
    }
  });

  it("leaves out the pairing the last visit opened on, and stays uniform over the others", () => {
    const rng = seeded(8);
    const counts = new Map<string, number>();
    for (let i = 0; i < 44 * 300; i++) {
      const key = pickFirstScene(DENSE, rng, DENSE[7].key)!.pairing.key;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    expect(counts.has(DENSE[7].key)).toBe(false);
    expect(counts.size).toBe(DENSE.length - 1);
    for (const count of counts.values()) {
      expect(count).toBeGreaterThan(300 * 0.7);
      expect(count).toBeLessThan(300 * 1.3);
    }
  });

  it("ignores the pairing to avoid when it is the only one, or not in the pool, and needs a pool", () => {
    expect(pickFirstScene([FORD_LUCAS], () => 0.5, FORD_LUCAS.key)!.pairing).toBe(FORD_LUCAS);
    expect(pickFirstScene(CHAIN, () => 0, "999+998")!.pairing).toBe(CHAIN[0]);
    expect(pickFirstScene(CHAIN, () => 0, null)!.pairing).toBe(CHAIN[0]);
    expect(pickFirstScene([], () => 0.5)).toBeNull();
  });

  it("does not depend on any scripted order: the opening scene is not always Ford and Lucas", () => {
    const rng = seeded(2);
    const opened = new Set(Array.from({ length: 60 }, () => pickFirstScene(DENSE, rng)!.pairing.key));
    expect(opened.size).toBeGreaterThan(20);
  });
});

describe("nextScene", () => {
  const ford: Scene = sceneOf(FORD_LUCAS); // Ford in slot 0, Lucas in slot 1

  it("does a single swap when the roll is under the chance: the shared person keeps the same slot", () => {
    // The roll (0.1 < 0.45) picks a single swap, then 0 picks the first of the two options.
    const rolls = [0.1, 0];
    const move = nextScene(ford, CHAIN, () => rolls.shift() ?? 0)!;
    expect(move.kind).toBe("single");
    expect(move.scene.pairing.key).toBe(FORD_SPIELBERG.key);
    expect(move.stayed).toBe(0);
    expect(move.changed).toEqual([1]);
    expect(move.scene.people.map((p) => p.id)).toEqual([3, 488]);
  });

  it("keeps the person in their slot when they were on the right", () => {
    const rolls = [0.1, 0.99]; // the last single candidate: Lucas + Spielberg
    const move = nextScene(ford, CHAIN, () => rolls.shift() ?? 0)!;
    expect(move.scene.pairing.key).toBe(LUCAS_SPIELBERG.key);
    expect(move.stayed).toBe(1);
    expect(move.changed).toEqual([0]);
    // The pairing lists Lucas first; the scene still has him in the right-hand slot.
    expect(move.scene.people.map((p) => p.id)).toEqual([488, 1]);
  });

  it("does a full swap when the roll is over the chance: both slots change, nobody stays", () => {
    const rolls = [0.99, 0];
    const move = nextScene(ford, CHAIN, () => rolls.shift() ?? 0)!;
    expect(move.kind).toBe("full");
    expect(move.stayed).toBeNull();
    expect(move.changed).toEqual([0, 1]);
    expect(move.scene.pairing.key).toBe(SPIELBERG_WILLIAMS.key);
    const before = new Set(ford.people.map((p) => p.id));
    expect(move.scene.people.some((p) => before.has(p.id))).toBe(false);
  });

  it("only swaps in full when no other pairing shares exactly one person", () => {
    const pool = [FORD_LUCAS, pairing(31, 24), pairing(1032, 6193)];
    for (const roll of [0, 0.3, 0.99]) {
      const move = nextScene(ford, pool, () => roll)!;
      expect(move.kind).toBe("full");
    }
  });

  it("only swaps single when a single swap is all that is left", () => {
    const pool = [FORD_LUCAS, FORD_SPIELBERG];
    const move = nextScene(ford, pool, () => 0.99)!;
    expect(move.kind).toBe("single");
    expect(move.scene.pairing.key).toBe(FORD_SPIELBERG.key);
  });

  it("never offers the current pairing, and returns null when nothing else exists", () => {
    expect(nextScene(ford, [FORD_LUCAS], () => 0.5)).toBeNull();
    expect(nextScene(ford, [], () => 0.5)).toBeNull();
    expect(nextScene(ford, [FORD_LUCAS, pairing(3, 1)], () => 0.5)).toBeNull(); // same people again
  });

  it("is a single swap about 45% of the time when both kinds are always possible", () => {
    const moves = walk(DENSE, DENSE[0], seeded(7), 4000);
    const singles = moves.filter((m) => m.kind === "single").length / moves.length;
    expect(SINGLE_SWAP_CHANCE).toBe(0.45);
    expect(singles).toBeGreaterThan(0.41);
    expect(singles).toBeLessThan(0.49);
  });

  it("never repeats the previous pairing and avoids the last four scenes", () => {
    const moves = walk(DENSE, DENSE[0], seeded(11), 3000);
    const keys = [DENSE[0].key, ...moves.map((m) => m.scene.pairing.key)];
    for (let i = 1; i < keys.length; i++) {
      const earlier = keys.slice(Math.max(0, i - (RECENT_WINDOW - 1)), i);
      expect(earlier).not.toContain(keys[i]);
      expect(keys[i]).not.toBe(keys[i - 1]);
    }
  });

  it("relaxes the recent-scenes rule when the pool is too small for it, but still never repeats", () => {
    const moves = walk(CHAIN.slice(0, 3), FORD_LUCAS, seeded(3), 200);
    expect(moves).toHaveLength(200);
    let previous = FORD_LUCAS.key;
    for (const move of moves) {
      expect(move.scene.pairing.key).not.toBe(previous);
      previous = move.scene.pairing.key;
    }
  });

  it("puts the staying person in the same slot in every single swap of a long walk", () => {
    const rng = seeded(21);
    let scene = sceneOf(DENSE[3]);
    const recent: string[] = [];
    for (let i = 0; i < 2000; i++) {
      const move = nextScene(scene, DENSE, rng, recent)!;
      const slots = [0, 1] as const;
      if (move.kind === "single") {
        const stayed = move.stayed!;
        expect(move.scene.people[stayed].id).toBe(scene.people[stayed].id);
        expect(move.changed).toEqual(slots.filter((slot) => slot !== stayed));
        expect(move.scene.people[move.changed[0]].id).not.toBe(scene.people[move.changed[0]].id);
      } else {
        expect(move.changed).toEqual([0, 1]);
      }
      // Whatever the slots, the scene's two people are exactly the pairing's two people.
      expect(move.scene.people.map((p) => p.id).sort()).toEqual(
        move.scene.pairing.people.map((p) => p.id).sort(),
      );
      recent.push(scene.pairing.key);
      scene = move.scene;
    }
  });

  it("is deterministic for a given seed, and differs between seeds", () => {
    const keys = (seed: number) => walk(DENSE, DENSE[0], seeded(seed), 60).map((m) => `${m.kind}:${m.scene.pairing.key}`);
    expect(keys(5)).toEqual(keys(5));
    expect(keys(5)).not.toEqual(keys(6));
  });
});

describe("transitionTo", () => {
  it("is a single swap with the shared person in place, whichever way round the pairing lists them", () => {
    const fordKept = transitionTo(sceneOf(FORD_LUCAS), FORD_SPIELBERG);
    expect(fordKept).toMatchObject({ kind: "single", stayed: 0, changed: [1] });
    expect(fordKept.scene.people.map((p) => p.id)).toEqual([3, 488]);

    const lucasKept = transitionTo(sceneOf(FORD_LUCAS), LUCAS_SPIELBERG);
    expect(lucasKept).toMatchObject({ kind: "single", stayed: 1, changed: [0] });
    expect(lucasKept.scene.people.map((p) => p.id)).toEqual([488, 1]);
  });

  it("is a full swap for a pairing that shares nobody", () => {
    expect(transitionTo(sceneOf(FORD_LUCAS), HANKS_SPIELBERG)).toMatchObject({
      kind: "full",
      stayed: null,
      changed: [0, 1],
    });
  });
});

describe("the first transition", () => {
  it("is not scripted: from the default scene it follows the same rules and varies with the roll", () => {
    const pool = heroPool(CHAIN);
    const first = defaultScene(pool)!;
    expect(first.pairing.key).toBe(FORD_LUCAS.key);
    const reached = new Set<string>();
    const kinds = new Set<string>();
    const rng = seeded(31);
    for (let i = 0; i < 200; i++) {
      const move = nextScene(first, pool, rng)!;
      reached.add(move.scene.pairing.key);
      kinds.add(move.kind);
    }
    // Ford + Spielberg is one of several; full swaps happen too.
    expect(reached.size).toBeGreaterThan(2);
    expect([...kinds].sort()).toEqual(["full", "single"]);
  });
});

describe("transitionBetween", () => {
  it("is a single swap when exactly one slot has a different person, with the other staying", () => {
    expect(transitionBetween(sceneOf(FORD_LUCAS), sceneOf(FORD_SPIELBERG))).toMatchObject({
      kind: "single",
      stayed: 0,
      changed: [1],
    });
    const lucasKept = transitionBetween(sceneOf(FORD_LUCAS), { pairing: LUCAS_SPIELBERG, people: [person(488), person(1)] });
    expect(lucasKept).toMatchObject({ kind: "single", stayed: 1, changed: [0] });
  });

  it("is a full swap when both slots differ, and keeps the target scene's own slots", () => {
    const target: Scene = { pairing: SPIELBERG_WILLIAMS, people: [person(491), person(488)] };
    const move = transitionBetween(sceneOf(FORD_LUCAS), target);
    expect(move).toMatchObject({ kind: "full", stayed: null, changed: [0, 1] });
    expect(move.scene).toBe(target);
  });

  it("treats a shared person who moved slots as a full swap: nobody stays where they are", () => {
    const flipped: Scene = { pairing: FORD_SPIELBERG, people: [person(488), person(3)] };
    expect(transitionBetween(sceneOf(FORD_LUCAS), flipped).kind).toBe("full");
  });

  it("undoes a transition: playing back from the new scene to the old gives the same kind and the same slot", () => {
    const rng = seeded(17);
    let scene = sceneOf(DENSE[3]);
    const recent: string[] = [];
    for (let i = 0; i < 500; i++) {
      const forward = nextScene(scene, DENSE, rng, recent)!;
      const back = transitionBetween(forward.scene, scene);
      expect(back.kind).toBe(forward.kind);
      expect(back.scene).toBe(scene);
      if (forward.kind === "single") {
        expect(back.stayed).toBe(forward.stayed);
        expect(back.changed).toEqual(forward.changed);
      }
      // And forward again is the very transition nextScene made.
      const again = transitionBetween(scene, forward.scene);
      expect(again).toMatchObject({ kind: forward.kind, stayed: forward.stayed, changed: forward.changed });
      recent.push(scene.pairing.key);
      scene = forward.scene;
    }
  });
});

describe("sceneDuration", () => {
  it("is 5.2 seconds give or take 600ms", () => {
    expect(sceneDuration(() => 0)).toBe(SCENE_MS - SCENE_JITTER_MS);
    expect(sceneDuration(() => 0.5)).toBe(SCENE_MS);
    expect(sceneDuration(() => 0.999999)).toBe(SCENE_MS + SCENE_JITTER_MS);
    const rng = seeded(1);
    for (let i = 0; i < 500; i++) {
      const ms = sceneDuration(rng);
      expect(ms).toBeGreaterThanOrEqual(4600);
      expect(ms).toBeLessThanOrEqual(5800);
    }
  });
});

describe("isRunning", () => {
  it("runs only while no reason to pause is set", () => {
    expect(isRunning(NOT_PAUSED)).toBe(true);
    for (const reason of Object.keys(NOT_PAUSED) as (keyof typeof NOT_PAUSED)[]) {
      expect(isRunning({ ...NOT_PAUSED, [reason]: true })).toBe(false);
    }
    expect(isRunning({ ...NOT_PAUSED, hover: true, search: true })).toBe(false);
  });
});

describe("resumeDelay", () => {
  it("keeps what was left of the scene, but never swaps sooner than the minimum", () => {
    expect(resumeDelay(3000)).toBe(3000);
    expect(resumeDelay(200)).toBe(MIN_RESUME_MS);
    expect(resumeDelay(0)).toBe(MIN_RESUME_MS);
  });
});
