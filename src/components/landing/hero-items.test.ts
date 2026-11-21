import { describe, expect, it } from "vitest";
import { applyTransition, initialState, type Item, type NameItem, type PanelItem, type PosterItem, type State, type StripItem, type YearItem } from "@/components/landing/hero-items";
import { TIMING } from "@/components/landing/hero-motion";
import { sceneOf, transitionTo, type HeroPairing, type HeroPerson, type Transition } from "@/lib/hero-scenes";
import { pairPortraitColors } from "@/lib/portrait-cuts";

const person = (id: number): HeroPerson => ({ id, name: `Person ${id}`, profilePath: `/p${id}.jpg` });

function pairing(a: number, b: number, posterCount = 5, sharedCount = 9): HeroPairing {
  const [low, high] = a < b ? [a, b] : [b, a];
  return {
    key: `${low}+${high}`,
    sharedCount,
    // Delta-coded: the first film of either person is in 1970 + a (when a is small) and the last, a film they made together, in 2000 + b.
    years: { own: [[1970 + a, 3], [1975 + b, 2]], together: [1980, 20, b] },
    people: [person(a), person(b)],
    posters: Array.from({ length: posterCount }, (_, i) => ({ path: `/f${a}-${b}-${i}.jpg`, title: `Film ${i}`, year: 1980 + i })),
  };
}

const panels = (items: readonly Item[]) => items.filter((item): item is PanelItem => item.kind === "panel");
const names = (items: readonly Item[]) => items.filter((item): item is NameItem => item.kind === "name");
const posters = (items: readonly Item[]) => items.filter((item): item is PosterItem => item.kind === "poster");
const years = (items: readonly Item[]) => items.filter((item): item is YearItem => item.kind === "year");
const strips = (items: readonly Item[]) => items.filter((item): item is StripItem => item.kind === "strip");
const staying = (items: readonly Item[]) => items.filter((item) => item.phase !== "leaving");
const leaving = (items: readonly Item[]) => items.filter((item) => item.phase === "leaving");

/** Two people whose colour is the same in the pair (a, b) as in the pair (a, c), and two for whom it is not (the pair's colour steps one of them). */
function collidingIds(): { a: number; b: number; c: number } {
  for (let a = 1; a < 200; a++) {
    for (let b = 1; b < 200; b++) {
      if (b === a) continue;
      for (let c = b + 1; c < 200; c++) {
        if (c === a) continue;
        if (pairPortraitColors(a, b)[0] !== pairPortraitColors(a, c)[0]) return { a, b, c };
      }
    }
  }
  throw new Error("no ids whose colour depends on the partner");
}

describe("initialState", () => {
  it("has a panel and a name for each person, the one \"&\", a poster for each of the pairing's, the timeline's strip of dots, the two year caps and the label", () => {
    const state = initialState(sceneOf(pairing(3, 1)), "idle");
    expect(panels(state.items).map((item) => [item.slot, item.person.id])).toEqual([[0, 3], [1, 1]]);
    expect(names(state.items).map((item) => [item.slot, item.person.id])).toEqual([[0, 3], [1, 1]]);
    expect(state.items.filter((item) => item.kind === "amp")).toHaveLength(1);
    expect(posters(state.items).map((item) => [item.slot, item.count])).toEqual([[0, 5], [1, 5], [2, 5], [3, 5], [4, 5]]);
    expect(years(state.items).map((item) => [item.slot, item.year])).toEqual([[0, 1973], [1, 2001]]);
    expect(state.items.filter((item) => item.kind === "label")).toHaveLength(1);
    expect(strips(state.items)).toHaveLength(1);
    expect(new Set(state.items.map((item) => item.id)).size).toBe(state.items.length);
    expect(state.items.every((item) => item.phase === "idle")).toBe(true);
  });

  it("gives each panel its person's colour in the pair, whichever order the pair is in", () => {
    const [first, second] = pairPortraitColors(3, 1);
    const state = initialState(sceneOf(pairing(3, 1)), "idle");
    expect(panels(state.items).map((item) => item.color)).toEqual([first, second]);
    expect(pairPortraitColors(1, 3)).toEqual([second, first]);
  });

  it("gives the strip each person's colour in the pair, in slot order, so their dots are the colour of their panel", () => {
    const [first, second] = pairPortraitColors(3, 1);
    const [strip] = strips(initialState(sceneOf(pairing(3, 1)), "idle").items);
    expect(strip.colors).toEqual([first, second]);
    expect(strip.pairing.key).toBe("1+3");
  });

  it("is the first reveal when its items are entering: the panels one after the other, then the posters in chronological order, then the captions", () => {
    const { items } = initialState(sceneOf(pairing(3, 1)), "entering");
    expect(items.every((item) => item.phase === "entering")).toBe(true);
    expect(panels(items).map((item) => [item.mode, item.delay])).toEqual([["intro", 0], ["intro", TIMING.introWipeStagger]]);
    // Each name comes up with its panel's figure, and the "&" with the second.
    expect(names(items).map((item) => [item.mode, item.delay])).toEqual([["intro", 0], ["intro", TIMING.introWipeStagger]]);
    expect(items.find((item) => item.kind === "amp")?.delay).toBe(TIMING.introWipeStagger);
    const delays = posters(items).map((item) => item.delay);
    expect(delays[0]).toBe(TIMING.introPostersDelay);
    expect(delays).toEqual([...delays].sort((a, b) => a - b));
    expect(new Set(delays).size).toBe(delays.length);
    for (const year of years(items)) expect(year.delay).toBeGreaterThan(delays.at(-1)!);
    // The dots start popping in with the first poster, ahead of the captions.
    expect(strips(items)[0].delay).toBe(delays[0]);
  });
});

describe("applyTransition", () => {
  const start = (a: number, b: number): State => initialState(sceneOf(pairing(a, b)), "entering");
  const single = (from: State, next: HeroPairing): Transition => transitionTo(from.scene, next);

  it("on a single swap leaves the panel that stays exactly as it was, and replaces the other", () => {
    const before = start(3, 1);
    const next = applyTransition(before, single(before, pairing(3, 488)));
    const [kept, replaced] = [panels(before.items)[0], panels(before.items)[1]];
    // Ford (3) stays in slot 0: the very same item, not marked leaving, not given a new colour or delay.
    expect(next.items).toContain(kept);
    expect(panels(next.items).filter((item) => item.slot === 0)).toHaveLength(1);
    // Lucas (1) in slot 1 leaves, and Spielberg (488) arrives there.
    const slotOne = panels(next.items).filter((item) => item.slot === 1);
    expect(slotOne.map((item) => [item.person.id, item.phase])).toEqual([[1, "leaving"], [488, "entering"]]);
    expect(slotOne[0].id).toBe(replaced.id);
    expect(slotOne[0].mode).toBe("swap");
    expect(slotOne[1].mode).toBe("swap");
  });

  it("on a single swap slides only the changed person's name: the other name and the \"&\" are the very same items, still", () => {
    const before = start(3, 1);
    const next = applyTransition(before, single(before, pairing(3, 488)));
    const [keptName, replacedName] = names(before.items);
    const amp = before.items.find((item) => item.kind === "amp")!;
    expect(next.items).toContain(keptName);
    expect(next.items).toContain(amp);
    expect(names(next.items).filter((item) => item.slot === 0)).toHaveLength(1);
    expect(names(next.items).filter((item) => item.slot === 1).map((item) => [item.person.id, item.phase])).toEqual([[1, "leaving"], [488, "entering"]]);
    expect(names(next.items).find((item) => item.id === replacedName.id)?.phase).toBe("leaving");
    // The "&" is never replaced, whatever changes, and a colour change under a person's panel leaves their name alone too.
    let state = before;
    for (const change of [pairing(3, 488), pairing(10, 11), pairing(10, 4)]) {
      state = applyTransition(state, transitionTo(state.scene, change));
      expect(state.items.filter((item) => item.kind === "amp")).toEqual([amp]);
    }
  });

  it("on a full swap replaces both panels", () => {
    const before = start(3, 1);
    const next = applyTransition(before, transitionTo(before.scene, pairing(10, 11)));
    expect(panels(next.items).filter((item) => item.phase === "leaving").map((item) => item.slot)).toEqual([0, 1]);
    expect(panels(next.items).filter((item) => item.phase === "entering").map((item) => item.person.id)).toEqual([10, 11]);
    // The second panel follows the first.
    const arriving = panels(next.items).filter((item) => item.phase === "entering");
    expect(arriving[1].delay - arriving[0].delay).toBe(TIMING.panelStagger);
  });

  it("always replaces the timeline: every poster, the strip of dots, the year caps and the label leave, and new ones arrive in chronological order", () => {
    const before = start(3, 1);
    const next = applyTransition(before, single(before, pairing(3, 488, 4, 6)));
    const gone = leaving(next.items).filter((item) => item.kind !== "panel");
    expect(gone.map((item) => item.kind).sort()).toEqual(["label", "name", "poster", "poster", "poster", "poster", "poster", "strip", "year", "year"]);
    const arriving = next.items.filter((item) => item.phase === "entering" && item.kind !== "panel" && item.kind !== "name");
    expect(posters(arriving)).toHaveLength(4);
    expect(posters(arriving).map((item) => item.slot)).toEqual([0, 1, 2, 3]);
    const delays = posters(arriving).map((item) => item.delay);
    expect(delays[0]).toBe(TIMING.posterArriveDelay);
    expect(delays).toEqual([...delays].sort((a, b) => a - b));
    expect(years(arriving).map((item) => item.year)).toEqual([1973, 2000 + 488]);
    // The leaving posters drop one after the other, left to right.
    const drops = posters(gone).map((item) => item.delay);
    expect(drops).toEqual([0, 1, 2, 3, 4].map((slot) => slot * TIMING.posterLeaveStagger));
  });

  it("gives every item an id of its own, across any number of changes", () => {
    let state = start(3, 1);
    for (const next of [pairing(3, 488), pairing(488, 31), pairing(31, 4), pairing(5, 6)]) {
      state = applyTransition(state, transitionTo(state.scene, next));
      expect(new Set(state.items.map((item) => item.id)).size).toBe(state.items.length);
    }
    expect(state.seq).toBe(4);
    expect(state.scene.pairing.key).toBe("5+6");
  });

  it("from a state whose last change is still playing, sends away what was arriving and leaves what was already leaving alone", () => {
    const first = applyTransition(start(3, 1), transitionTo(sceneOf(pairing(3, 1)), pairing(3, 488)));
    const alreadyLeaving = leaving(first.items);
    const second = applyTransition(first, transitionTo(first.scene, pairing(488, 31)));
    for (const item of alreadyLeaving) expect(second.items).toContain(item);
    // What arrived in the first change now leaves (the new timeline and Spielberg's panel, which is the one to stay in the second: he stays).
    expect(staying(second.items).filter((item) => item.kind === "poster")).toHaveLength(pairing(488, 31).posters.length);
    expect(panels(second.items).filter((item) => item.person.id === 488 && item.phase !== "leaving")).toHaveLength(1);
  });

  it("when the person who stays changes colour with a new partner, cross-fades the same panel in place instead of leaving it", () => {
    const { a, b, c } = collidingIds();
    const before = start(a, b);
    const next = applyTransition(before, transitionTo(before.scene, pairing(a, c)));
    const slot = before.scene.people[0].id === a ? 0 : 1;
    const ofA = panels(next.items).filter((item) => item.slot === slot);
    expect(ofA.map((item) => [item.person.id, item.phase, item.mode])).toEqual([[a, "leaving", "recolour"], [a, "entering", "recolour"]]);
    expect(ofA[0].color).not.toBe(ofA[1].color);
    expect(ofA[1].color).toBe(pairPortraitColors(a, c)[0]);
    // Nothing moves in it: no delay, and the other slot is a plain swap.
    expect(ofA[1].delay).toBe(0);
  });

  it("when the person who stays keeps their colour, does not touch their panel at all", () => {
    let found = false;
    for (let a = 1; a < 100 && !found; a++) {
      for (let c = 1; c < 100 && !found; c++) {
        const b = 500;
        if (a === c || pairPortraitColors(a, b)[0] !== pairPortraitColors(a, c)[0]) continue;
        found = true;
        const before = start(a, b);
        const next = applyTransition(before, transitionTo(before.scene, pairing(a, c)));
        const slot = before.scene.people[0].id === a ? 0 : 1;
        expect(panels(next.items).filter((item) => item.slot === slot)).toEqual(panels(before.items).filter((item) => item.slot === slot));
      }
    }
    expect(found).toBe(true);
  });
});
