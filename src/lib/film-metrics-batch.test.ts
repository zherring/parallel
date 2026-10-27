import { describe, expect, it } from "vitest";
import { MAX_BATCH_IDS, batchChunks, batchUrl, parseIdList } from "@/lib/film-metrics-batch";

const range = (n: number, from = 1) => Array.from({ length: n }, (_, i) => from + i);

describe("parseIdList", () => {
  it("parses comma separated ids in the order given", () => {
    expect(parseIdList("3,1,2")).toEqual({ ok: true, ids: [3, 1, 2] });
    expect(parseIdList("550")).toEqual({ ok: true, ids: [550] });
  });

  it("deduplicates, keeping the first occurrence", () => {
    expect(parseIdList("5,3,5,3,9")).toEqual({ ok: true, ids: [5, 3, 9] });
  });

  it("accepts exactly the maximum and rejects one more", () => {
    expect(parseIdList(range(MAX_BATCH_IDS).join(","))).toMatchObject({ ok: true });
    expect(parseIdList(range(MAX_BATCH_IDS + 1).join(","))).toMatchObject({ ok: false });
  });

  it("counts distinct ids toward the limit, not repeats", () => {
    const repeated = [...range(MAX_BATCH_IDS), ...range(MAX_BATCH_IDS)].join(",");
    expect(parseIdList(repeated)).toEqual({ ok: true, ids: range(MAX_BATCH_IDS) });
  });

  it.each([
    ["missing", null],
    ["empty", ""],
    ["a lone comma", ","],
    ["a trailing comma", "1,2,"],
    ["a leading comma", ",1"],
    ["a double comma", "1,,2"],
    ["zero", "0"],
    ["a negative", "-5"],
    ["a decimal", "1.5"],
    ["letters", "abc"],
    ["digits and letters", "12abc"],
    ["a leading zero", "01"],
    ["more than ten digits", "99999999999"],
    ["a space", "1, 2"],
    ["an exponent", "1e3"],
  ])("rejects %s", (_name, raw) => {
    const result = parseIdList(raw);
    expect(result.ok).toBe(false);
  });

  it("rejects an absurdly long value without parsing it", () => {
    expect(parseIdList("1,".repeat(5000))).toMatchObject({ ok: false });
  });
});

describe("batchChunks", () => {
  it("returns nothing for no ids", () => {
    expect(batchChunks([])).toEqual([]);
  });

  it("keeps up to the maximum in one chunk, sorted ascending", () => {
    expect(batchChunks([30, 10, 20])).toEqual([[10, 20, 30]]);
    expect(batchChunks(range(MAX_BATCH_IDS))).toHaveLength(1);
  });

  it("splits longer lists into chunks of at most the maximum", () => {
    const chunks = batchChunks(range(MAX_BATCH_IDS * 2 + 1));
    expect(chunks.map((c) => c.length)).toEqual([MAX_BATCH_IDS, MAX_BATCH_IDS, 1]);
    expect(chunks.flat()).toEqual(range(MAX_BATCH_IDS * 2 + 1));
  });

  it("deduplicates", () => {
    expect(batchChunks([2, 1, 2, 1])).toEqual([[1, 2]]);
  });

  it("makes the same URL for the same films however they were ordered", () => {
    expect(batchChunks([3, 1, 2])).toEqual(batchChunks([2, 3, 1]));
  });
});

describe("batchUrl", () => {
  it("joins the ids into the ids query value", () => {
    expect(batchUrl([1, 2, 3])).toBe("/api/film-metrics?ids=1,2,3");
  });
});
