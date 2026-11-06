import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PeoplePanel, type PanelPerson } from "@/components/timeline/people-panel";

const person = (id: number, name: string): PanelPerson => ({
  person: { id, name, profilePath: null, knownFor: null, birthday: null, deathday: null, biography: null },
  slot: id - 1,
  roles: "Director",
  facts: "Born 1950",
  filmCount: 10,
  visible: true,
  removeHref: "/",
});

function markup(layout: "condense" | "stack", openIds = new Set<number>(layout === "stack" ? [1, 2] : [])) {
  return renderToStaticMarkup(
    createElement(PeoplePanel, {
      people: [person(1, "Jack Lemmon"), person(2, "Walter Matthau")],
      layout,
      onLayoutChange: () => {},
      openIds,
      onToggleOpen: () => {},
      onToggleVisible: () => {},
    }),
  );
}

describe("PeoplePanel", () => {
  it("has one expand/condense control instead of a Condense/Stack pair", () => {
    const html = markup("condense");
    expect(html).toContain("Expand every person&#x27;s details");
    expect(html).not.toContain("Condense</button>");
    expect(html).not.toContain("Stack</button>");
  });

  it("points the arrows out to expand and in to condense", () => {
    expect(markup("condense")).toContain("lucide-maximize-2");
    expect(markup("stack")).toContain("lucide-minimize-2");
    expect(markup("stack")).toContain("Condense the people list");
  });

  it("keeps individual carets when all details have been opened", () => {
    const html = markup("stack");
    expect(html).toContain('aria-label="Collapse Jack Lemmon"');
    expect(html).toContain('aria-label="Collapse Walter Matthau"');
    expect(html.match(/lucide-chevron-down/g)).toHaveLength(2);
  });

  it("puts the row's caret before the portrait", () => {
    const row = markup("condense").split("<li ")[1];
    expect(row.indexOf('aria-label="Expand Jack Lemmon"')).toBeLessThan(row.indexOf("JL"));
  });

  it("opens the artist's bio from the name without navigating to a solo timeline", () => {
    const html = markup("condense");
    expect(html).toContain('aria-label="Biography of Jack Lemmon"');
    expect(html).toContain('aria-label="Biography of Walter Matthau"');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).not.toContain('href="/p/');
  });

  it("keeps the row-wide unfurl target separate from the name and eye", () => {
    const row = markup("condense").split("<li ")[1];
    expect(row).toContain("inset-y-0 left-0 right-10");
    expect(row.indexOf("</button>")).toBeLessThan(row.indexOf('aria-label="Biography of Jack Lemmon"'));
    expect(row).toContain("pointer-events-none flex");
    expect(row).toContain("pointer-events-auto relative inline-block");
    expect(row).toContain("inset-y-0 right-0 inline-flex w-10");
    expect(row).toContain("Show Jack Lemmon&#x27;s films on the timeline");
  });

  it("leaves poster-row controls in the timeline rather than the people panel", () => {
    for (const layout of ["condense", "stack"] as const) {
      const html = markup(layout);
      expect(html).not.toContain("Show all films");
      expect(html).not.toContain("Show fewer films");
    }
  });

  it("docks the fully expanded panel with a square divider and no floating shadow", () => {
    const html = markup("stack");
    expect(html).toContain("md:self-stretch");
    expect(html).toContain("md:rounded-r-none");
    expect(html).toContain("md:shadow-none");
    expect(html).not.toContain("md:self-start");
  });

  it("keeps the compact panel content-sized with a timeline-height cap", () => {
    const html = markup("condense");
    expect(html).toContain("md:self-start");
    expect(html).toContain("md:shadow-lg");
    expect(html).toContain("md:max-h-[calc(clamp(26rem,100dvh-var(--chrome),1100px)-1.5rem)]");
    expect(html).not.toContain("md:self-stretch");
  });

  it("stays content-sized when every person has been opened individually", () => {
    const html = markup("condense", new Set([1, 2]));
    expect(html).toContain('aria-label="Collapse Jack Lemmon"');
    expect(html).toContain('aria-label="Collapse Walter Matthau"');
    expect(html).toContain("md:self-start");
    expect(html).not.toContain("md:self-stretch");
    expect(html).toContain("lucide-maximize-2");
  });
});
