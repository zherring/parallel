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
import { TIMING, arrive, depart, drawLine, wipeFrames, type PanelMode, type ItemKind } from "@/components/landing/hero-motion";
import { TimelineLine } from "@/components/landing/hero-timeline";
import { posterImageUrl, preloadScene, useHeroRotation } from "@/components/landing/use-hero-rotation";
import { useHeroKeys } from "@/components/landing/use-hero-keys";
import { useHeroPause } from "@/components/landing/use-hero-pause";
import { useKeycapPress } from "@/components/landing/use-keycap-press";
import { useReducedMotion } from "@/components/pair-wash";
import type { NavDirection } from "@/lib/hero-history";
import { isRunning, pickFirstScene, type HeroPairing, type HeroPerson, type HeroPoster, type Scene, type Slot, type Transition } from "@/lib/hero-scenes";
import { pairPortraitColors } from "@/lib/portrait-cuts";
import { buildPeopleSlug } from "@/lib/slug";

interface Props {
  /** Every pairing the hero can rotate through. */
  pool: readonly HeroPairing[];
  /** The scene in the server markup, inside a <noscript>: what visitors without JavaScript get. */
  fallback: Scene;
}

type Phase = "idle" | "entering" | "leaving";

interface ItemBase {
  id: string;
  phase: Phase;
  /** Milliseconds before its arrival or its departure starts. */
  delay: number;
  /** A panel's: how it arrives and leaves (hero-motion.ts `PanelMode`); the other pieces ignore it. */
  mode: PanelMode;
}

/**
 * The pieces of the stage that come and go. A panel is one person's side (montage, figure, name) in slot 0 (left) or 1 (right); a poster is one of the
 * scene's posters (`slot` is its place in the chronological row of `count`); a year is the cap at the left (0, the first shared film's year) or the right
 * (1, the last's) end; the label is "+N more". Items stay mounted (keyed by id) from arrival to departure, so a leaving piece is the very element that
 * was on screen: its images never flicker.
 */
interface PanelItem extends ItemBase {
  kind: "panel";
  slot: Slot;
  person: HeroPerson;
  /** The person's colour in this scene's pair (`pairPortraitColors`), which a staying person's panel can change with their new partner. */
  color: string;
}
interface PosterItem extends ItemBase {
  kind: "poster";
  slot: number;
  count: number;
  poster: HeroPoster;
}
interface YearItem extends ItemBase {
  kind: "year";
  slot: Slot;
  year: number;
}
interface LabelItem extends ItemBase {
  kind: "label";
  count: number;
  pairing: HeroPairing;
}
type Item = PanelItem | PosterItem | YearItem | LabelItem;

interface State {
  scene: Scene;
  /** Number of transitions so far; 0 is the scene the visit opened on. */
  seq: number;
  items: Item[];
}

const SLOTS = [0, 1] as const;

/** Each person's colour in the scene's pair: the colour is the pair's, so the same two people have the same colours here as on their pair page. */
const sceneColor = (scene: Scene, slot: Slot): string => pairPortraitColors(scene.people[slot].id, scene.people[slot === 0 ? 1 : 0].id)[0];

const panelItem = (scene: Scene, slot: Slot, id: string, phase: Phase, delay: number, mode: PanelMode): PanelItem => ({
  id,
  kind: "panel",
  slot,
  person: scene.people[slot],
  color: sceneColor(scene, slot),
  phase,
  delay,
  mode,
});

/** The scene's posters, the year caps and the "+N more" label: what always changes with the scene, and all of it arrives at once (`captionsAt` is when the caps and the label do). */
function timelineItems(pairing: HeroPairing, seq: number, phase: Phase, postersAt: number, captionsAt: number): Item[] {
  const count = pairing.posters.length;
  return [
    ...pairing.posters.map(
      (poster, slot): PosterItem => ({ id: `poster-${slot}-${seq}`, kind: "poster", slot, count, poster, phase, delay: postersAt + slot * TIMING.posterStagger, mode: "swap" }),
    ),
    { id: `year-0-${seq}`, kind: "year", slot: 0, year: pairing.span.first, phase, delay: captionsAt, mode: "swap" },
    { id: `year-1-${seq}`, kind: "year", slot: 1, year: pairing.span.last, phase, delay: captionsAt, mode: "swap" },
    { id: `label-${seq}`, kind: "label", count, pairing, phase, delay: captionsAt, mode: "swap" },
  ];
}

/** The scene on its first reveal: the frames wipe in (`wipeFrames`) one after the other, then the posters are dealt, then the captions arrive. */
function initialState(scene: Scene, phase: Phase): State {
  const intro = phase === "entering";
  const postersAt = intro ? TIMING.introPostersDelay : 0;
  const captionsAt = intro ? postersAt + scene.pairing.posters.length * TIMING.posterStagger + TIMING.introCaptionsGap : 0;
  return {
    scene,
    seq: 0,
    items: [
      ...SLOTS.map((slot) => panelItem(scene, slot, `panel-${slot}-0`, phase, intro ? slot * TIMING.introWipeStagger : 0, "intro")),
      ...timelineItems(scene.pairing, 0, phase, postersAt, captionsAt),
    ],
  };
}

/**
 * Marks what leaves and adds what arrives, per changed piece: a panel whose person is replaced, and the whole timeline (posters, caps, label), which
 * always changes. A person who stays keeps their panel exactly as it is, unless their colour changes with their new partner (then the same panel
 * cross-fades into the new colour, in place). It works from any state, also one whose last transition is still playing: what was arriving is sent away from
 * where it is, and what was already leaving carries on.
 */
function applyTransition(state: State, transition: Transition): State {
  const seq = state.seq + 1;
  const { scene } = transition;
  const recoloured = new Set<Slot>();

  const items = state.items.map((item): Item => {
    if (item.phase === "leaving") return item;
    if (item.kind !== "panel") return { ...item, phase: "leaving", delay: item.kind === "poster" ? item.slot * TIMING.posterLeaveStagger : 0 };
    if (transition.changed.includes(item.slot)) return { ...item, phase: "leaving", delay: item.slot * TIMING.panelStagger, mode: "swap" };
    if (item.color !== sceneColor(scene, item.slot)) {
      recoloured.add(item.slot);
      return { ...item, phase: "leaving", delay: 0, mode: "recolour" };
    }
    return item;
  });

  for (const slot of SLOTS) {
    if (transition.changed.includes(slot)) items.push(panelItem(scene, slot, `panel-${slot}-${seq}`, "entering", slot * TIMING.panelStagger, "swap"));
    else if (recoloured.has(slot)) items.push(panelItem(scene, slot, `panel-${slot}-${seq}`, "entering", 0, "recolour"));
  }
  items.push(
    ...timelineItems(scene.pairing, seq, "entering", TIMING.posterArriveDelay, TIMING.captionDelay),
  );
  return { scene, seq, items };
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

/** The anchor of poster `slot` of a scene with `count` posters: a point on the line. The row is centred on the seam among the posters a width shows (`--cap`, `POSTER_CAPS`). */
const posterAnchor = (slot: number, count: number) => ({
  left: `calc(50% + (${slot} - (min(${count}, var(--cap)) - 1) / 2) * var(--step))`,
  top: "var(--line-y)",
});

/**
 * Everything inside the stage's link: the two panels (frames, with the pieces in them), the scrim that holds the headline, the timeline line, and the
 * posters, "+N more" and year caps on it. Drawn from `items`, with the animations of `Motion`; the noscript scene is the same thing, all idle.
 */
function Layers({ items, reduced, onGone }: { items: readonly Item[]; reduced: boolean; onGone: (id: string) => void }) {
  const panels = items.filter((item): item is PanelItem => item.kind === "panel");
  const posters = items.filter((item): item is PosterItem => item.kind === "poster");
  const years = items.filter((item): item is YearItem => item.kind === "year");
  const labels = items.filter((item): item is LabelItem => item.kind === "label");

  return (
    <>
      <div className="grid h-full grid-cols-2 gap-(--seam)">
        {SLOTS.map((slot) => (
          <div key={slot} data-frame="" className="relative isolate overflow-hidden rounded-[9px] bg-[#0b0d10] [container-type:inline-size]">
            {panels
              .filter((item) => item.slot === slot)
              .map((item) => (
                <Motion key={item.id} item={item} reduced={reduced} onGone={onGone} className="absolute inset-0">
                  <PanelParts person={item.person} color={item.color} slot={slot} />
                </Motion>
              ))}
            {/* A white ring when the stage is hovered, the focus colour when its link has keyboard focus. */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-10 rounded-[9px] ring-1 ring-inset ring-white/15 transition-shadow duration-300 group-hover:ring-2 group-hover:ring-white/70 group-focus-visible:ring-2 group-focus-visible:ring-focus"
            />
          </div>
        ))}
      </div>

      {/* A wide, soft, dark glow behind the headline (which is the section's, over the stage): no edge, so no box. Phones have the headline under the stage. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[34%] hidden h-[58%] w-[min(94%,1020px)] -translate-x-1/2 -translate-y-1/2 sm:block"
        style={{ background: "radial-gradient(closest-side, rgb(7 9 11 / 0.66), rgb(7 9 11 / 0.4) 52%, transparent)" }}
      />

      <TimelineLine />

      {/* Posters, label and caps are anchored on the line; the posters shown are the first of the row, three, four or five by width (`POSTER_CAPS`). */}
      <div className="pointer-events-none absolute inset-0 [--cap:3] sm:[--cap:4] lg:[--cap:5]">
        {posters.map((item) => (
          <div
            key={item.id}
            className={`group/poster absolute size-0 hover:z-20 ${item.slot === 4 ? "max-lg:hidden" : item.slot === 3 ? "max-sm:hidden" : ""}`}
            style={posterAnchor(item.slot, item.count)}
          >
            <Motion item={item} reduced={reduced} onGone={onGone} className="absolute left-0 top-0">
              <PosterParts poster={item.poster} src={posterImageUrl(item.poster.path)} />
            </Motion>
          </div>
        ))}

        {labels.map((item) => (
          // On the line, past the last dot; on a phone, which has no room beside the row (the right year cap is there), centred under it.
          <div
            key={item.id}
            className="absolute top-(--line-y) left-(--label-left) size-0 max-sm:top-[calc(var(--line-y)+32px)] max-sm:left-1/2"
            style={{ "--label-left": `calc(50% + (min(${item.count}, var(--cap)) - 1) / 2 * var(--step) + 20px)` } as CSSProperties}
          >
            <Motion item={item} reduced={reduced} onGone={onGone} className="absolute left-0 top-0 -translate-y-1/2 max-sm:-translate-x-1/2">
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

  const { reasons, set } = useHeroPause(root, reduced);
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
  useHeroKeys({ heroVisible: !reasons.offscreen, onNavigate: step });
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
      {/* Previous and Next sit inside the panels' outer edges at the stage's middle, outside the link, so no control is nested in it. */}
      {canStep && (
        <KeycapButton
          direction="prev"
          label="Previous pairing"
          pressed={pressed === "prev"}
          onClick={navigate("prev")}
          className={`left-[calc(var(--gutter)+8px)] top-1/2 z-20 -translate-y-1/2 ${keycapIn}`}
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
          className="group absolute inset-x-(--gutter) inset-y-0 block outline-none!"
        >
          <div aria-hidden="true" className="absolute inset-0">
            <Layers items={state.items} reduced={reduced} onGone={onGone} />
          </div>
        </Link>
      )}

      {canStep && (
        <KeycapButton
          direction="next"
          label="Next pairing"
          pressed={pressed === "next"}
          onClick={navigate("next")}
          className={`right-[calc(var(--gutter)+8px)] top-1/2 z-20 -translate-y-1/2 ${keycapIn}`}
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
 * The hero's stage, the box under the headline: two portrait panels with the pair's films on a timeline along the bottom. The page is prerendered, so
 * the server cannot choose a scene at random and renders only the empty, fixed-size box plus the default scene in a <noscript>, which gives crawlers and
 * visitors without JavaScript a real link, and costs everyone else no image requests, as the browser does not parse a <noscript> when scripts run. Once
 * hydrated, the browser picks the scene at random and reveals it when its images are in. The box has its final size from the first paint, so nothing shifts.
 * Its size and spacing come from the variables its section sets (hero.tsx): `--stage-h`, `--gutter` and `--seam`; the rest are derived here.
 */
export function HeroStage({ pool, fallback }: Props) {
  // False on the server and for the hydrating render, true from the next one: the random pick
  // must not run before then, or the markup would not match the server's.
  const live = useSyncExternalStore(subscribeNever, () => true, () => false);
  const root = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={root}
      data-hero-stage=""
      // `--pw` is a poster's width, from the box (its width and its height), `--step` the distance between posters; `--line-y` is the line's place down the stage.
      className="group/stage relative mx-auto h-(--stage-h) w-full max-w-[1600px] [--inset:12px] [--line-y:85%] [--pw:clamp(52px,min(6vw,calc(var(--stage-h)*0.15)),104px)] [--step:calc(var(--pw)*1.55)] sm:[--inset:20px]"
    >
      {live ? <LiveStage root={root} pool={pool} /> : null}
      <noscript>
        <a
          href={sceneHref(fallback)}
          aria-label={sceneLabel(fallback)}
          className="group absolute inset-x-(--gutter) inset-y-0 block outline-none!"
        >
          <div aria-hidden="true" className="absolute inset-0">
            <Layers items={initialState(fallback, "idle").items} reduced={false} onGone={noop} />
          </div>
        </a>
      </noscript>
    </div>
  );
}
