import { describe, expect, it } from "vitest";
import { filmCountLabel, joinNames } from "@/lib/format";

describe("joinNames", () => {
  it("joins names naturally", () => {
    expect(joinNames([])).toBe("");
    expect(joinNames(["David Fincher"])).toBe("David Fincher");
    expect(joinNames(["David Fincher", "Jeff Cronenweth"])).toBe("David Fincher & Jeff Cronenweth");
    expect(joinNames(["A", "B", "C"])).toBe("A, B & C");
  });
});

describe("filmCountLabel", () => {
  it("pluralizes", () => {
    expect(filmCountLabel(1)).toBe("1 film");
    expect(filmCountLabel(2)).toBe("2 films");
    expect(filmCountLabel(11)).toBe("11 films");
    expect(filmCountLabel(0)).toBe("0 films");
  });
});
