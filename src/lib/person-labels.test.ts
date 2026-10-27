import { describe, expect, it } from "vitest";
import { departmentLabel, initials } from "@/lib/person-labels";

describe("departmentLabel", () => {
  it("maps TMDB departments to readable labels", () => {
    expect(departmentLabel("Acting")).toBe("Actor");
    expect(departmentLabel("Directing")).toBe("Director");
    expect(departmentLabel("Writing")).toBe("Writer");
    expect(departmentLabel("Camera")).toBe("Cinematographer");
    expect(departmentLabel("Editing")).toBe("Editor");
    expect(departmentLabel("Sound")).toBe("Music & sound");
    expect(departmentLabel("Production")).toBe("Producer");
  });

  it("passes unknown departments through and treats empty as null", () => {
    expect(departmentLabel("Stunts")).toBe("Stunts");
    expect(departmentLabel("  Acting ")).toBe("Actor");
    expect(departmentLabel("")).toBeNull();
    expect(departmentLabel("   ")).toBeNull();
    expect(departmentLabel(null)).toBeNull();
    expect(departmentLabel(undefined)).toBeNull();
  });
});

describe("initials", () => {
  it("uses the first and last word", () => {
    expect(initials("David Fincher")).toBe("DF");
    expect(initials("Bong Joon Ho")).toBe("BH");
    expect(initials("  helena   bonham carter ")).toBe("HC");
  });

  it("handles single words, non-latin names and empty input", () => {
    expect(initials("Zendaya")).toBe("Z");
    expect(initials("송강호")).toBe("송");
    expect(initials("Éric Rohmer")).toBe("ÉR");
    expect(initials("   ")).toBe("?");
  });
});
