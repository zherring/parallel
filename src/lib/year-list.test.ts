import { describe, expect, it } from "vitest";
import { decodeYears, encodeYears } from "@/lib/year-list";

describe("encodeYears and decodeYears", () => {
  it("store the first year and then the gap to each next one, a repeated year being a gap of 0", () => {
    expect(encodeYears([1977, 1977, 1979, 1980])).toEqual([1977, 0, 2, 1]);
    expect(decodeYears([1977, 0, 2, 1])).toEqual([1977, 1977, 1979, 1980]);
  });

  it("sort the years first, so the list is one a decoder can take", () => {
    expect(encodeYears([1999, 1980, 1980, 2001])).toEqual([1980, 0, 19, 2]);
  });

  it("round-trip any list, and an empty one stays empty", () => {
    const years = [1920, 1921, 1921, 1921, 1932, 1955, 1955, 2026];
    expect(decodeYears(encodeYears(years))).toEqual(years);
    expect(encodeYears([])).toEqual([]);
    expect(decodeYears([])).toEqual([]);
  });

  it("do not change the list they are given", () => {
    const years = [2000, 1990];
    encodeYears(years);
    expect(years).toEqual([2000, 1990]);
  });
});
