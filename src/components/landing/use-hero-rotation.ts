"use client";

import { useCallback, useEffect, useRef } from "react";
import { createHeroController, type Cause, type HeroController, type Preload } from "@/components/landing/hero-controller";
import { preloadImage } from "@/components/landing/hero-motion";
import type { NavDirection } from "@/lib/hero-history";
import type { HeroPairing, HeroPerson, Scene, Transition } from "@/lib/hero-scenes";
import { tmdbImage } from "@/lib/images";
import { MONTAGE_POSTERS, treatmentShape } from "@/lib/portrait-treatment";

interface Options {
  pool: readonly HeroPairing[];
  /** The scene on screen when the hook starts. */
  initial: Scene;
  /** The rotation advances only while this is true. */
  running: boolean;
  onTransition: (transition: Transition, direction: NavDirection, cause: Cause) => void;
}

/** The sizes the stage draws: the cut-out figure is tall, the timeline's posters small, and the montage's (a darkened 3 x 3 behind the figure) soft. */
export const PERSON_SIZE = "h632";
export const POSTER_SIZE = "w342";
export const MONTAGE_SIZE = "w185";

export const personImageUrl = (path: string) => tmdbImage(path, PERSON_SIZE) ?? "";
export const posterImageUrl = (path: string) => tmdbImage(path, POSTER_SIZE) ?? "";
/** The montage behind a person: the posters of their own films, from the same call the panel draws them with (`treatmentShape`). */
export const montageImageUrls = (person: HeroPerson): string[] =>
  treatmentShape(person.id, person.profilePath).posters.slice(0, MONTAGE_POSTERS).map((path) => tmdbImage(path, MONTAGE_SIZE) ?? "");

/** Loads (and decodes) a scene's two portraits and their montages, and its posters. */
export function preloadScene(scene: Scene, timeoutMs?: number): Preload {
  const handles = [
    ...scene.people.map((person) => personImageUrl(person.profilePath)),
    ...scene.people.flatMap(montageImageUrls),
    ...scene.pairing.posters.map((poster) => posterImageUrl(poster.path)),
  ].map((url) => preloadImage(url, timeoutMs));
  return {
    ready: Promise.all(handles.map((handle) => handle.promise)).then((results) => results.every(Boolean)),
    cancel: () => handles.forEach((handle) => handle.cancel()),
  };
}

/**
 * Runs the hero's scene changes (see hero-controller.ts): the automatic rotation, every few
 * seconds while `running`, and `go`, the visitor's Previous and Next, which work either way.
 * `warm` loads the next scene's images ahead of a click.
 */
export function useHeroRotation({ pool, initial, running, onTransition }: Options) {
  const latest = useRef(onTransition);
  const controller = useRef<HeroController | null>(null);

  useEffect(() => {
    latest.current = onTransition;
  });

  useEffect(() => {
    const created = createHeroController({
      pool,
      initial,
      preload: (scene) => preloadScene(scene),
      onTransition: (transition, direction, cause) => latest.current(transition, direction, cause),
    });
    controller.current = created;
    return () => {
      created.dispose();
      controller.current = null;
    };
  }, [pool, initial]);

  // After the effect above, so a controller made in the same commit starts with the right state.
  useEffect(() => {
    controller.current?.setRunning(running);
  }, [running, pool, initial]);

  const go = useCallback((direction: NavDirection) => controller.current?.go(direction), []);
  const warm = useCallback(() => controller.current?.warm(), []);
  return { go, warm };
}
