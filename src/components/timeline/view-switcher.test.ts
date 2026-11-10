import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { PageView } from "@/lib/films-view";
import { ViewSwitcher } from "./view-switcher";
import { inPlace, isPlainClick } from "./view-tabs";

const hrefFor = (view: PageView) => `/p/a?view=${view}`;
const switcher = (props: Partial<Parameters<typeof ViewSwitcher>[0]> = {}) =>
  renderToStaticMarkup(createElement(ViewSwitcher, { view: "timeline", hrefFor, ...props }));

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

  it("has Quotes as its fourth segment, inside the same box, for a page that has quotes, and not otherwise", () => {
    const html = switcher({ quotes: true });
    expect(html.match(/<nav\b/g)).toHaveLength(1);
    const links = linksOf(html);
    expect(links.map((link) => link.text)).toEqual(["Films", "Timeline", "Table", "Quotes"]);
    expect(links[3]).toMatchObject({ href: "/p/a?view=clippings" });
    // What a person reads is Quotes; the address and the code say clippings.
    expect(html).not.toContain("Clippings");
    expect(linksOf(switcher({ quotes: false })).map((link) => link.text)).toEqual(["Films", "Timeline", "Table"]);
    expect(linksOf(switcher()).map((link) => link.text)).toEqual(["Films", "Timeline", "Table"]);
  });

  it("never says Focus: the Depth view is Films to a person", () => {
    expect(switcher({ quotes: true })).not.toContain("Focus");
    expect(switcher({ sheet: true })).not.toContain("Focus");
  });

  it("marks the one view the page is on as current, the Quotes' segment on the Quotes like any other", () => {
    for (const [view, expected] of [
      ["depth", [true, false, false, false]],
      ["timeline", [false, true, false, false]],
      ["table", [false, false, true, false]],
      ["clippings", [false, false, false, true]],
    ] satisfies [PageView, boolean[]][]) {
      expect(linksOf(switcher({ view, quotes: true })).map((link) => link.current), view).toEqual(expected);
    }
    // Without quotes there is no fourth segment to mark: the three are as they were.
    expect(linksOf(switcher({ view: "table" })).map((link) => link.current)).toEqual([false, false, true]);
  });

  it("has the same segments in the phone's sheet, as a row that fills it", () => {
    const sheet = switcher({ sheet: true, quotes: true });
    expect(linksOf(sheet).map((link) => link.text)).toEqual(["Films", "Timeline", "Table", "Quotes"]);
    expect(sheet).toContain("w-full");
    // The bar's box is the bar's height; the sheet's is not.
    expect(switcher()).toContain("h-(--bar-h)");
    expect(sheet).not.toContain("h-(--bar-h)");
  });

  it("gives every segment the bar's one radius inside, concentric with the box", () => {
    const html = switcher({ quotes: true });
    expect(html).toContain("rounded-(--bar-radius)");
    expect(html.match(/rounded-\[max\(0px,calc\(var\(--bar-radius\)-var\(--switcher-pad\)\)\)\]/g)).toHaveLength(4);
  });

  it("asks the page for the click handler of each view, in order: the page decides which views it shows in place", () => {
    const asked: PageView[] = [];
    const html = switcher({
      quotes: true,
      onClickFor: (view) => {
        asked.push(view);
        return undefined;
      },
    });
    expect(asked).toEqual(["depth", "timeline", "table", "clippings"]);
    // Without a handler a link is a plain link: it navigates.
    expect(html.match(/<a\b/g)).toHaveLength(4);
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
