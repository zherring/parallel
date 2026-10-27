import { describe, expect, it } from "vitest";
import { buildMatchIndex, searchIndex, type MatchablePerson } from "@/lib/people-match";
import { MAX_SEARCH_RESULTS, mergeSearchResults, type TmdbHit } from "@/lib/search-merge";

const local = (id: number, name: string, popularity: number, knownForTitles: string[] = []): MatchablePerson => ({
  id,
  name,
  profilePath: `/${id}.jpg`,
  knownFor: "Directing",
  knownForTitles,
  popularity,
  credits: 0,
});

const hit = (id: number, name: string, popularity: number, knownForTitles: string[] = []): TmdbHit => ({
  id,
  name,
  profilePath: null,
  knownFor: "Acting",
  knownForTitles,
  popularity,
});

const matches = (people: MatchablePerson[], query: string) => searchIndex(buildMatchIndex(people), query);
const ids = (results: { id: number }[]) => results.map((r) => r.id);

describe("mergeSearchResults", () => {
  it("puts local matches first, by score, then the rest of TMDB by popularity", () => {
    const found = matches([local(1, "Steven Spielberg", 12), local(2, "Steven Soderbergh", 4)], "ste");
    const merged = mergeSearchResults("ste", found, [
      hit(10, "Obscure Alpha", 1),
      hit(11, "Obscure Beta", 9),
      hit(12, "Obscure Gamma", 4),
    ]);
    expect(ids(merged)).toEqual([1, 2, 11, 12, 10]);
  });

  it("returns the local matches alone when TMDB has nothing, and TMDB's alone when the index has nothing", () => {
    const found = matches([local(1, "Steven Spielberg", 12)], "spielberg");
    expect(ids(mergeSearchResults("spielberg", found, []))).toEqual([1]);
    expect(ids(mergeSearchResults("zzz", [], [hit(5, "A", 1), hit(6, "B", 3)]))).toEqual([6, 5]);
    expect(mergeSearchResults("zzz", [], [])).toEqual([]);
  });

  it("lists a person found by both once, keeping the local entry", () => {
    const found = matches([local(1, "Steven Spielberg", 12, ["Jaws"])], "spielberg");
    const merged = mergeSearchResults("spielberg", found, [hit(1, "Steven Spielberg", 99, ["Other"]), hit(2, "Zed Spielberg", 1)]);
    expect(ids(merged)).toEqual([1, 2]);
    expect(merged[0]).toEqual({
      id: 1,
      name: "Steven Spielberg",
      profilePath: "/1.jpg",
      knownFor: "Directing",
      knownForTitles: ["Jaws"],
    });
  });

  it("falls back to TMDB's known-for titles when the index has none", () => {
    const found = matches([local(1, "Steven Spielberg", 12)], "spielberg");
    const merged = mergeSearchResults("spielberg", found, [hit(1, "Steven Spielberg", 5, ["Jaws", "E.T."])]);
    expect(merged[0].knownForTitles).toEqual(["Jaws", "E.T."]);
  });

  it("never returns more than 8, and never repeats an id", () => {
    const people = Array.from({ length: 12 }, (_, i) => local(i + 1, `Alex Stone ${i}`, i));
    const found = searchIndex(buildMatchIndex(people), "alex", 12);
    const merged = mergeSearchResults("alex", found, [hit(1, "Alex Stone 0", 1), ...Array.from({ length: 12 }, (_, i) => hit(100 + i, `Other ${i}`, i))]);
    expect(merged).toHaveLength(MAX_SEARCH_RESULTS);
    expect(new Set(ids(merged)).size).toBe(merged.length);
  });

  it("ranks a TMDB hit the matcher accepts by name with the local matches, not after them", () => {
    // Someone typed in full who is not in the index: the exact name beats a local typo guess.
    const found = matches([local(1, "Gavin Spielberg", 8)], "gavin speiller");
    expect(found[0].kind).toBe("fuzzy");
    const merged = mergeSearchResults("gavin speiller", found, [hit(7, "Gavin Speiller", 0.4)]);
    expect(ids(merged)).toEqual([7, 1]);
  });

  it("keeps a famous typo correction ahead of an obscure whole-word TMDB hit", () => {
    const found = matches([local(1, "Steven Spielberg", 12)], "speil");
    expect(found[0].kind).toBe("fuzzy");
    const merged = mergeSearchResults("speil", found, [hit(2, "Gavin Speiller", 0.4), hit(3, "David Speilberg", 0.2)]);
    expect(ids(merged)).toEqual([1, 2, 3]);
  });

  it("keeps TMDB hits the matcher does not accept by name after the strong group, most popular first", () => {
    const merged = mergeSearchResults("speil", [], [hit(2, "Sheila Hancock", 50), hit(3, "Gavin Speiller", 0.4)]);
    // 'Gavin Speiller' starts with 'speil'; 'Sheila Hancock' does not match it.
    expect(ids(merged)).toEqual([3, 2]);
  });

  it("strips the extra fields from the response objects", () => {
    const found = matches([local(1, "Steven Spielberg", 12)], "spielberg");
    const [first, second] = mergeSearchResults("spielberg", found, [hit(2, "Zed Spielberg", 1)]);
    expect(Object.keys(first).sort()).toEqual(["id", "knownFor", "knownForTitles", "name", "profilePath"]);
    expect(Object.keys(second).sort()).toEqual(["id", "knownFor", "knownForTitles", "name", "profilePath"]);
  });
});
