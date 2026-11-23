import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BACON, BACON_FILM_TITLE, togetherNote } from "@/lib/bacon-mode";
import type { FilmDetails } from "@/lib/types";
import { FilmContent } from "./film-content";

const film: FilmDetails = {
  id: 150540,
  title: "Apollo 13",
  year: 1995,
  releaseDate: "1995-06-30",
  posterPath: null,
  backdropPath: null,
  runtime: 140,
  tagline: null,
  overview: null,
  genres: ["Drama"],
  cast: [
    { id: BACON.id, name: BACON.name, profilePath: null, job: "Actor", role: "actor", character: "Jack Swigert", order: 2 },
    { id: 31, name: "Tom Hanks", profilePath: null, job: "Actor", role: "actor", character: "Jim Lovell", order: 0 },
    { id: 77, name: "Walk On", profilePath: null, job: "Actor", role: "actor", character: "Himself", order: 20 },
  ],
  crew: [],
};

function render(props: Partial<Parameters<typeof FilmContent>[0]> = {}) {
  return renderToStaticMarkup(
    createElement(FilmContent, {
      film,
      titleId: "title",
      peopleInView: [{ id: BACON.id, name: BACON.name }],
      added: [],
      full: false,
      onToggleAdd: () => {},
      scrollRef: { current: null },
      ...props,
    }),
  );
}

/** The markup of the row of one person: from their `<li>` to its end. */
const rowOf = (html: string, name: string) => html.split("<li").find((part) => part.includes(`>${name}</p>`)) ?? "";

describe("FilmContent in a mode", () => {
  const blockedNote = (person: { id: number }) => (person.id === 77 ? togetherNote(0) : undefined);

  it("dims the row of a person the mode does not let in, with the note a search gives, and disables their Add", () => {
    const html = render({ blockedNote });
    const blocked = rowOf(html, "Walk On");
    expect(blocked).toContain("data-mode-blocked");
    expect(blocked).toContain("No films with Kevin Bacon");
    expect(blocked).toContain("opacity-60");
    expect(blocked).toContain("text-strong/60");
    expect(blocked).toMatch(/<button[^>]*disabled=""[^>]*>Add<\/button>/);
    expect(blocked).toContain(`title="${BACON_FILM_TITLE}"`);
    // The role stays readable beside the note.
    expect(blocked).toContain("Himself · </span>No films with Kevin Bacon");
  });

  it("leaves a person the mode lets in as any other row, and the film's cast unmarked without a rule", () => {
    const html = render({ blockedNote });
    const open = rowOf(html, "Tom Hanks");
    expect(open).not.toContain("data-mode-blocked");
    expect(open).not.toContain("opacity-60");
    expect(open).not.toContain('disabled=""');
    expect(rowOf(render(), "Walk On")).not.toContain("data-mode-blocked");
  });

  it("says what is true of a film nobody can be added from, and of a full page in the mode's own words", () => {
    expect(render({ blockedFilmNote: BACON_FILM_TITLE })).toContain("data-film-blocked");
    expect(render()).not.toContain("data-film-blocked");
    const full = render({ full: true, fullTitle: "Kevin Bacon mode is one person at a time" });
    expect(full).toContain("Kevin Bacon mode is one person at a time, so no one else can be added.");
    expect(render({ full: true })).toContain("A timeline holds up to 4 people, so no one else can be added.");
  });
});
