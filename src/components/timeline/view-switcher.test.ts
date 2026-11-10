import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { FilmsView, PageView } from "@/lib/films-view";
import { QuotesLink, ViewSwitcher } from "./view-switcher";
import { inPlace, isPlainClick } from "./view-tabs";

const hrefFor = (view: FilmsView) => `/p/a?view=${view}`;
const switcher = (props: Partial<Parameters<typeof ViewSwitcher>[0]> = {}) =>
  renderToStaticMarkup(createElement(ViewSwitcher, { view: "timeline", hrefFor, ...props }));
const quotes = (props: Partial<Parameters<typeof QuotesLink>[0]> = {}) =>
  renderToStaticMarkup(createElement(QuotesLink, { current: false, href: "/p/a?view=clippings", ...props }));

/** The links of some markup, as their text, current mark, address and title. */
const linksOf = (html: string) =>
  [...html.matchAll(/<a\b([^>]*)>([^<]*)<\/a>/g)].map(([, attributes, text]) => ({
    text,
    current: /aria-current="page"/.test(attributes),
    href: /href="([^"]*)"/.exec(attributes)?.[1],
    title: /title="([^"]*)"/.exec(attributes)?.[1] ?? null,
  }));

describe("ViewSwitcher", () => {
  it("is one nav of three text links, Films, Timeline and Table, in that order, each with a title", () => {
    const html = switcher();
    expect(html).toContain('<nav aria-label="Views"');
    const links = linksOf(html);
    expect(links.map((link) => link.text)).toEqual(["Films", "Timeline", "Table"]);
    expect(links.map((link) => link.href)).toEqual(["/p/a?view=depth", "/p/a?view=timeline", "/p/a?view=table"]);
    expect(links.every((link) => link.title && link.title.length > 6)).toBe(true);
    expect(links.map((link) => link.title?.split(" ")[0])).toEqual(["Films", "Timeline", "Table"]);
    // Words, not icons, and links, not buttons.
    expect(html).not.toMatch(/<svg\b/);
    expect(html).not.toMatch(/<button\b/);
  });

  it("never says Focus: the Depth view is Films to a person", () => {
    expect(switcher()).not.toContain("Focus");
    expect(switcher({ sheet: true })).not.toContain("Focus");
  });

  it("marks the view the page is on as current, and none for the Quotes", () => {
    for (const [view, expected] of [
      ["depth", [true, false, false]],
      ["timeline", [false, true, false]],
      ["table", [false, false, true]],
      ["clippings", [false, false, false]],
    ] satisfies [PageView, boolean[]][]) {
      expect(linksOf(switcher({ view })).map((link) => link.current), view).toEqual(expected);
    }
  });

  it("has the same three words in the phone's sheet, as a row that fills it", () => {
    const sheet = switcher({ sheet: true });
    expect(linksOf(sheet).map((link) => link.text)).toEqual(["Films", "Timeline", "Table"]);
    expect(sheet).toContain("w-full");
    // The bar's box is the bar's height; the sheet's is not.
    expect(switcher()).toContain("h-(--bar-h)");
    expect(sheet).not.toContain("h-(--bar-h)");
  });

  it("asks the page for the click handler of each view, in order: the page decides which views it shows in place", () => {
    const asked: FilmsView[] = [];
    const html = switcher({
      onClickFor: (view) => {
        asked.push(view);
        return undefined;
      },
    });
    expect(asked).toEqual(["depth", "timeline", "table"]);
    // Without a handler a link is a plain link: it navigates.
    expect(html.match(/<a\b/g)).toHaveLength(3);
  });
});

describe("QuotesLink", () => {
  it("is a text link named Quotes, to the Quotes' address; what a person reads is Quotes, the code says clippings", () => {
    const html = quotes();
    expect(linksOf(html)).toEqual([expect.objectContaining({ text: "Quotes", href: "/p/a?view=clippings", current: false })]);
    expect(html).not.toContain("Clippings");
    expect(html).not.toMatch(/<svg\b/);
  });

  it("is current on the Quotes alone", () => {
    expect(linksOf(quotes({ current: true }))[0].current).toBe(true);
    expect(linksOf(quotes({ current: false }))[0].current).toBe(false);
  });

  it("is the bar's height and radius, and the sheet's row is not", () => {
    expect(quotes()).toContain("h-(--bar-h)");
    expect(quotes()).toContain("rounded-(--bar-radius)");
    expect(quotes({ sheet: true })).not.toContain("h-(--bar-h)");
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
