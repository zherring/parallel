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

const pair = [person(1, "Jack Lemmon"), person(2, "Walter Matthau")];

function markup(
  layout: "condense" | "stack",
  openIds = new Set<number>(layout === "stack" ? [1, 2] : []),
  people: PanelPerson[] = pair,
) {
  return renderToStaticMarkup(
    createElement(PeoplePanel, {
      people,
      layout,
      onLayoutChange: () => {},
      openIds,
      onToggleOpen: () => {},
      onToggleVisible: () => {},
      onOpenPerson: () => {},
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

  it("opens the artist's details from the name without navigating to a solo timeline", () => {
    const html = markup("condense");
    // The name is text in the heading (which names the lane region), not a label that renames it.
    expect(html).not.toContain('aria-label="Details for');
    expect(html).toContain('title="Details for Jack Lemmon"');
    expect(html).toContain('title="Details for Walter Matthau"');
    expect(html).toContain(">Jack Lemmon</button>");
    expect(html).toContain(">Walter Matthau</button>");
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).not.toContain('href="/p/');
  });

  it("keeps the row-wide unfurl target separate from the name and eye", () => {
    const row = markup("condense").split("<li ")[1];
    const unfurl = row.indexOf('aria-label="Expand Jack Lemmon"');
    const bio = row.indexOf('title="Details for Jack Lemmon"');
    const eye = row.indexOf("Show Jack Lemmon&#x27;s films on the timeline");
    // Three controls, in reading order: unfurl, name, eye; none of them inside another.
    expect(unfurl).toBeGreaterThan(-1);
    expect(bio).toBeGreaterThan(unfurl);
    expect(eye).toBeGreaterThan(bio);
    expect(row.indexOf("</button>")).toBeLessThan(bio);
    // One eye per person, each a pressed-state toggle (the expand control is a third, with its own name).
    expect(markup("condense").match(/aria-pressed="true" aria-label="Show /g)).toHaveLength(2);
  });

  it("leaves poster-row controls in the timeline rather than the people panel", () => {
    for (const layout of ["condense", "stack"] as const) {
      const html = markup(layout);
      expect(html).not.toContain("Show all films");
      expect(html).not.toContain("Show fewer films");
    }
  });

  it("docks the fully expanded panel flush, apart from a compact one that floats", () => {
    expect(markup("stack")).toContain('data-layout="stack"');
    expect(markup("stack")).not.toContain('data-layout="condense"');
  });

  it("keeps the compact panel content-sized", () => {
    expect(markup("condense")).toContain('data-layout="condense"');
    expect(markup("condense")).not.toContain('data-layout="stack"');
  });

  it("stays compact when every person has been opened individually", () => {
    const html = markup("condense", new Set([1, 2]));
    expect(html).toContain('aria-label="Collapse Jack Lemmon"');
    expect(html).toContain('aria-label="Collapse Walter Matthau"');
    expect(html).toContain('data-layout="condense"');
    expect(html).toContain("lucide-maximize-2");
  });

  it("explains the green only while two or more people are on the track", () => {
    expect(markup("condense")).toContain("Green: made together");
    const oneHidden = [pair[0], { ...pair[1], visible: false }];
    expect(markup("condense", new Set(), oneHidden)).not.toContain("Green: made together");
  });

  it("disables the eye of the last person on the track, and only theirs", () => {
    const oneHidden = [pair[0], { ...pair[1], visible: false }];
    const html = markup("condense", new Set(), oneHidden);
    const [, lemmon, matthau] = html.split("<li ");
    expect(lemmon).toMatch(/aria-label="Show Jack Lemmon&#x27;s films on the timeline"[^>]*disabled=""/);
    expect(matthau).not.toContain('disabled=""');
    // With both on the track, either can be hidden.
    expect(markup("condense")).not.toContain('disabled=""');
  });
});
