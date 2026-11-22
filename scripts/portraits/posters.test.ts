import { describe, expect, it } from "vitest";
import { BACKDROP_POSTERS, CORE_POSTERS, EXTENSION_POSTERS } from "../../src/lib/backdrop-posters";
import type { PortraitCuts } from "../../src/lib/portrait-cuts";
import { acceptedShortLists } from "./posters";

/** A person whose core and extension hold `distinct` different posters (the lists repeat the last ones to fill their tiles). */
const person = (name: string, distinct: number): { cut: PortraitCuts[string]; backdrop: string[] } => {
  const all = Array.from({ length: BACKDROP_POSTERS }, (_, index) => `/${name.replace(/\W/g, "")}${Math.min(index, distinct - 1)}.jpg`);
  return { cut: { name, posters: all.slice(0, CORE_POSTERS) } as PortraitCuts[string], backdrop: all.slice(CORE_POSTERS) };
};

describe("acceptedShortLists", () => {
  const people = { 30: person("Carol", 12), 7: person("Ann", 12), 20: person("Bob", 5), 40: person("Dee", BACKDROP_POSTERS), 50: person("Eve", 3) };
  const cuts = Object.fromEntries(Object.entries(people).map(([id, { cut }]) => [id, cut])) as unknown as PortraitCuts;
  const backdrops = Object.fromEntries(Object.entries(people).map(([id, { backdrop }]) => [id, backdrop]));

  it("has the extension's size the montage needs", () => {
    expect(people[20].backdrop).toHaveLength(EXTENSION_POSTERS);
  });

  it("prints the short landing people as the test's table entries, fewest posters first and by id among equals, and leaves out the full ones and the other people", () => {
    expect(acceptedShortLists(cuts, backdrops, [30, 7, 20, 40])).toEqual(["  20: 5, // Bob", "  7: 12, // Ann", "  30: 12, // Carol"]);
  });

  it("names each person once, and not someone with no stored lists", () => {
    expect(acceptedShortLists(cuts, backdrops, [20, 20, 999])).toEqual(["  20: 5, // Bob"]);
  });
});
