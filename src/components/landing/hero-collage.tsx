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
  type ReactNode,
} from "react";
import { HeroConnector, STAGE, TimelineLine } from "@/components/landing/hero-timeline";
import { TIMING, arrive, depart, float, nod } from "@/components/landing/hero-motion";
import { personImageUrl, posterImageUrl, useHeroRotation } from "@/components/landing/use-hero-rotation";
import { useHeroPause } from "@/components/landing/use-hero-pause";
import {
  isRunning,
  type HeroPairing,
  type Scene,
  type Transition,
} from "@/lib/hero-scenes";
import { buildPeopleSlug } from "@/lib/slug";

interface Props {
  /** Every pairing the hero can rotate through. */
  pool: readonly HeroPairing[];
  /** The scene in the server markup. */
  initial: Scene;
}

type Phase = "idle" | "entering" | "leaving";

/** One card on the stage: a portrait (slot 0 or 1) or a poster (slot 0 to 2). */
interface Item {
  id: string;
  type: "person" | "poster";
  slot: number;
  src: string;
  /** A person's name, or a poster's "Title (year)". */
  text: string;
  phase: Phase;
  delay: number;
  /** The `seq` of the transition in which this person stays and nods; 0 for none. */
  nod: number;
}

interface State {
  scene: Scene;
  /** Number of transitions so far; 0 is the server-rendered scene. */
  seq: number;
  items: Item[];
}

const personItem = (scene: Scene, slot: 0 | 1, id: string, phase: Phase, delay: number): Item => ({
  id,
  type: "person",
  slot,
  src: personImageUrl(scene.people[slot].profilePath),
  text: scene.people[slot].name,
  phase,
  delay,
  nod: 0,
});

const posterItem = (pairing: HeroPairing, slot: number, id: string, phase: Phase, delay: number): Item => ({
  id,
  type: "poster",
  slot,
  src: posterImageUrl(pairing.posters[slot].path),
  text: `${pairing.posters[slot].title} (${pairing.posters[slot].year})`,
  phase,
  delay,
  nod: 0,
});

function initialState(scene: Scene): State {
  return {
    scene,
    seq: 0,
    items: [
      personItem(scene, 0, "person-0-0", "idle", 0),
      personItem(scene, 1, "person-1-0", "idle", 0),
      ...[0, 1, 2].map((slot) => posterItem(scene.pairing, slot, `poster-${slot}-0`, "idle", 0)),
    ],
  };
}

/** Marks what leaves, lets the staying person nod, and adds what arrives. */
function applyTransition(state: State, transition: Transition): State {
  const seq = state.seq + 1;
  const { scene } = transition;
  const posters = scene.pairing.posters;
  const samePoster = (slot: number) => state.scene.pairing.posters[slot]?.path === posters[slot]?.path;

  const items = state.items.map((item): Item => {
    if (item.phase === "leaving") return item;
    if (item.type === "person") {
      if (transition.changed.includes(item.slot as 0 | 1)) return { ...item, phase: "leaving", delay: 0 };
      return transition.stayed === item.slot ? { ...item, nod: seq } : item;
    }
    if (samePoster(item.slot)) return item;
    return { ...item, phase: "leaving", delay: item.slot * TIMING.posterLeaveStagger };
  });

  for (const slot of transition.changed) {
    items.push(personItem(scene, slot, `person-${slot}-${seq}`, "entering", TIMING.personArriveDelay + slot * 80));
  }
  for (let slot = 0; slot < posters.length; slot++) {
    if (samePoster(slot)) continue;
    items.push(
      posterItem(scene.pairing, slot, `poster-${slot}-${seq}`, "entering", TIMING.posterArriveDelay + slot * TIMING.posterStagger),
    );
  }
  return { scene, seq, items };
}

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";
function subscribeReduced(onChange: () => void) {
  const query = window.matchMedia(REDUCED_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
const useReducedMotion = () =>
  useSyncExternalStore(subscribeReduced, () => window.matchMedia(REDUCED_QUERY).matches, () => false);

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
  const { phase, delay, nod: nodAt } = item;

  useLayoutEffect(() => {
    const element = ref.current;
    if (phase !== "entering" || !element) return;
    const animations = arrive(element, kind, { reduced, delay });
    return () => animations.forEach((animation) => animation.cancel());
    // Only on arrival: later renders must not restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    const element = ref.current;
    if (phase !== "leaving" || !element) return;
    const animations = depart(element, kind, { reduced, delay });
    Promise.all(animations.map((animation) => animation.finished)).then(
      () => onGone(item.id),
      () => {}, // cancelled by an unmount
    );
    return () => animations.forEach((animation) => animation.cancel());
  }, [phase, kind, reduced, delay, onGone, item.id]);

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

function PersonCard({ item, tilt, priority, flip }: { item: Item; tilt: number; priority: boolean; flip: boolean }) {
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
        // The first portrait may be the page's largest paint; the rest are not needed to paint it.
        {...(priority ? { fetchPriority: "high" as const } : { decoding: "async" as const })}
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

function PosterCard({ item, tilt }: { item: Item; tilt: number }) {
  return (
    <div
      title={item.text}
      className="absolute inset-0 overflow-hidden rounded-[6px] bg-surface shadow-[0_0_0_1px_var(--lit),0_0_14px_-3px_var(--lit-glow),0_10px_18px_-6px_rgb(0_0_0/0.7)] transition-shadow duration-300 group-hover:shadow-[0_0_0_1.5px_var(--lit),0_0_20px_-2px_var(--lit-glow),0_10px_18px_-6px_rgb(0_0_0/0.7)] group-focus-visible:shadow-[0_0_0_2px_var(--focus),0_0_18px_-2px_var(--focus),0_10px_18px_-6px_rgb(0_0_0/0.7)]"
      style={{ rotate: `${tilt}deg` }}
    >
      <img
        src={item.src}
        alt=""
        width={STAGE.posterSize.width}
        height={STAGE.posterSize.height}
        // Posters that arrive later were preloaded, so they load at once; the first ones may wait.
        loading={item.id.endsWith("-0") ? "lazy" : "eager"}
        decoding="async"
        draggable={false}
        className="absolute inset-0 size-full select-none object-cover"
      />
    </div>
  );
}

export function HeroCollage({ pool, initial }: Props) {
  const reduced = useReducedMotion();
  // null until the visitor presses the button: then the preference decides (paused if reduced).
  const [choice, setChoice] = useState<boolean | null>(null);
  const paused = choice ?? reduced;

  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [state, setState] = useState(() => initialState(initial));

  const { reasons, set } = useHeroPause(root, paused);
  const running = isRunning(reasons);
  useHeroRotation({
    pool,
    initial,
    running,
    onTransition: (transition) => setState((current) => applyTransition(current, transition)),
  });

  const onGone = useCallback((id: string) => {
    setState((current) => ({ ...current, items: current.items.filter((item) => item.id !== id) }));
  }, []);
  const onFocusChange = useCallback((focused: boolean) => set("focus", focused), [set]);

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
  }, [reduced]);

  const byType = (type: Item["type"], slot: number) =>
    state.items.filter((item) => item.type === type && item.slot === slot);

  const { scene } = state;
  const count = scene.pairing.sharedCount;
  const label = `${scene.people.map((person) => person.name).join(" and ")}: ${count} ${
    count === 1 ? "film" : "films"
  } together`;
  const href = `/p/${buildPeopleSlug(scene.people.map(({ id, name }) => ({ id, name })))}`;
  // The people and posters lift a little when the link is hovered or focused.
  const lift =
    "transition-[translate] duration-300 ease-out motion-safe:group-hover:-translate-y-1.5 motion-safe:group-focus-visible:-translate-y-1.5";

  return (
    <div
      ref={root}
      data-hero-collage=""
      className="relative mx-auto h-[calc(var(--s)_*_446px)] w-[calc(var(--s)_*_380px)] shrink-0 [--s:.56] sm:[--s:.66] lg:[--s:.7] wide:[--s:.76]"
    >
      <TimelineLine />
      {/* The whole collage is one link to the pair; its decorative images carry no text of their own. */}
      <Link
        href={href}
        prefetch={false}
        aria-label={label}
        onFocus={(event) => onFocusChange(event.currentTarget.matches(":focus-visible"))}
        onBlur={() => onFocusChange(false)}
        className="group absolute inset-0 block rounded-3xl outline-none!"
      >
        <div
          ref={stage}
          aria-hidden="true"
          className="absolute left-0 top-0 origin-top-left scale-[var(--s)]"
          style={{ width: STAGE.width, height: STAGE.height }}
        >
          {/* Atmosphere: a soft green glow and a little grain, feathered so no edge shows. */}
          <div className="pointer-events-none absolute -left-32 -top-16 h-[640px] w-[640px] bg-[radial-gradient(closest-side,rgb(0_224_84/0.16),transparent)]" />
          <div
            className="pointer-events-none absolute -left-24 -top-12 h-[560px] w-[560px] opacity-[0.07] [mask-image:radial-gradient(closest-side,#000_35%,transparent)]"
            style={{ backgroundImage: GRAIN }}
          />

          <HeroConnector seq={state.seq} reduced={reduced} />

          {STAGE.person.map((place, slot) => (
            <div
              key={slot}
              className={`absolute ${lift}`}
              style={{ left: place.left, top: place.top, ...STAGE.personSize, zIndex: 20 - slot * 10 }}
            >
              <div data-drift="" data-kind="person" data-depth={slot === 0 ? 5 : -6} className="absolute inset-0">
                {byType("person", slot).map((item) => (
                  <Motion key={item.id} item={item} reduced={reduced} onGone={onGone}>
                    <PersonCard item={item} tilt={place.tilt} priority={item.id === "person-0-0"} flip={slot === 1} />
                  </Motion>
                ))}
              </div>
            </div>
          ))}

          {STAGE.poster.map((place, slot) => (
            <div
              key={slot}
              className={`absolute ${lift}`}
              style={{ left: place.left, top: place.top, ...STAGE.posterSize, zIndex: 12 + slot * 2 }}
            >
              <div data-drift="" data-kind="poster" data-depth={slot === 1 ? 3 : -2.5} className="absolute inset-0">
                {byType("poster", slot).map((item) => (
                  <Motion key={item.id} item={item} reduced={reduced} onGone={onGone}>
                    <PosterCard item={item} tilt={place.tilt} />
                  </Motion>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Link>

      {/* Beside the collage, outside the link: low-contrast until hovered or focused, never hidden. */}
      <button
        type="button"
        onClick={() => setChoice(!paused)}
        aria-pressed={paused}
        aria-label={paused ? "Play hero animation" : "Pause hero animation"}
        className="absolute left-full top-1 ml-1.5 flex size-8 items-center justify-center rounded-full border border-transparent text-muted/80 transition-colors hover:border-border hover:text-strong focus-visible:border-border focus-visible:text-strong"
      >
        {paused ? (
          <Play size={14} strokeWidth={2} aria-hidden="true" fill="currentColor" />
        ) : (
          <Pause size={14} strokeWidth={2} aria-hidden="true" fill="currentColor" />
        )}
      </button>
    </div>
  );
}
