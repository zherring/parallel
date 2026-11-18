import { describe, expect, it } from "vitest";
import { canonicalPeoplePath } from "@/lib/canonical-people";

describe("canonicalPeoplePath", () => {
  it("uses the homepage's curated order even when it is not numeric", () => {
    const ford = { id: 3, name: "Harrison Ford" };
    const lucas = { id: 1, name: "George Lucas" };
    expect(canonicalPeoplePath([ford, lucas])).toBe("/p/3-harrison-ford+1-george-lucas");
    expect(canonicalPeoplePath([lucas, ford])).toBe(canonicalPeoplePath([ford, lucas]));
  });

  it("sorts uncurated groups numerically without changing the input order", () => {
    const people = Object.freeze([
      { id: 900010, name: "C" },
      { id: 900002, name: "B" },
      { id: 900001, name: "A" },
    ]);
    expect(canonicalPeoplePath(people)).toBe("/p/900001-a+900002-b+900010-c");
    expect(people.map((person) => person.id)).toEqual([900010, 900002, 900001]);
  });

  it("uses current names rather than the curated names", () => {
    expect(canonicalPeoplePath([{ id: 1, name: "New Name" }, { id: 3, name: "Harrison Ford" }]))
      .toBe("/p/3-harrison-ford+1-new-name");
  });

  it("keeps a single person's normal slug", () => {
    expect(canonicalPeoplePath([{ id: 955, name: "Penélope Cruz" }])).toBe("/p/955-penelope-cruz");
  });
});
