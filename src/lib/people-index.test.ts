import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { EXAMPLE_PAIRINGS } from "@/lib/examples";
import {
  decodePeopleIndex,
  encodePeopleIndex,
  type PeopleIndexFile,
} from "@/lib/people-index-format";
import { loadPeopleMatchIndex } from "@/lib/people-index";
import { buildMatchIndex, searchIndex, type MatchablePerson } from "@/lib/people-match";
import { EVAL_QUERIES, hitRank, hitRates } from "@/lib/people-search-eval";

const person = (id: number, name: string, extra: Partial<MatchablePerson> = {}): MatchablePerson => ({
  id,
  name,
  profilePath: `/${id}.jpg`,
  knownFor: "Directing",
  knownForTitles: ["Jaws", "E.T."],
  popularity: 6.27,
  credits: 15,
  ...extra,
});

describe("encodePeopleIndex / decodePeopleIndex", () => {
  const people = [
    person(488, "Steven Spielberg"),
    person(7, "Pat Nophoto", { profilePath: null, knownFor: null, knownForTitles: [], popularity: 12.345, credits: 0 }),
    person(9, "Cam Actor", { knownFor: "Acting", knownForTitles: ["E.T.", "Heat"] }),
  ];

  it("round-trips every field (popularity to two decimals)", () => {
    const decoded = decodePeopleIndex(encodePeopleIndex(people, "2026-01-01T00:00:00.000Z"));
    expect(decoded).toEqual([people[0], { ...people[1], popularity: 12.35 }, people[2]]);
  });

  it("stores each department and title once, and keeps the rows as plain arrays", () => {
    const file = encodePeopleIndex(people, "2026-01-01T00:00:00.000Z");
    expect(file.generatedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(file.departments).toEqual(["Directing", "Acting"]);
    expect(file.titles).toEqual(["Jaws", "E.T.", "Heat"]);
    expect(file.people[0]).toEqual([488, "Steven Spielberg", "/488.jpg", 0, 6.27, 15, [0, 1]]);
    expect(file.people[1]).toEqual([7, "Pat Nophoto", "", -1, 12.35, 0, []]);
  });
});

const INDEX_PATH = fileURLToPath(new URL("./people-index.generated.json", import.meta.url));
const generated = existsSync(INDEX_PATH)
  ? (JSON.parse(readFileSync(INDEX_PATH, "utf8")) as PeopleIndexFile)
  : null;
// An index that was never generated (a fresh clone with the file removed) has nothing to check.
const hasRealIndex = generated !== null && generated.people.length > 0;

describe.skipIf(!hasRealIndex)("the generated people index", () => {
  const people = decodePeopleIndex(generated!);
  const index = buildMatchIndex(people);

  it("loads lazily through loadPeopleMatchIndex, once, as a ready-to-search index", async () => {
    const first = loadPeopleMatchIndex();
    expect(loadPeopleMatchIndex()).toBe(first);
    const loaded = await first;
    expect(loaded.entries).toHaveLength(people.length);
    expect(searchIndex(loaded, "speil")[0].person.name).toBe("Steven Spielberg");
  });

  it("is dated, compact and has no duplicate ids", () => {
    expect(Number.isNaN(Date.parse(generated!.generatedAt))).toBe(false);
    expect(people.length).toBeGreaterThan(5000);
    expect(new Set(people.map((p) => p.id)).size).toBe(people.length);
    expect(readFileSync(INDEX_PATH, "utf8").trim().split("\n")).toHaveLength(1);
    expect(readFileSync(INDEX_PATH).length).toBeLessThan(3 * 1024 * 1024);
  });

  it("is sorted most notable first and every person has a name", () => {
    for (let i = 1; i < people.length; i++) {
      expect(people[i].popularity).toBeLessThanOrEqual(people[i - 1].popularity);
    }
    expect(people.every((p) => p.name.trim().length > 0)).toBe(true);
  });

  it("contains every person the curated example pairings mention", () => {
    const ids = new Set(people.map((p) => p.id));
    const missing = EXAMPLE_PAIRINGS.flatMap((pairing) => pairing.people).filter((p) => !ids.has(p.id));
    // Fix: run `npm run people:refresh` after adding people to src/lib/examples.ts.
    expect(missing).toEqual([]);
  });

  it("finds the people the product owner types, from the start or with a typo", () => {
    const top = (q: string, n: number) => searchIndex(index, q, n).map((m) => m.person.name);
    expect(top("speil", 3)).toContain("Steven Spielberg");
    expect(top("spiel", 3)).toContain("Steven Spielberg");
    expect(top("georg", 3)).toContain("George Lucas");
    expect(top("steven spie", 1)).toEqual(["Steven Spielberg"]);
    expect(top("george luc", 1)).toEqual(["George Lucas"]);
    expect(top("scorcese", 1)).toEqual(["Martin Scorsese"]);
    expect(top("tarantno", 1)).toEqual(["Quentin Tarantino"]);
  });

  it("keeps the hit rate over the realistic query list above a regression floor", () => {
    const ranks = EVAL_QUERIES.map(({ q, expect: wanted }) =>
      hitRank(
        searchIndex(index, q).map((m) => m.person.name),
        wanted,
      ),
    );
    const rates = hitRates(ranks);
    const misses = EVAL_QUERIES.filter((_, i) => ranks[i] === 0).map((e) => e.q);
    expect(misses).toEqual([]);
    expect(rates.top3).toBeGreaterThanOrEqual(0.95);
    expect(rates.top1).toBeGreaterThanOrEqual(0.85);
  });
});
