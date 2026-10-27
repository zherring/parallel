import { describe, expect, it } from "vitest";
import { joinNames } from "@/lib/format";

describe("joinNames", () => {
  it("joins names naturally", () => {
    expect(joinNames([])).toBe("");
    expect(joinNames(["David Fincher"])).toBe("David Fincher");
    expect(joinNames(["David Fincher", "Jeff Cronenweth"])).toBe("David Fincher & Jeff Cronenweth");
    expect(joinNames(["A", "B", "C"])).toBe("A, B & C");
  });
});
