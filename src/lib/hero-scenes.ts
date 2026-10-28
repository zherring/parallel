/**
 * The landing hero is a collage of one pairing at a time (two portraits, up to five shared-film
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
  /** The most-voted shared films that have a poster, oldest first: three to five. */
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

/**
 * The scene in the server markup: Harrison Ford and George Lucas. The page is prerendered, so the
 * server cannot pick at random; it puts this scene in a <noscript> for visitors without
 * JavaScript and crawlers, and the browser picks the scene it shows (see `pickFirstScene`).
 */
export const DEFAULT_SCENE_KEY = "1+3";

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

/** How many of the pair's shared films have no poster on the collage: the "+N more" hint. */
export function moreFilms(pairing: HeroPairing): number {
  return Math.max(0, pairing.sharedCount - pairing.posters.length);
}

function sharedPersonIds(a: HeroPairing, b: HeroPairing): number[] {
  const ids = new Set(a.people.map((person) => person.id));
  return b.people.filter((person) => ids.has(person.id)).map((person) => person.id);
}

/**
 * The pairings the hero rotates through: those with two people and enough posters (at least
 * `posterCount`, examples.ts's HERO_POSTER_MIN), and which share a person with at least one
 * other, so a single swap is always on the table. (A pairing nobody else touches could only ever
 * come in as a full swap.)
 */
export function heroPool(pairings: readonly HeroPairing[], posterCount = 3): HeroPairing[] {
  const usable = pairings.filter((pairing) => pairing.posters.length >= posterCount);
  const seen = new Map<number, number>();
  for (const pairing of usable) {
    for (const person of pairing.people) seen.set(person.id, (seen.get(person.id) ?? 0) + 1);
  }
  return usable.filter((pairing) => pairing.people.some((person) => (seen.get(person.id) ?? 0) > 1));
}

/** The scene in the server markup (the <noscript> fallback); falls back to the pool's first pairing. */
export function defaultScene(pool: readonly HeroPairing[], key = DEFAULT_SCENE_KEY): Scene | null {
  const pairing = pool.find((candidate) => candidate.key === key) ?? pool[0];
  return pairing ? sceneOf(pairing) : null;
}

/**
 * The scene a visit opens on: one pairing of the pool, uniformly at random, shown with its people
 * in the pairing's own order. `avoidKey` is the pairing the previous visit of this browser session
 * opened on; it is left out when anything else is left, so two visits in a row differ. Null for
 * an empty pool. `rng` returns a number in [0, 1), like Math.random.
 */
export function pickFirstScene(
  pool: readonly HeroPairing[],
  rng: () => number,
  avoidKey?: string | null,
): Scene | null {
  const others = avoidKey ? pool.filter((pairing) => pairing.key !== avoidKey) : pool;
  const options = others.length > 0 ? others : pool;
  if (options.length === 0) return null;
  return sceneOf(options[Math.min(options.length - 1, Math.floor(rng() * options.length))]);
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

  return transitionTo(current, next);
}

/**
 * The change from `current` to the pairing `next`, whichever pairing that is. A pairing sharing
 * exactly one person is a single swap (that person keeps their slot); anything else is a full one.
 */
export function transitionTo(current: Scene, next: HeroPairing): Transition {
  const shared = sharedPersonIds(current.pairing, next);
  if (shared.length !== 1) {
    return { kind: "full", scene: sceneOf(next), changed: [0, 1], stayed: null };
  }
  const stayed: Slot = current.people[0].id === shared[0] ? 0 : 1;
  const kept = current.people[stayed];
  const joiner = next.people.find((person) => person.id !== shared[0])!;
  const people: readonly [HeroPerson, HeroPerson] = stayed === 0 ? [kept, joiner] : [joiner, kept];
  const changed: Slot = stayed === 0 ? 1 : 0;
  return { kind: "single", scene: { pairing: next, people }, changed: [changed], stayed };
}

/**
 * The change from the scene on screen to `to`, a scene that was shown before (history navigation),
 * read from the two scenes' people: a slot whose person is the same stays, so exactly one changed
 * slot is a single swap and anything else a full one. For two scenes that follow each other in
 * the history this is the transition that built them, whichever way it is played.
 */
export function transitionBetween(from: Scene, to: Scene): Transition {
  const changed = ([0, 1] as const).filter((slot) => from.people[slot].id !== to.people[slot].id);
  if (changed.length === 1) {
    return { kind: "single", scene: to, changed, stayed: changed[0] === 0 ? 1 : 0 };
  }
  return { kind: "full", scene: to, changed: [0, 1], stayed: null };
}

/** How long the next scene lasts: SCENE_MS plus or minus up to SCENE_JITTER_MS. */
export function sceneDuration(rng: () => number): number {
  return Math.round(SCENE_MS + (rng() * 2 - 1) * SCENE_JITTER_MS);
}

/** Why the rotation is held; it runs only while every one of them is false. */
export interface PauseReasons {
  /** The visitor prefers reduced motion: the rotation never plays by itself (Previous and Next still work). */
  reducedMotion: boolean;
  /** The pointer is over the collage. */
  hover: boolean;
  /** Keyboard focus is on the collage's link. */
  focus: boolean;
  /** A pointer is pressed on the collage (and a moment after), so a click cannot change target. */
  press: boolean;
  /** Someone is typing in the search field. */
  search: boolean;
  /** The hero is scrolled out of view. */
  offscreen: boolean;
  /** The tab is in the background. */
  hidden: boolean;
}

export const NOT_PAUSED: PauseReasons = {
  reducedMotion: false,
  hover: false,
  focus: false,
  press: false,
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
