import { describe, expect, it } from "vitest";
import {
  inPeriod,
  outsidePeriodIds,
  parsePeriodParams,
  parseYear,
  periodLabel,
  rawPeriodSearch,
  resolvePeriod,
  searchWithPeriod,
  spanOfYears,
} from "@/lib/period";

describe("parseYear", () => {
  it("accepts four-digit years from 1880 to 2100", () => {
    expect(parseYear("1978")).toBe(1978);
    expect(parseYear("1880")).toBe(1880);
    expect(parseYear("2100")).toBe(2100);
  });

  it("drops anything else", () => {
    for (const bad of ["1879", "2101", "abc", "", "19", "19780", "1978.5", "-1978", "+1978", " 1978", "1e3", "0x7BA", "NaN"]) {
      expect(parseYear(bad)).toBeNull();
    }
    expect(parseYear(undefined)).toBeNull();
    expect(parseYear(null)).toBeNull();
  });

  it("takes the first of a repeated parameter", () => {
    expect(parseYear(["1990", "1980"])).toBe(1990);
    expect(parseYear(["nope", "1980"])).toBeNull();
    expect(parseYear([])).toBeNull();
  });
});

describe("parsePeriodParams", () => {
  it("reads a query string, URLSearchParams and a searchParams object alike", () => {
    const expected = { from: 1978, to: 1993 };
    expect(parsePeriodParams("?from=1978&to=1993")).toEqual(expected);
    expect(parsePeriodParams("from=1978&to=1993&view=table")).toEqual(expected);
    expect(parsePeriodParams(new URLSearchParams("to=1993&from=1978"))).toEqual(expected);
    expect(parsePeriodParams({ from: "1978", to: "1993", other: "x" })).toEqual(expected);
  });

  it("leaves a side open when it is missing or not a year", () => {
    expect(parsePeriodParams("?from=1978")).toEqual({ from: 1978, to: null });
    expect(parsePeriodParams("?to=1993")).toEqual({ from: null, to: 1993 });
    expect(parsePeriodParams("?from=soon&to=1993")).toEqual({ from: null, to: 1993 });
    expect(parsePeriodParams("?from=1700&to=3000")).toEqual({ from: null, to: null });
    expect(parsePeriodParams("")).toEqual({ from: null, to: null });
  });

  it("swaps ends given the wrong way round", () => {
    expect(parsePeriodParams("?from=1993&to=1978")).toEqual({ from: 1978, to: 1993 });
    expect(parsePeriodParams({ from: "2001", to: "1999" })).toEqual({ from: 1999, to: 2001 });
  });
});

describe("spanOfYears", () => {
  it("is the first and last year", () => {
    expect(spanOfYears([1990, 1966, 2005, 1981])).toEqual({ first: 1966, last: 2005 });
    expect(spanOfYears([1994])).toEqual({ first: 1994, last: 1994 });
  });

  it("has none without years", () => {
    expect(spanOfYears([])).toBeNull();
    expect(spanOfYears([Number.NaN])).toBeNull();
  });
});

describe("resolvePeriod", () => {
  const span = { first: 1966, last: 2005 };

  it("keeps a period inside the span", () => {
    expect(resolvePeriod({ from: 1978, to: 1993 }, span)).toEqual({ from: 1978, to: 1993 });
    expect(resolvePeriod({ from: 1966, to: 1993 }, span)).toEqual({ from: 1966, to: 1993 });
  });

  it("closes an open side at the span", () => {
    expect(resolvePeriod({ from: 1978, to: null }, span)).toEqual({ from: 1978, to: 2005 });
    expect(resolvePeriod({ from: null, to: 1981 }, span)).toEqual({ from: 1966, to: 1981 });
  });

  it("clamps ends that stick out, so one period has one spelling", () => {
    expect(resolvePeriod({ from: 1900, to: 1981 }, span)).toEqual({ from: 1966, to: 1981 });
    expect(resolvePeriod({ from: 1990, to: 2090 }, span)).toEqual({ from: 1990, to: 2005 });
  });

  it("is no period when it covers the whole span, or nothing was asked", () => {
    expect(resolvePeriod({ from: 1966, to: 2005 }, span)).toBeNull();
    expect(resolvePeriod({ from: 1900, to: 2100 }, span)).toBeNull();
    expect(resolvePeriod({ from: 1960, to: null }, span)).toBeNull();
    expect(resolvePeriod({ from: null, to: null }, span)).toBeNull();
  });

  it("is no period when it lies outside the span", () => {
    expect(resolvePeriod({ from: 2010, to: 2020 }, span)).toBeNull();
    expect(resolvePeriod({ from: 1900, to: 1950 }, span)).toBeNull();
    expect(resolvePeriod({ from: 2010, to: null }, span)).toBeNull();
    expect(resolvePeriod({ from: null, to: 1950 }, span)).toBeNull();
  });

  it("is no period without films, or for films of one year", () => {
    expect(resolvePeriod({ from: 1978, to: 1993 }, null)).toBeNull();
    expect(resolvePeriod({ from: 1990, to: 1995 }, { first: 1994, last: 1994 })).toBeNull();
  });
});

describe("periodLabel", () => {
  it("joins the years with an en dash", () => {
    expect(periodLabel({ from: 1978, to: 1993 })).toBe("1978–1993");
  });

  it("is one year when they match", () => {
    expect(periodLabel({ from: 1994, to: 1994 })).toBe("1994");
  });
});

describe("inPeriod", () => {
  it("includes both ends", () => {
    const period = { from: 1978, to: 1993 };
    expect(inPeriod(1978, period)).toBe(true);
    expect(inPeriod(1993, period)).toBe(true);
    expect(inPeriod(1977, period)).toBe(false);
    expect(inPeriod(1994, period)).toBe(false);
  });

  it("takes everything without a period", () => {
    expect(inPeriod(1900, null)).toBe(true);
    expect(inPeriod(2100, undefined)).toBe(true);
  });
});

describe("outsidePeriodIds", () => {
  const period = { from: 1978, to: 1993 };
  // Films on one or both lanes: ids 1 and 5 are shared (listed once per lane), the rest belong to one lane.
  const lanes = [
    [
      { id: 1, year: 1977 }, // shared, the year before the period
      { id: 2, year: 1978 }, // first year of the period
      { id: 3, year: 1993 }, // last year of the period
      { id: 4, year: 1994 }, // the year after
      { id: 5, year: 1978 }, // shared, first year
    ],
    [
      { id: 1, year: 1977 },
      { id: 5, year: 1978 },
      { id: 6, year: 1993 },
      { id: 7, year: 2001 },
    ],
  ];
  const films = lanes.flat();

  it("takes the films before the first year and after the last, shared or not", () => {
    expect([...outsidePeriodIds(films, period)].sort((a, b) => a - b)).toEqual([1, 4, 7]);
  });

  it("keeps the films of the first and last year, shared or not", () => {
    const outside = outsidePeriodIds(films, period);
    for (const id of [2, 3, 5, 6]) expect(outside.has(id)).toBe(false);
  });

  it("counts a shared film once, however many lanes list it", () => {
    expect(outsidePeriodIds([...films, ...films], period).size).toBe(3);
  });

  it("treats a one-year period as that year only", () => {
    expect([...outsidePeriodIds(films, { from: 1993, to: 1993 })].sort((a, b) => a - b)).toEqual([1, 2, 4, 5, 7]);
  });

  it("is empty without a period, or without films", () => {
    expect(outsidePeriodIds(films, null).size).toBe(0);
    expect(outsidePeriodIds(films, undefined).size).toBe(0);
    expect(outsidePeriodIds([], period).size).toBe(0);
  });
});

describe("searchWithPeriod", () => {
  const period = { from: 1978, to: 1993 };

  it("writes the period", () => {
    expect(searchWithPeriod("", period)).toBe("?from=1978&to=1993");
  });

  it("keeps the other parameters, such as the view and the sort", () => {
    expect(searchWithPeriod("?view=table&sort=year&dir=desc", period)).toBe(
      "?view=table&sort=year&dir=desc&from=1978&to=1993",
    );
  });

  it("replaces an earlier period", () => {
    expect(searchWithPeriod("?from=1966&view=table&to=1970", period)).toBe("?view=table&from=1978&to=1993");
  });

  it("removes the period without touching the rest", () => {
    expect(searchWithPeriod("?view=table&from=1978&to=1993", null)).toBe("?view=table");
    expect(searchWithPeriod("?from=1978&to=1993", null)).toBe("");
    expect(searchWithPeriod("", null)).toBe("");
  });
});

describe("rawPeriodSearch", () => {
  it("writes the ends a link named", () => {
    expect(rawPeriodSearch({ from: 1978, to: 1993 })).toBe("?from=1978&to=1993");
    expect(rawPeriodSearch({ from: 1978, to: null })).toBe("?from=1978");
    expect(rawPeriodSearch({ from: null, to: 1993 })).toBe("?to=1993");
  });

  it("is empty for none, and so carries nothing junk through a redirect", () => {
    expect(rawPeriodSearch({ from: null, to: null })).toBe("");
    expect(rawPeriodSearch(parsePeriodParams("?from=abc&to=3000&x=1"))).toBe("");
  });
});
