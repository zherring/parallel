"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type FocusEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { KeycapButton } from "@/components/landing/keycap-button";
import { MoreLabel, PanelParts, PosterParts, YearCap } from "@/components/landing/hero-parts";
import { arrive, depart, drawLine, wipeFrames, type ItemKind } from "@/components/landing/hero-motion";
import { SLOTS, applyTransition, initialState, type AmpItem, type Item, type LabelItem, type NameItem, type PanelItem, type PosterItem, type StripItem, type YearItem } from "@/components/landing/hero-items";
import { TimelineLine, TimelineStrip } from "@/components/landing/hero-timeline";
import { useSplashHidden } from "@/components/landing/genre-tabs";
import { usePanelShown } from "@/components/landing/panel-shown";
import { useHeroVariants } from "@/components/landing/use-hero-variants";
import { posterImageUrl, preloadScene, useHeroRotation } from "@/components/landing/use-hero-rotation";
import { useHeroKeys } from "@/components/landing/use-hero-keys";
import { useHeroPause } from "@/components/landing/use-hero-pause";
import { useKeycapPress } from "@/components/landing/use-keycap-press";
import { useReducedMotion } from "@/components/pair-wash";
import type { NavDirection } from "@/lib/hero-history";
import { posterPlace, stripOf } from "@/lib/hero-layout";
import { isRunning, pickFirstScene, type HeroPairing, type Scene } from "@/lib/hero-scenes";
import { DEFAULT_VARIANTS, type HeroVariants } from "@/lib/hero-variants";
import { buildPeopleSlug } from "@/lib/slug";

interface Props {
  /** Every pairing the hero can rotate through. */
  pool: readonly HeroPairing[];
  /** The scene in the server markup, inside a <noscript>: what visitors without JavaScript get. */
  fallback: Scene;
}

/** "Steven Spielberg and Tom Hanks: 6 films together": the link's name and the announcement. */
function sceneLabel(scene: Scene): string {
  const count = scene.pairing.sharedCount;
  return `${scene.people.map((person) => person.name).join(" and ")}: ${count} ${count === 1 ? "film" : "films"} together`;
}

const sceneHref = (scene: Scene) =>
  `/p/${buildPeopleSlug(scene.people.map(({ id, name }) => ({ id, name })))}`;

const subscribeNever = () => () => {};
const noop = () => {};

/** The pairing the last visit of this browser session opened on, so the next one differs. */
const LAST_FIRST_KEY = "parallel:hero-first";
function lastFirstKey(): string | null {
  try {
    return window.sessionStorage.getItem(LAST_FIRST_KEY);
  } catch {
    return null; // storage blocked: nothing to avoid
  }
}
function rememberFirstKey(key: string) {
  try {
    window.sessionStorage.setItem(LAST_FIRST_KEY, key);
  } catch {
    // storage blocked: the next visit may open on the same scene
  }
}

/** How long the first scene's images get to load before it shows anyway. */
const REVEAL_TIMEOUT_MS = 2500;

/**
 * Runs the arrive and depart animations of one piece on its own wrapper (hero-motion.ts reaches the parts inside it by `data-part`). A piece stays mounted
 * from arrival to departure and tells `onGone` when its departure is over.
 */
function Motion({
  item,
  reduced,
  onGone,
  className,
  children,
}: {
  item: Item;
  reduced: boolean;
  onGone: (id: string) => void;
  className: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const kind: ItemKind = item.kind;
  const { phase, delay, mode } = item;

  useLayoutEffect(() => {
    const element = ref.current;
    if (phase !== "entering" || !element) return;
    const animations = arrive(element, kind, { reduced, delay, mode });
    return () => animations.forEach((animation) => animation.cancel());
    // Only on arrival: later renders must not restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    const element = ref.current;
    if (phase !== "leaving" || !element) return;
    const animations = depart(element, kind, { reduced, delay, mode });
    Promise.all(animations.map((animation) => animation.finished)).then(
      () => onGone(item.id),
      () => {}, // cancelled by an unmount
    );
    return () => animations.forEach((animation) => animation.cancel());
  }, [phase, kind, reduced, delay, mode, onGone, item.id]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

/**
 * The anchor of poster `slot` of a scene with `count` posters: a point on the cluster's baseline, a little above the line (`--poster-gap`), offset by the poster's
 * own place in the fan (`posterPlace`). The cluster is centred on the seam among the posters a width shows (`--cap`, `POSTER_CAPS`), each `--step` from the next,
 * and each poster is over the one before it (`--z`).
 */
const posterAnchor = (slot: number, count: number) =>
  ({
    left: `calc(50% + (${slot} - (min(${count}, var(--cap)) - 1) / 2) * var(--step))`,
    top: `calc(var(--line-y) - var(--poster-gap) + ${posterPlace(slot, count).dy}px)`,
    "--z": slot,
  }) as CSSProperties;

/** Where a half of the stage is, in the stage's link: from the seam out to its panel's edge, and (`--ext`: 0 in the panels layout, the inset in the wide one) on past it to the screen's. */
const halfBox = (slot: 0 | 1): CSSProperties =>
  slot === 0
    ? { left: "calc(-1 * var(--ext))", right: "calc(50% + var(--seam) / 2)" }
    : { left: "calc(50% + var(--seam) / 2)", right: "calc(-1 * var(--ext))" };

/** The halves' corners: all four of a panel; in the wide layout only the ones at the seam, as the others are the screen's. */
const halfCorners = (slot: 0 | 1, layout: HeroVariants["layout"]) => (layout === "wide" ? (slot === 0 ? "rounded-r-[9px]" : "rounded-l-[9px]") : "rounded-[9px]");

/** One side of the names' label: the names of `slot` in one cell, so a leaving name and the one arriving are in the same place. A is against the "&" on its left (right-aligned), B on its right. */
function NameColumn({ slot, names, reduced, onGone }: { slot: 0 | 1; names: readonly NameItem[]; reduced: boolean; onGone: (id: string) => void }) {
  return (
    <div className={`grid justify-items-center ${slot === 0 ? "sm:justify-items-end" : "sm:justify-items-start"}`}>
      {names
        .filter((item) => item.slot === slot)
        .map((item) => (
          <Motion key={item.id} item={item} reduced={reduced} onGone={onGone} className="col-start-1 row-start-1 sm:whitespace-nowrap">
            {item.person.name}
          </Motion>
        ))}
    </div>
  );
}

/**
 * Everything inside the stage's link: the two halves (frames, with the pieces in them), the scrim that holds the headline, the timeline line, and over it
 * the strip of dots, the poster cluster, "+N more", the year caps and the names' label. Drawn from `items`, with the animations of `Motion`; the noscript scene is the same
 * thing, all idle.
 */
function Layers({ items, reduced, onGone, variants }: { items: readonly Item[]; reduced: boolean; onGone: (id: string) => void; variants: HeroVariants }) {
  const panels = items.filter((item): item is PanelItem => item.kind === "panel");
  const posters = items.filter((item): item is PosterItem => item.kind === "poster");
  const strips = items.filter((item): item is StripItem => item.kind === "strip");
  const years = items.filter((item): item is YearItem => item.kind === "year");
  const labels = items.filter((item): item is LabelItem => item.kind === "label");
  const names = items.filter((item): item is NameItem => item.kind === "name");
  const amps = items.filter((item): item is AmpItem => item.kind === "amp");
  const { layout, edge } = variants;

  return (
    <>
      {SLOTS.map((slot) => (
        <div
          key={slot}
          data-frame=""
          className={`absolute inset-y-0 isolate overflow-hidden bg-[#0b0d10] ${halfCorners(slot, layout)}`}
          style={halfBox(slot)}
        >
          {panels
            .filter((item) => item.slot === slot)
            .map((item) => (
              <Motion key={item.id} item={item} reduced={reduced} onGone={onGone} className="absolute inset-0">
                <PanelParts person={item.person} color={item.color} slot={slot} layout={layout} edge={edge} />
              </Motion>
            ))}
          {/* A white ring when the stage is hovered, the focus colour when its link has keyboard focus; it fades out toward the bottom, which melts into the page. */}
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute inset-0 z-10 ${halfCorners(slot, layout)} ring-1 ring-inset ring-white/15 transition-shadow duration-300 [mask-image:linear-gradient(to_bottom,#000_55%,transparent_92%)] group-hover:ring-2 group-hover:ring-white/70 group-focus-visible:ring-2 group-focus-visible:ring-focus`}
          />
        </div>
      ))}

      {/* A wide, soft, dark glow behind the headline (which is the section's, over the stage): no edge, so no box. Phones have the headline under the stage. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[34%] hidden h-[58%] w-[min(94%,1020px)] -translate-x-1/2 -translate-y-1/2 sm:block"
        style={{ background: "radial-gradient(closest-side, rgb(7 9 11 / 0.66), rgb(7 9 11 / 0.4) 52%, transparent)" }}
      />

      <TimelineLine />

      {/* The strip's dots, the cluster, its label and the caps are anchored on the line or just above it; the posters shown are the first of the row, three, four or five by width (`POSTER_CAPS`). */}
      <div className="pointer-events-none absolute inset-0 [--cap:3] sm:[--cap:4] lg:[--cap:5]">
        {strips.map((item) => {
          const strip = stripOf(item.pairing);
          return (
            strip && (
              <Motion key={item.id} item={item} reduced={reduced} onGone={onGone} className="absolute inset-0">
                <TimelineStrip strip={strip} colors={item.colors} />
              </Motion>
            )
          );
        })}

        {posters.map((item) => (
          <div
            key={item.id}
            className={`group/poster absolute z-(--z) size-0 hover:z-20 ${item.slot === 4 ? "max-lg:hidden" : item.slot === 3 ? "max-sm:hidden" : ""}`}
            style={posterAnchor(item.slot, item.count)}
          >
            <Motion item={item} reduced={reduced} onGone={onGone} className="absolute left-0 top-0">
              <PosterParts poster={item.poster} src={posterImageUrl(item.poster.path)} slot={item.slot} count={item.count} />
            </Motion>
          </div>
        ))}

        {labels.map((item) => (
          // To the right of the cluster, on the posters' middle (not the line's).
          <div
            key={item.id}
            className="absolute size-0"
            style={{
              left: `calc(50% + (min(${item.count}, var(--cap)) - 1) / 2 * var(--step) + var(--pw) / 2 + 14px)`,
              top: "calc(var(--line-y) - var(--poster-gap) - var(--pw) * 0.75)",
            }}
          >
            <Motion item={item} reduced={reduced} onGone={onGone} className="absolute left-0 top-0 -translate-y-1/2">
              <MoreLabel pairing={item.pairing} />
            </Motion>
          </div>
        ))}

        {years.map((item) => (
          <div
            key={item.id}
            className="absolute size-0"
            style={{ top: "var(--line-y)", [item.slot === 0 ? "left" : "right"]: "calc(-1 * min(var(--gutter) - 4px, 18px))" }}
          >
            <Motion item={item} reduced={reduced} onGone={onGone} className={`absolute top-0 -translate-y-1/2 ${item.slot === 0 ? "left-0" : "right-0"}`}>
              <YearCap year={item.year} />
            </Motion>
          </div>
        ))}

        {/*
          The names, one label under the line, centred on the seam: "A & B", the "&" on the seam and the names balanced on either side of it (a grid of two equal columns round
          it, A against it on its left and B on its right), on one line. On a phone it wraps: A on the first line and "& B" on the second, centred. Each name is a piece
          of its own, so a swap of one person slides only their name; a column holds the leaving name and the arriving one in the same place.
        */}
        <div data-names="" className="absolute inset-x-0 top-[calc(var(--line-y)+22px)] flex flex-col items-center text-center text-[length:clamp(16px,1.6vw,24px)] font-semibold leading-[1.15] tracking-[-0.02em] text-white [text-shadow:0_1px_14px_rgb(0_0_0/0.65)] sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-baseline sm:gap-x-[0.45em]">
          <NameColumn slot={0} names={names} reduced={reduced} onGone={onGone} />
          <div className="flex items-baseline justify-center gap-[0.35em] sm:contents">
            {amps.map((item) => (
              <Motion key={item.id} item={item} reduced={reduced} onGone={onGone} className="font-normal text-white/70">
                &amp;
              </Motion>
            ))}
            <NameColumn slot={1} names={names} reduced={reduced} onGone={onGone} />
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Pointer parallax: while a mouse or pen is over the stage, the figures and the posters drift a few pixels against it (`--px` and `--py`, from -1 to 1,
 * which their `translate` reads), eased. It runs only while the pointer is over the stage or the drift has not settled, so it costs nothing otherwise,
 * and it is a property (`translate`) none of the scene animations (`transform`, `opacity`) touch.
 */
function useParallax(root: RefObject<HTMLElement | null>, reduced: boolean) {
  useEffect(() => {
    const element = root.current;
    if (!element || reduced) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    let box: DOMRect | null = null;
    let targetX = 0;
    let targetY = 0;
    let x = 0;
    let y = 0;
    let frame = 0;
    const tick = () => {
      x += (targetX - x) * 0.09;
      y += (targetY - y) * 0.09;
      if (Math.abs(targetX - x) + Math.abs(targetY - y) < 0.002) {
        x = targetX;
        y = targetY;
        frame = 0;
      } else {
        frame = requestAnimationFrame(tick);
      }
      element.style.setProperty("--px", x.toFixed(3));
      element.style.setProperty("--py", y.toFixed(3));
    };
    const kick = () => {
      if (!frame) frame = requestAnimationFrame(tick);
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      box ??= element.getBoundingClientRect();
      targetX = Math.max(-1, Math.min(1, ((event.clientX - box.left) / box.width - 0.5) * 2));
      targetY = Math.max(-1, Math.min(1, ((event.clientY - box.top) / box.height - 0.5) * 2));
      kick();
    };
    const leave = () => {
      targetX = 0;
      targetY = 0;
      kick();
    };
    const forget = () => {
      box = null;
    };
    element.addEventListener("pointermove", move, { passive: true });
    element.addEventListener("pointerleave", leave);
    window.addEventListener("scroll", forget, { passive: true });
    window.addEventListener("resize", forget);
    return () => {
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerleave", leave);
      window.removeEventListener("scroll", forget);
      window.removeEventListener("resize", forget);
      cancelAnimationFrame(frame);
      element.style.removeProperty("--px");
      element.style.removeProperty("--py");
    };
  }, [root, reduced]);
}

/**
 * The live stage: a scene picked at random once this mounts in the browser, then the automatic rotation and the visitor's Previous and Next (buttons and
 * arrow keys), and a polite live region that names the scene after a button or key, never after the rotation. All the ways to hold the rotation still (there
 * is no pause button) are in useHeroPause; the controls call `go`. Nothing is drawn until the first scene's images are in (the stage's box has its size
 * from the first paint), and then it is revealed: the line draws, the panels wipe in, and the figures and posters follow.
 */
function Stage({ root, pool, initial }: { root: RefObject<HTMLDivElement | null>; pool: readonly HeroPairing[]; initial: Scene }) {
  const reduced = useReducedMotion();
  const [state, setState] = useState(() => initialState(initial, "entering"));
  const [announcement, setAnnouncement] = useState("");
  const [revealed, setRevealed] = useState(false);

  // The genre tabs replace the splash with a grid: while it is hidden the rotation holds still (and the arrow keys, which step what is on screen, leave it alone).
  const splashHidden = useSplashHidden();
  const { reasons, set } = useHeroPause(root, reduced, splashHidden);
  const variants = useHeroVariants();
  const running = isRunning(reasons) && revealed;
  const { go, warm } = useHeroRotation({
    pool,
    initial,
    running,
    onTransition: (transition, direction, cause) => {
      setState((current) => applyTransition(current, transition));
      // Said after a button or key; an automatic change empties the region instead, so it never
      // holds the name of a scene that is no longer on screen.
      setAnnouncement(cause === "manual" ? `Showing ${sceneLabel(transition.scene)}` : "");
    },
  });
  // A step from the buttons or the arrow keys presses the matching keycap, and only a step that
  // happens: a key the page ignores (typing, an open combobox, a held key repeating) never gets here.
  const { pressed, press } = useKeycapPress();
  const step = useCallback(
    (direction: NavDirection) => {
      press(direction);
      go(direction);
    },
    [press, go],
  );
  useHeroKeys({ heroVisible: !reasons.offscreen && !reasons.genre, onNavigate: step });
  useParallax(root, reduced);

  useEffect(() => rememberFirstKey(initial.pairing.key), [initial]);

  useEffect(() => {
    const loading = preloadScene(initial, REVEAL_TIMEOUT_MS);
    let current = true;
    void loading.ready.then(() => {
      if (current) setRevealed(true);
    });
    return () => {
      current = false;
      loading.cancel();
    };
  }, [initial]);

  // The first reveal: the line draws outward and the frames wipe in. The pieces on them animate themselves (`Motion`, mode "intro") as they mount.
  useLayoutEffect(() => {
    const element = root.current;
    if (!revealed || !element) return;
    const frames = [...element.querySelectorAll<HTMLElement>("[data-frame]")];
    const line = element.querySelector<HTMLElement>("[data-line]");
    const animations = [...wipeFrames(frames, reduced), ...(line ? drawLine(line, reduced) : [])];
    return () => animations.forEach((animation) => animation.cancel());
    // Once: a later change of the preference must not play the reveal again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed]);

  // The pointer arriving suggests a click on Next may follow: have its images ready.
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    element.addEventListener("pointerenter", warm);
    return () => element.removeEventListener("pointerenter", warm);
  }, [root, warm]);

  const onGone = useCallback((id: string) => {
    setState((current) => ({ ...current, items: current.items.filter((item) => item.id !== id) }));
  }, []);
  // Keyboard focus on the link or on Previous or Next holds the rotation, so the scene does not
  // change under someone who is about to press a button.
  const focusHandlers = {
    onFocus: (event: FocusEvent<HTMLElement>) => {
      warm();
      set("focus", event.currentTarget.matches(":focus-visible"));
    },
    onBlur: () => set("focus", false),
  };

  const { scene } = state;
  const navigate = (direction: NavDirection) => () => step(direction);
  // With a single pairing in the pool there is nowhere to step to.
  const canStep = pool.length > 1;
  // The keycaps come in with the reveal, after the panels have wiped in.
  const keycapIn = revealed ? "opacity-100 motion-safe:transition-opacity motion-safe:duration-500 motion-safe:delay-700" : "invisible opacity-0";

  return (
    <>
      {/* Previous and Next sit inside the panels' outer edges at the stage's middle, outside the link, so no control is nested in it. In the wide layout they stay where the panels' are. */}
      {canStep && (
        <KeycapButton
          direction="prev"
          label="Previous pairing"
          pressed={pressed === "prev"}
          onClick={navigate("prev")}
          className={`left-[calc(var(--core-pad)+8px)] top-1/2 z-20 -translate-y-1/2 ${keycapIn}`}
          onPhoto
          {...focusHandlers}
        />
      )}

      {/* The whole stage is one link to the pair; its decorative layers carry no text of their own. */}
      {revealed && (
        <Link
          href={sceneHref(scene)}
          prefetch={false}
          aria-label={sceneLabel(scene)}
          {...focusHandlers}
          className="group absolute inset-x-(--core-pad) inset-y-0 block outline-none!"
        >
          <div aria-hidden="true" className="absolute inset-0">
            <Layers items={state.items} reduced={reduced} onGone={onGone} variants={variants} />
          </div>
        </Link>
      )}

      {canStep && (
        <KeycapButton
          direction="next"
          label="Next pairing"
          pressed={pressed === "next"}
          onClick={navigate("next")}
          className={`right-[calc(var(--core-pad)+8px)] top-1/2 z-20 -translate-y-1/2 ${keycapIn}`}
          onPhoto
          {...focusHandlers}
        />
      )}

      {/* Said after Previous or Next, not after the rotation changes the scene by itself. */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
    </>
  );
}

/** Picks the scene this visit opens on, in the browser only (it is random), then runs the stage. */
function LiveStage({ root, pool }: { root: RefObject<HTMLDivElement | null>; pool: readonly HeroPairing[] }) {
  const [initial] = useState(() => pickFirstScene(pool, Math.random, lastFirstKey()));
  return initial ? <Stage root={root} pool={pool} initial={initial} /> : null;
}

/**
 * The hero's stage, the box under the headline: two portrait halves with the pair's films on a timeline along the bottom. The page is prerendered, so
 * the server cannot choose a scene at random and renders only the empty, fixed-size box plus the default scene in a <noscript>, which gives crawlers and
 * visitors without JavaScript a real link, and costs everyone else no image requests, as the browser does not parse a <noscript> when scripts run. Once
 * hydrated, the browser picks the scene at random and reveals it when its images are in. The box has its final size from the first paint, so nothing shifts.
 * It does not go live at all until the genre tabs have shown it once (a page opened on `/#horror` shows the genre's grid and never the splash, so the splash's
 * images are not fetched, and its reveal plays when the visitor first comes to it).
 *
 * Its size and spacing come from the variables its section sets (hero.tsx): `--stage-h`, `--gutter` and `--seam`; the rest are derived here. The stage is as wide
 * as the screen and a size container, so `--core-pad` (what `100cqw` makes of it) is how far in from the screen's edges the panels of the "panels" layout are:
 * the gutter, or, past 1600px of width, the gutter and half of what is left. Both layouts are drawn from it (`--ext` is how far a half runs out past its
 * panel: nothing, or all the way to the screen's edge). `--pw` is a poster's width, from the box (its height, and on a phone its width), `--step` the distance
 * between posters of the cluster; `--line-y` is the line's place down the stage, `--poster-gap` how far the
 * posters' bottoms are above it, and `--axis-pad` how far in from a panel's outer edge the dots' axis starts (past the year cap).
 */
export function HeroStage({ pool, fallback }: Props) {
  // False on the server and for the hydrating render, true from the next one: the random pick
  // must not run before then, or the markup would not match the server's.
  const live = useSyncExternalStore(subscribeNever, () => true, () => false);
  const shown = usePanelShown();
  const root = useRef<HTMLDivElement>(null);
  const { layout } = useHeroVariants();

  return (
    <div
      ref={root}
      data-hero-stage=""
      data-layout={layout}
      className="group/stage relative h-(--stage-h) w-full [container-type:inline-size] [--line-y:82%] [--core-pad:max(var(--gutter),calc((100cqw_-_1600px)/2_+_var(--gutter)))] [--ext:0px] [--reach:var(--gutter)] [--fade:calc(var(--gutter)+14px)] [--axis-pad:44px] [--poster-gap:22px] [--pw:min(68px,calc(var(--stage-h)*0.15),17cqw)] [--step:calc(var(--pw)*0.76)] data-[layout=wide]:[--ext:var(--core-pad)] data-[layout=wide]:[--reach:var(--core-pad)] data-[layout=wide]:[--fade:56px] sm:[--poster-gap:26px] sm:[--pw:min(92px,calc(var(--stage-h)*0.15))] lg:[--pw:min(100px,calc(var(--stage-h)*0.15))]"
    >
      {live && shown ? <LiveStage root={root} pool={pool} /> : null}
      <noscript>
        <a
          href={sceneHref(fallback)}
          aria-label={sceneLabel(fallback)}
          className="group absolute inset-x-(--core-pad) inset-y-0 block outline-none!"
        >
          <div aria-hidden="true" className="absolute inset-0">
            <Layers items={initialState(fallback, "idle").items} reduced={false} onGone={noop} variants={DEFAULT_VARIANTS} />
          </div>
        </a>
      </noscript>
    </div>
  );
}
