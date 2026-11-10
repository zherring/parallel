import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { FilmsView, PageView } from "@/lib/films-view";
import { ViewSwitcher } from "./view-switcher";
import { SectionTabs, inPlace, isPlainClick } from "./view-tabs";

const hrefFor = (view: FilmsView) => `/p/a?view=${view}`;
const switcher = (props: Partial<Parameters<typeof ViewSwitcher>[0]> = {}) =>
  renderToStaticMarkup(createElement(ViewSwitcher, { view: "timeline", hrefFor, ...props }));
const tabs = (props: Partial<Parameters<typeof SectionTabs>[0]> = {}) =>
  renderToStaticMarkup(
    createElement(SectionTabs, { clippings: true, section: "films", filmsHref: "/p/a", clippingsHref: "/p/a?view=clippings", ...props }),
  );

/** The links of some markup, as [label, current, href]. */
const linksOf = (html: string) =>
  [...html.matchAll(/<a\b([^>]*)>/g)].map(([, attributes]) => ({
    label: /aria-label="([^"]*)"/.exec(attributes)?.[1] ?? null,
    current: /aria-current="page"/.test(attributes),
    href: /href="([^"]*)"/.exec(attributes)?.[1],
    title: /title="([^"]*)"/.exec(attributes)?.[1] ?? null,
  }));

describe("ViewSwitcher", () => {
  it("is one nav of three icon links, Timeline, Focus and Table, in that order, each with an aria-label and a title", () => {
    const html = switcher();
    expect(html).toContain('<nav aria-label="Films view"');
    const links = linksOf(html);
    expect(links.map((link) => link.label)).toEqual(["Timeline view", "Focus view", "Table view"]);
    expect(links.map((link) => link.href)).toEqual(["/p/a?view=timeline", "/p/a?view=depth", "/p/a?view=table"]);
    expect(links.every((link) => link.title && link.title.length > 6)).toBe(true);
    expect(links.map((link) => link.title?.split(" ")[0])).toEqual(["Timeline", "Focus", "Table"]);
    // Each is an icon (an inline svg), and no button: they are links.
    expect(html.match(/<svg\b/g)).toHaveLength(3);
    expect(html).not.toMatch(/<button\b/);
  });

  it("marks the view the page is on as current, and none for the Quotes", () => {
    for (const [view, expected] of [
      ["timeline", [true, false, false]],
      ["depth", [false, true, false]],
      ["table", [false, false, true]],
      ["clippings", [false, false, false]],
    ] satisfies [PageView, boolean[]][]) {
      expect(linksOf(switcher({ view })).map((link) => link.current), view).toEqual(expected);
    }
  });

  it("writes the words beside the icons only when asked to (the phone's sheet)", () => {
    const bar = switcher();
    for (const word of ["Timeline", "Focus", "Table"]) expect(bar).not.toContain(`>${word}<`);
    const sheet = switcher({ labelled: true });
    for (const word of ["Timeline", "Focus", "Table"]) expect(sheet).toContain(`>${word}<`);
    // The accessible name still holds the shown word (label in name).
    expect(linksOf(sheet).map((link) => link.label)).toEqual(["Timeline view", "Focus view", "Table view"]);
  });

  it("asks the page for the click handler of each view, in order: the page decides which views it shows in place", () => {
    const asked: FilmsView[] = [];
    const html = switcher({
      onClickFor: (view) => {
        asked.push(view);
        return undefined;
      },
    });
    expect(asked).toEqual(["timeline", "depth", "table"]);
    // Without a handler a link is a plain link: it navigates.
    expect(html.match(/<a\b/g)).toHaveLength(3);
  });
});

describe("SectionTabs", () => {
  it("is Films and Quotes for a page that has them, Films current on the Timeline, Focus and Table", () => {
    const links = linksOf(tabs());
    expect(links.map((link) => link.href)).toEqual(["/p/a", "/p/a?view=clippings"]);
    expect(links.map((link) => link.current)).toEqual([true, false]);
    expect(tabs()).toContain('<nav aria-label="Sections"');
    expect(tabs()).toContain(">Films<");
    expect(tabs()).toContain(">Quotes<");
  });

  it("marks Quotes current on the Quotes", () => {
    expect(linksOf(tabs({ section: "clippings" })).map((link) => link.current)).toEqual([false, true]);
  });

  it("is Films alone for a page without Quotes, so that the bar is the same size on every page", () => {
    const html = tabs({ clippings: false });
    expect(linksOf(html)).toHaveLength(1);
    expect(html).toContain(">Films<");
    expect(html).not.toContain("Quotes");
    expect(linksOf(html)[0].current).toBe(true);
  });

  it("goes where the Films href says: the view last used", () => {
    expect(linksOf(tabs({ filmsHref: "/p/a?view=depth" }))[0].href).toBe("/p/a?view=depth");
  });

  it("keeps the words for a screen reader when the bar has no room for them (compact)", () => {
    const html = tabs({ compact: true });
    expect(html).toContain('class="max-lg:sr-only">Films<');
    expect(tabs()).not.toContain("max-lg:sr-only");
  });
});

describe("inPlace and isPlainClick", () => {
  const click = (overrides: Partial<{ button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean }> = {}) => {
    const preventDefault = vi.fn();
    const event = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, preventDefault, ...overrides };
    return { event: event as never, preventDefault };
  };

  it("has no handler without a choice to make: the link navigates", () => {
    expect(inPlace(undefined)).toBeUndefined();
  });

  it("chooses in place on a plain click, and keeps the link for the browser on any other", () => {
    const choose = vi.fn();
    const handler = inPlace(choose)!;
    const plain = click();
    handler(plain.event);
    expect(choose).toHaveBeenCalledTimes(1);
    expect(plain.preventDefault).toHaveBeenCalledTimes(1);
    for (const modified of [{ metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) {
      const other = click(modified);
      handler(other.event);
      expect(other.preventDefault).not.toHaveBeenCalled();
      expect(isPlainClick(other.event)).toBe(false);
    }
    expect(choose).toHaveBeenCalledTimes(1);
  });
});
