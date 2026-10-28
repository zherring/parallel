import { describe, expect, it } from "vitest";
import {
  chipDescription,
  chipLabel,
  edgeFades,
  fadeMask,
  filmCountLabel,
  scrollStep,
} from "@/lib/collaborator-chip";

describe("filmCountLabel", () => {
  it("pluralizes", () => {
    expect(filmCountLabel(1)).toBe("1 film");
    expect(filmCountLabel(2)).toBe("2 films");
    expect(filmCountLabel(11)).toBe("11 films");
  });
});

describe("chipLabel", () => {
  it("names the person, the films together and the roles", () => {
    expect(chipLabel({ name: "Steven Spielberg", sharedCount: 4, roles: "Director" })).toBe(
      "Add Steven Spielberg: 4 films together, Director",
    );
    expect(chipLabel({ name: "Joel Coen", sharedCount: 13, roles: "Director, Writer, Editor" })).toBe(
      "Add Joel Coen: 13 films together, Director, Writer, Editor",
    );
  });

  it("leaves out roles it does not have", () => {
    expect(chipLabel({ name: "Someone", sharedCount: 1, roles: "" })).toBe("Add Someone: 1 film together");
  });
});

describe("chipDescription", () => {
  it("lists the titles", () => {
    expect(chipDescription({ titles: ["Jaws"] })).toBe("Together in Jaws");
    expect(chipDescription({ titles: ["Jaws", "Duel", "1941"] })).toBe("Together in Jaws, Duel, and 1941");
  });

  it("is null without titles", () => {
    expect(chipDescription({ titles: [] })).toBeNull();
  });
});

describe("edgeFades", () => {
  it("fades only the end at the start of a long row", () => {
    expect(edgeFades(0, 400, 1200)).toEqual({ start: false, end: true });
  });

  it("fades both edges in the middle", () => {
    expect(edgeFades(300, 400, 1200)).toEqual({ start: true, end: true });
  });

  it("fades only the start at the end of the row, even with a fractional scroll position", () => {
    expect(edgeFades(800, 400, 1200)).toEqual({ start: true, end: false });
    expect(edgeFades(799.6, 400, 1200)).toEqual({ start: true, end: false });
  });

  it("shows no fades when everything fits", () => {
    expect(edgeFades(0, 400, 400)).toEqual({ start: false, end: false });
    expect(edgeFades(0, 400, 300)).toEqual({ start: false, end: false });
  });
});

describe("fadeMask", () => {
  it("is undefined when nothing is hidden", () => {
    expect(fadeMask({ start: false, end: false })).toBeUndefined();
  });

  it("fades only the edges that have more behind them", () => {
    expect(fadeMask({ start: false, end: true })).toBe(
      "linear-gradient(to right, #000 0, #000 0, #000 calc(100% - 32px), transparent 100%)",
    );
    expect(fadeMask({ start: true, end: false })).toBe(
      "linear-gradient(to right, transparent 0, #000 32px, #000 100%, #000 100%)",
    );
    expect(fadeMask({ start: true, end: true })).toBe(
      "linear-gradient(to right, transparent 0, #000 32px, #000 calc(100% - 32px), transparent 100%)",
    );
  });
});

describe("scrollStep", () => {
  it("scrolls most of a screenful, at least 120px", () => {
    expect(scrollStep(500)).toBe(400);
    expect(scrollStep(100)).toBe(120);
  });
});
