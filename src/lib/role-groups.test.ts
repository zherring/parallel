import { describe, expect, it } from "vitest";
import { ROLE_GROUPS, pickSuggestions, primaryGroup, roleGroupOf, type RoleGroup } from "@/lib/role-groups";
import { ROLE_ORDER } from "@/lib/roles";

interface Candidate {
  name: string;
  group: RoleGroup;
  count: number;
}

const c = (name: string, group: RoleGroup, count: number): Candidate => ({ name, group, count });
const names = (list: Candidate[]) => list.map((x) => x.name);

describe("roleGroupOf", () => {
  it("puts every role in a group, with producers and designers under other", () => {
    for (const role of ROLE_ORDER) expect(ROLE_GROUPS).toContain(roleGroupOf(role));
    expect(roleGroupOf("actor")).toBe("acting");
    expect(roleGroupOf("director")).toBe("directing");
    expect(roleGroupOf("writer")).toBe("writing");
    expect(roleGroupOf("cinematographer")).toBe("camera");
    expect(roleGroupOf("composer")).toBe("music");
    expect(roleGroupOf("editor")).toBe("editing");
    expect(roleGroupOf("producer")).toBe("other");
    expect(roleGroupOf("production-designer")).toBe("other");
    expect(roleGroupOf("costume-designer")).toBe("other");
  });
});

describe("primaryGroup", () => {
  it("is the group with the most films", () => {
    expect(primaryGroup({ acting: 5, directing: 2 })).toBe("acting");
    expect(primaryGroup({ writing: 4, directing: 3, acting: 1 })).toBe("writing");
  });

  it("breaks a tie toward the earlier group", () => {
    expect(primaryGroup({ acting: 3, directing: 3 })).toBe("directing");
    expect(primaryGroup({ editing: 2, camera: 2 })).toBe("camera");
  });

  it("uses other only when it is all there is", () => {
    expect(primaryGroup({ other: 9, directing: 1 })).toBe("directing");
    expect(primaryGroup({ other: 3 })).toBe("other");
    expect(primaryGroup({})).toBe("other");
  });
});

describe("pickSuggestions", () => {
  it("returns nothing for no candidates or a limit of zero", () => {
    expect(pickSuggestions([], 10)).toEqual([]);
    expect(pickSuggestions([c("a", "acting", 3)], 0)).toEqual([]);
  });

  it("returns every candidate, most films first, when there are fewer than the limit", () => {
    const list = [c("a", "acting", 3), c("b", "directing", 5), c("d", "camera", 4)];
    expect(names(pickSuggestions(list, 10))).toEqual(["b", "d", "a"]);
  });

  it("lets the director, camera and composer in ahead of a fourth co-star", () => {
    const list = [
      c("star1", "acting", 9),
      c("star2", "acting", 8),
      c("star3", "acting", 7),
      c("star4", "acting", 6),
      c("star5", "acting", 5),
      c("director", "directing", 3),
      c("dp", "camera", 2),
      c("composer", "music", 2),
    ];
    const picked = names(pickSuggestions(list, 5));
    expect(picked).toContain("director");
    expect(picked).toContain("dp");
    expect(picked).toContain("composer");
    expect(picked.filter((n) => n.startsWith("star"))).toEqual(["star1", "star2"]);
  });

  it("reserves at most two places per group, then fills the rest by count", () => {
    const list = [
      c("a1", "acting", 9),
      c("a2", "acting", 8),
      c("a3", "acting", 7),
      c("a4", "acting", 6),
      c("d1", "directing", 2),
    ];
    // a1, a2 and d1 are reserved; a3 takes the last slot by count.
    expect(names(pickSuggestions(list, 4))).toEqual(["a1", "a2", "a3", "d1"]);
    // With a quota of one, only a1 and d1 are reserved and the fill is the same.
    expect(names(pickSuggestions(list, 3, 1))).toEqual(["a1", "a2", "d1"]);
  });

  it("orders the result by count, then by role group, then by the original rank", () => {
    const list = [
      c("actor", "acting", 4),
      c("composer", "music", 4),
      c("director", "directing", 4),
      c("actor2", "acting", 4),
      c("writer", "writing", 6),
    ];
    expect(names(pickSuggestions(list, 5))).toEqual(["writer", "director", "composer", "actor", "actor2"]);
  });

  it("keeps the rank order inside a group", () => {
    const list = [c("first", "directing", 5), c("second", "directing", 5), c("third", "directing", 3)];
    expect(names(pickSuggestions(list, 2))).toEqual(["first", "second"]);
  });

  it("gives each group its best before any group its second when the groups outnumber the limit", () => {
    const list = [
      c("a1", "acting", 9),
      c("a2", "acting", 8),
      c("d1", "directing", 7),
      c("d2", "directing", 6),
      c("w1", "writing", 5),
    ];
    // One place each for acting, directing and writing before anybody's second.
    expect(names(pickSuggestions(list, 3))).toEqual(["a1", "d1", "w1"]);
  });

  it("does not change the list it is given", () => {
    const list = [c("a", "acting", 1), c("b", "directing", 9)];
    const copy = structuredClone(list);
    pickSuggestions(list, 1);
    expect(list).toEqual(copy);
  });
});
