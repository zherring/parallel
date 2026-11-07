import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PersonSummary } from "@/lib/types";
import { PersonBio } from "./person-bio";

const person: PersonSummary = {
  id: 1,
  name: "Jack Lemmon",
  profilePath: null,
  knownFor: null,
  birthday: null,
  deathday: null,
  biography: null,
};

describe("PersonBio", () => {
  it("lets the name open the dialog when TMDB has no biography", () => {
    const html = renderToStaticMarkup(createElement(PersonBio, { person, roles: "Actor", nameTrigger: true }));
    expect(html).toContain('aria-haspopup="dialog"');
    // The name is the button's text, so the heading and the lane region it names still read "Jack Lemmon".
    expect(html).not.toContain('aria-label="Biography of');
    expect(html).toContain('title="Biography of Jack Lemmon"');
    expect(html).toContain("Jack Lemmon</button>");
    expect(html).not.toContain("href=");
  });

  it("still omits an empty teaser", () => {
    expect(renderToStaticMarkup(createElement(PersonBio, { person, roles: "Actor" }))).toBe("");
  });
});
