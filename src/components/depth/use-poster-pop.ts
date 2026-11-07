"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { REDUCED_MOTION } from "@/components/depth/use-media";
import { springEasing } from "@/components/landing/hero-motion";

/** How much a poster grows as it pops forward, and how far (px on screen) it lifts. */
export const POP_SCALE = 1.1;
export const POP_LIFT = 4;
const POP_MS = 260;
/** The pointer leaving the copy for the poster under it (the copy lifts, so a strip of the poster is not under it) is not a leave. */
const LEAVE_DELAY_MS = 40;

export interface PosterPop {
  /** A background poster is hovered or has keyboard focus: its copy pops forward over everything. Idempotent (it also cancels a pending leave). */
  pop(trigger: HTMLElement): void;
  /** The poster was left: its copy settles back (after a moment, unless it is popped again), or at once with `delay` 0. */
  unpop(trigger: HTMLElement, delay?: number): void;
  /** Drops everything at once, without animation (a drag, a film opened, a resize). */
  cancel(): void;
  /** Whether a node is part of a copy: a pointer moving from a poster onto its own copy has not left it. */
  owns(node: EventTarget | null): boolean;
}

interface Popped {
  trigger: HTMLElement;
  copy: HTMLElement;
  /** The poster's size in its layer (px) and its scale on screen: what the copy is drawn at. */
  w: number;
  h: number;
  base: number;
  animation: Animation | null;
}

/**
 * The hover pop of the posters behind the films made together: the poster grows a little, lifts and goes fully sharp,
 * with a larger softer shadow fading in, and is drawn above every other poster, including the ones of nearer layers it
 * overlaps.
 *
 * That last part is why it is a copy. The layers sit at different depths in one 3D context, and the browser draws a nearer
 * layer over a farther one whatever the z-index or order; to bring one poster over a nearer poster its layer would have to
 * come forward too. So the poster's markup is cloned into a flat layer on top of the scene (a fixed sibling, above the
 * scroller and below the rail and the pill) at the screen position and size the poster has, and the copy is what animates
 * (`transform`, WAAPI, the hero's spring) and what the pointer hits: it carries the poster's `data-film`, so a hit test at
 * its centre finds its button. A press on it is passed on to the scroller (so a drag still pans), a click opens the film
 * through the poster it copies, and it follows the poster while the scene scrolls. Reduced motion: no scale or lift, only
 * the stacking and the sharpness.
 *
 * Nothing re-renders: the copy is plain DOM, made on hover and removed when it has settled back.
 */
export function usePosterPop(scrollerRef: RefObject<HTMLElement | null>, onLeave?: (trigger: HTMLElement) => void): PosterPop {
  const api = useRef<PosterPop | null>(null);
  const onLeaveRef = useRef(onLeave);
  useEffect(() => {
    onLeaveRef.current = onLeave;
  });

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const layer = document.createElement("div");
    layer.setAttribute("aria-hidden", "true");
    layer.setAttribute("data-pop-layer", "");
    layer.style.cssText = "position:fixed;inset:0;z-index:15;pointer-events:none;";
    document.body.appendChild(layer);

    let active: Popped | null = null;
    let leaving: Popped | null = null;
    let leaveTimer: number | undefined;
    let frame = 0;

    const place = (popped: Popped) => {
      const rect = popped.trigger.getBoundingClientRect();
      popped.copy.style.left = `${rect.left + rect.width / 2 - popped.w / 2}px`;
      popped.copy.style.top = `${rect.top + rect.height / 2 - popped.h / 2}px`;
    };

    /** A press, move or release on the copy, as the scroller would have got it from the poster underneath. */
    const forward = (type: string, event: PointerEvent) => {
      scroller.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          pointerId: event.pointerId,
          pointerType: event.pointerType,
          isPrimary: event.isPrimary,
          button: event.button,
          buttons: event.buttons,
          clientX: event.clientX,
          clientY: event.clientY,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          altKey: event.altKey,
          shiftKey: event.shiftKey,
        }),
      );
    };

    const drop = (popped: Popped | null) => {
      if (!popped) return;
      popped.animation?.cancel();
      popped.copy.remove();
    };

    /** Settles the copy back (or removes it at once) and forgets it. */
    const retire = (popped: Popped, animate: boolean) => {
      if (active === popped) active = null;
      popped.copy.removeAttribute("data-pop");
      const button = popped.copy.querySelector<HTMLElement>("button");
      if (button) button.style.pointerEvents = "none";
      const { animation } = popped;
      if (!animate || !animation || animation.playState === "idle") {
        drop(popped);
        return;
      }
      drop(leaving);
      leaving = popped;
      // Back the way it came: the reversed spring.
      animation.onfinish = animation.oncancel = () => {
        popped.copy.remove();
        if (leaving === popped) leaving = null;
      };
      animation.reverse();
    };

    const make = (trigger: HTMLElement): Popped | null => {
      const li = trigger.closest<HTMLElement>("[data-poster]");
      if (!li) return null;
      const w = Number.parseFloat(li.style.width);
      const h = Number.parseFloat(li.style.height);
      const rect = trigger.getBoundingClientRect();
      if (!(w > 0) || !(h > 0) || !(rect.width > 0)) return null;
      const base = rect.width / w;

      // The poster's own markup (its images are cached, its classes are in the stylesheet), drawn at its size in its layer and
      // scaled to what it is on screen, so its corners and shadows scale with it as they do in the scene.
      const copy = li.cloneNode(true) as HTMLElement;
      copy.removeAttribute("data-poster");
      copy.setAttribute("data-pop", "");
      copy.style.width = `${w}px`;
      copy.style.height = `${h}px`;
      copy.style.transformOrigin = "50% 50%";
      copy.style.transform = `scale(${base})`;
      copy.style.setProperty("--focus", "1");
      copy.style.willChange = "transform";
      copy.querySelectorAll<HTMLImageElement>("img[data-src]").forEach((img) => {
        if (!img.hasAttribute("src")) img.src = img.dataset.src ?? "";
      });
      const button = copy.querySelector<HTMLElement>("button");
      if (!button) return null;
      button.removeAttribute("aria-label");
      button.removeAttribute("aria-describedby");
      button.removeAttribute("aria-current");
      button.setAttribute("aria-hidden", "true");
      button.tabIndex = -1;

      const popped: Popped = { trigger, copy, w, h, base, animation: null };
      place(popped);
      layer.appendChild(copy);

      button.addEventListener("pointerenter", () => window.clearTimeout(leaveTimer));
      button.addEventListener("pointerleave", () => {
        window.clearTimeout(leaveTimer);
        leaveTimer = window.setTimeout(() => {
          if (active !== popped) return;
          retire(popped, true);
          onLeaveRef.current?.(trigger);
        }, LEAVE_DELAY_MS);
      });
      button.addEventListener("pointerdown", (event) => {
        // The poster underneath is the one that is pressed: it takes focus, and the scroller gets the press, so that a drag pans.
        trigger.focus({ preventScroll: true });
        forward("pointerdown", event);
      });
      // The press must not move focus onto the copy (it is not focusable): the poster underneath keeps it.
      button.addEventListener("mousedown", (event) => event.preventDefault());
      button.addEventListener("pointermove", (event) => forward("pointermove", event));
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        trigger.click();
      });

      if (!window.matchMedia(REDUCED_MOTION).matches) {
        popped.animation = copy.animate(
          [
            { transform: `translateY(0px) scale(${base})` },
            { transform: `translateY(${-POP_LIFT}px) scale(${base * POP_SCALE})` },
          ],
          { duration: POP_MS, easing: springEasing(), fill: "forwards" },
        );
      }
      return popped;
    };

    const pop = (trigger: HTMLElement) => {
      // Collaborations are already in front; only the posters behind pop.
      if (trigger.dataset.layer === "0") return;
      window.clearTimeout(leaveTimer);
      if (active?.trigger === trigger) return;
      if (active) retire(active, false);
      active = make(trigger);
    };

    const unpop = (trigger: HTMLElement, delay = LEAVE_DELAY_MS) => {
      if (!active || active.trigger !== trigger) return;
      window.clearTimeout(leaveTimer);
      const current = active;
      if (delay <= 0) {
        retire(current, true);
        return;
      }
      leaveTimer = window.setTimeout(() => {
        if (active === current) retire(current, true);
      }, delay);
    };

    const cancel = () => {
      window.clearTimeout(leaveTimer);
      drop(active);
      drop(leaving);
      active = null;
      leaving = null;
    };

    // The copy follows its poster while the scene scrolls (a frame at most).
    const follow = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (active) place(active);
      });
    };
    scroller.addEventListener("scroll", follow, { passive: true });
    window.addEventListener("resize", cancel);
    window.addEventListener("blur", cancel);
    document.addEventListener("visibilitychange", cancel);

    api.current = { pop, unpop, cancel, owns: (node) => node instanceof Node && layer.contains(node) };
    return () => {
      api.current = null;
      scroller.removeEventListener("scroll", follow);
      window.removeEventListener("resize", cancel);
      window.removeEventListener("blur", cancel);
      document.removeEventListener("visibilitychange", cancel);
      if (frame) cancelAnimationFrame(frame);
      cancel();
      layer.remove();
    };
  }, [scrollerRef]);

  // Stable, and safe to call before the effect has run or after it has been cleaned up.
  return useMemo<PosterPop>(
    () => ({
      pop: (trigger) => api.current?.pop(trigger),
      unpop: (trigger, delay) => api.current?.unpop(trigger, delay),
      cancel: () => api.current?.cancel(),
      owns: (node) => api.current?.owns(node) ?? false,
    }),
    [],
  );
}
