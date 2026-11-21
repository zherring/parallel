import { describe, expect, it } from "vitest";
import examples from "@/lib/examples.generated.json";
import cuts from "@/lib/portrait-cuts.json";
import { PORTRAIT_IDS, type PortraitCuts } from "@/lib/portrait-cuts";
import { PROFILE_OVERRIDES } from "@/lib/profile-overrides";
import type { GeneratedExamples } from "@/lib/examples";

const CUTS = cuts as unknown as PortraitCuts;
const data: GeneratedExamples = examples;
const people = Object.values(data).flatMap((entry) => entry.people);

describe("the landing's people and their cut-outs", () => {
  it("shows every person from the photo their cut-out was made from, so none falls back to a tear", () => {
    for (const person of people) {
      const cut = CUTS[String(person.id)];
      expect(cut, `${person.name} (${person.id}) has no cut; run npm run portraits:cut`).toBeDefined();
      expect(person.profilePath, `${person.name} (${person.id}): examples.generated.json and portrait-cuts.json name different photos`).toBe(cut.profilePath);
    }
  });
});

describe("PROFILE_OVERRIDES", () => {
  const known = new Set([...people.map((person) => person.id), ...PORTRAIT_IDS]);

  it("names only people the app shows (the landing's or the cut script's), so none is dead", () => {
    for (const id of Object.keys(PROFILE_OVERRIDES).map(Number)) expect(known.has(id), `override for ${id} is for nobody in the examples or PORTRAIT_IDS`).toBe(true);
  });

  it("each has a cut made from it (an override changed without `npm run portraits:cut` would show a tear)", () => {
    for (const [id, path] of Object.entries(PROFILE_OVERRIDES)) {
      expect(CUTS[id]?.profilePath, `override for ${id}: run npm run portraits:cut`).toBe(path);
    }
  });

  it("holds TMDB profile paths", () => {
    for (const [id, path] of Object.entries(PROFILE_OVERRIDES)) expect(path, `override for ${id}`).toMatch(/^\/[\w-]+\.(jpg|png)$/);
  });
});
