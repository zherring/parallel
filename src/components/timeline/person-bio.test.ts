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
    expect(html).not.toContain('aria-label="Details for');
    expect(html).toContain('title="Details for Jack Lemmon"');
    expect(html).toContain("Jack Lemmon</button>");
    expect(html).not.toContain("href=");
  });

  it("says another name in place of the person's, but opens on the same person", () => {
    const html = renderToStaticMarkup(createElement(PersonBio, { person, onOpen, nameTrigger: true, label: "Lemmon" }));
    expect(html).toContain(">Lemmon</button>");
    expect(html).toContain('title="Details for Jack Lemmon"');
  });

  it("lets a portrait open the person panel too: a button of its own, out of the Tab order, named like the name beside it", () => {
    const html = renderToStaticMarkup(
      createElement(PersonBio, { person, onOpen, portrait: createElement("span", { "data-face": "" }), portraitClassName: "rounded-(--bar-radius)" }),
    );
    expect(html).toContain('aria-label="Details for Jack Lemmon"');
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain("rounded-(--bar-radius)");
    expect(html).toContain('<span data-face=""></span>');
    expect(html.match(/<button/g)).toHaveLength(1);
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

  it("is only a trigger: one button per variant and no dialog markup of its own", () => {
    const variants = [
      { person: withBiography, nameTrigger: true },
      { person: withBiography },
      { person: withBiography, flow: true },
    ];
    for (const props of variants) {
      const html = renderToStaticMarkup(createElement(PersonBio, { onOpen, ...props }));
      expect(html.match(/<button/g)).toHaveLength(1);
      expect(html).not.toContain('role="dialog"');
      expect(html).not.toContain("aria-modal");
    }
  });
});
