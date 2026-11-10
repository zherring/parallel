import { describe, expect, it } from "vitest";
import { personRows, sharedRows } from "@/lib/film-rows";
import { sharedFilms } from "@/lib/shared";
import type { Credit, Film, PersonTimeline } from "@/lib/types";
import {
  BASE_VIEWS,
  DEFAULT_VIEW,
  DEPTH_VIEW,
  FILMS_VIEWS,
  FILMS_VIEW_LABELS,
  VIEWS,
  VIEW_LABELS,
  availableViews,
  carryView,
  hasClippingsTab,
  headlineCount,
  isFilmView,
  isFilmsView,
  parseView,
  quoteIdsOf,
  resolveView,
  searchWithView,
  showingMessage,
  showsPeriodNote,
  viewParams,
} from "@/lib/films-view";

describe("VIEWS", () => {
  it("lists the timeline first and defaults to it", () => {
    expect(VIEWS).toEqual(["timeline", "table", "clippings"]);
    expect(DEFAULT_VIEW).toBe("timeline");
    expect(VIEW_LABELS).toEqual({ timeline: "Timeline", table: "Table", clippings: "Quotes" });
  });
});

describe("FILMS_VIEWS", () => {
  it("is Timeline, Focus and Table, in the order of the switcher; Focus is the Depth view", () => {
    expect(FILMS_VIEWS).toEqual(["timeline", "depth", "table"]);
    expect(FILMS_VIEWS[1]).toBe(DEPTH_VIEW);
    expect(FILMS_VIEW_LABELS).toEqual({ timeline: "Timeline", depth: "Focus", table: "Table" });
  });

  it("are the views of Films, and the Clippings are not one of them", () => {
    expect(FILMS_VIEWS.every(isFilmsView)).toBe(true);
    expect(isFilmsView("clippings")).toBe(false);
  });
});

describe("hasClippingsTab", () => {
  const quotes = { clippings: [{}] };
  const criticQuotes = { critics: [{}], reading: [] };
  const readingOnly = { critics: [], reading: [{}] };

  it("is true for a page with quotes, with critics, with reading only, or with several", () => {
    expect(hasClippingsTab(quotes, null)).toBe(true);
    expect(hasClippingsTab(null, criticQuotes)).toBe(true);
    expect(hasClippingsTab(null, readingOnly)).toBe(true);
    expect(hasClippingsTab(quotes, criticQuotes)).toBe(true);
  });

  it("is false for a page with none of them", () => {
    expect(hasClippingsTab(null, null)).toBe(false);
    expect(hasClippingsTab(undefined, undefined)).toBe(false);
    expect(hasClippingsTab({ clippings: [] }, { critics: [], reading: [] })).toBe(false);
  });
});

describe("availableViews", () => {
  it("offers Timeline and Table to every page, and Clippings only to a page that has quotes, critics or reading", () => {
    expect(availableViews(false)).toEqual(["timeline", "table"]);
    expect(availableViews(false)).toBe(BASE_VIEWS);
    expect(availableViews(true)).toEqual(["timeline", "table", "clippings"]);
  });
});

describe("resolveView", () => {
  it("keeps a view the page offers", () => {
    expect(resolveView("table", availableViews(false))).toBe("table");
    expect(resolveView("clippings", availableViews(true))).toBe("clippings");
  });

  it("keeps Clippings for a page that has critics or reading but no quotes", () => {
    expect(resolveView("clippings", availableViews(hasClippingsTab(null, { critics: [], reading: [{}] })))).toBe("clippings");
    expect(resolveView("clippings", availableViews(hasClippingsTab(null, { critics: [{}], reading: [] })))).toBe("clippings");
  });

  it("falls back to the default view for one it does not offer: ?view=clippings on a page with neither quotes nor critics", () => {
    expect(resolveView(parseView("?view=clippings"), availableViews(hasClippingsTab(null, null)))).toBe("timeline");
    expect(resolveView(parseView("?view=clippings&sort=rating"), availableViews(false))).toBe("timeline");
  });
});

describe("the clippings view in the URL", () => {
  it("is selected by ?view=clippings and written back the same way", () => {
    expect(parseView("?view=clippings")).toBe("clippings");
    expect(searchWithView("", "clippings")).toBe("?view=clippings");
    expect(searchWithView("?view=clippings", "timeline")).toBe("");
    expect(searchWithView("?foo=1&view=clippings", "table")).toBe("?foo=1&view=table");
  });

  it("is not carried to the page of another set of people, which has no clippings of the same pair", () => {
    expect(carryView("/p/1-a+2-b+3-c", "?view=clippings")).toBe("/p/1-a+2-b+3-c");
  });
});

describe("isFilmView", () => {
  it("is true for the views of the films and false for the clippings", () => {
    expect(VIEWS.filter(isFilmView)).toEqual(["timeline", "table"]);
  });

  it("does not list the Depth view, which is no tab: a link to it reads as the default view", () => {
    expect(VIEWS).not.toContain(DEPTH_VIEW);
    expect(parseView("?view=depth")).toBe(DEFAULT_VIEW);
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

  describe("with the ids of the page's quotes", () => {
    const IDS = ["short-one", "critic-short"];

    it("opens the Clippings for a link to one of them that names no view", () => {
      expect(parseView("?quote=short-one", IDS)).toBe("clippings");
      expect(parseView("quote=critic-short", IDS)).toBe("clippings");
      expect(parseView("?quote=%20short-one%20", IDS)).toBe("clippings");
      expect(parseView("?from=1970&quote=short-one", IDS)).toBe("clippings");
      expect(parseView({ quote: "short-one" }, IDS)).toBe("clippings");
      expect(parseView({ quote: ["short-one", "nope"] }, IDS)).toBe("clippings");
      expect(parseView(new URLSearchParams({ quote: "short-one" }), new Set(IDS))).toBe("clippings");
    });

    it("lets it win over a sort, since a quote is only ever on the Clippings", () => {
      expect(parseView("?sort=rating&quote=short-one", IDS)).toBe("clippings");
    });

    it("ignores an id the page does not have, an empty one, one of another case, and a quote on a page without any", () => {
      expect(parseView("?quote=nope", IDS)).toBe("timeline");
      expect(parseView("?quote=", IDS)).toBe("timeline");
      expect(parseView("?quote=SHORT-ONE", IDS)).toBe("timeline");
      expect(parseView("?quote=short", IDS)).toBe("timeline");
      expect(parseView("?quote=short-one")).toBe("timeline");
      expect(parseView("?quote=short-one", [])).toBe("timeline");
      expect(parseView({ quote: ["nope", "short-one"] }, IDS)).toBe("timeline");
      expect(parseView("?sort=rating&quote=nope", IDS)).toBe("table");
    });

    it("lets a view the link names win", () => {
      expect(parseView("?view=table&quote=short-one", IDS)).toBe("table");
      expect(parseView("?view=timeline&quote=short-one", IDS)).toBe("timeline");
      expect(parseView("?view=clippings&quote=short-one", IDS)).toBe("clippings");
      expect(parseView("?view=grid&quote=short-one", IDS)).toBe("clippings");
    });

    it("is the view the page shows, when resolved: the Clippings for a pair that has quotes, never for one that has none", () => {
      const clippings = { clippings: [{ id: "short-one" }] };
      const ids = quoteIdsOf(clippings, null);
      expect(resolveView(parseView("?quote=short-one", ids), availableViews(hasClippingsTab(clippings, null)))).toBe("clippings");
      expect(resolveView(parseView("?quote=short-one", quoteIdsOf(null, null)), availableViews(false))).toBe("timeline");
    });

    it("is dropped again by a change of view, which writes nothing that would bring the Clippings back", () => {
      expect(searchWithView("?quote=short-one", "timeline")).toBe("");
      expect(searchWithView("?quote=short-one", "table")).toBe("?view=table");
      expect(parseView(searchWithView("?quote=short-one", "timeline"), ["short-one"])).toBe("timeline");
      expect(parseView(searchWithView("?quote=short-one", "table"), ["short-one"])).toBe("table");
    });
  });
});

describe("quoteIdsOf", () => {
  it("lists the artists' ids and then the critics'", () => {
    expect(quoteIdsOf({ clippings: [{ id: "a" }, { id: "b" }] }, { critics: [{ id: "critic-c" }] })).toEqual(["a", "b", "critic-c"]);
  });

  it("is empty for a page without quotes", () => {
    expect(quoteIdsOf(null, null)).toEqual([]);
    expect(quoteIdsOf(undefined, { critics: [] })).toEqual([]);
  });
});

describe("viewParams", () => {
  it("is the view, sort, direction and quote of a page's query, in that order, and nothing else", () => {
    const params = viewParams({ quote: "q", from: "1970", dir: "asc", utm_source: "x", sort: "year", view: "table", to: "1980" });
    expect(params.toString()).toBe("view=table&sort=year&dir=asc&quote=q");
  });

  it("takes the first of a repeated parameter and leaves out empty and missing ones", () => {
    expect(viewParams({ view: ["clippings", "table"], quote: ["a", "b"], sort: "", dir: undefined }).toString()).toBe("view=clippings&quote=a");
    expect(viewParams({}).toString()).toBe("");
  });

  it("writes an id so that a URL reads it back unchanged", () => {
    const text = viewParams({ quote: "a b&c=d" }).toString();
    expect(new URLSearchParams(text).get("quote")).toBe("a b&c=d");
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

  it("keeps a quote on the Clippings and drops it from any other view, which has no quote on screen", () => {
    expect(searchWithView("?view=clippings&quote=a-quote", "clippings")).toBe("?view=clippings&quote=a-quote");
    expect(searchWithView("?view=clippings&quote=a-quote", "timeline")).toBe("");
    expect(searchWithView("?view=clippings&quote=a-quote", "table")).toBe("?view=table");
    expect(searchWithView("?foo=1&quote=a-quote&view=clippings", "timeline")).toBe("?foo=1");
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

  it("adds view=depth when the page being left is the Depth view, without the sort", () => {
    expect(carryView(href, "?view=depth")).toBe(`${href}?view=depth`);
    expect(carryView(href, "?view=depth&from=1990&to=2000")).toBe(`${href}?view=depth`);
    expect(carryView(href, "?view=depth&sort=rating&dir=desc")).toBe(`${href}?view=depth`);
    expect(carryView(`${href}#x`, "?view=depth")).toBe(`${href}?view=depth#x`);
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

describe("showsPeriodNote", () => {
  it("is for the Timeline only: a period dims its films, and the Table and the CSV list every one", () => {
    expect(showsPeriodNote("timeline")).toBe(true);
    expect(showsPeriodNote("table")).toBe(false);
  });

  it("says yes to no view but the Timeline", () => {
    expect(VIEWS.filter(showsPeriodNote)).toEqual(["timeline"]);
  });
});
