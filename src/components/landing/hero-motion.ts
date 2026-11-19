// The hero's choreography, as Web Animations API calls on plain elements. Transform and opacity
// (and clip-path for the first reveal's wipes), so it stays on the compositor and nothing here touches layout.
// What is moved is always an element of its own (`data-part`) inside a wrapper, so these never fight the
// pointer parallax (the `translate` of an element above it, see hero-stage.tsx), a poster's hover lift and tilt (the
// `translate` and `rotate` of one below it) or the layout transforms that centre things: the animations use `transform`
// and `opacity` only, and those are separate properties.
//
// An item arrives over what it replaces, and what it replaces stays under it, unchanged, until it is covered
// (`hold`): a cross-fade of two layers that both fade would dip through the panel's dark base.

/** What the choreography needs to know about the visitor's settings. */
export interface MotionOptions {
  /** prefers-reduced-motion: plain cross-fades, no wipes, travel or parallax. */
  reduced: boolean;
  /** Milliseconds before the animation starts. */
  delay?: number;
  /** A panel's: the first reveal, a person replaced, or the same person in a new colour. */
  mode?: PanelMode;
}

/** The pieces of the stage that come and go with a scene. */
export type ItemKind = "panel" | "name" | "amp" | "poster" | "strip" | "year" | "label";

/**
 * How a panel arrives or leaves. "intro": the first reveal, whose frame wipes in (`wipeFrames`) so only the figure moves (and, in a name's own piece, the name).
 * "swap": its person is replaced. "recolour": its person stays but the pair's colour for them changed (their new partner's colour collided
 * with theirs, see `pairPortraitColors`): the same panel cross-fades, and nothing moves, so the panel that stays does stay still.
 */
export type PanelMode = "intro" | "swap" | "recolour";

// A damped spring (zeta 0.62) sampled into linear(): about 8% overshoot, settled by the end.
const SPRING =
  "linear(0, 0.04, 0.139, 0.273, 0.419, 0.563, 0.695, 0.809, 0.902, 0.973, 1.024, 1.057, 1.076, 1.083, 1.082, 1.075, 1.064, 1.052, 1.04, 1.029, 1.019, 1.01, 1.004, 0.999, 0.996, 0.994, 0.993, 0.993, 0.994, 0.994, 1)";
// For browsers without linear(): a back-out curve with a similar overshoot.
const SPRING_FALLBACK = "cubic-bezier(0.34, 1.5, 0.64, 1)";
const EASE_IN_OUT = "cubic-bezier(0.4, 0, 0.2, 1)";
const EASE_IN = "cubic-bezier(0.4, 0, 1, 1)";
const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";
/** The figure's rise: quick off the mark, settling without overshoot. */
const EASE_RISE = "cubic-bezier(0.2, 0.8, 0.2, 1)";

/** The spring as a CSS `easing` value, for any Web Animations call (the people pill's heads use it too). */
export const springEasing = (): string =>
  typeof CSS !== "undefined" && CSS.supports("animation-timing-function", "linear(0, 1)")
    ? SPRING
    : SPRING_FALLBACK;

/** Timings, in milliseconds, shared with the component's stagger. */
export const TIMING = {
  /** A reduced-motion visitor's cross-fades. */
  reduced: 150,
  /** The outgoing figure sinks and the name slides up and out. */
  figureLeave: 300,
  /** The montage cross-fades to the new person's, starting just after the figure starts to sink. */
  backdrop: 450,
  backdropDelay: 60,
  /** The incoming figure rises, and the name comes up from below, as the outgoing one is nearly gone. */
  figureArrive: 560,
  figureDelay: 150,
  name: 300,
  /** The second panel of a full swap follows the first. */
  panelStagger: 70,
  /** What stays under an arriving panel (its backdrop), so it is never uncovered: longer than the arrival's own end. */
  panelHold: 660,
  /** Posters drop away one by one, then new ones are dealt in chronological order. */
  posterLeave: 260,
  posterLeaveStagger: 40,
  posterArriveDelay: 260,
  posterStagger: 60,
  posterArrive: 520,
  /** The year caps and the "+N more" label cross-fade after the posters have started. */
  captionDelay: 300,
  caption: 320,
  /** The timeline's dots pop in from the left to the right, over this long, each on its own spring. */
  stripSweep: 520,
  stripDot: 420,
  /** The first reveal: the line draws, the frames wipe, and what is on them follows. */
  introLineDelay: 120,
  introLine: 700,
  introWipe: 640,
  introWipeStagger: 80,
  introFigureDelay: 260,
  introPostersDelay: 520,
  introCaptionsGap: 160,
} as const;

const part = (el: HTMLElement, name: string): HTMLElement | null => el.querySelector<HTMLElement>(`[data-part="${name}"]`);

const fade = (el: HTMLElement, from: number, to: number, duration: number, delay: number, easing = EASE_OUT): Animation =>
  el.animate([{ opacity: from }, { opacity: to }], { duration, delay, easing, fill: from < to ? "backwards" : "forwards" });

/** Keeps the element as it is for `duration`, so that it is part of what `Promise.all(finished)` waits for. */
const hold = (el: HTMLElement, duration: number): Animation =>
  el.animate([{ opacity: 1 }, { opacity: 1 }], { duration });

/**
 * A piece arriving. A reduced-motion visitor gets a plain fade of the whole piece. A panel's parts move by `mode`; a poster is dealt in, rising
 * into its place in the cluster; a name comes up from below; the timeline's dots pop in from the left to the right; the "&", the year caps and the label fade in.
 */
export function arrive(el: HTMLElement, kind: ItemKind, { reduced, delay = 0, mode = "swap" }: MotionOptions): Animation[] {
  if (reduced) return [fade(el, 0, 1, TIMING.reduced, delay)];
  switch (kind) {
    case "panel":
      return arrivePanel(el, delay, mode);
    case "name":
      return [arriveName(el, delay, mode)];
    case "poster":
      return arrivePoster(el, delay);
    case "strip":
      return arriveStrip(el, delay);
    case "amp":
      // With the first names: it is the one piece that stays through every scene after.
      return [fade(el, 0, 1, TIMING.caption, delay + TIMING.introFigureDelay + 120)];
    case "year":
    case "label":
      return [fade(el, 0, 1, TIMING.caption, delay)];
  }
}

/** A piece leaving: its parts go as they came (a panel keeps its backdrop under the next one's, `hold`). */
export function depart(el: HTMLElement, kind: ItemKind, { reduced, delay = 0, mode = "swap" }: MotionOptions): Animation[] {
  if (reduced) return [fade(el, 1, 0, TIMING.reduced, delay, "ease-in")];
  switch (kind) {
    case "panel":
      return departPanel(el, delay, mode);
    case "name":
      // Only the end of the motion is given: it starts from wherever the name is, so one sent away mid-arrival leaves from where it is.
      return [el.animate({ transform: "translateY(-12px)", opacity: 0 }, { duration: TIMING.figureLeave, delay, easing: EASE_IN, fill: "forwards" })];
    case "poster":
      return departPoster(el, delay);
    case "amp":
    case "year":
      // Its replacement fades in over it, so it stays until that has covered it.
      return [hold(el, TIMING.caption + TIMING.captionDelay + 60)];
    case "strip":
    case "label":
      return [fade(el, 1, 0, 200, delay, "ease-in")];
  }
}

function arrivePanel(el: HTMLElement, delay: number, mode: PanelMode): Animation[] {
  const backdrop = part(el, "backdrop");
  const figure = part(el, "figure");
  const foot = part(el, "foot");
  const animations: Animation[] = [];

  if (mode === "recolour") {
    // The same panel in its new colour, over the old: nothing moves.
    animations.push(fade(el, 0, 1, TIMING.backdrop, delay, EASE_IN_OUT));
    return animations;
  }

  if (mode === "intro") {
    // The frame wipes in (`wipeFrames`); the figure rises 24px into it.
    if (figure) {
      animations.push(
        figure.animate([{ transform: "translateY(24px)", opacity: 0 }, { transform: "translateY(0)", opacity: 1 }], {
          duration: 700,
          delay: delay + TIMING.introFigureDelay,
          easing: EASE_RISE,
          fill: "backwards",
        }),
      );
    }
    return animations;
  }

  // A person replaced: the montage and the foot gradient (over the figure) fade in over the old ones, the figure rises from 8% below.
  if (backdrop) animations.push(fade(backdrop, 0, 1, TIMING.backdrop, delay + TIMING.backdropDelay, EASE_IN_OUT));
  if (foot) animations.push(fade(foot, 0, 1, TIMING.backdrop, delay + TIMING.backdropDelay, EASE_IN_OUT));
  if (figure) {
    const options = { delay: delay + TIMING.figureDelay, fill: "backwards" } as const;
    animations.push(
      figure.animate([{ transform: "translateY(8%)" }, { transform: "translateY(0)" }], { ...options, duration: TIMING.figureArrive, easing: EASE_RISE }),
      figure.animate([{ opacity: 0 }, { opacity: 1 }], { ...options, duration: TIMING.figureArrive * 0.5, easing: EASE_OUT }),
    );
  }
  return animations;
}

/** A name comes up from below, as its figure rises: on the first reveal after the figure has started, on a swap with it. */
function arriveName(el: HTMLElement, delay: number, mode: PanelMode): Animation {
  const intro = mode === "intro";
  return el.animate([{ transform: `translateY(${intro ? 10 : 14}px)`, opacity: 0 }, { transform: "translateY(0)", opacity: 1 }], {
    duration: intro ? 420 : TIMING.name,
    delay: delay + (intro ? TIMING.introFigureDelay + 120 : TIMING.figureDelay),
    easing: EASE_RISE,
    fill: "backwards",
  });
}

function departPanel(el: HTMLElement, delay: number, mode: PanelMode): Animation[] {
  // What stays: the backdrop under the arriving panel's (and, for a recolour, everything under it).
  const animations: Animation[] = [hold(el, mode === "recolour" ? TIMING.backdrop + 80 : TIMING.panelHold + delay)];
  if (mode === "recolour") return animations;
  // Only the end of each motion is given: it starts from wherever the part is, so a panel sent away mid-arrival (Next pressed again at
  // once) leaves from where it is instead of jumping to its resting place first.
  const figure = part(el, "figure");
  const foot = part(el, "foot");
  // The foot gradient sinks away as the new one comes in over it (their two never add up to a darker foot for long).
  if (foot) animations.push(fade(foot, 1, 0, TIMING.backdrop, delay + TIMING.backdropDelay, EASE_IN_OUT));
  if (figure) {
    animations.push(
      figure.animate({ transform: "translateY(6%)", opacity: 0 }, { duration: TIMING.figureLeave, delay, easing: EASE_IN, fill: "forwards" }),
    );
  }
  return animations;
}

function arrivePoster(el: HTMLElement, delay: number): Animation[] {
  const poster = part(el, "poster");
  if (!poster) return [];
  // Dealt onto the cluster: it rises and settles from a little smaller.
  return [
    poster.animate([{ transform: "translateY(28px) scale(0.94)", opacity: 0 }, { transform: "translateY(0) scale(1)", opacity: 1 }], {
      duration: TIMING.posterArrive,
      delay,
      easing: EASE_RISE,
      fill: "backwards",
    }),
  ];
}

function departPoster(el: HTMLElement, delay: number): Animation[] {
  const poster = part(el, "poster");
  if (!poster) return [];
  return [poster.animate({ transform: "translateY(16px) scale(0.96)", opacity: 0 }, { duration: TIMING.posterLeave, delay, easing: EASE_IN, fill: "forwards" })];
}

/** The timeline's dots pop in on a spring, from the left to the right (each by its place across the axis, `data-x`, 0 to 1). */
function arriveStrip(el: HTMLElement, delay: number): Animation[] {
  const easing = springEasing();
  return [...el.querySelectorAll<HTMLElement>("[data-dot]")].map((dot) =>
    dot.animate([{ transform: "scale(0)" }, { transform: "scale(1)" }], {
      duration: TIMING.stripDot,
      delay: delay + Number(dot.dataset.x ?? 0) * TIMING.stripSweep,
      easing,
      fill: "backwards",
    }),
  );
}

/** The first reveal's wipes: each panel's frame opens from the bottom, one after the other (clip-path, so what is inside it does not move). */
export function wipeFrames(frames: readonly HTMLElement[], reduced: boolean): Animation[] {
  if (reduced) return frames.map((frame) => fade(frame, 0, 1, TIMING.reduced, 0));
  return frames.map((frame, index) =>
    frame.animate([{ clipPath: "inset(100% 0 0 0)" }, { clipPath: "inset(0 0 0 0)" }], {
      duration: TIMING.introWipe,
      delay: index * TIMING.introWipeStagger,
      easing: EASE_RISE,
      fill: "backwards",
    }),
  );
}

/** The first reveal's line: it draws outward from the middle (a clip-path over the faded line, whose mask is its own). */
export function drawLine(line: HTMLElement, reduced: boolean): Animation[] {
  if (reduced) return [fade(line, 0, 1, TIMING.reduced, 0)];
  return [
    line.animate([{ clipPath: "inset(0 50% 0 50%)" }, { clipPath: "inset(0 0 0 0)" }], {
      duration: TIMING.introLine,
      delay: TIMING.introLineDelay,
      easing: EASE_OUT,
      fill: "backwards",
    }),
  ];
}

/** Loads (and decodes) an image; resolves false if it fails or takes longer than `timeoutMs`. */
export function preloadImage(url: string, timeoutMs = 10000): { promise: Promise<boolean>; cancel: () => void } {
  const image = new Image();
  let settle: (ok: boolean) => void = () => {};
  const promise = new Promise<boolean>((resolve) => {
    settle = resolve;
  });
  const timer = setTimeout(() => settle(false), timeoutMs);
  image.decoding = "async";
  image.onload = () => {
    // decode() makes the first paint of the real <img> cheap; a failure here is not a failure to load.
    image.decode().then(
      () => settle(true),
      () => settle(true),
    );
  };
  image.onerror = () => settle(false);
  image.src = url;
  return {
    promise: promise.finally(() => clearTimeout(timer)),
    cancel: () => {
      clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      settle(false);
    },
  };
}
