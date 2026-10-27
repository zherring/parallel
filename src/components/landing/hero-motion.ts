// The hero's choreography, as Web Animations API calls on plain elements. Transform and opacity
// (plus a 2px blur on the way out), so it stays on the compositor. Nothing here touches layout.
// The element being moved is always a wrapper around the card, so these never fight the card's
// own tilt, the idle float or the pointer parallax, which live on other elements.

/** What the choreography needs to know about the visitor's settings. */
export interface MotionOptions {
  /** prefers-reduced-motion: cross-fades only, no travel, scale or blur. */
  reduced: boolean;
  /** Milliseconds before the animation starts. */
  delay?: number;
}

export type CardKind = "person" | "poster";

// A damped spring (zeta 0.62) sampled into linear(): about 8% overshoot, settled by the end.
const SPRING =
  "linear(0, 0.04, 0.139, 0.273, 0.419, 0.563, 0.695, 0.809, 0.902, 0.973, 1.024, 1.057, 1.076, 1.083, 1.082, 1.075, 1.064, 1.052, 1.04, 1.029, 1.019, 1.01, 1.004, 0.999, 0.996, 0.994, 0.993, 0.993, 0.994, 0.994, 1)";
// For browsers without linear(): a back-out curve with a similar overshoot.
const SPRING_FALLBACK = "cubic-bezier(0.34, 1.5, 0.64, 1)";
const EASE_IN_OUT = "cubic-bezier(0.4, 0, 0.2, 1)";
const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";

const spring = (): string =>
  typeof CSS !== "undefined" && CSS.supports("animation-timing-function", "linear(0, 1)")
    ? SPRING
    : SPRING_FALLBACK;

/** Timings, in milliseconds, shared with the component's stagger. */
export const TIMING = {
  leave: 320,
  posterLeave: 260,
  arrive: 520,
  posterArrive: 480,
  /** The incoming portraits start while the outgoing ones are still easing back. */
  personArriveDelay: 190,
  /** Posters are dealt after the portraits, one every POSTER_STAGGER. */
  posterArriveDelay: 260,
  posterStagger: 70,
  posterLeaveStagger: 40,
  nodDelay: 200,
  nod: 460,
  draw: 760,
  drawDelay: 260,
  pulse: 640,
  pulseDelay: 420,
  pulseStagger: 90,
} as const;

/** A portrait or poster arriving: from the bottom right with a spring (a plain fade if reduced). */
export function arrive(el: HTMLElement, kind: CardKind, { reduced, delay = 0 }: MotionOptions): Animation[] {
  if (reduced) {
    return [el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, delay, easing: "ease-out", fill: "backwards" })];
  }
  const person = kind === "person";
  const from = person
    ? "translate3d(46px, 38px, 0) rotate(4deg) scale(0.94)"
    : "translate3d(30px, 20px, 0) rotate(8deg) scale(0.9)";
  const duration = person ? TIMING.arrive : TIMING.posterArrive;
  return [
    el.animate([{ transform: from }, { transform: "translate3d(0, 0, 0) rotate(0deg) scale(1)" }], {
      duration,
      delay,
      easing: spring(),
      fill: "backwards",
    }),
    el.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: duration * 0.45,
      delay,
      easing: EASE_OUT,
      fill: "backwards",
    }),
  ];
}

/**
 * A portrait or poster leaving: eases back, drifts down and left, turns a little and blurs, while
 * its opacity falls faster, so it is nearly gone before the next card arrives in its place.
 */
export function depart(el: HTMLElement, kind: CardKind, { reduced, delay = 0 }: MotionOptions): Animation[] {
  if (reduced) {
    return [el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, delay, easing: "ease-in", fill: "forwards" })];
  }
  const person = kind === "person";
  const duration = person ? TIMING.leave : TIMING.posterLeave;
  return [
    el.animate(
      [
        { transform: "translate3d(0, 0, 0) rotate(0deg) scale(1)", filter: "blur(0px)" },
        {
          transform: person
            ? "translate3d(-14px, 12px, 0) rotate(-4deg) scale(0.96)"
            : "translate3d(-10px, 10px, 0) rotate(-5deg) scale(0.94)",
          filter: "blur(2px)",
        },
      ],
      { duration, delay, easing: EASE_IN_OUT, fill: "forwards" },
    ),
    el.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: duration * 0.72,
      delay,
      easing: EASE_IN_OUT,
      fill: "forwards",
    }),
  ];
}

/** The person who stays acknowledges the change: a small scale up and back. */
export function nod(el: HTMLElement, { reduced, delay = 0 }: MotionOptions): Animation | null {
  if (reduced) return null;
  return el.animate(
    [
      { transform: "scale(1)" },
      { transform: "scale(1.02)", offset: 0.4 },
      { transform: "scale(1)" },
    ],
    { duration: TIMING.nod, delay, easing: EASE_IN_OUT },
  );
}

/** Draws the connector again and pulses the shared-film nodes once. */
export function redraw(svg: SVGElement, { reduced }: { reduced: boolean }): Animation[] {
  const animations: Animation[] = [];
  const connector = svg.querySelector<SVGElement>("[data-connector]");
  if (connector) {
    const total = TIMING.drawDelay + TIMING.draw;
    const fadedBy = 140 / total;
    const drawFrom = TIMING.drawDelay / total;
    animations.push(
      reduced
        ? connector.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: 200, fill: "backwards" })
        : // The old connector fades away, then the new one draws itself from the people to the posters.
          connector.animate(
            [
              { strokeDashoffset: 0, opacity: 0.75, offset: 0 },
              { strokeDashoffset: 0, opacity: 0, offset: fadedBy },
              { strokeDashoffset: 1, opacity: 0, offset: fadedBy + 0.001 },
              { strokeDashoffset: 1, opacity: 0.75, offset: drawFrom },
              { strokeDashoffset: 0, opacity: 0.75, offset: 1, easing: EASE_OUT },
            ],
            { duration: total, easing: "linear", fill: "backwards" },
          ),
    );
  }
  if (!reduced) {
    svg.querySelectorAll<SVGElement>("[data-pulse]").forEach((node, index) => {
      animations.push(
        node.animate(
          [
            { transform: "scale(1)", opacity: 1 },
            { transform: "scale(2.1)", opacity: 0.55, offset: 0.35 },
            { transform: "scale(1)", opacity: 1 },
          ],
          { duration: TIMING.pulse, delay: TIMING.pulseDelay + index * TIMING.pulseStagger, easing: EASE_IN_OUT },
        ),
      );
    });
  }
  return animations;
}

/** The idle float: a slow, small, endless rise and fall. Starts paused. Phase offsets the card. */
export function float(el: HTMLElement, { amplitude, period, phase }: { amplitude: number; period: number; phase: number }): Animation {
  const animation = el.animate(
    [{ transform: "translate3d(0, 0, 0)" }, { transform: `translate3d(0, ${-amplitude}px, 0)` }],
    { duration: period, delay: -phase * period, iterations: Infinity, direction: "alternate", easing: "ease-in-out" },
  );
  animation.pause();
  return animation;
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
