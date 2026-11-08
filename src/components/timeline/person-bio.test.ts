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

const withBiography: PersonSummary = {
  ...person,
  biography: "Jack Lemmon was an American actor. He won two Academy Awards.",
};

const onOpen = () => {};

describe("PersonBio", () => {
  it("lets the name open the person panel when TMDB has no biography", () => {
    const html = renderToStaticMarkup(createElement(PersonBio, { person, onOpen, nameTrigger: true }));
    expect(html).toContain('aria-haspopup="dialog"');
    // The name is the button's text, so the heading and the lane region it names still read "Jack Lemmon".
    expect(html).not.toContain('aria-label="Biography of');
    expect(html).toContain('title="Biography of Jack Lemmon"');
    expect(html).toContain("Jack Lemmon</button>");
    expect(html).not.toContain("href=");
  });

  it("says another name in place of the person's, but opens on the same person", () => {
    const html = renderToStaticMarkup(createElement(PersonBio, { person, onOpen, nameTrigger: true, label: "Lemmon" }));
    expect(html).toContain(">Lemmon</button>");
    expect(html).toContain('title="Biography of Jack Lemmon"');
  });

  it("still omits an empty teaser", () => {
    expect(renderToStaticMarkup(createElement(PersonBio, { person, onOpen }))).toBe("");
  });

  it("gives a person with a biography a teaser and a More button, in the lane header and in the people column", () => {
    for (const flow of [false, true]) {
      const html = renderToStaticMarkup(createElement(PersonBio, { person: withBiography, onOpen, flow }));
      expect(html).toContain("Jack Lemmon was an American actor.");
      expect(html).toContain("More<span");
      expect(html).toContain('aria-haspopup="dialog"');
    }
  });

  it("no longer renders a dialog of its own", () => {
    const html = renderToStaticMarkup(createElement(PersonBio, { person: withBiography, onOpen, nameTrigger: true }));
    expect(html).not.toContain("<dialog");
  });
});
