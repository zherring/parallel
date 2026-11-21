import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/profile-overrides", () => ({ PROFILE_OVERRIDES: { 1: "/override-1.jpg", 2: "/override-2.jpg" } }));
vi.mock("@/lib/portrait-cuts.json", () => ({ default: { "1": { profilePath: "/cut-1.jpg" }, "3": { profilePath: "/cut-3.jpg" } } }));

import { profilePathFor } from "@/lib/profile-path";

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
