import { describe, expect, it } from "vitest";
import { creditsLine, creditsRoles, filmCardContent, rolesText } from "@/lib/film-credits";
import type { Credit, Film } from "@/lib/types";

const credit = (role: Credit["role"], extra: Partial<Credit> = {}): Credit => ({
  role,
  job: extra.job ?? role,
  minor: false,
  ...extra,
});

const film = (id: number, credits: Credit[], extra: Partial<Film> = {}): Film => ({
  id,
  title: `Film ${id}`,
  releaseDate: "1995-01-27",
  year: 1995,
  posterPath: `/poster${id}.jpg`,
  voteCount: 10,
  credits,
  minor: credits.every((c) => c.minor),
  ...extra,
});

const person = (id: number, name: string, profilePath: string | null = `/p${id}.jpg`) => ({ id, name, profilePath });

describe("creditsRoles and rolesText", () => {
  it("lists each role once in the usual order", () => {
    const roles = creditsRoles([credit("writer"), credit("director"), credit("writer")]);
    expect(rolesText(roles)).toBe("Director, Writer");
  });

  it("adds the character for an actor", () => {
    expect(rolesText(creditsRoles([credit("actor", { character: "Jesse" })]))).toBe("Actor (as Jesse)");
    expect(rolesText(creditsRoles([credit("actor")]))).toBe("Actor");
  });

  it("keeps several characters of one actor on one role", () => {
    const roles = creditsRoles([credit("actor", { character: "Jesse" }), credit("actor", { character: "Jesse" }), credit("actor", { character: "Vic" })]);
    expect(rolesText(roles)).toBe("Actor (as Jesse / Vic)");
  });

  it("puts the director and the lead actor of one person together", () => {
    const roles = creditsRoles([credit("actor", { character: "Jesse" }), credit("director"), credit("writer")]);
    expect(rolesText(roles)).toBe("Actor (as Jesse), Director, Writer");
    expect(roles.map((r) => r.label)).toEqual(["Actor", "Director", "Writer"]);
  });

  it("names the job instead of 'Other' for minor crew roles", () => {
    const roles = creditsRoles([credit("other", { job: "Executive Producer", minor: true }), credit("other", { job: "Co-Producer", minor: true })]);
    expect(rolesText(roles)).toBe("Executive Producer, Co-Producer");
  });

  it("moves a marker in the character into a tag", () => {
    const roles = creditsRoles([credit("actor", { character: "Waiter (uncredited)", minor: true })]);
    expect(roles).toEqual([{ label: "Actor", detail: "as Waiter, uncredited" }]);
    expect(rolesText(creditsRoles([credit("actor", { character: "Narrator (voice, uncredited)", minor: true })]))).toBe(
      "Actor (as Narrator, voice, uncredited)",
    );
  });

  it("marks a minor credit that does not say why", () => {
    expect(rolesText(creditsRoles([credit("actor", { character: "Man at bar", minor: true, order: 31 })]))).toBe(
      "Actor (as Man at bar, minor)",
    );
    expect(rolesText(creditsRoles([credit("actor", { minor: true, order: 40 })]))).toBe("Actor (minor)");
  });

  it("does not repeat what a self appearance already says", () => {
    expect(rolesText(creditsRoles([credit("actor", { character: "Himself", minor: true })]))).toBe("Actor (as Himself)");
  });

  it("does not tag an actor who also has a major credit", () => {
    const roles = creditsRoles([credit("actor", { character: "Jesse" }), credit("actor", { character: "Jesse (uncredited)", minor: true })]);
    expect(rolesText(roles)).toBe("Actor (as Jesse, uncredited)");
    // A mixed pair is not "all minor": no generic tag on top of the real one.
    expect(rolesText(creditsRoles([credit("actor", { character: "Jesse" }), credit("actor", { character: "Vic", minor: true })]))).toBe(
      "Actor (as Jesse / Vic)",
    );
  });

  it("is empty without credits", () => {
    expect(creditsRoles([])).toEqual([]);
    expect(rolesText([])).toBe("");
  });
});

describe("creditsLine", () => {
  it("joins the name and the roles", () => {
    const [row] = filmCardContent(1, [{ person: person(564, "Richard Linklater"), films: [film(1, [credit("director"), credit("writer")])] }], {
      includeMinor: false,
    })!.rows;
    expect(creditsLine(row)).toBe("Richard Linklater: Director, Writer");
  });
});

describe("filmCardContent", () => {
  const linklater = person(564, "Richard Linklater");
  const hawke = person(569, "Ethan Hawke");
  const shared = film(76, [credit("director"), credit("writer")]);
  const lanes = [
    { person: linklater, films: [shared, film(5, [credit("director")])] },
    { person: hawke, films: [film(76, [credit("actor", { character: "Jesse", order: 0 })]), film(6, [credit("actor", { character: "Bob" })])] },
  ];

  it("gives one row per person with a credit on a shared film, in lane order", () => {
    const content = filmCardContent(76, lanes, { includeMinor: false })!;
    expect(content.title).toBe("Film 76");
    expect(content.year).toBe(1995);
    expect(content.posterPath).toBe("/poster76.jpg");
    expect(content.rows.map((r) => r.personId)).toEqual([564, 569]);
    expect(content.rows.map(creditsLine)).toEqual(["Richard Linklater: Director, Writer", "Ethan Hawke: Actor (as Jesse)"]);
    expect(content.rows[0]).toMatchObject({ name: "Richard Linklater", profilePath: "/p564.jpg" });
  });

  it("lists the hovered lane's person first", () => {
    const content = filmCardContent(76, lanes, { includeMinor: false, firstPersonId: 569 })!;
    expect(content.rows.map((r) => r.personId)).toEqual([569, 564]);
  });

  it("shows only the lanes that have the film for an unshared one", () => {
    const content = filmCardContent(6, lanes, { includeMinor: false, firstPersonId: 569 })!;
    expect(content.rows.map(creditsLine)).toEqual(["Ethan Hawke: Actor (as Bob)"]);
  });

  it("hides minor credits unless asked, and drops a person left with none", () => {
    const withMinor = [
      { person: linklater, films: [film(9, [credit("director")])] },
      { person: hawke, films: [film(9, [credit("actor", { character: "Himself (uncredited)", minor: true })])] },
    ];
    expect(filmCardContent(9, withMinor, { includeMinor: false })!.rows.map((r) => r.personId)).toEqual([564]);
    const all = filmCardContent(9, withMinor, { includeMinor: true })!;
    expect(all.rows.map(creditsLine)).toEqual(["Richard Linklater: Director", "Ethan Hawke: Actor (as Himself, uncredited)"]);
  });

  it("keeps the film's own details even when nobody has a visible credit", () => {
    const only = [{ person: hawke, films: [film(3, [credit("actor", { minor: true })])] }];
    const content = filmCardContent(3, only, { includeMinor: false })!;
    expect(content.title).toBe("Film 3");
    expect(content.rows).toEqual([]);
  });

  it("is null for a film no lane has", () => {
    expect(filmCardContent(999, lanes, { includeMinor: true })).toBeNull();
  });

  it("works for a single person", () => {
    const content = filmCardContent(5, [lanes[0]], { includeMinor: false, firstPersonId: 564 })!;
    expect(content.rows.map(creditsLine)).toEqual(["Richard Linklater: Director"]);
  });
});
