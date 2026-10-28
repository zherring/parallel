import {
  PRELOAD_LEAD_MS,
  resumeDelay,
  sceneDuration,
  type HeroPairing,
  type Scene,
  type Transition,
} from "@/lib/hero-scenes";
import { startHistory, stepHistory, type HeroHistory, type HistoryStep, type NavDirection } from "@/lib/hero-history";

/** The images of a scene on their way: resolves true once every one is loaded. */
export interface Preload {
  ready: Promise<boolean>;
  cancel: () => void;
}

export type Cause = "auto" | "manual";

export interface ControllerOptions {
  pool: readonly HeroPairing[];
  /** The scene on screen to begin with. */
  initial: Scene;
  /** Starts loading a scene's images. */
  preload: (scene: Scene) => Preload;
  /** Called when the scene on screen changes: play this transition. */
  onTransition: (transition: Transition, direction: NavDirection, cause: Cause) => void;
  /** Like Math.random; tests inject a seeded one. */
  rng?: () => number;
}

export interface HeroController {
  /** The automatic rotation advances only while this is true. Turning it off keeps the time left. */
  setRunning: (running: boolean) => void;
  /**
   * Previous or Next, by the visitor. Works whether or not the rotation runs. It cancels a swap
   * in flight, shows the scene once its images are loaded, and (if the rotation runs) starts a
   * full scene's time over; a paused rotation stays paused and starts a full scene's time too
   * when it resumes.
   */
  go: (direction: NavDirection) => void;
  /** A hint that Next may come soon (the pointer is on the hero): load the next scene's images. */
  warm: () => void;
  dispose: () => void;
}

interface Plan {
  direction: NavDirection;
  step: HistoryStep;
  loading: Preload;
}

/** How many scenes are tried when images will not load, before giving up until the next swap. */
const ATTEMPTS = 4;

/**
 * Drives the scene changes of the hero: the automatic rotation and the visitor's Previous and
 * Next, which share one history (hero-history.ts) and one way of getting a scene on screen. A
 * scene is chosen ahead and its images loaded first (about a second ahead for the rotation), and
 * the swap waits if they are late, so a card never arrives half-loaded. A scene whose images will
 * not load is left out and another is tried.
 *
 * A swap is "in flight" from the moment it is chosen until its images are loaded and it is
 * shown; the animation itself belongs to the component. Pressing a button, or pausing, drops a
 * swap in flight: the wait ends and nothing is shown, so no scene arrives late or twice.
 */
export function createHeroController(options: ControllerOptions): HeroController {
  const { pool, preload, onTransition } = options;
  const rng = options.rng ?? Math.random;

  let history: HeroHistory = startHistory(options.initial);
  let plan: Plan | null = null;
  const failed = new Set<string>();

  let running = false;
  let disposed = false;
  /** Bumped by a button press: the swap in flight (automatic or manual) is no longer wanted. */
  let navEpoch = 0;
  /** Bumped by that and by pausing: the automatic swap in flight is no longer wanted. */
  let autoEpoch = 0;
  /** A button press is waiting for its images. */
  let navigating = false;

  let preloadTimer: ReturnType<typeof setTimeout> | undefined;
  let swapTimer: ReturnType<typeof setTimeout> | undefined;
  let due: number | null = null;
  let remaining: number | null = null;

  const clearTimers = () => {
    clearTimeout(preloadTimer);
    clearTimeout(swapTimer);
  };

  function prepare(direction: NavDirection): Plan | null {
    if (plan?.direction === direction) return plan;
    plan?.loading.cancel();
    plan = null;
    const step = stepHistory(
      history,
      direction,
      pool.filter((pairing) => !failed.has(pairing.key)),
      rng,
    );
    if (!step) return null;
    plan = { direction, step, loading: preload(step.transition.scene) };
    return plan;
  }

  /**
   * Shows the scene one step in `direction`, once its images are loaded. "stale" when the swap
   * was dropped while it waited, "none" when there was nothing to show.
   */
  async function reach(
    direction: NavDirection,
    cause: Cause,
    stale: () => boolean,
  ): Promise<"done" | "stale" | "none"> {
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const next = prepare(direction);
      if (!next) return "none";
      const ok = await next.loading.ready;
      if (stale() || disposed) return "stale"; // the plan stays for whoever swaps next
      // A scene seen before is shown even if its images are slow now; a new one that will not load is skipped.
      if (ok || !next.step.fresh) {
        plan = null;
        history = next.step.history;
        onTransition(next.step.transition, next.direction, cause);
        return "done";
      }
      failed.add(next.step.transition.scene.pairing.key);
      next.loading.cancel();
      plan = null;
    }
    return "none";
  }

  function schedule(ms: number) {
    clearTimers();
    due = performance.now() + ms;
    preloadTimer = setTimeout(() => void prepare("next"), Math.max(0, ms - PRELOAD_LEAD_MS));
    swapTimer = setTimeout(() => void swapAutomatically(), ms);
  }

  async function swapAutomatically() {
    const epoch = ++autoEpoch;
    const result = await reach("next", "auto", () => epoch !== autoEpoch);
    if (result === "stale" || !running) return;
    schedule(sceneDuration(rng));
  }

  return {
    setRunning(next) {
      if (disposed || next === running) return;
      running = next;
      if (next) {
        // A button press waiting for its images starts the time itself when it is done.
        if (!navigating) schedule(remaining === null ? sceneDuration(rng) : resumeDelay(remaining));
        return;
      }
      autoEpoch++;
      clearTimers();
      if (due !== null) remaining = Math.max(0, due - performance.now());
    },

    go(direction) {
      if (disposed) return;
      const epoch = ++navEpoch;
      autoEpoch++;
      navigating = true;
      clearTimers(); // no automatic swap while this one loads
      void reach(direction, "manual", () => epoch !== navEpoch).then((result) => {
        if (result === "stale") return; // a newer press owns the time now
        navigating = false;
        if (running) schedule(sceneDuration(rng));
        else if (result === "done") remaining = null; // a full scene's time when it resumes
      });
    },

    warm() {
      if (!disposed && !navigating) prepare("next");
    },

    dispose() {
      disposed = true;
      clearTimers();
      plan?.loading.cancel();
      plan = null;
    },
  };
}
