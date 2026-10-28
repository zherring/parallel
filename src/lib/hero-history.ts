import {
  RECENT_WINDOW,
  nextScene,
  transitionBetween,
  type HeroPairing,
  type Scene,
  type Transition,
} from "@/lib/hero-scenes";

/**
 * The scenes of this visit, for the hero's Previous and Next buttons (and the arrow keys). Pure,
 * like hero-scenes.ts: the randomness is an argument, so tests drive it with a seeded generator.
 *
 * Next shows the scene after the current one in the history when the visitor went back, and
 * otherwise a new one (the rule the automatic rotation uses), which it appends. Previous goes one
 * scene back, and at the start of the history a fresh scene is made and put in front, so the
 * button always does something. The history holds the last HISTORY_CAP scenes.
 */

export type NavDirection = "prev" | "next";

/** How many scenes the history keeps: the oldest go when Next adds past it. */
export const HISTORY_CAP = 30;

export interface HeroHistory {
  /** Oldest first. Never empty. */
  scenes: readonly Scene[];
  /** The scene on screen. */
  index: number;
}

export interface HistoryStep {
  /** The history once the step is taken. */
  history: HeroHistory;
  /** How to get from the scene on screen to the one the step reaches. */
  transition: Transition;
  /** False when the step goes back or forward to a scene the visitor has already seen. */
  fresh: boolean;
}

export const startHistory = (scene: Scene): HeroHistory => ({ scenes: [scene], index: 0 });

export const currentScene = ({ scenes, index }: HeroHistory): Scene => scenes[index];

/**
 * The step in `direction`, or null when a new scene was needed and `pool` has none to offer
 * (nothing but the current pairing). A new scene is never the current pairing, and avoids the
 * scenes around it in the history, as `nextScene` does. Does not change `history`.
 */
export function stepHistory(
  history: HeroHistory,
  direction: NavDirection,
  pool: readonly HeroPairing[],
  rng: () => number,
): HistoryStep | null {
  const { scenes, index } = history;
  const current = scenes[index];

  if (direction === "next") {
    if (index < scenes.length - 1) {
      return { history: { scenes, index: index + 1 }, transition: transitionBetween(current, scenes[index + 1]), fresh: false };
    }
    // The scenes just before the current one are the ones a new scene should not repeat.
    const recent = scenes.slice(Math.max(0, index - (RECENT_WINDOW - 1)), index).map((scene) => scene.pairing.key);
    const transition = nextScene(current, pool, rng, recent);
    if (!transition) return null;
    const grown = [...scenes, transition.scene];
    const kept = grown.slice(-HISTORY_CAP);
    return { history: { scenes: kept, index: kept.length - 1 }, transition, fresh: true };
  }

  if (index > 0) {
    return { history: { scenes, index: index - 1 }, transition: transitionBetween(current, scenes[index - 1]), fresh: false };
  }
  // At the start: a fresh scene goes in front. The scenes after the current one are the ones it
  // should not repeat, since Next would bring them back.
  const upcoming = scenes.slice(1, RECENT_WINDOW).map((scene) => scene.pairing.key);
  const transition = nextScene(current, pool, rng, upcoming);
  if (!transition) return null;
  const grown = [transition.scene, ...scenes];
  return { history: { scenes: grown.slice(0, HISTORY_CAP), index: 0 }, transition, fresh: true };
}
