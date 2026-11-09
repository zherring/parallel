import { describe, expect, it } from "vitest";
import { DEPTH_VIEW, depthSearch, flatSearch, isDepthView, withDepth } from "@/lib/depth-url";

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
