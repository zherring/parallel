import { describe, expect, it } from "vitest";
import { CRITIC_ID_PREFIX } from "@/lib/clippings-view";
import clippings from "@/lib/clippings.json";
import type { ClippingsData } from "@/lib/clippings";
import type { CriticsData } from "@/lib/critics";
import essays from "@/lib/essays.json";
import known from "@/lib/examples.generated.json";
import {
  validateCriticsFile,
  validateIds,
  validateQuotesFile,
  type KnownPairings,
} from "../../scripts/clippings/lib";

// The pipeline (`npm run clippings:merge`) checks every file it merges, but the JSON is also edited by hand and by
// other branches; nothing else reads it back with the same rules. These are the pipeline's own validators, run over
// what ships: https links (bar the http-only sites in `HTTP_ONLY_HOSTS`), dates, the names and TMDB ids of each pair
// against examples.generated.json, speakers that are in the pair, required fields, and ids that are non-empty slugs,
// unique, and never shared between an artist's quote and a critic's.
const quotes = clippings as unknown as ClippingsData;
const critics = essays as unknown as CriticsData;
const pairings = known as unknown as KnownPairings;

describe("clippings.json", () => {
  it("has entries", () => {
    expect(Object.keys(quotes).length).toBeGreaterThan(0);
  });

  it.each(Object.entries(quotes))("%s is fit to merge: header, speakers, dates, https urls and required fields", (key, entry) => {
    expect(validateQuotesFile(entry, key, pairings)).toEqual([]);
  });
});

describe("essays.json", () => {
  it("has entries", () => {
    expect(Object.keys(critics).length).toBeGreaterThan(0);
  });

  it.each(Object.entries(critics))("%s is fit to merge: header, kinds, dates, https urls and required fields", (key, entry) => {
    expect(validateCriticsFile(entry, key, pairings)).toEqual([]);
  });
});

describe("the ids of the quotes", () => {
  it("are non-empty slugs, unique within a pair and across the critics, and critic ids carry the prefix and no clipping's does", () => {
    expect(validateIds(quotes, critics)).toEqual([]);
  });

  it("never collide between an artist's quote and a critic's", () => {
    const artistIds = new Set(Object.values(quotes).flatMap((entry) => entry.clippings.map((c) => c.id)));
    const criticIds = Object.values(critics).flatMap((entry) => entry.critics.map((c) => c.id));
    expect(criticIds.filter((id) => artistIds.has(id))).toEqual([]);
    expect(criticIds.every((id) => id.startsWith(CRITIC_ID_PREFIX))).toBe(true);
    expect([...artistIds].filter((id) => id.startsWith(CRITIC_ID_PREFIX))).toEqual([]);
  });

  it("are checked by the same rule that rejects the problems this test guards against", () => {
    // A guard that cannot fail guards nothing: the validators do say so about data with these problems.
    const bad = {
      "488+491": {
        pair: ["Steven Spielberg", "John Williams"],
        tmdb_ids: [488, 491],
        clippings: [
          {
            id: "",
            speaker: "Somebody Else",
            about: "John Williams",
            quote: "Fine.",
            film: null,
            said_year: null,
            publication: "P",
            via: null,
            title: "T",
            date: "12/05/2012",
            url: "http://example.com/a",
            context: "C",
            secondhand: false,
          },
        ],
      },
    };
    expect(validateQuotesFile(bad["488+491"], "488+491", pairings).join("\n")).toMatch(/speaker "Somebody Else".*\n.*date "12\/05\/2012".*\n.*not an https URL/);
    expect(validateIds(bad, {}).join("\n")).toContain('id "" is empty');
  });
});
