import { TIMING, type PanelMode } from "@/components/landing/hero-motion";
import { decodedYears, yearAxis } from "@/lib/hero-layout";
import type { HeroPairing, HeroPerson, HeroPoster, Scene, Slot, Transition } from "@/lib/hero-scenes";
import { pairPortraitColors } from "@/lib/portrait-cuts";

/**
 * What is on the landing hero's stage, as plain data (hero-stage.tsx draws it and `Motion` animates it): the pieces that come and go with a scene, and how a
 * scene change marks which leave and which arrive. Pure, so the rules that matter (the panel that stays does not move, the timeline always changes) are tested.
 */

export type Phase = "idle" | "entering" | "leaving";

export interface ItemBase {
  id: string;
  phase: Phase;
  /** Milliseconds before its arrival or its departure starts. */
  delay: number;
  /** A panel's: how it arrives and leaves (hero-motion.ts `PanelMode`); the other pieces ignore it. */
  mode: PanelMode;
}

/**
 * The pieces of the stage that come and go. A panel is one person's side (montage, figure, foot gradient, name) in slot 0 (left) or 1 (right); a poster is one
 * of the scene's posters (`slot` is its place in the chronological row of `count`); the strip is the timeline's dots (each person's films in their colour, the
 * films they made together in white); a year is the cap at the left (0, the year of the first film of either person) or the right (1, the last's) end; the label
 * is "+N more". Items stay mounted (keyed by id) from arrival to departure, so a leaving piece is the very element that was on screen: its images never flicker.
 */
export interface PanelItem extends ItemBase {
  kind: "panel";
  slot: Slot;
  person: HeroPerson;
  /** The person's colour in this scene's pair (`pairPortraitColors`), which a staying person's panel can change with their new partner. */
  color: string;
}
export interface PosterItem extends ItemBase {
  kind: "poster";
  slot: number;
  count: number;
  poster: HeroPoster;
}
export interface StripItem extends ItemBase {
  kind: "strip";
  pairing: HeroPairing;
  /** Each person's colour in this scene's pair, in slot order: the dots of their own films. */
  colors: readonly [string, string];
}
export interface YearItem extends ItemBase {
  kind: "year";
  slot: Slot;
  year: number;
}
export interface LabelItem extends ItemBase {
  kind: "label";
  count: number;
  pairing: HeroPairing;
}
export type Item = PanelItem | PosterItem | StripItem | YearItem | LabelItem;

export interface State {
  scene: Scene;
  /** Number of transitions so far; 0 is the scene the visit opened on. */
  seq: number;
  items: Item[];
}

export const SLOTS = [0, 1] as const;

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

/**
 * The scene's posters, the timeline's dots, the year caps and the "+N more" label: what always changes with the scene. The dots arrive with the first poster
 * (`postersAt`), the caps and the label after the last (`captionsAt`).
 */
function timelineItems(scene: Scene, seq: number, phase: Phase, postersAt: number, captionsAt: number): Item[] {
  const { pairing } = scene;
  const count = pairing.posters.length;
  const axis = yearAxis(decodedYears(pairing.years));
  const colors = [sceneColor(scene, 0), sceneColor(scene, 1)] as const;
  return [
    ...pairing.posters.map(
      (poster, slot): PosterItem => ({ id: `poster-${slot}-${seq}`, kind: "poster", slot, count, poster, phase, delay: postersAt + slot * TIMING.posterStagger, mode: "swap" }),
    ),
    { id: `strip-${seq}`, kind: "strip", pairing, colors, phase, delay: postersAt, mode: "swap" },
    ...(axis
      ? ([
          { id: `year-0-${seq}`, kind: "year", slot: 0, year: axis.first, phase, delay: captionsAt, mode: "swap" },
          { id: `year-1-${seq}`, kind: "year", slot: 1, year: axis.last, phase, delay: captionsAt, mode: "swap" },
        ] satisfies YearItem[])
      : []),
    { id: `label-${seq}`, kind: "label", count, pairing, phase, delay: captionsAt, mode: "swap" },
  ];
}

/** The scene on its first reveal: the frames wipe in (`wipeFrames`) one after the other, then the posters are dealt, then the captions arrive. */
export function initialState(scene: Scene, phase: Phase): State {
  const intro = phase === "entering";
  const postersAt = intro ? TIMING.introPostersDelay : 0;
  const captionsAt = intro ? postersAt + scene.pairing.posters.length * TIMING.posterStagger + TIMING.introCaptionsGap : 0;
  return {
    scene,
    seq: 0,
    items: [
      ...SLOTS.map((slot) => panelItem(scene, slot, `panel-${slot}-0`, phase, intro ? slot * TIMING.introWipeStagger : 0, "intro")),
      ...timelineItems(scene, 0, phase, postersAt, captionsAt),
    ],
  };
}

/**
 * Marks what leaves and adds what arrives, per changed piece: a panel whose person is replaced, and the whole timeline (posters, dots, caps, label), which
 * always changes. A person who stays keeps their panel exactly as it is, unless their colour changes with their new partner (then the same panel
 * cross-fades into the new colour, in place). It works from any state, also one whose last transition is still playing: what was arriving is sent away from
 * where it is, and what was already leaving carries on.
 */
export function applyTransition(state: State, transition: Transition): State {
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
  items.push(...timelineItems(scene, seq, "entering", TIMING.posterArriveDelay, TIMING.captionDelay));
  return { scene, seq, items };
}
