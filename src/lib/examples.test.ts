import { describe, expect, it } from "vitest";
import { EXAMPLE_PAIRINGS, pairingHref } from "@/lib/examples";
import { MAX_PEOPLE } from "@/lib/people-nav";
import { parsePeopleSlug } from "@/lib/slug";

describe("EXAMPLE_PAIRINGS", () => {
  it("has six pairings, including the Fincher ones", () => {
    expect(EXAMPLE_PAIRINGS).toHaveLength(6);
    const keys = EXAMPLE_PAIRINGS.map((p) => p.people.map((x) => x.id).join("+"));
    expect(keys).toContain("7467+7479");
    expect(keys).toContain("7467+287");
  });

  it("has no duplicate pairings", () => {
    const keys = EXAMPLE_PAIRINGS.map((p) =>
      p.people
        .map((x) => x.id)
        .sort((a, b) => a - b)
        .join("+"),
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  it.each(EXAMPLE_PAIRINGS.map((p) => [pairingHref(p), p] as const))(
    "%s round-trips through parsePeopleSlug",
    (href, pairing) => {
      expect(href.startsWith("/p/")).toBe(true);
      const parsed = parsePeopleSlug(href.slice("/p/".length));
      const ids = pairing.people.map((p) => p.id);

      expect(parsed).toEqual({ ids });
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.length).toBeGreaterThanOrEqual(2);
      expect(ids.length).toBeLessThanOrEqual(MAX_PEOPLE);
    },
  );

  it("has names and a one-line blurb for every pairing", () => {
    for (const { people, blurb } of EXAMPLE_PAIRINGS) {
      expect(people.every((p) => p.name.trim().length > 0 && Number.isInteger(p.id))).toBe(true);
      expect(blurb.trim().length).toBeGreaterThan(10);
      expect(blurb).not.toContain("\n");
    }
  });
});
