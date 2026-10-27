import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_FILM_TAB,
  FILM_TABS,
  hashForTab,
  nextTabIndex,
  rememberFilmTab,
  rememberedFilmTab,
  scrollEdges,
  scrollTopAfterTabChange,
  tabFromHash,
} from "@/lib/tabs";

describe("FILM_TABS", () => {
  it("lists cast first and defaults to it", () => {
    expect(FILM_TABS).toEqual(["cast", "crew"]);
    expect(DEFAULT_FILM_TAB).toBe("cast");
  });
});

describe("remembered tab", () => {
  afterEach(() => rememberFilmTab(DEFAULT_FILM_TAB));

  it("starts on the default tab", () => {
    expect(rememberedFilmTab()).toBe("cast");
  });

  it("returns the tab chosen last", () => {
    rememberFilmTab("crew");
    expect(rememberedFilmTab()).toBe("crew");
    rememberFilmTab("cast");
    expect(rememberedFilmTab()).toBe("cast");
  });
});

describe("nextTabIndex", () => {
  it("moves right and wraps from the last tab to the first", () => {
    expect(nextTabIndex("ArrowRight", 0, 2)).toBe(1);
    expect(nextTabIndex("ArrowRight", 1, 2)).toBe(0);
    expect(nextTabIndex("ArrowRight", 2, 4)).toBe(3);
  });

  it("moves left and wraps from the first tab to the last", () => {
    expect(nextTabIndex("ArrowLeft", 1, 2)).toBe(0);
    expect(nextTabIndex("ArrowLeft", 0, 2)).toBe(1);
    expect(nextTabIndex("ArrowLeft", 0, 4)).toBe(3);
  });

  it("jumps to the ends with Home and End from anywhere", () => {
    expect(nextTabIndex("Home", 1, 2)).toBe(0);
    expect(nextTabIndex("Home", 0, 2)).toBe(0);
    expect(nextTabIndex("End", 0, 2)).toBe(1);
    expect(nextTabIndex("End", 1, 2)).toBe(1);
  });

  it("stays put on a single tab", () => {
    expect(nextTabIndex("ArrowRight", 0, 1)).toBe(0);
    expect(nextTabIndex("ArrowLeft", 0, 1)).toBe(0);
  });

  it("ignores every other key", () => {
    for (const key of ["ArrowUp", "ArrowDown", "Tab", "Enter", " ", "Escape", "a", "PageDown"]) {
      expect(nextTabIndex(key, 0, 2)).toBeNull();
    }
  });

  it("returns null when there are no tabs", () => {
    expect(nextTabIndex("ArrowRight", 0, 0)).toBeNull();
    expect(nextTabIndex("Home", 0, 0)).toBeNull();
  });
});

describe("tabFromHash", () => {
  const ids = ["featured", "horror", "sci-fi", "crime-thriller"] as const;

  it("finds the tab a hash points at, with or without the #", () => {
    expect(tabFromHash("#horror", ids, "featured")).toBe("horror");
    expect(tabFromHash("sci-fi", ids, "featured")).toBe("sci-fi");
  });

  it("ignores case and percent-encoding", () => {
    expect(tabFromHash("#Horror", ids, "featured")).toBe("horror");
    expect(tabFromHash("#crime%2Dthriller", ids, "featured")).toBe("crime-thriller");
  });

  it("falls back for an empty, unknown or malformed hash", () => {
    expect(tabFromHash("", ids, "featured")).toBe("featured");
    expect(tabFromHash("#", ids, "featured")).toBe("featured");
    expect(tabFromHash("#nope", ids, "featured")).toBe("featured");
    expect(tabFromHash("#%E0%A4%A", ids, "featured")).toBe("featured");
    expect(tabFromHash("#horror-2", ids, "featured")).toBe("featured");
  });
});

describe("hashForTab", () => {
  it("is empty for the default tab so its URL stays clean", () => {
    expect(hashForTab("featured", "featured")).toBe("");
  });

  it("is #id for every other tab, and round-trips through tabFromHash", () => {
    const ids = ["featured", "horror"] as const;
    expect(hashForTab("horror", "featured")).toBe("#horror");
    expect(tabFromHash(hashForTab("horror", "featured"), ids, "featured")).toBe("horror");
    expect(tabFromHash(hashForTab("featured", "featured"), ids, "featured")).toBe("featured");
  });
});

describe("scrollEdges", () => {
  it("has no edges when everything fits", () => {
    expect(scrollEdges(0, 600, 600)).toEqual({ start: false, end: false });
  });

  it("has only an end edge at the start of a strip that overflows", () => {
    expect(scrollEdges(0, 375, 900)).toEqual({ start: false, end: true });
  });

  it("has both edges in the middle", () => {
    expect(scrollEdges(200, 375, 900)).toEqual({ start: true, end: true });
  });

  it("has only a start edge at the far end, allowing for fractional scroll positions", () => {
    expect(scrollEdges(525, 375, 900)).toEqual({ start: true, end: false });
    expect(scrollEdges(524.6, 375, 900)).toEqual({ start: true, end: false });
    expect(scrollEdges(0.4, 375, 375.3)).toEqual({ start: false, end: false });
  });
});

describe("scrollTopAfterTabChange", () => {
  it("leaves the scroll position alone while the film header is still in view", () => {
    expect(scrollTopAfterTabChange(0, 420)).toBe(0);
    expect(scrollTopAfterTabChange(180, 420)).toBe(180);
    expect(scrollTopAfterTabChange(420, 420)).toBe(420);
  });

  it("brings the tab content back under the bar once the bar has stuck", () => {
    expect(scrollTopAfterTabChange(900, 420)).toBe(420);
    expect(scrollTopAfterTabChange(421, 420)).toBe(420);
  });

  it("never goes negative", () => {
    expect(scrollTopAfterTabChange(50, -10)).toBe(0);
    expect(scrollTopAfterTabChange(0, 0)).toBe(0);
  });
});
