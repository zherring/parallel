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
import "@/components/landing/hero-cue.css";
import "@/components/landing/hero-stage.css";
import { KeycapButton } from "@/components/landing/keycap-button";
import { CueCall, MoreLabel, PanelParts, PosterParts, YearCap } from "@/components/landing/hero-parts";
import { arrive, depart, drawLine, wipeFrames, type ItemKind } from "@/components/landing/hero-motion";
import { SLOTS, applyTransition, initialState, type AmpItem, type Item, type LabelItem, type NameItem, type PanelItem, type PosterItem, type StripItem, type YearItem } from "@/components/landing/hero-items";
import { TimelineLine, TimelineStrip } from "@/components/landing/hero-timeline";
import { useSplashHidden } from "@/components/landing/genre-tabs";
import { usePanelShown } from "@/components/landing/panel-shown";
import { posterImageUrl, preloadScene, useHeroRotation } from "@/components/landing/use-hero-rotation";
import { useHeroKeys } from "@/components/landing/use-hero-keys";
import { useHeroPause } from "@/components/landing/use-hero-pause";
import { useKeycapPress } from "@/components/landing/use-keycap-press";
import { useReducedMotion } from "@/components/pair-wash";
import type { NavDirection } from "@/lib/hero-history";
import { BAND_WIDTH_CSS, CAP_VAR_CLASS, posterHiddenClass, posterPlace, stripOf } from "@/lib/hero-layout";
import { isRunning, pickFirstScene, type HeroPairing, type Scene } from "@/lib/hero-scenes";
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

/** A keycap's height on the stage: the middle of the names' row on a phone (22px under the line, and half of the row's box: `Action`'s `data-names-row`), the stage's middle from `sm` up. */
const KEYCAP_ROW = "top-[calc(var(--line-y)+22px+var(--row-body)/2)] z-20 -translate-y-1/2 sm:top-1/2";

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
    top: `calc(var(--line-y) - var(--poster-gap) + ${posterPlace(slot).dy}px)`,
    "--z": slot,
    "--slot": slot,
    "--count": count,
  }) as CSSProperties;

/** Where a half of the stage is, in the stage's decoration box (inset from the screen by `--core-pad`): from the seam out past the box's edge (by `--core-pad`) to the screen's. */
const halfBox = (slot: 0 | 1): CSSProperties =>
  slot === 0
    ? { left: "calc(-1 * var(--core-pad))", right: "calc(50% + var(--seam) / 2)" }
    : { left: "calc(50% + var(--seam) / 2)", right: "calc(-1 * var(--core-pad))" };

/** The halves' corners: only the ones at the seam are rounded, as the others are the screen's. */
const halfCorners = (slot: 0 | 1) => (slot === 0 ? "rounded-r-[9px]" : "rounded-l-[9px]");

/**
 * One side of the names' label: the names of `slot` in one cell, so a leaving name and the one arriving are in the same place. A is against the "&" on its left (right-aligned), B on its right.
 * Each name is two texts, one shown at a time: the full name from `sm` up, and on a phone the family name (`item.label`, hero-items.ts). The label is decoration (`aria-hidden`): the stage's link is named by the full names.
 * On a phone the column is an inline box (an atomic one, `inline-grid`: a piece animates by its transform, which an inline box that is not atomic ignores) in the label's one run of text, so the label is "A & B" on one line and wraps, where it does not fit the third, between A and "& B"; a name of two words ("De Niro", "Lilly Wachowski") stays on one line unless it alone is wider than the third, and then wraps inside its own box (never inside a word).
 */
function NameColumn({ slot, names, reduced, onGone }: { slot: 0 | 1; names: readonly NameItem[]; reduced: boolean; onGone: (id: string) => void }) {
  return (
    <div className={`grid justify-items-center max-sm:inline-grid max-sm:max-w-full max-sm:shrink-0 ${slot === 0 ? "sm:justify-items-end" : "sm:justify-items-start"}`}>
      {names
        .filter((item) => item.slot === slot)
        .map((item) => (
          <Motion key={item.id} item={item} reduced={reduced} onGone={onGone} className="col-start-1 row-start-1 sm:whitespace-nowrap">
            <span className="sm:hidden">{item.label}</span>
            <span className="max-sm:hidden">{item.person.name}</span>
          </Motion>
        ))}
    </div>
  );
}

/**
 * The stage's decoration, under its link and not in it: the two halves (frames, with the pieces in them: montage, figure and foot), the scrim that holds the headline,
 * and the timeline line. It is all `aria-hidden`, has no pointer events of its own to speak of and is not a link: only the action zone over it is (`Action`).
 * Drawn from `items`, with the animations of `Motion`; the noscript scene is the same thing, all idle.
 */
function Backdrop({ items, reduced, onGone }: { items: readonly Item[]; reduced: boolean; onGone: (id: string) => void }) {
  const panels = items.filter((item): item is PanelItem => item.kind === "panel");

  return (
    <>
      {SLOTS.map((slot) => (
        <div
          key={slot}
          data-frame=""
          className={`absolute top-0 bottom-[calc(var(--stage-h)_-_var(--scene-h))] isolate overflow-hidden bg-[#0b0d10] ${halfCorners(slot)}`}
          style={halfBox(slot)}
        >
          {panels
            .filter((item) => item.slot === slot)
            .map((item) => (
              <Motion key={item.id} item={item} reduced={reduced} onGone={onGone} className="absolute inset-0">
                <PanelParts person={item.person} color={item.color} slot={slot} />
              </Motion>
            ))}
        </div>
      ))}

      {/* A wide, soft, dark glow behind the headline (which is the section's, over the stage): no edge, so no box. On a phone the headline is across the stage's top, `--head-h` high, and so is the glow, centred on it. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[calc(var(--head-h)*0.5)] h-[calc(var(--head-h)*1.5)] w-[130%] -translate-x-1/2 -translate-y-1/2 sm:top-[34%] sm:h-[58%] sm:w-[min(94%,1020px)]"
        style={{ background: "radial-gradient(closest-side, rgb(7 9 11 / 0.66), rgb(7 9 11 / 0.4) 52%, transparent)" }}
      />

      <TimelineLine />
    </>
  );
}

/**
 * What is inside the stage's link, the action zone (see `ZONE_CLASS`): the strip of dots (in the band, with the year caps at its ends), the poster cluster, "+N more", the
 * names' label and the cue's line under it; they are anchored on the stage's line, and drawn from `items`, with the animations of `Motion`. The noscript scene is the same, all idle.
 */
function Action({ items, reduced, onGone }: { items: readonly Item[]; reduced: boolean; onGone: (id: string) => void }) {
  const posters = items.filter((item): item is PosterItem => item.kind === "poster");
  const strips = items.filter((item): item is StripItem => item.kind === "strip");
  const years = items.filter((item): item is YearItem => item.kind === "year");
  const labels = items.filter((item): item is LabelItem => item.kind === "label");
  const names = items.filter((item): item is NameItem => item.kind === "name");
  const amps = items.filter((item): item is AmpItem => item.kind === "amp");

  return (
    <>
      {/* The strip's dots, the cluster, its label and the caps are anchored on the line or just above it; the posters shown are the first of the row, three, four or five by width (`POSTER_CAPS`, `posterHiddenClass`). */}
      <div className="pointer-events-none absolute inset-0">
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
            data-cue-poster=""
            className={`group/poster absolute z-(--z) size-0 hover:z-20 ${posterHiddenClass(item.slot)}`}
            style={posterAnchor(item.slot, item.count)}
          >
            <Motion item={item} reduced={reduced} onGone={onGone} className="absolute left-0 top-0">
              <PosterParts poster={item.poster} src={posterImageUrl(item.poster.path)} slot={item.slot} />
            </Motion>
          </div>
        ))}

        {labels.map((item) => (
          // To the right of the cluster, on the posters' middle (not the line's).
          <div
            key={item.id}
            data-cue-more=""
            className="absolute size-0"
            style={
              {
                left: `calc(50% + (min(${item.count}, var(--cap)) - 1) / 2 * var(--step) + var(--pw) / 2 + 14px)`,
                top: "calc(var(--line-y) - var(--poster-gap) - var(--pw) * 0.75)",
                "--count": item.count,
              } as CSSProperties
            }
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
            style={{ top: "var(--line-y)", [item.slot === 0 ? "left" : "right"]: "calc(50% - var(--band-w) / 2)" }}
          >
            <Motion item={item} reduced={reduced} onGone={onGone} className={`absolute top-0 -translate-y-1/2 ${item.slot === 0 ? "left-0" : "right-0"}`}>
              <YearCap year={item.year} />
            </Motion>
          </div>
        ))}

        {/*
          The names, one label under the line, centred on the seam: "A & B" (on a phone their family names, "Anderson & Hoffman"; `NameColumn`), the "&" on the seam and the names balanced on either side of it (a grid of two equal columns round
          it, A against it on its left and B on its right), on one line. Each name is a piece of its own, so a swap of one person slides only their name; a column holds the leaving name
          and the arriving one in the same place. Under the names is the cue's line (`CueCall`), where a click goes: hidden until the cue (hero-cue.css), and on a touch screen, which has no
          hover, always there.
          On a phone the row under the line is in thirds of the screen: Previous (stage level, outside the link) centred in the left, this block in the middle third and Next in the right. The block is
          a box of the row's height (`--row-body`, hero-stage.css: room for the longest wrap) and its content is centred in it, so the keycaps, centred on the same box, are centred on the names whatever they
          wrap to. The names are one run of text, "A & B", centred on the third, on one line where it fits the room between the keycaps (two thirds of the screen less the two 44px keycaps and 12px clear of each, as the cue's line is wider than the third and between them) and wrapping at its spaces where it does not (between the names, "A" over "& B", the "&" kept with B by a no-break space; a name of two words wraps inside its own box; never inside a word; at the size `--name-fs`: the longest word of the pool's labels fills the third, and its "&" beside it pokes out of the third a little, into the room before the keycap), and the cue's line under them, one line, wider than the third (`CueCall`): it is between the keycaps, which are centred on the same box.
        */}
        <div data-names-row="" className="absolute left-1/2 top-[calc(var(--line-y)+22px)] flex h-(--row-body) w-[calc(100cqw/3)] -translate-x-1/2 flex-col items-center justify-center sm:inset-x-0 sm:block sm:h-auto sm:w-auto sm:translate-x-0">
          <div data-names="" className="text-center max-sm:w-max max-sm:max-w-[calc(66.667cqw_-_68px)] text-[length:var(--name-fs)] font-semibold leading-[1.15] tracking-[-0.02em] text-white [text-shadow:0_1px_14px_rgb(0_0_0/0.65)] sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-baseline sm:gap-x-[0.45em] sm:text-[length:clamp(16px,1.6vw,24px)]">
            <NameColumn slot={0} names={names} reduced={reduced} onGone={onGone} />
            {/* On a phone the label is one run of text, "A & B": A, a space the line may break at (from `sm` up it is not there, the label is a grid), then the "&" and B in one box, a flex row that does not break between them, so a wrap never leaves the "&" at the end of a line, alone: "A" over "& B". The row's content is centred in it, so where it is a little wider than the third (the "&" beside a name as wide as the third) it overhangs the third on both sides alike. */}
            <span className="sm:hidden"> </span>
            <div className="max-sm:inline-flex max-sm:items-baseline max-sm:justify-center max-sm:gap-[0.3em] sm:contents">
              {amps.map((item) => (
                <Motion key={item.id} item={item} reduced={reduced} onGone={onGone} className="font-normal text-white/70 max-sm:inline-block">
                  &amp;
                </Motion>
              ))}
              <NameColumn slot={1} names={names} reduced={reduced} onGone={onGone} />
            </div>
          </div>
          {/* From `sm` up the line is under the names' box (12px; they are one line), centred on the stage; on a phone it is in the block's flow, a gap under them. */}
          <div className="mt-(--row-gap) grid justify-items-center sm:absolute sm:inset-x-0 sm:top-full sm:mt-3">
            {labels.map((item) => (
              <Motion key={item.id} item={item} reduced={reduced} onGone={onGone} className="col-start-1 row-start-1">
                <CueCall count={item.pairing.sharedCount} />
              </Motion>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * The stage's one link, and its box is the action zone: the poster cluster (a poster is 1.5 times its width tall) padded 56px above, as wide as the timeline's band, down to the
 * stage's bottom, which takes in the posters, "+N more", the line and its dots, the years, the names and the cue's line. Hover cue, keyboard focus and click are all this box:
 * the faces, the montage and the headline are not in a link (no pointer cursor, no click), and the focus ring wraps the zone. `--zone-top` is its top, set on the stage (hero-stage.css; in px, from the line's, which is from the scene's height: a percentage would be of the link's own box where it is used for the content's offset). Its content
 * (`Action`) is drawn on the stage's own coordinates: a box as big as the stage's, centred on the zone (which is centred on the stage), as it was when the link was the whole stage.
 */
const ZONE_CLASS =
  "group absolute bottom-0 left-1/2 top-(--zone-top) block w-(--band-w) -translate-x-1/2 rounded-[14px] outline-none! focus-visible:ring-2 focus-visible:ring-focus";
const ZoneContent = ({ children }: { children: ReactNode }) => (
  <div
    aria-hidden="true"
    className={`pointer-events-none absolute left-1/2 -translate-x-1/2 ${CAP_VAR_CLASS}`}
    style={{ top: "calc(-1 * var(--zone-top))", width: "calc(100cqw - 2 * var(--core-pad))", height: "var(--stage-h)" }}
  >
    {children}
  </div>
);

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
      {/* Previous and Next are outside the link, so no control is nested in it. From `sm` up they sit 8px in from the decoration box's outer edges (`--core-pad` in from the screen's) at the stage's middle. On a phone
          they are in the names' row, under the line: Previous centred in the left third of the screen, Next in the right, on the middle of the row (`--row-body`, the box the names are centred in), clear of the faces. */}
      {canStep && (
        <KeycapButton
          direction="prev"
          label="Previous pairing"
          pressed={pressed === "prev"}
          onClick={navigate("prev")}
          className={`${KEYCAP_ROW} left-[calc(100cqw/6-22px)] sm:left-[calc(var(--core-pad)+8px)] ${keycapIn}`}
          onPhoto
          {...focusHandlers}
        />
      )}

      {/* The stage's decoration: not a link, so the faces, the montage and the headline are plain. */}
      {revealed && (
        <div aria-hidden="true" className="absolute inset-x-(--core-pad) inset-y-0">
          <Backdrop items={state.items} reduced={reduced} onGone={onGone} />
        </div>
      )}
      {/* The one link to the pair is the action zone, over it: the posters and everything below them. Its decorative layers carry no text of their own. */}
      {revealed && (
        <Link href={sceneHref(scene)} prefetch={false} aria-label={sceneLabel(scene)} data-stage-link="" {...focusHandlers} className={ZONE_CLASS}>
          <ZoneContent>
            <Action items={state.items} reduced={reduced} onGone={onGone} />
          </ZoneContent>
        </Link>
      )}

      {canStep && (
        <KeycapButton
          direction="next"
          label="Next pairing"
          pressed={pressed === "next"}
          onClick={navigate("next")}
          className={`${KEYCAP_ROW} right-[calc(100cqw/6-22px)] sm:right-[calc(var(--core-pad)+8px)] ${keycapIn}`}
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
 * Its size and spacing come from the variables its section sets (hero.tsx): `--stage-h`, `--gutter` and `--seam`; the rest are derived from them in hero-stage.css, each with its reasons: the stage is as wide as
 * the screen and a size container, so `--core-pad` (what `100cqw` makes of it) is how far in from the screen's edges its decoration box is; `--line-y` is the timeline's line's place down it, `--drop` how far
 * that and all that stands on it is moved down, `--pw` and `--step` the poster cluster's size and spacing, `--axis-pad` and `--axis-w` the dots' axis. `--band-w`, the width of the band the timeline's content
 * is in (hero-layout.ts `BAND`), is set here, from the same TS that the timeline's numbers come from.
 */
export function HeroStage({ pool, fallback }: Props) {
  // False on the server and for the hydrating render, true from the next one: the random pick
  // must not run before then, or the markup would not match the server's.
  const live = useSyncExternalStore(subscribeNever, () => true, () => false);
  const shown = usePanelShown();
  const root = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={root}
      data-hero-stage=""
      className="group/stage relative h-(--stage-h) w-full [container-type:inline-size]"
      style={{ "--band-w": BAND_WIDTH_CSS } as CSSProperties}
    >
      {live && shown ? <LiveStage root={root} pool={pool} /> : null}
      <noscript>
        <div aria-hidden="true" className="absolute inset-x-(--core-pad) inset-y-0">
          <Backdrop items={initialState(fallback, "idle").items} reduced={false} onGone={noop} />
        </div>
        <a href={sceneHref(fallback)} aria-label={sceneLabel(fallback)} className={ZONE_CLASS}>
          <ZoneContent>
            <Action items={initialState(fallback, "idle").items} reduced={false} onGone={noop} />
          </ZoneContent>
        </a>
      </noscript>
    </div>
  );
}
