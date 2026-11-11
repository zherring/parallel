import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PersonSummary } from "@/lib/types";
import { LaneHeader } from "./lane-header";

const person: PersonSummary = {
  id: 3460,
  name: "Gene Wilder",
  profilePath: null,
  knownFor: "Acting",
  birthday: "1933-06-11",
  deathday: "2016-08-29",
  biography: "Gene Wilder was an American actor. He began on the stage.",
};

const props = {
  person,
  roles: "Actor, Writer",
  facts: "Born 1933 · died 2016 · first film 1966",
  span: "1966–2005",
  soloHref: null,
  removeHref: "/",
  divider: false,
  onOpenPerson: () => {},
};

const html = (extra: Record<string, unknown> = {}) => renderToStaticMarkup(createElement(LaneHeader, { ...props, ...extra }));

describe("LaneHeader", () => {
  it("has the biography teaser and its More button by default: a page of several people has no masthead to say it", () => {
    const out = html();
    expect(out).toContain("data-person-bio");
    expect(out).toContain("Gene Wilder was an American actor.");
    expect(out).toContain("More<span");
  });

  it("leaves the biography to the masthead on a page of one person: the name, the roles, the years and the remove link stay", () => {
    const out = html({ bio: false });
    expect(out).not.toContain("data-person-bio");
    expect(out).not.toContain("Gene Wilder was an American actor.");
    expect(out).not.toContain("More<span");
    expect(out).toContain('id="person-3460"');
    expect(out).toContain("Actor, Writer");
    expect(out).toContain("Born 1933");
    expect(out).toContain("1966–2005");
    expect(out).toContain('aria-label="Remove Gene Wilder"');
  });

  it("pins its content under the page bar when told where (pinTop), and is the lane's height without it", () => {
    const pinned = html({ pinTop: "calc(0.75rem + var(--bar-h))" });
    expect(pinned).toMatch(/data-lane-head-pin[^>]*style="top:calc\(0\.75rem \+ var\(--bar-h\)\)"/);
    expect(pinned).not.toContain("h-full");
    const loose = html();
    expect(loose).toMatch(/data-lane-head-pin[^>]*class="[^"]*h-full/);
    expect(loose).not.toContain("top:");
  });

  it("keeps the header's own box (the one the track measures and draws its borders on) around the pinned block", () => {
    const out = html({ pinTop: "0px", divider: true });
    const header = out.indexOf('data-lane-head="true"');
    expect(header).toBeGreaterThanOrEqual(0);
    expect(header).toBeLessThan(out.indexOf("data-lane-head-pin"));
    expect(out).toMatch(/data-lane-head="true"[^>]*border-b/);
  });
});
