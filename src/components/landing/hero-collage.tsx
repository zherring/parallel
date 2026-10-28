"use client";

import Link from "next/link";
import { Pause, Play } from "lucide-react";
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
import { TimelineLine } from "@/components/landing/hero-timeline";
import { KeycapButton } from "@/components/landing/keycap-button";
import { TIMING, arrive, depart, float, nod } from "@/components/landing/hero-motion";
import { personImageUrl, posterImageUrl, preloadScene, useHeroRotation } from "@/components/landing/use-hero-rotation";
import { useHeroKeys } from "@/components/landing/use-hero-keys";
import { useHeroPause } from "@/components/landing/use-hero-pause";
import { useKeycapPress } from "@/components/landing/use-keycap-press";
import type { NavDirection } from "@/lib/hero-history";
import {
  LINE_Y,
  MORE_LEFT,
  MORE_UNDER,
  NO_PLACE,
  PERSON_MID_Y,
  POSTER_SLOTS,
  POSTER_TOP,
  STAGE,
  moreLabelPlace,
  posterPlace,
  posterSlotLeft,
  type Place,
} from "@/lib/hero-layout";
import {
  isRunning,
  moreFilms,
  pickFirstScene,
  type HeroPairing,
  type Scene,
  type Transition,
} from "@/lib/hero-scenes";
import { buildPeopleSlug } from "@/lib/slug";

interface Props {
  /** Every pairing the hero can rotate through. */
  pool: readonly HeroPairing[];
  /** The scene in the server markup, inside a <noscript>: what visitors without JavaScript get. */
  fallback: Scene;
}

type Phase = "idle" | "entering" | "leaving";
/** Which way the cards travel: 1 forward, -1 for Previous (see hero-motion.ts). */
type Dir = 1 | -1;

/**
 * One piece on the stage: a portrait (slot 0 or 1), a poster (slot 0 to 4) or the "+N more"
 * label beside the posters (slot 0).
 */
interface Item {
  id: string;
  type: "person" | "poster" | "label";
  slot: number;
  src: string;
  /** A person's name, a poster's "Title (year)" or the label's "+N more". */
  text: string;
  /** Where a poster or label sits, which depends on how many posters its scene has. */
  place: Place;
  phase: Phase;
  delay: number;
  /** The direction of the transition that brought it in, and then the one that sends it away. */
  dir: Dir;
  /** The `seq` of the transition in which this person stays and nods; 0 for none. */
  nod: number;
}

interface State {
  scene: Scene;
  /** Number of transitions so far; 0 is the scene the visit opened on. */
  seq: number;
  items: Item[];
}

const personItem = (scene: Scene, slot: 0 | 1, id: string, phase: Phase, delay: number, dir: Dir = 1): Item => ({
  id,
  type: "person",
  slot,
  src: personImageUrl(scene.people[slot].profilePath),
  text: scene.people[slot].name,
  place: NO_PLACE,
  phase,
  delay,
  dir,
  nod: 0,
});

const posterItem = (pairing: HeroPairing, slot: number, id: string, phase: Phase, delay: number, dir: Dir = 1): Item => ({
  id,
  type: "poster",
  slot,
  src: posterImageUrl(pairing.posters[slot].path),
  text: `${pairing.posters[slot].title} (${pairing.posters[slot].year})`,
  place: posterPlace(slot, pairing.posters.length),
  phase,
  delay,
  dir,
  nod: 0,
});

/** The "+N more" hint of a pairing with films beyond its posters; null when it shows them all. */
const moreText = (pairing: HeroPairing): string | null => {
  const more = moreFilms(pairing);
  return more > 0 ? `+${more} more` : null;
};

const labelItem = (pairing: HeroPairing, id: string, phase: Phase, delay: number, dir: Dir = 1): Item | null => {
  const text = moreText(pairing);
  if (!text) return null;
  return { id, type: "label", slot: 0, src: "", text, place: moreLabelPlace(pairing.posters.length), phase, delay, dir, nod: 0 };
};

function initialState(scene: Scene): State {
  const label = labelItem(scene.pairing, "label-0", "idle", 0);
  return {
    scene,
    seq: 0,
    items: [
      personItem(scene, 0, "person-0-0", "idle", 0),
      personItem(scene, 1, "person-1-0", "idle", 0),
      ...scene.pairing.posters.map((_, slot) => posterItem(scene.pairing, slot, `poster-${slot}-0`, "idle", 0)),
      ...(label ? [label] : []),
    ],
  };
}

/**
 * Marks what leaves, lets the staying person nod, and adds what arrives. It works from any state,
 * also one whose last transition is still playing: what was arriving is sent away from where it
 * is, and what was already leaving carries on.
 */
function applyTransition(state: State, transition: Transition, dir: Dir): State {
  const seq = state.seq + 1;
  const { scene } = transition;
  const posters = scene.pairing.posters;
  // The row is centred, so a poster holds its place only if the row is as long as it was.
  const sameRow = state.scene.pairing.posters.length === posters.length;
  const samePoster = (slot: number) => sameRow && state.scene.pairing.posters[slot]?.path === posters[slot]?.path;
  const sameMore = sameRow && moreText(state.scene.pairing) === moreText(scene.pairing);

  const items = state.items.map((item): Item => {
    if (item.phase === "leaving") return item;
    if (item.type === "label") return sameMore ? item : { ...item, phase: "leaving", delay: 0, dir };
    if (item.type === "person") {
      if (transition.changed.includes(item.slot as 0 | 1)) return { ...item, phase: "leaving", delay: 0, dir };
      return transition.stayed === item.slot ? { ...item, nod: seq } : item;
    }
    if (samePoster(item.slot)) return item;
    return { ...item, phase: "leaving", delay: item.slot * TIMING.posterLeaveStagger, dir };
  });

  for (const slot of transition.changed) {
    items.push(personItem(scene, slot, `person-${slot}-${seq}`, "entering", TIMING.personArriveDelay + slot * 80, dir));
  }
  for (let slot = 0; slot < posters.length; slot++) {
    if (samePoster(slot)) continue;
    items.push(
      posterItem(scene.pairing, slot, `poster-${slot}-${seq}`, "entering", TIMING.posterArriveDelay + slot * TIMING.posterStagger, dir),
    );
  }
  // The label comes in just after the last poster is dealt.
  const label = sameMore
    ? null
    : labelItem(scene.pairing, `label-${seq}`, "entering", TIMING.posterArriveDelay + posters.length * TIMING.posterStagger, dir);
  if (label) items.push(label);
  return { scene, seq, items };
}

/** "Steven Spielberg and Tom Hanks: 6 films together": the link's name and the announcement. */
function sceneLabel(scene: Scene): string {
  const count = scene.pairing.sharedCount;
  return `${scene.people.map((person) => person.name).join(" and ")}: ${count} ${count === 1 ? "film" : "films"} together`;
}

const sceneHref = (scene: Scene) =>
  `/p/${buildPeopleSlug(scene.people.map(({ id, name }) => ({ id, name })))}`;

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";
function subscribeReduced(onChange: () => void) {
  const query = window.matchMedia(REDUCED_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
const useReducedMotion = () =>
  useSyncExternalStore(subscribeReduced, () => window.matchMedia(REDUCED_QUERY).matches, () => false);

const subscribeNever = () => () => {};

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

/** How far each poster slot drifts with the pointer: the middle ones come forward. */
const POSTER_DEPTH = [-2.5, 1, 3, 1, -2.5];

const GRAIN = `url("data:image/svg+xml,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .9 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>",
)}")`;

/**
 * Runs the arrive, depart and nod animations of one card on its own wrapper, which is the only
 * element they move. Items stay mounted (keyed by id) from arrival to departure, so a leaving
 * card is the very element that was on screen: its image never flickers.
 */
function Motion({
  item,
  reduced,
  onGone,
  children,
}: {
  item: Item;
  reduced: boolean;
  onGone: (id: string) => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const kind = item.type;
  const { phase, delay, nod: nodAt, dir } = item;

  useLayoutEffect(() => {
    const element = ref.current;
    if (phase !== "entering" || !element) return;
    const animations = arrive(element, kind, { reduced, delay, dir });
    return () => animations.forEach((animation) => animation.cancel());
    // Only on arrival: later renders must not restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    const element = ref.current;
    if (phase !== "leaving" || !element) return;
    const animations = depart(element, kind, { reduced, delay, dir });
    Promise.all(animations.map((animation) => animation.finished)).then(
      () => onGone(item.id),
      () => {}, // cancelled by an unmount
    );
    return () => animations.forEach((animation) => animation.cancel());
  }, [phase, kind, reduced, delay, dir, onGone, item.id]);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!nodAt || !element) return;
    const animation = nod(element, { reduced, delay: TIMING.nodDelay });
    return () => animation?.cancel();
  }, [nodAt, reduced]);

  return (
    <div ref={ref} className="absolute inset-0">
      {children}
    </div>
  );
}

function PersonCard({ item, tilt, flip }: { item: Item; tilt: number; flip: boolean }) {
  return (
    <figure
      className="absolute inset-0 m-0 overflow-hidden rounded-[18px] bg-surface shadow-[0_1px_1px_rgb(0_0_0/0.5),0_10px_20px_-6px_rgb(0_0_0/0.55),0_30px_50px_-14px_rgb(0_0_0/0.7)]"
      style={{ rotate: `${tilt}deg` }}
    >
      <img
        src={item.src}
        alt=""
        width={STAGE.personSize.width}
        height={STAGE.personSize.height}
        decoding="async"
        draggable={false}
        className="absolute inset-0 size-full select-none object-cover [object-position:50%_20%]"
      />
      <span aria-hidden="true" className="absolute inset-0 bg-linear-to-t from-black/80 via-black/5 to-transparent" />
      <figcaption
        className={`absolute inset-x-3.5 bottom-3.5 text-[15px] font-semibold leading-tight tracking-[0.015em] text-white [text-shadow:0_1px_10px_rgb(0_0_0/0.6)] max-sm:hidden ${flip ? "text-right" : ""}`}
      >
        {item.text}
      </figcaption>
      <span
        aria-hidden="true"
        className="absolute inset-0 rounded-[18px] ring-1 ring-inset ring-white/15 transition-shadow duration-300 group-hover:ring-2 group-hover:ring-accent-green/70 group-focus-visible:ring-2 group-focus-visible:ring-focus"
      />
    </figure>
  );
}

function PosterCard({ item }: { item: Item }) {
  const { dx, dy, tilt } = item.place;
  return (
    <div
      title={item.text}
      className="absolute inset-0 overflow-hidden rounded-[6px] bg-surface shadow-[0_0_0_1px_var(--lit),0_0_14px_-3px_var(--lit-glow),0_10px_18px_-6px_rgb(0_0_0/0.7)] transition-shadow duration-300 group-hover:shadow-[0_0_0_1.5px_var(--lit),0_0_20px_-2px_var(--lit-glow),0_10px_18px_-6px_rgb(0_0_0/0.7)] group-focus-visible:shadow-[0_0_0_2px_var(--focus),0_0_18px_-2px_var(--focus),0_10px_18px_-6px_rgb(0_0_0/0.7)]"
      style={{ translate: `${dx}px ${dy}px`, rotate: `${tilt}deg` }}
    >
      <img
        src={item.src}
        alt=""
        width={STAGE.posterSize.width}
        height={STAGE.posterSize.height}
        decoding="async"
        draggable={false}
        className="absolute inset-0 size-full select-none object-cover"
      />
    </div>
  );
}

/**
 * "+N more" at the right end of the poster row, a quiet pill sitting on the line. It is drawn in
 * the stage's scaled space, so its size is divided by the scale to stay a readable 12px at every
 * width; padding and border are in em and the border's width is counter-scaled the same way. On
 * the narrowest phones there is no room beside the row, so it sits centred under it instead.
 */
function MoreLabel({ item }: { item: Item }) {
  return (
    <span
      aria-hidden="true"
      className="absolute left-0 top-0 -translate-y-1/2 translate-x-(--dx) whitespace-nowrap rounded-full border border-border bg-canvas px-[0.75em] py-[0.3em] font-medium leading-none tracking-[0.02em] text-muted transition-colors duration-300 group-hover:border-accent-green/50 group-hover:text-strong max-[359px]:left-(--under-left) max-[359px]:top-(--under-top) max-[359px]:-translate-x-1/2 max-[359px]:translate-y-0"
      style={
        {
          "--dx": `${item.place.dx}px`,
          "--under-left": `${MORE_UNDER.x - MORE_LEFT}px`,
          "--under-top": `${MORE_UNDER.y - LINE_Y}px`,
          fontSize: "calc(12px / var(--s))",
          borderWidth: "calc(1px / var(--s))",
        } as CSSProperties
      }
    >
      {item.text}
    </span>
  );
}

// The people and posters lift a little when the link is hovered or focused.
const LIFT =
  "transition-[translate] duration-300 ease-out motion-safe:group-hover:-translate-y-1.5 motion-safe:group-focus-visible:-translate-y-1.5";

/**
 * The collage itself, drawn in its own plane (STAGE) and scaled to the room there is: the two
 * portraits, the poster slots and the "+N more" label, with the cards `items` holds. The link
 * around it and its `group` class are the caller's.
 */
function Stage({
  items,
  reduced,
  onGone,
  stageRef,
  className = "",
}: {
  items: readonly Item[];
  reduced: boolean;
  onGone: (id: string) => void;
  stageRef?: RefObject<HTMLDivElement | null>;
  className?: string;
}) {
  const byType = (type: Item["type"], slot: number) =>
    items.filter((item) => item.type === type && item.slot === slot);

  return (
    <div
      ref={stageRef}
      aria-hidden="true"
      className={`absolute left-0 top-0 origin-top-left scale-[var(--s)] ${className}`}
      style={{ width: STAGE.width, height: STAGE.height }}
    >
      {/* Atmosphere: a soft green glow and a little grain, feathered so no edge shows. */}
      <div className="pointer-events-none absolute -left-32 -top-16 h-[640px] w-[640px] bg-[radial-gradient(closest-side,rgb(0_224_84/0.16),transparent)]" />
      <div
        className="pointer-events-none absolute -left-24 -top-12 h-[560px] w-[560px] opacity-[0.07] [mask-image:radial-gradient(closest-side,#000_35%,transparent)]"
        style={{ backgroundImage: GRAIN }}
      />

      {STAGE.person.map((place, slot) => (
        <div
          key={slot}
          className={`absolute ${LIFT}`}
          style={{ left: place.left, top: place.top, ...STAGE.personSize, zIndex: 20 - slot * 10 }}
        >
          <div data-drift="" data-kind="person" data-depth={slot === 0 ? 5 : -6} className="absolute inset-0">
            {byType("person", slot).map((item) => (
              <Motion key={item.id} item={item} reduced={reduced} onGone={onGone}>
                <PersonCard item={item} tilt={place.tilt} flip={slot === 1} />
              </Motion>
            ))}
          </div>
        </div>
      ))}

      {/* The slots of a full row; a card shifts itself within its slot to centre a shorter one. */}
      {Array.from({ length: POSTER_SLOTS }, (_, slot) => (
        <div
          key={slot}
          className={`absolute ${LIFT}`}
          style={{ left: posterSlotLeft(slot), top: POSTER_TOP, ...STAGE.posterSize, zIndex: 12 + slot * 2 }}
        >
          <div data-drift="" data-kind="poster" data-depth={POSTER_DEPTH[slot]} className="absolute inset-0">
            {byType("poster", slot).map((item) => (
              <Motion key={item.id} item={item} reduced={reduced} onGone={onGone}>
                <PosterCard item={item} />
              </Motion>
            ))}
          </div>
        </div>
      ))}

      {/* On the line, past the right end of the row: it stays put while the posters float. */}
      <div className="absolute" style={{ left: MORE_LEFT, top: LINE_Y, zIndex: 30 }}>
        {byType("label", 0).map((item) => (
          <Motion key={item.id} item={item} reduced={reduced} onGone={onGone}>
            <MoreLabel item={item} />
          </Motion>
        ))}
      </div>
    </div>
  );
}

const noop = () => {};

/**
 * A round control beside the collage, outside its link: pause and play (Previous and Next are
 * keycaps, see keycap-button.tsx). The button is 44px square so it is easy to hit; the circle
 * drawn in it is 32px, quiet (low-contrast, never hidden) until the collage is hovered or the
 * button is focused, and a touch screen, which has no hover, keeps the stronger colour.
 */
function RoundButton({
  label,
  pressed,
  className,
  style,
  onClick,
  onFocus,
  onBlur,
  children,
}: {
  label: string;
  pressed?: boolean;
  className: string;
  style?: CSSProperties;
  onClick: () => void;
  onFocus?: (event: FocusEvent<HTMLButtonElement>) => void;
  onBlur?: (event: FocusEvent<HTMLButtonElement>) => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onFocus={onFocus}
      onBlur={onBlur}
      aria-label={label}
      aria-pressed={pressed}
      style={style}
      className={`group/btn absolute flex size-11 items-center justify-center rounded-full outline-none! ${className}`}
    >
      <span
        aria-hidden="true"
        className="flex size-8 items-center justify-center rounded-full border border-transparent bg-canvas/0 text-muted/70 transition-colors duration-200 group-hover/collage:border-border group-hover/collage:text-body group-hover/btn:border-accent-green/60 group-hover/btn:bg-surface/80 group-hover/btn:text-strong group-focus-visible/btn:border-border group-focus-visible/btn:bg-surface/80 group-focus-visible/btn:text-strong group-focus-visible/btn:outline-2 group-focus-visible/btn:outline-offset-2 group-focus-visible/btn:outline-focus [@media(hover:none)]:border-border [@media(hover:none)]:text-body"
      >
        {children}
      </span>
    </button>
  );
}

/** Where Previous and Next sit: centred on the portraits, a hair outside the collage's edges. */
const SIDE_BUTTON_STYLE: CSSProperties = { top: `calc(var(--s) * ${PERSON_MID_Y}px)` };

/**
 * The live collage: a scene picked at random once this mounts in the browser, then the automatic
 * rotation and the visitor's Previous and Next (buttons and arrow keys), the pause button, and a
 * polite live region that names the scene after a button or key, never after the rotation. All
 * the ways to hold the rotation still are in useHeroPause; the controls call `go`.
 */
function Collage({
  root,
  pool,
  initial,
}: {
  root: RefObject<HTMLDivElement | null>;
  pool: readonly HeroPairing[];
  initial: Scene;
}) {
  const reduced = useReducedMotion();
  // null until the visitor presses the button: then the preference decides (paused if reduced).
  const [choice, setChoice] = useState<boolean | null>(null);
  const paused = choice ?? reduced;

  const stage = useRef<HTMLDivElement>(null);
  const [state, setState] = useState(() => initialState(initial));
  const [announcement, setAnnouncement] = useState("");
  // The scene fades in once its images are in, so the cards never show empty.
  const [revealed, setRevealed] = useState(false);

  const { reasons, set } = useHeroPause(root, paused);
  const running = isRunning(reasons) && revealed;
  const { go, warm } = useHeroRotation({
    pool,
    initial,
    running,
    onTransition: (transition, direction, cause) => {
      setState((current) => applyTransition(current, transition, direction === "prev" ? -1 : 1));
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
  // change under someone who is about to press a button (not on pause: pressing play must play).
  const focusHandlers = {
    onFocus: (event: FocusEvent<HTMLElement>) => {
      warm();
      set("focus", event.currentTarget.matches(":focus-visible"));
    },
    onBlur: () => set("focus", false),
  };

  // The idle float: slow, small, out of phase. Runs only while the rotation does.
  const floats = useRef<Animation[]>([]);
  useEffect(() => {
    const element = stage.current;
    if (!element || reduced) return;
    const layers = element.querySelectorAll<HTMLElement>("[data-drift]");
    const animations = [...layers].map((layer, index) =>
      float(layer, {
        amplitude: layer.dataset.kind === "poster" ? 2 : 3,
        period: 3600 + index * 530,
        phase: (index * 0.37) % 1,
      }),
    );
    floats.current = animations;
    return () => {
      animations.forEach((animation) => animation.cancel());
      floats.current = [];
    };
  }, [reduced]);
  useEffect(() => {
    for (const animation of floats.current) {
      if (running) animation.play();
      else animation.pause();
    }
  }, [running, reduced]);

  // Pointer parallax: the cards drift a few pixels, smoothed, opposite ways. Mouse only.
  useEffect(() => {
    const element = stage.current;
    const section = root.current?.closest("section");
    if (!element || !section || reduced) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const layers = [...element.querySelectorAll<HTMLElement>("[data-depth]")];
    let targetX = 0;
    let targetY = 0;
    let x = 0;
    let y = 0;
    let frame = 0;
    const tick = () => {
      x += (targetX - x) * 0.08;
      y += (targetY - y) * 0.08;
      for (const layer of layers) {
        const depth = Number(layer.dataset.depth);
        layer.style.translate = `${(x * depth).toFixed(2)}px ${(y * depth).toFixed(2)}px`;
      }
      frame = Math.abs(targetX - x) + Math.abs(targetY - y) > 0.002 ? requestAnimationFrame(tick) : 0;
    };
    const kick = () => {
      if (!frame) frame = requestAnimationFrame(tick);
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const box = section.getBoundingClientRect();
      targetX = ((event.clientX - box.left) / box.width - 0.5) * 2;
      targetY = ((event.clientY - box.top) / box.height - 0.5) * 2;
      kick();
    };
    const leave = () => {
      targetX = 0;
      targetY = 0;
      kick();
    };
    section.addEventListener("pointermove", move, { passive: true });
    section.addEventListener("pointerleave", leave);
    return () => {
      section.removeEventListener("pointermove", move);
      section.removeEventListener("pointerleave", leave);
      cancelAnimationFrame(frame);
      for (const layer of layers) layer.style.translate = "";
    };
  }, [root, reduced]);

  const { scene } = state;
  const navigate = (direction: NavDirection) => () => step(direction);
  // With a single pairing in the pool there is nowhere to step to.
  const canStep = pool.length > 1;

  return (
    <>
      {/* Previous, Next and pause sit beside the collage, outside the link, so no control is nested in it. */}
      {canStep && (
        <KeycapButton
          direction="prev"
          label="Previous pairing"
          pressed={pressed === "prev"}
          onClick={navigate("prev")}
          className="right-full mr-[3px] -translate-y-1/2"
          style={SIDE_BUTTON_STYLE}
          {...focusHandlers}
        />
      )}

      {/* The whole collage is one link to the pair; its decorative images carry no text of their own. */}
      <Link
        href={sceneHref(scene)}
        prefetch={false}
        aria-label={sceneLabel(scene)}
        {...focusHandlers}
        className="group absolute inset-0 block rounded-3xl outline-none!"
      >
        <Stage
          items={state.items}
          reduced={reduced}
          onGone={onGone}
          stageRef={stage}
          className={revealed ? "opacity-100 motion-safe:transition-opacity motion-safe:duration-500" : "opacity-0"}
        />
      </Link>

      {canStep && (
        <KeycapButton
          direction="next"
          label="Next pairing"
          pressed={pressed === "next"}
          onClick={navigate("next")}
          className="left-full ml-[3px] -translate-y-1/2"
          style={SIDE_BUTTON_STYLE}
          {...focusHandlers}
        />
      )}

      <RoundButton
        label={paused ? "Play hero animation" : "Pause hero animation"}
        pressed={paused}
        onClick={() => setChoice(!paused)}
        className="-top-0.5 left-full ml-[3px]"
      >
        {paused ? (
          <Play size={14} strokeWidth={2} aria-hidden="true" fill="currentColor" />
        ) : (
          <Pause size={14} strokeWidth={2} aria-hidden="true" fill="currentColor" />
        )}
      </RoundButton>

      {/* Said after Previous or Next, not after the rotation changes the scene by itself. */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
    </>
  );
}

/** Picks the scene this visit opens on, in the browser only (it is random), then runs the collage. */
function LiveCollage({ root, pool }: { root: RefObject<HTMLDivElement | null>; pool: readonly HeroPairing[] }) {
  const [initial] = useState(() => pickFirstScene(pool, Math.random, lastFirstKey()));
  return initial ? <Collage root={root} pool={pool} initial={initial} /> : null;
}

/**
 * The hero's collage. The page is prerendered, so the server cannot choose a scene at random and
 * renders only an empty, fixed-size, aria-hidden stage (the timeline line is the same for every
 * scene) plus the default scene in a <noscript>, which gives crawlers and visitors without
 * JavaScript a real link, and costs everyone else no image requests, as the browser does not
 * parse a <noscript> when scripts run. Once hydrated, the browser picks the scene at random and
 * fades it in. The box has its final size from the first paint, so nothing shifts.
 */
export function HeroCollage({ pool, fallback }: Props) {
  // False on the server and for the hydrating render, true from the next one: the random pick
  // must not run before then, or the markup would not match the server's.
  const live = useSyncExternalStore(subscribeNever, () => true, () => false);
  const root = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={root}
      data-hero-collage=""
      className="group/collage relative mx-auto shrink-0 [--s:.56] sm:[--s:.66] lg:[--s:.7] wide:[--s:.76]"
      style={{ width: `calc(var(--s) * ${STAGE.width}px)`, height: `calc(var(--s) * ${STAGE.height}px)` }}
    >
      <TimelineLine />
      {live ? <LiveCollage root={root} pool={pool} /> : <div aria-hidden="true" data-hero-stage="" className="absolute inset-0" />}
      <noscript>
        <a
          href={sceneHref(fallback)}
          aria-label={sceneLabel(fallback)}
          className="group absolute inset-0 block rounded-3xl outline-none!"
        >
          <Stage items={initialState(fallback).items} reduced={false} onGone={noop} />
        </a>
      </noscript>
    </div>
  );
}
