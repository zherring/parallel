import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isSenderPeriod, useUrlPeriod } from "@/components/timeline/use-period";
import type { Period, RawPeriod } from "@/lib/period";

/** Renders the hook on the server, the way the page's first render does, and hands back what it returned. */
function renderHook() {
  let result: readonly [RawPeriod, (next: Period | null) => void] | undefined;
  function Probe() {
    result = useUrlPeriod();
    return null;
  }
  renderToStaticMarkup(createElement(Probe));
  return result!;
}

/** A browser's `window`, as far as the hook looks: where the page is, and what `history.replaceState` was asked. */
function browserAt(pathname: string, search = "", hash = "") {
  const replaceState = vi.fn();
  vi.stubGlobal("window", { location: { pathname, search, hash }, history: { replaceState }, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  return replaceState;
}

afterEach(() => vi.unstubAllGlobals());

// Each test uses a path of its own: what the hook remembers (see `isSenderPeriod`) is per page.
describe("useUrlPeriod", () => {
  it("shows no period on the server and on the first client render, so they match", () => {
    expect(renderHook()[0]).toEqual({ from: null, to: null });
  });

  it("writes a period to the address bar with replaceState, keeping the other parameters and the hash", () => {
    const [, setPeriod] = renderHook();
    const replaceState = browserAt("/p/write", "?view=table&sort=year", "#films");
    setPeriod({ from: 1970, to: 1980 });
    expect(replaceState).toHaveBeenCalledTimes(1);
    expect(replaceState).toHaveBeenCalledWith(null, "", "/p/write?view=table&sort=year&from=1970&to=1980#films");
  });

  it("replaces the period the address bar had", () => {
    const [, setPeriod] = renderHook();
    const replaceState = browserAt("/p/replace", "?from=1966&to=1998");
    setPeriod({ from: 1970, to: 1980 });
    expect(replaceState).toHaveBeenCalledWith(null, "", "/p/replace?from=1970&to=1980");
  });

  it("takes the period away with null, keeping the rest", () => {
    const [, setPeriod] = renderHook();
    const replaceState = browserAt("/p/clear", "?view=table&from=1970&to=1980");
    setPeriod(null);
    expect(replaceState).toHaveBeenCalledWith(null, "", "/p/clear?view=table");
    const bare = browserAt("/p/clear2", "?from=1970&to=1980");
    setPeriod(null);
    expect(bare).toHaveBeenCalledWith(null, "", "/p/clear2");
  });
});

describe("isSenderPeriod", () => {
  it("is false for a period nobody on this page has chosen: one that came with the link", () => {
    browserAt("/p/fresh", "?from=1970&to=1980");
    expect(isSenderPeriod({ from: 1970, to: 1980 })).toBe(false);
  });

  it("is true for the period this page's own controls just wrote, and only for that one", () => {
    const [, setPeriod] = renderHook();
    browserAt("/p/chosen");
    setPeriod({ from: 1970, to: 1980 });
    expect(isSenderPeriod({ from: 1970, to: 1980 })).toBe(true);
    expect(isSenderPeriod({ from: 1970, to: 1981 })).toBe(false);
    expect(isSenderPeriod({ from: 1971, to: 1980 })).toBe(false);
  });

  it("is false on another page, where the same years came with a link", () => {
    const [, setPeriod] = renderHook();
    browserAt("/p/first-page");
    setPeriod({ from: 1970, to: 1980 });
    browserAt("/p/second-page", "?from=1970&to=1980");
    expect(isSenderPeriod({ from: 1970, to: 1980 })).toBe(false);
  });

  it("follows the last thing written: a new choice replaces the old one", () => {
    const [, setPeriod] = renderHook();
    browserAt("/p/follows");
    setPeriod({ from: 1970, to: 1980 });
    setPeriod({ from: 1975, to: 1985 });
    expect(isSenderPeriod({ from: 1970, to: 1980 })).toBe(false);
    expect(isSenderPeriod({ from: 1975, to: 1985 })).toBe(true);
  });

  it("is false for every period once the period was taken away", () => {
    const [, setPeriod] = renderHook();
    browserAt("/p/taken-away");
    setPeriod({ from: 1970, to: 1980 });
    setPeriod(null);
    expect(isSenderPeriod({ from: 1970, to: 1980 })).toBe(false);
  });
});
