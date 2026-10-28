import { describe, expect, it } from "vitest";
import {
  SUGGESTION_LIMIT,
  listedSuggestions,
  panelSection,
  suggestionDetail,
  suggestionTitle,
  suggestionsAnnouncement,
  type SuggestionsStatus,
} from "@/lib/collaborator-suggest";
import type { CollaboratorSuggestion } from "@/lib/types";

const suggestion = (id: number, extra: Partial<CollaboratorSuggestion> = {}): CollaboratorSuggestion => ({
  id,
  name: `Person ${id}`,
  profilePath: null,
  sharedCount: 3,
  roles: "Director",
  titles: [],
  ...extra,
});

describe("panelSection", () => {
  it("shows the suggestions in an empty, enabled field that has them or is loading them", () => {
    expect(panelSection(true, "", "ready")).toBe("suggestions");
    expect(panelSection(true, "", "loading")).toBe("suggestions");
  });

  it("shows the usual search as soon as there is any text", () => {
    for (const status of ["idle", "loading", "ready", "hidden"] as const) {
      expect(panelSection(true, "h", status)).toBe("search");
      expect(panelSection(true, "harrison", status)).toBe("search");
    }
  });

  it("brings the suggestions back when the text is cleared", () => {
    expect(panelSection(true, "ha", "ready")).toBe("search");
    expect(panelSection(true, "", "ready")).toBe("suggestions");
  });

  it("falls back to the field's usual behaviour when there is nothing to suggest", () => {
    expect(panelSection(true, "", "hidden")).toBe("search");
    expect(panelSection(true, "", "idle")).toBe("search");
  });

  it("is always the usual search for a field that is not enabled for suggestions", () => {
    const statuses: SuggestionsStatus[] = ["idle", "loading", "ready", "hidden"];
    for (const status of statuses) {
      expect(panelSection(false, "", status)).toBe("search");
      expect(panelSection(false, "ha", status)).toBe("search");
    }
  });
});

describe("listedSuggestions", () => {
  it("keeps the first ones in order, up to the limit", () => {
    const ten = Array.from({ length: 10 }, (_, index) => suggestion(index + 1));
    const listed = listedSuggestions(ten);
    expect(listed).toHaveLength(SUGGESTION_LIMIT);
    expect(listed.map((s) => s.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("keeps a short list whole", () => {
    expect(listedSuggestions([suggestion(1), suggestion(2)]).map((s) => s.id)).toEqual([1, 2]);
    expect(listedSuggestions([])).toEqual([]);
  });
});

describe("suggestionDetail", () => {
  it("says the roles and how many films together", () => {
    expect(suggestionDetail({ roles: "Director, Writer", sharedCount: 11 })).toBe("Director, Writer · 11 films together");
    expect(suggestionDetail({ roles: "Composer", sharedCount: 1 })).toBe("Composer · 1 film together");
  });

  it("leaves out roles it does not have", () => {
    expect(suggestionDetail({ roles: "", sharedCount: 4 })).toBe("4 films together");
  });
});

describe("suggestionTitle", () => {
  it("lists the titles", () => {
    expect(suggestionTitle({ titles: ["Jaws"] })).toBe("Together in Jaws");
    expect(suggestionTitle({ titles: ["Jaws", "Duel", "1941"] })).toBe("Together in Jaws, Duel, and 1941");
  });

  it("is null without titles", () => {
    expect(suggestionTitle({ titles: [] })).toBeNull();
  });
});

describe("suggestionsAnnouncement", () => {
  it("says how many suggestions there are", () => {
    expect(suggestionsAnnouncement("ready", 8)).toBe("8 frequent collaborators");
    expect(suggestionsAnnouncement("ready", 1)).toBe("1 frequent collaborator");
  });

  it("says they are on their way while loading", () => {
    expect(suggestionsAnnouncement("loading", 0)).toBe("Loading frequent collaborators");
  });

  it("says nothing when there are none", () => {
    expect(suggestionsAnnouncement("ready", 0)).toBe("");
    expect(suggestionsAnnouncement("hidden", 0)).toBe("");
    expect(suggestionsAnnouncement("idle", 0)).toBe("");
  });
});
