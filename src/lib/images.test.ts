import { describe, expect, it } from "vitest";
import { tmdbImage } from "@/lib/images";

describe("tmdbImage", () => {
  it("builds a TMDB CDN url", () => {
    expect(tmdbImage("/abc.jpg", "w342")).toBe("https://image.tmdb.org/t/p/w342/abc.jpg");
  });

  it("returns null for missing paths", () => {
    expect(tmdbImage(null, "w342")).toBeNull();
    expect(tmdbImage(undefined, "w92")).toBeNull();
  });
});
