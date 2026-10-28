import { describe, expect, it } from "vitest";
import { personRows, sharedRows } from "@/lib/film-rows";
import { sharedFilms } from "@/lib/shared";
import type { Credit, Film, PersonTimeline } from "@/lib/types";
import {
  DEFAULT_VIEW,
  VIEWS,
  VIEW_LABELS,
  carryView,
  headlineCount,
  parseView,
  searchWithView,
  showingMessage,
  viewForKey,
} from "@/lib/films-view";

describe("VIEWS", () => {
  it("lists the timeline first and defaults to it", () => {
    expect(VIEWS).toEqual(["timeline", "table"]);
    expect(DEFAULT_VIEW).toBe("timeline");
    expect(VIEW_LABELS).toEqual({ timeline: "Timeline", table: "Table" });
  });
});

describe("parseView", () => {
  it("is the timeline without any parameter", () => {
    expect(parseView("")).toBe("timeline");
    expect(parseView("?")).toBe("timeline");
    expect(parseView("?utm_source=x")).toBe("timeline");
  });

  it("reads ?view=table, with or without the leading question mark", () => {
    expect(parseView("?view=table")).toBe("table");
    expect(parseView("view=table")).toBe("table");
    expect(parseView("?foo=1&view=table")).toBe("table");
  });

  it("reads an explicit ?view=timeline", () => {
    expect(parseView("?view=timeline")).toBe("timeline");
  });

  it("falls back to the default for an unknown view", () => {
    expect(parseView("?view=grid")).toBe("timeline");
    expect(parseView("?view=")).toBe("timeline");
    expect(parseView("?view=TABLE")).toBe("timeline");
  });

  it("opens the table for a sorted link that names no view", () => {
    expect(parseView("?sort=box-office&dir=desc")).toBe("table");
    expect(parseView("?sort=rating")).toBe("table");
    expect(parseView("?dir=asc")).toBe("table");
  });

  it("lets an explicit view win over a sort", () => {
    expect(parseView("?view=timeline&sort=box-office&dir=desc")).toBe("timeline");
    expect(parseView("?sort=rating&dir=desc&view=table")).toBe("table");
  });

  it("applies the sort rule to an unknown view too", () => {
    expect(parseView("?view=grid&sort=year&dir=desc")).toBe("table");
  });
});

describe("searchWithView", () => {
  it("writes view=table for the table", () => {
    expect(searchWithView("", "table")).toBe("?view=table");
    expect(searchWithView("?view=timeline", "table")).toBe("?view=table");
  });

  it("writes nothing for the timeline, the default", () => {
    expect(searchWithView("", "timeline")).toBe("");
    expect(searchWithView("?view=table", "timeline")).toBe("");
  });

  it("keeps the other parameters", () => {
    expect(searchWithView("?foo=1", "table")).toBe("?foo=1&view=table");
    expect(searchWithView("?foo=1&view=table", "timeline")).toBe("?foo=1");
  });

  it("keeps the table's sort when the view changes", () => {
    expect(searchWithView("?sort=rating&dir=desc", "table")).toBe("?sort=rating&dir=desc&view=table");
    expect(searchWithView("?view=table&sort=rating&dir=desc", "table")).toBe("?view=table&sort=rating&dir=desc");
  });

  it("says view=timeline outright when a sort would otherwise open the table", () => {
    expect(searchWithView("?view=table&sort=rating&dir=desc", "timeline")).toBe("?view=timeline&sort=rating&dir=desc");
    expect(searchWithView("?sort=rating&dir=desc", "timeline")).toBe("?sort=rating&dir=desc&view=timeline");
  });

  it("round-trips through parseView", () => {
    for (const start of ["", "?view=table", "?sort=rating&dir=desc", "?view=table&sort=awards&dir=asc"]) {
      for (const view of VIEWS) {
        expect(parseView(searchWithView(start, view))).toBe(view);
      }
    }
  });
});

describe("carryView", () => {
  const href = "/p/1032-martin-scorsese+3661-thelma-schoonmaker";

  it("adds view=table when the page being left shows the table", () => {
    expect(carryView(href, "?view=table")).toBe(`${href}?view=table`);
  });

  it("carries the table of a sorted link, without the sort", () => {
    expect(carryView(href, "?sort=box-office&dir=desc")).toBe(`${href}?view=table`);
    expect(carryView(href, "?view=table&sort=rating&dir=desc")).toBe(`${href}?view=table`);
  });

  it("leaves the href alone for the timeline, which is what a page without a view opens", () => {
    expect(carryView(href, "")).toBe(href);
    expect(carryView(href, "?view=timeline")).toBe(href);
    expect(carryView(href, "?view=timeline&sort=rating&dir=desc")).toBe(href);
  });

  it("appends to a query that is already there, and keeps a hash last", () => {
    expect(carryView(`${href}?a=1`, "?view=table")).toBe(`${href}?a=1&view=table`);
    expect(carryView(`${href}#x`, "?view=table")).toBe(`${href}?view=table#x`);
  });
});

describe("viewForKey", () => {
  it("moves between the two tabs with the arrow keys, wrapping", () => {
    expect(viewForKey("ArrowRight", "timeline")).toBe("table");
    expect(viewForKey("ArrowRight", "table")).toBe("timeline");
    expect(viewForKey("ArrowLeft", "timeline")).toBe("table");
    expect(viewForKey("ArrowLeft", "table")).toBe("timeline");
  });

  it("jumps to the ends with Home and End", () => {
    expect(viewForKey("Home", "table")).toBe("timeline");
    expect(viewForKey("End", "timeline")).toBe("table");
    expect(viewForKey("Home", "timeline")).toBe("timeline");
    expect(viewForKey("End", "table")).toBe("table");
  });

  it("ignores every other key", () => {
    for (const key of ["Enter", " ", "Tab", "ArrowDown", "ArrowUp", "a", "Escape"]) {
      expect(viewForKey(key, "timeline")).toBeNull();
    }
  });
});

describe("headlineCount", () => {
  it("counts the films after the names", () => {
    expect(headlineCount(11)).toBe("11 films");
    expect(headlineCount(64)).toBe("64 films");
  });

  it("says 1 film in the singular", () => {
    expect(headlineCount(1)).toBe("1 film");
  });

  it("leaves the count out when there are no films, so the headline is just the names", () => {
    expect(headlineCount(0)).toBeNull();
  });
});

describe("the headline count follows the checkbox as the table does", () => {
  const TODAY = "2026-10-27";
  const major: Credit = { role: "actor", job: "Actor", minor: false };
  const cameo: Credit = { role: "actor", job: "Actor", minor: true };
  const film = (id: number, releaseDate: string, credits: Credit[]): Film => ({
    id,
    title: `Film ${id}`,
    releaseDate,
    year: Number(releaseDate.slice(0, 4)),
    posterPath: null,
    voteCount: 0,
    credits,
    minor: credits.every((credit) => credit.minor),
  });
  const person = (id: number, films: Film[]): PersonTimeline => ({
    person: { id, name: `Person ${id}`, profilePath: null, knownFor: null, birthday: null, deathday: null, biography: null },
    films,
  });
  // Two shared films with major credits, one shared cameo, and one film only the first person has.
  const a = person(1, [film(1, "1980-01-01", [major]), film(2, "1990-01-01", [major]), film(3, "2000-01-01", [cameo]), film(4, "2010-01-01", [major])]);
  const b = person(2, [film(1, "1980-01-01", [major]), film(2, "1990-01-01", [major]), film(3, "2000-01-01", [cameo])]);

  it("counts the shared films of two people with and without minor credits", () => {
    const off = sharedFilms([a, b], { includeMinor: false, today: TODAY });
    const on = sharedFilms([a, b], { includeMinor: true, today: TODAY });
    expect(headlineCount(off.length)).toBe("2 films");
    expect(headlineCount(on.length)).toBe("3 films");
    // the table lists exactly those films
    expect(sharedRows(off, [{ id: 1, name: "Person 1" }, { id: 2, name: "Person 2" }])).toHaveLength(off.length);
  });

  it("counts one person's own films the way their table lists them", () => {
    expect(headlineCount(personRows(a, false).length)).toBe("3 films");
    expect(headlineCount(personRows(a, true).length)).toBe("4 films");
  });

  it("has nothing to count for people with no shared film", () => {
    const loner = person(3, [film(9, "1999-01-01", [major])]);
    expect(headlineCount(sharedFilms([a, loner], { includeMinor: true, today: TODAY }).length)).toBeNull();
  });
});

describe("showingMessage", () => {
  it("says what the lists show now", () => {
    expect(showingMessage(43, true)).toBe("Showing 43 films together");
    expect(showingMessage(11, false)).toBe("Showing 11 films");
    expect(showingMessage(1, true)).toBe("Showing 1 film together");
  });

  it("says so when there is nothing to show", () => {
    expect(showingMessage(0, true)).toBe("No films together to show");
    expect(showingMessage(0, false)).toBe("No films to show");
  });
});
