import { describe, expect, it } from "vitest";
import { DEFAULT_VARIANTS, parseHeroVariants, showsLab, withVariant } from "@/lib/hero-variants";

describe("parseHeroVariants", () => {
  it("is edge=none (no outline on the splash) and layout=panels without a query", () => {
    expect(DEFAULT_VARIANTS).toEqual({ edge: "none", layout: "panels" });
    expect(parseHeroVariants("")).toEqual(DEFAULT_VARIANTS);
  });

  it("reads the two from the query, with or without its '?'", () => {
    expect(parseHeroVariants("?edge=full&layout=wide")).toEqual({ edge: "full", layout: "wide" });
    expect(parseHeroVariants("layout=wide")).toEqual({ edge: "none", layout: "wide" });
    expect(parseHeroVariants("?edge=full&lab")).toEqual({ edge: "full", layout: "panels" });
  });

  it("falls back to the default for a value it does not know", () => {
    expect(parseHeroVariants("?edge=thin&layout=huge")).toEqual(DEFAULT_VARIANTS);
  });
});

describe("withVariant", () => {
  it("sets one variant and keeps every other parameter, `lab` included as a bare flag", () => {
    expect(withVariant("", "layout", "wide")).toBe("?layout=wide");
    expect(withVariant("?edge=none", "layout", "wide")).toBe("?edge=none&layout=wide");
    expect(withVariant("?lab&edge=full", "edge", "none")).toBe("?lab&edge=none");
    expect(withVariant("?edge=none&lab", "layout", "wide")).toBe("?edge=none&lab&layout=wide");
  });
});

describe("showsLab", () => {
  it("shows while developing, and in production only for a visit that asks with ?lab", () => {
    expect(showsLab("", true)).toBe(true);
    expect(showsLab("", false)).toBe(false);
    expect(showsLab("?edge=none", false)).toBe(false);
    expect(showsLab("?lab", false)).toBe(true);
    expect(showsLab("?layout=wide&lab=1", false)).toBe(true);
  });
});
