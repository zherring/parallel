import { describe, expect, it } from "vitest";
import { DEPTH_VIEW, flatSearch, isDepthView, redirectSearch, withDepth } from "@/lib/depth-url";

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

describe("redirectSearch", () => {
  it("is empty for a query with nothing to carry", () => {
    expect(redirectSearch({})).toBe("");
    expect(redirectSearch({ view: "table", sort: "year", utm_source: "x" })).toBe("");
    expect(redirectSearch({ from: "abc", to: "xyz" })).toBe("");
  });

  it("carries the period in its canonical order, as it always did", () => {
    expect(redirectSearch({ from: "1970", to: "1980" })).toBe("?from=1970&to=1980");
    expect(redirectSearch({ from: "1980", to: "1970" })).toBe("?from=1970&to=1980");
    expect(redirectSearch({ to: "1980" })).toBe("?to=1980");
  });

  it("carries view=depth, after the period, and nothing else", () => {
    expect(redirectSearch({ view: "depth" })).toBe("?view=depth");
    expect(redirectSearch({ view: "depth", from: "1970", to: "1980", sort: "year" })).toBe("?from=1970&to=1980&view=depth");
    expect(redirectSearch({ view: ["depth", "table"] })).toBe("?view=depth");
  });
});

describe("flatSearch", () => {
  it("drops view=depth and keeps the period and any other parameter", () => {
    expect(flatSearch("?view=depth")).toBe("");
    expect(flatSearch("view=depth")).toBe("");
    expect(flatSearch("?view=depth&from=1990&to=2000")).toBe("?from=1990&to=2000");
    expect(flatSearch("?from=1990&view=depth&to=2000&a=1")).toBe("?from=1990&to=2000&a=1");
  });

  it("is the same query when it was not the Depth view", () => {
    expect(flatSearch("")).toBe("");
    expect(flatSearch("?from=1990&to=2000")).toBe("?from=1990&to=2000");
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
