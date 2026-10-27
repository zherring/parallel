/**
 * The landing hero is a collage of one pairing at a time (two portraits, three shared-film
 * posters) that changes every few seconds. This module is the pure part: which pairing comes
 * next, which portrait slot changes, and the timing and pause rules. It has no DOM and takes its
 * randomness as an argument, so tests drive it with a seeded generator (see featured.ts).
 */

/** The left (0) or right (1) portrait card. */
export type Slot = 0 | 1;

export interface HeroPerson {
  id: number;
  name: string;
  /** TMDB profile path. */
  profilePath: string;
}

export interface HeroPoster {
  /** TMDB poster path. */
  path: string;
  title: string;
  year: number;
}

export interface HeroPairing {
  /** The pairing's person ids, sorted and joined with "+" (examples.ts `pairingKey`). */
  key: string;
  /** Films the pair shares by the pair page's default rules. */
  sharedCount: number;
  people: readonly [HeroPerson, HeroPerson];
  posters: readonly HeroPoster[];
}

/** What is on screen: a pairing, with its people placed in the two slots. */
export interface Scene {
  pairing: HeroPairing;
  people: readonly [HeroPerson, HeroPerson];
}

export interface Transition {
  /**
   * "single": one person stays in the same slot and the other is replaced.
   * "full": both are replaced.
   */
  kind: "single" | "full";
  scene: Scene;
  /** Slots that get a new person, in slot order. */
  changed: readonly Slot[];
  /** The slot of the person who stays on a single swap; null on a full swap. */
  stayed: Slot | null;
}

/** The hero opens on Harrison Ford and George Lucas, so the server markup never varies. */
export const FIRST_SCENE_KEY = "1+3";

/** Chance that a transition is a single swap, when one is possible. */
export const SINGLE_SWAP_CHANCE = 0.45;
/** A scene is not revisited while it is among this many latest scenes (the current one included). */
export const RECENT_WINDOW = 4;
/** How long a scene lasts, give or take SCENE_JITTER_MS. */
export const SCENE_MS = 5200;
export const SCENE_JITTER_MS = 600;
/** The next scene's images start loading this long before the swap. */
export const PRELOAD_LEAD_MS = 1000;
/** After pausing or resuming, a swap never comes sooner than this. */
export const MIN_RESUME_MS = 1200;

export function sceneOf(pairing: HeroPairing): Scene {
  return { pairing, people: pairing.people };
}

function sharedPersonIds(a: HeroPairing, b: HeroPairing): number[] {
  const ids = new Set(a.people.map((person) => person.id));
  return b.people.filter((person) => ids.has(person.id)).map((person) => person.id);
}

/**
 * The pairings the hero rotates through: those with two people and enough posters, and which
 * share a person with at least one other, so a single swap is always on the table. (A pairing
 * nobody else touches could only ever come in as a full swap.)
 */
export function heroPool(pairings: readonly HeroPairing[], posterCount = 3): HeroPairing[] {
  const usable = pairings.filter((pairing) => pairing.posters.length >= posterCount);
  const seen = new Map<number, number>();
  for (const pairing of usable) {
    for (const person of pairing.people) seen.set(person.id, (seen.get(person.id) ?? 0) + 1);
  }
  return usable.filter((pairing) => pairing.people.some((person) => (seen.get(person.id) ?? 0) > 1));
}

/** The scene the page is rendered with; falls back to the pool's first pairing. */
export function firstScene(pool: readonly HeroPairing[], key = FIRST_SCENE_KEY): Scene | null {
  const pairing = pool.find((candidate) => candidate.key === key) ?? pool[0];
  return pairing ? sceneOf(pairing) : null;
}

/**
 * The next scene, or null when the pool holds nothing but the current pairing.
 *
 * - Never the current pairing, and none of the last RECENT_WINDOW scenes: the current one and the
 *   ones before it, whose keys are `recent` (newest last). If that leaves nothing, only the
 *   current pairing is excluded.
 * - With probability SINGLE_SWAP_CHANCE, when a candidate shares exactly one person with the
 *   current pairing, it is a single swap: that person keeps their slot and the other is replaced.
 *   Otherwise it is a full swap to a pairing sharing nobody (or, when none is left, a single one).
 *
 * `rng` returns a number in [0, 1), like Math.random.
 */
export function nextScene(
  current: Scene,
  pool: readonly HeroPairing[],
  rng: () => number,
  recent: readonly string[] = [],
): Transition | null {
  const { pairing } = current;
  const avoid = new Set([...recent.slice(-(RECENT_WINDOW - 1)), pairing.key]);

  let candidates = pool.filter((candidate) => !avoid.has(candidate.key));
  if (candidates.length === 0) candidates = pool.filter((candidate) => candidate.key !== pairing.key);
  if (candidates.length === 0) return null;

  const singles = candidates.filter((candidate) => sharedPersonIds(pairing, candidate).length === 1);
  const fulls = candidates.filter((candidate) => sharedPersonIds(pairing, candidate).length === 0);

  const wantSingle = singles.length > 0 && (fulls.length === 0 || rng() < SINGLE_SWAP_CHANCE);
  const options = wantSingle || fulls.length === 0 ? singles : fulls;
  if (options.length === 0) return null; // only a duplicate of the current pairing is left
  const next = options[Math.min(options.length - 1, Math.floor(rng() * options.length))];

  if (!wantSingle && fulls.length > 0) {
    return { kind: "full", scene: sceneOf(next), changed: [0, 1], stayed: null };
  }
  const [keptId] = sharedPersonIds(pairing, next);
  const stayed: Slot = current.people[0].id === keptId ? 0 : 1;
  const kept = current.people[stayed];
  const joiner = next.people.find((person) => person.id !== keptId)!;
  const people: readonly [HeroPerson, HeroPerson] = stayed === 0 ? [kept, joiner] : [joiner, kept];
  const changed: Slot = stayed === 0 ? 1 : 0;
  return { kind: "single", scene: { pairing: next, people }, changed: [changed], stayed };
}

/** How long the next scene lasts: SCENE_MS plus or minus up to SCENE_JITTER_MS. */
export function sceneDuration(rng: () => number): number {
  return Math.round(SCENE_MS + (rng() * 2 - 1) * SCENE_JITTER_MS);
}

/** Why the rotation is held; it runs only while every one of them is false. */
export interface PauseReasons {
  /** The visitor pressed pause (or prefers reduced motion and has not pressed play). */
  user: boolean;
  /** The pointer is over the collage. */
  hover: boolean;
  /** Keyboard focus is on the collage's link. */
  focus: boolean;
  /** Someone is typing in the search field. */
  search: boolean;
  /** The hero is scrolled out of view. */
  offscreen: boolean;
  /** The tab is in the background. */
  hidden: boolean;
}

export const NOT_PAUSED: PauseReasons = {
  user: false,
  hover: false,
  focus: false,
  search: false,
  offscreen: false,
  hidden: false,
};

export const isRunning = (reasons: PauseReasons): boolean => !Object.values(reasons).some(Boolean);

/**
 * Milliseconds until the swap when the rotation continues, given the time that was left when it
 * stopped. Leaving the collage never swaps instantly: it waits at least MIN_RESUME_MS.
 */
export function resumeDelay(remainingMs: number): number {
  return Math.max(MIN_RESUME_MS, remainingMs);
}

/** The number shown `progress` (0 to 1) of the way through a count from `from` to `to`, eased out. */
export function countAt(from: number, to: number, progress: number): number {
  const t = Math.min(1, Math.max(0, progress));
  const eased = 1 - (1 - t) ** 3;
  return Math.round(from + (to - from) * eased);
}
