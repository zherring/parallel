import { describe, expect, it } from "vitest";
import {
  MINOR_CHARACTER_PATTERN,
  ROLE_ORDER,
  isMinorCast,
  isMinorCrewRole,
  roleForJob,
  roleLabel,
  roleSummary,
} from "@/lib/roles";

describe("roleForJob", () => {
  it.each([
    ["Director", "director"],
    ["Writer", "writer"],
    ["Screenplay", "writer"],
    ["Story", "writer"],
    ["Novel", "writer"],
    ["Characters", "writer"],
    ["Teleplay", "writer"],
    ["Author", "writer"],
    ["Original Story", "writer"],
    ["Director of Photography", "cinematographer"],
    ["Editor", "editor"],
    ["Original Music Composer", "composer"],
    ["Composer", "composer"],
    ["Producer", "producer"],
    ["Production Design", "production-designer"],
    ["Costume Design", "costume-designer"],
  ])("maps %s to %s", (job, role) => {
    expect(roleForJob(job)).toBe(role);
  });

  it("is case and whitespace insensitive", () => {
    expect(roleForJob("  director of photography ")).toBe("cinematographer");
  });

  it.each(["Executive Producer", "Co-Producer", "Associate Producer", "Gaffer", "Casting", ""])(
    "maps %j to other",
    (job) => {
      expect(roleForJob(job)).toBe("other");
    },
  );
});

describe("isMinorCrewRole", () => {
  it("is minor only for other", () => {
    expect(isMinorCrewRole("other")).toBe(true);
    expect(isMinorCrewRole("producer")).toBe(false);
    expect(isMinorCrewRole("director")).toBe(false);
  });
});

describe("MINOR_CHARACTER_PATTERN", () => {
  it.each([
    "Self (archive footage)",
    "Self",
    "Himself",
    "Herself - Host",
    "Themselves",
    "Bartender (uncredited)",
    "Voice (uncredited)",
    "Cameo",
    "Archive Footage",
  ])("matches %j", (character) => {
    expect(MINOR_CHARACTER_PATTERN.test(character)).toBe(true);
  });

  it.each(["Tyler Durden", "Narrator", "Woody (voice)", "Selfridge", "Myself Jones", ""])(
    "does not match %j",
    (character) => {
      expect(MINOR_CHARACTER_PATTERN.test(character)).toBe(false);
    },
  );
});

describe("isMinorCast", () => {
  it("is minor from order 15 onward", () => {
    expect(isMinorCast(14, "Detective")).toBe(false);
    expect(isMinorCast(15, "Detective")).toBe(true);
  });

  it("is minor when the character text matches, whatever the order", () => {
    expect(isMinorCast(0, "Self (archive footage)")).toBe(true);
  });

  it("is not minor without order or matching character", () => {
    expect(isMinorCast(undefined, undefined)).toBe(false);
  });
});

describe("roleLabel / ROLE_ORDER", () => {
  it("has a label for every role", () => {
    for (const role of ROLE_ORDER) expect(roleLabel(role)).toMatch(/^[A-Z]/);
    expect(roleLabel("production-designer")).toBe("Production designer");
  });

  it("lists each role once, other last", () => {
    expect(new Set(ROLE_ORDER).size).toBe(ROLE_ORDER.length);
    expect(ROLE_ORDER.at(-1)).toBe("other");
  });
});

describe("roleSummary", () => {
  it("lists each role once in ROLE_ORDER", () => {
    expect(
      roleSummary([
        { role: "writer", job: "Screenplay", minor: false },
        { role: "director", job: "Director", minor: false },
        { role: "actor", job: "Actor", minor: false },
        { role: "director", job: "Director", minor: false },
      ]),
    ).toBe("Actor, Director, Writer");
  });

  it("is empty without credits", () => {
    expect(roleSummary([])).toBe("");
  });
});
