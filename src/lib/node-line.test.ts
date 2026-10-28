import { describe, expect, it } from "vitest";
import { NODES_PARAM, NODE_LINES, parseNodeLine } from "@/lib/node-line";
import { DEFAULT_NODE_LINE } from "@/lib/timeline-layout";

/** What the timeline does with the address bar: reads `nodes` from the query string and parses its value. */
const fromQuery = (query: string) => parseNodeLine(new URLSearchParams(query).get(NODES_PARAM));

describe("parseNodeLine", () => {
  it("names the parameter nodes and accepts the two layouts", () => {
    expect(NODES_PARAM).toBe("nodes");
    expect([...NODE_LINES]).toEqual(["top", "bottom"]);
    expect(parseNodeLine("top")).toBe("top");
    expect(parseNodeLine("bottom")).toBe("bottom");
  });

  it("ignores case and surrounding space", () => {
    expect(parseNodeLine("BOTTOM")).toBe("bottom");
    expect(parseNodeLine(" Bottom ")).toBe("bottom");
    expect(parseNodeLine("Top")).toBe("top");
  });

  it("falls back to the default, top, for anything else", () => {
    expect(DEFAULT_NODE_LINE).toBe("top");
    for (const value of [null, undefined, "", " ", "up", "down", "bottoms", "bottom,top", "0", "true"]) {
      expect(parseNodeLine(value)).toBe("top");
    }
  });
});

describe("reading the parameter from a query string", () => {
  it("finds it with or without the question mark, alone or among other parameters (such as the table's sort)", () => {
    expect(fromQuery("?nodes=bottom")).toBe("bottom");
    expect(fromQuery("nodes=bottom")).toBe("bottom");
    expect(fromQuery("?sort=rating&dir=desc&nodes=bottom")).toBe("bottom");
    expect(fromQuery("?nodes=bottom&sort=rating")).toBe("bottom");
    expect(fromQuery("?nodes=top&sort=rating")).toBe("top");
  });

  it("takes the first value when it is repeated", () => {
    expect(fromQuery("?nodes=bottom&nodes=top")).toBe("bottom");
    expect(fromQuery("?nodes=top&nodes=bottom")).toBe("top");
  });

  it("is the default without the parameter or with an empty or unknown value", () => {
    for (const query of ["", "?", "?sort=year", "?nodes=", "?nodes", "?nodes=sideways"]) {
      expect(fromQuery(query)).toBe("top");
    }
  });
});
