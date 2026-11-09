import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PersonPanelEntry } from "@/lib/side-panel";
import { PersonContent } from "./person-panel";

const entry: PersonPanelEntry = {
  person: {
    id: 137427,
    name: "Denis Villeneuve",
    profilePath: "/abc.jpg",
    knownFor: "Directing",
    birthday: "1967-10-03",
    deathday: null,
    biography: "Denis Villeneuve is a Canadian film director.\n\nHe was born in Quebec.",
  },
  roles: "Director, Writer",
};
const pair = [
  { id: 137427, name: "Denis Villeneuve" },
  { id: 151, name: "Roger Deakins" },
];

function content(overrides: Partial<PersonPanelEntry["person"]> = {}, peopleInView = pair) {
  return renderToStaticMarkup(
    createElement(PersonContent, {
      entry: { ...entry, person: { ...entry.person, ...overrides } },
      titleId: "title",
      peopleInView,
    }),
  );
}

describe("PersonContent", () => {
  it("names the dialog with a heading that links to TMDB in a new tab", () => {
    const html = content();
    expect(html).toMatch(/<h2 id="title"[^>]*><a href="https:\/\/www\.themoviedb\.org\/person\/137427" target="_blank"/);
    expect(html).toContain(">Denis Villeneuve</a></h2>");
  });

  it("gives the roles, the life line and every paragraph of the biography", () => {
    const html = content();
    expect(html).toContain("Director, Writer");
    expect(html).toContain("Born October 3, 1967");
    expect(html).toContain("<p>Denis Villeneuve is a Canadian film director.</p>");
    expect(html).toContain("<p>He was born in Quebec.</p>");
    expect(html).toContain("Read more on TMDB");
  });

  it("says so when TMDB has no biography, and keeps the way to TMDB", () => {
    const html = content({ biography: null });
    expect(html).toContain("No biography available on TMDB.");
    expect(html).toContain("Read more on TMDB");
  });

  it("shows the initials under the photo, and alone when TMDB has no photo", () => {
    expect(content()).toContain("https://image.tmdb.org/t/p/w342/abc.jpg");
    expect(content()).toContain(">DV<");
    const bare = content({ profilePath: null });
    expect(bare).toContain(">DV<");
    expect(bare).not.toContain("<img");
  });

  it("links to the person's own timeline from a page with others", () => {
    expect(content()).toContain('href="/p/137427-denis-villeneuve"');
  });

  it("leaves that link out on the person's own page", () => {
    expect(content({}, [pair[0]])).not.toContain('href="/p/');
  });
});
