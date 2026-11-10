import { describe, expect, it } from "vitest";
import { DEPTH_VIEW, depthSearch, flatSearch, isDepthView, opensDepth, pageViewHref, withDepth } from "@/lib/depth-url";

describe("isDepthView", () => {
  it("is true for view=depth only", () => {
    expect(DEPTH_VIEW).toBe("depth");
    expect(isDepthView("depth")).toBe(true);
    expect(isDepthView("table")).toBe(false);
    expect(isDepthView("timeline")).toBe(false);
    expect(isDepthView("Depth")).toBe(false);
    expect(isDepthView(undefined)).toBe(false);
    expect(isDepthView(null)).toBe(false);
    expect(isDepthView("")).toBe(false);
  });

  it("reads the first of a repeated parameter", () => {
    expect(isDepthView(["depth", "table"])).toBe(true);
    expect(isDepthView(["table", "depth"])).toBe(false);
    expect(isDepthView([])).toBe(false);
  });
});

describe("flatSearch", () => {
  it("turns view=depth into view=timeline, said outright, and keeps the period and any other parameter", () => {
    expect(flatSearch("?view=depth")).toBe("?view=timeline");
    expect(flatSearch("view=depth")).toBe("?view=timeline");
    expect(flatSearch("?view=depth&from=1990&to=2000")).toBe("?view=timeline&from=1990&to=2000");
    expect(flatSearch("?from=1990&view=depth&to=2000&a=1")).toBe("?from=1990&view=timeline&to=2000&a=1");
  });

  it("names the Timeline even when the query named no view: a plain address opens Films on a phone", () => {
    expect(flatSearch("")).toBe("?view=timeline");
    expect(flatSearch("?from=1990&to=2000")).toBe("?from=1990&to=2000&view=timeline");
  });
});

describe("opensDepth", () => {
  const quotes = ["a-quote"];

  it("opens Films on a phone, and the Timeline everywhere else, for an address that names no view", () => {
    expect(opensDepth({}, quotes, true)).toBe(true);
    expect(opensDepth({}, quotes, false)).toBe(false);
    // A period or any other parameter names no view.
    expect(opensDepth({ from: "1990", to: "2000" }, quotes, true)).toBe(true);
    expect(opensDepth({ from: "1990", to: "2000" }, quotes, false)).toBe(false);
    expect(opensDepth({ utm_source: "x" }, quotes, true)).toBe(true);
  });

  it("lets a view the address names win over the device, in both directions", () => {
    expect(opensDepth({ view: "depth" }, quotes, false)).toBe(true);
    expect(opensDepth({ view: "depth" }, quotes, true)).toBe(true);
    for (const view of ["timeline", "table", "clippings"]) {
      expect(opensDepth({ view }, quotes, true), view).toBe(false);
      expect(opensDepth({ view }, quotes, false), view).toBe(false);
    }
  });

  it("takes the first of a repeated view", () => {
    expect(opensDepth({ view: ["table", "depth"] }, quotes, true)).toBe(false);
    expect(opensDepth({ view: ["depth", "table"] }, quotes, false)).toBe(true);
  });

  it("counts a sort, and a quote of the page's own, as naming a view (the Table and the Quotes)", () => {
    expect(opensDepth({ sort: "rating", dir: "desc" }, quotes, true)).toBe(false);
    expect(opensDepth({ quote: "a-quote" }, quotes, true)).toBe(false);
    // A quote the page does not have, and a view it does not know, name nothing.
    expect(opensDepth({ quote: "not-its" }, quotes, true)).toBe(true);
    expect(opensDepth({ view: "bogus" }, quotes, true)).toBe(true);
    expect(opensDepth({ view: "bogus" }, quotes, false)).toBe(false);
  });
});

describe("depthSearch", () => {
  it("is view=depth alone for a page with nothing to carry", () => {
    expect(depthSearch("")).toBe("?view=depth");
    expect(depthSearch("?")).toBe("?view=depth");
  });

  it("carries the period, in its canonical order, before view=depth", () => {
    expect(depthSearch("?from=1970&to=1980")).toBe("?from=1970&to=1980&view=depth");
    expect(depthSearch("to=1980&from=1970")).toBe("?from=1970&to=1980&view=depth");
    expect(depthSearch("?from=1980&to=1970")).toBe("?from=1970&to=1980&view=depth");
    expect(depthSearch("?to=1980")).toBe("?to=1980&view=depth");
  });

  it("leaves the other views' parameters behind", () => {
    expect(depthSearch("?view=timeline&sort=rating&dir=desc&from=1970&to=1980")).toBe("?from=1970&to=1980&view=depth");
    expect(depthSearch("?view=clippings&quote=short-one&utm_source=x")).toBe("?view=depth");
  });
});

describe("withDepth", () => {
  const href = "/p/1032-martin-scorsese";

  it("adds view=depth to a plain href", () => {
    expect(withDepth(href)).toBe(`${href}?view=depth`);
  });

  it("appends to a query that is already there, replacing a view, and keeps a hash last", () => {
    expect(withDepth(`${href}?a=1`)).toBe(`${href}?a=1&view=depth`);
    expect(withDepth(`${href}?view=table&a=1`)).toBe(`${href}?view=depth&a=1`);
    expect(withDepth(`${href}?view=depth`)).toBe(`${href}?view=depth`);
    expect(withDepth(`${href}#x`)).toBe(`${href}?view=depth#x`);
  });

  it("leaves the slug alone: its plus signs are not query characters", () => {
    expect(withDepth("/p/1032-martin-scorsese+3661-thelma-schoonmaker")).toBe(
      "/p/1032-martin-scorsese+3661-thelma-schoonmaker?view=depth",
    );
  });
});

describe("pageViewHref", () => {
  const path = "/p/1032-martin-scorsese+3661-thelma-schoonmaker";

  it("is the page's own address with the view written out, for every view: the Timeline's too, since a plain address opens Films on a phone", () => {
    expect(pageViewHref(path, "", "timeline")).toBe(`${path}?view=timeline`);
    expect(pageViewHref(path, "", "table")).toBe(`${path}?view=table`);
    expect(pageViewHref(path, "", "clippings")).toBe(`${path}?view=clippings`);
    expect(pageViewHref(path, "", "depth")).toBe(`${path}?view=depth`);
  });

  /** The query of an address, as parameters (their order is not the point). */
  const query = (href: string) => Object.fromEntries(new URL(href, "https://parallel.test").searchParams);

  it("keeps the period on every view, whichever view the visitor is leaving", () => {
    const period = { from: "1990", to: "2000" };
    for (const from of ["?from=1990&to=2000", "?from=1990&to=2000&view=depth", "?view=clippings&from=1990&to=2000", "?view=table&from=1990&to=2000"]) {
      expect(query(pageViewHref(path, from, "timeline")), from).toEqual({ ...period, view: "timeline" });
      expect(query(pageViewHref(path, from, "table")), from).toEqual({ ...period, view: "table" });
      expect(query(pageViewHref(path, from, "clippings")), from).toEqual({ ...period, view: "clippings" });
      expect(query(pageViewHref(path, from, "depth")), from).toEqual({ ...period, view: "depth" });
    }
  });

  it("leaves a quote behind when the Clippings are left, and a sort when Focus is chosen", () => {
    expect(query(pageViewHref(path, "?view=clippings&quote=short-one&from=1990&to=2000", "table"))).toEqual({ view: "table", from: "1990", to: "2000" });
    expect(query(pageViewHref(path, "?view=table&sort=year&dir=desc&from=1990&to=2000", "depth"))).toEqual({ from: "1990", to: "2000", view: "depth" });
    // A sort in the query would read as the Table's: the Timeline says so outright.
    expect(query(pageViewHref(path, "?view=table&sort=year&dir=desc", "timeline"))).toEqual({ view: "timeline", sort: "year", dir: "desc" });
  });
});
