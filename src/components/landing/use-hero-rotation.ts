"use client";

import { useEffect, useRef } from "react";
import { preloadImage } from "@/components/landing/hero-motion";
import {
  FIRST_SCENE_KEY,
  PRELOAD_LEAD_MS,
  RECENT_WINDOW,
  SECOND_SCENE_KEY,
  nextScene,
  resumeDelay,
  sceneDuration,
  transitionTo,
  type HeroPairing,
  type Scene,
  type Transition,
} from "@/lib/hero-scenes";
import { tmdbImage } from "@/lib/images";

interface Options {
  pool: readonly HeroPairing[];
  initial: Scene;
  /** The rotation advances only while this is true. */
  running: boolean;
  onTransition: (transition: Transition) => void;
}

interface Plan {
  transition: Transition;
  /** Resolves true once every image of the next scene (two portraits, up to five posters) is loaded. */
  ready: Promise<boolean>;
  dispose: () => void;
}

export const personImageUrl = (path: string) => tmdbImage(path, "w342") ?? "";
export const posterImageUrl = (path: string) => tmdbImage(path, "w185") ?? "";

function planFor(transition: Transition): Plan {
  const { scene } = transition;
  const handles = [
    ...scene.people.map((person) => personImageUrl(person.profilePath)),
    ...scene.pairing.posters.map((poster) => posterImageUrl(poster.path)),
  ].map((url) => preloadImage(url));
  return {
    transition,
    ready: Promise.all(handles.map((handle) => handle.promise)).then((results) => results.every(Boolean)),
    dispose: () => handles.forEach((handle) => handle.cancel()),
  };
}

/**
 * Drives the scene changes: every few seconds picks the next scene, loads its images about a
 * second ahead (the swap waits if they are late, so a card never arrives half-loaded) and
 * reports the transition. Stops and keeps the time left in the scene when `running` turns false;
 * continues from there when it turns true again. Randomness starts after the scripted first swap.
 */
export function useHeroRotation({ pool, initial, running, onTransition }: Options): void {
  const latest = useRef(onTransition);
  const scene = useRef(initial);
  const history = useRef<string[]>([]);
  const plan = useRef<Plan | null>(null);
  const failed = useRef(new Set<string>());
  const scripted = useRef(false);
  const due = useRef<number | null>(null);
  const remaining = useRef<number | null>(null);

  useEffect(() => {
    latest.current = onTransition;
  });

  useEffect(() => {
    if (!running || pool.length < 2) return;
    let cancelled = false;
    const timers = new Set<number>();
    const after = (ms: number, run: () => void) => {
      const id = window.setTimeout(() => {
        timers.delete(id);
        run();
      }, ms);
      timers.add(id);
    };

    const choose = (): Plan | null => {
      if (plan.current) return plan.current;
      const usable = pool.filter((pairing) => !failed.current.has(pairing.key));
      const current = scene.current;
      let transition: Transition | null = null;
      if (!scripted.current && current.pairing.key === FIRST_SCENE_KEY) {
        const second = usable.find((pairing) => pairing.key === SECOND_SCENE_KEY);
        if (second) transition = transitionTo(current, second);
      }
      transition ??= nextScene(current, usable, Math.random, history.current);
      plan.current = transition ? planFor(transition) : null;
      return plan.current;
    };

    const commit = (next: Plan) => {
      plan.current = null;
      scripted.current = true;
      history.current = [...history.current, scene.current.pairing.key].slice(-(RECENT_WINDOW - 1));
      scene.current = next.transition.scene;
      latest.current(next.transition);
      schedule(sceneDuration(Math.random));
    };

    const swap = async () => {
      for (let attempt = 0; attempt < 4; attempt++) {
        const next = choose();
        if (!next) return;
        const ok = await next.ready;
        if (cancelled) return; // paused while waiting: the plan stays for when the rotation resumes
        if (ok) return commit(next);
        failed.current.add(next.transition.scene.pairing.key); // an image would not load: pick another
        scripted.current = true;
        next.dispose();
        plan.current = null;
      }
      schedule(sceneDuration(Math.random));
    };

    const schedule = (ms: number) => {
      due.current = performance.now() + ms;
      after(Math.max(0, ms - PRELOAD_LEAD_MS), () => void choose());
      after(ms, () => void swap());
    };

    schedule(remaining.current === null ? sceneDuration(Math.random) : resumeDelay(remaining.current));

    return () => {
      cancelled = true;
      timers.forEach((id) => window.clearTimeout(id));
      remaining.current = Math.max(0, (due.current ?? performance.now()) - performance.now());
    };
  }, [running, pool]);

  useEffect(() => () => plan.current?.dispose(), []);
}
