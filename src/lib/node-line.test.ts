import { describe, expect, it } from "vitest";
import { NODES_PARAM, nodeLineFromSearch, parseNodeLine } from "@/lib/node-line";

describe("parseNodeLine", () => {
  it("accepts the two layouts", () => {
    expect(parseNodeLine("top")).toBe("top");
    expect(parseNodeLine("bottom")).toBe("bottom");
  });

  it("ignores case and surrounding space", () => {
    expect(parseNodeLine("BOTTOM")).toBe("bottom");
    expect(parseNodeLine(" Bottom ")).toBe("bottom");
  });

  it("falls back to the default, top, for anything else", () => {
    for (const value of [null, undefined, "", "up", "down", "bottoms", "bottom,top", "0", "true"]) {
      expect(parseNodeLine(value)).toBe("top");
    }
  });
});

describe("nodeLineFromSearch", () => {
  it("reads the nodes parameter of a query string, with or without the question mark", () => {
    expect(NODES_PARAM).toBe("nodes");
    expect(nodeLineFromSearch("?nodes=bottom")).toBe("bottom");
    expect(nodeLineFromSearch("nodes=bottom")).toBe("bottom");
    expect(nodeLineFromSearch("?nodes=top")).toBe("top");
  });

  it("finds it among other parameters, such as the table's sort", () => {
    expect(nodeLineFromSearch("?sort=rating&dir=desc&nodes=bottom")).toBe("bottom");
    expect(nodeLineFromSearch("?nodes=bottom&sort=rating")).toBe("bottom");
  });

  it("takes the first when it is repeated", () => {
    expect(nodeLineFromSearch("?nodes=bottom&nodes=top")).toBe("bottom");
    expect(nodeLineFromSearch("?nodes=top&nodes=bottom")).toBe("top");
  });

  it("is the default without the parameter, with an empty query or with nothing at all", () => {
    expect(nodeLineFromSearch("")).toBe("top");
    expect(nodeLineFromSearch("?")).toBe("top");
    expect(nodeLineFromSearch("?sort=year")).toBe("top");
    expect(nodeLineFromSearch(null)).toBe("top");
    expect(nodeLineFromSearch(undefined)).toBe("top");
  });

  it("is the default for an unknown or empty value", () => {
    expect(nodeLineFromSearch("?nodes=")).toBe("top");
    expect(nodeLineFromSearch("?nodes=sideways")).toBe("top");
    expect(nodeLineFromSearch("?nodes")).toBe("top");
  });
});
