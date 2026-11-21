import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/profile-overrides", () => ({ PROFILE_OVERRIDES: { 1: "/override-1.jpg", 2: "/override-2.jpg" } }));
vi.mock("@/lib/portrait-cuts.json", () => ({ default: { "1": { profilePath: "/cut-1.jpg" }, "3": { profilePath: "/cut-3.jpg" } } }));

import { profilePathFor, withShownPhotos } from "@/lib/profile-path";

describe("profilePathFor", () => {
  it("is our override over a cut and over TMDB's photo", () => {
    expect(profilePathFor(1, "/tmdb.jpg")).toBe("/override-1.jpg");
    expect(profilePathFor(2, "/tmdb.jpg")).toBe("/override-2.jpg");
  });

  it("is the photo of the person's cut over TMDB's, so a photo TMDB changed never leaves a cut-out without its photo", () => {
    expect(profilePathFor(3, "/tmdb.jpg")).toBe("/cut-3.jpg");
  });

  it("is TMDB's photo for a person with neither", () => {
    expect(profilePathFor(4, "/tmdb.jpg")).toBe("/tmdb.jpg");
    expect(profilePathFor(4, null)).toBeNull();
  });

  it("gives an override or a cut to a person TMDB has no photo of", () => {
    expect(profilePathFor(2, null)).toBe("/override-2.jpg");
    expect(profilePathFor(3, null)).toBe("/cut-3.jpg");
  });
});

describe("withShownPhotos", () => {
  it("gives each person the photo the app shows, and keeps a person whose photo is already that one as the same object", () => {
    const kept = { id: 4, name: "D", profilePath: "/tmdb-4.jpg" };
    const people = withShownPhotos([{ id: 1, name: "A", profilePath: "/old-1.jpg" }, { id: 3, name: "C", profilePath: "/old-3.jpg" }, kept]);
    expect(people.map((person) => person.profilePath)).toEqual(["/override-1.jpg", "/cut-3.jpg", "/tmdb-4.jpg"]);
    expect(people[0].name).toBe("A");
    expect(people[2]).toBe(kept);
  });
});
