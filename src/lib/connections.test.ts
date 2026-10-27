import { describe, expect, it } from "vitest";
import {
  CONNECTION_SLOTS,
  GROUP_SLOT,
  PAIR_SLOTS,
  connectionKey,
  connectionLegend,
  connectionSlot,
  pairIndex,
  slotColor,
} from "@/lib/connections";

describe("pairIndex", () => {
  it("numbers the six pairs of four lanes 0 to 5, each once", () => {
    const indexes: number[] = [];
    for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) indexes.push(pairIndex(a, b));
    expect([...indexes].sort((x, y) => x - y)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("does not depend on the order of the two lanes", () => {
    expect(pairIndex(2, 0)).toBe(pairIndex(0, 2));
  });

  it("keeps the colours of the first pairs when a lane is added", () => {
    // Three lanes use pairs 0 to 2; a fourth lane only adds 3 to 5.
    expect([pairIndex(0, 1), pairIndex(0, 2), pairIndex(1, 2)]).toEqual([0, 1, 2]);
    expect([pairIndex(0, 3), pairIndex(1, 3), pairIndex(2, 3)]).toEqual([3, 4, 5]);
  });
});

describe("connectionSlot", () => {
  it("is null for a film in every lane: that one is green", () => {
    expect(connectionSlot([0, 1], 2)).toBeNull();
    expect(connectionSlot([0, 1, 2], 3)).toBeNull();
    expect(connectionSlot([0, 1, 2, 3], 4)).toBeNull();
  });

  it("is null for a film in fewer than two lanes: there is no connection", () => {
    expect(connectionSlot([1], 3)).toBeNull();
    expect(connectionSlot([], 3)).toBeNull();
  });

  it("gives a pair its own slot", () => {
    expect(connectionSlot([0, 1], 3)).toBe(0);
    expect(connectionSlot([0, 2], 3)).toBe(1);
    expect(connectionSlot([1, 2], 3)).toBe(2);
  });

  it("gives six different pairs of four lanes six different slots", () => {
    const slots = new Set<number | null>();
    for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) slots.add(connectionSlot([a, b], 4));
    expect(slots.size).toBe(PAIR_SLOTS);
    expect([...slots].every((slot) => slot !== null && slot < PAIR_SLOTS)).toBe(true);
  });

  it("is the same whichever films are on screen: it depends on the lanes alone", () => {
    expect(connectionSlot([1, 3], 4)).toBe(connectionSlot([3, 1], 4));
    expect(connectionSlot([0, 2], 4)).toBe(connectionSlot([0, 2], 3));
  });

  it("puts every subset of three of four lanes on the one remaining slot", () => {
    for (const lanes of [[0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3]]) expect(connectionSlot(lanes, 4)).toBe(GROUP_SLOT);
  });

  it("never goes past the palette", () => {
    for (let a = 0; a < 6; a++) for (let b = a + 1; b < 6; b++) expect(connectionSlot([a, b], 6)).toBeLessThan(CONNECTION_SLOTS);
  });
});

describe("slotColor", () => {
  it("names one palette token per slot, one-based, and clamps", () => {
    expect(slotColor(0)).toBe("var(--conn-1)");
    expect(slotColor(GROUP_SLOT)).toBe(`var(--conn-${CONNECTION_SLOTS})`);
    expect(slotColor(99)).toBe(slotColor(GROUP_SLOT));
    expect(slotColor(-3)).toBe("var(--conn-1)");
    expect(new Set(Array.from({ length: CONNECTION_SLOTS }, (_, i) => slotColor(i))).size).toBe(CONNECTION_SLOTS);
  });
});

describe("connectionLegend", () => {
  const conn = (lanes: number[], laneCount: number) => ({ lanes, slot: connectionSlot(lanes, laneCount) });

  it("has no legend for one or two lanes", () => {
    expect(connectionLegend([conn([0, 1], 2)], 2)).toEqual([]);
    expect(connectionLegend([], 1)).toEqual([]);
  });

  it("lists green first, then one chip per pair in use, in slot order, with counts", () => {
    const legend = connectionLegend(
      [conn([1, 2], 3), conn([0, 1, 2], 3), conn([0, 1], 3), conn([1, 2], 3), conn([0, 1, 2], 3), conn([0, 1, 2], 3)],
      3,
    );
    expect(legend.map((entry) => [entry.key, entry.lanes, entry.count])).toEqual([
      ["all", null, 3],
      ["slot-0", [0, 1], 1],
      ["slot-2", [1, 2], 2],
    ]);
    expect(legend[0].slot).toBeNull();
  });

  it("leaves out colours with nothing on screen", () => {
    const legend = connectionLegend([conn([0, 2], 3)], 3);
    expect(legend.map((entry) => entry.key)).toEqual(["slot-1"]);
  });

  it("keeps the colour of a pair when the others come and go (the minor toggle)", () => {
    const with_ = connectionLegend([conn([0, 1], 3), conn([1, 2], 3)], 3);
    const without = connectionLegend([conn([1, 2], 3)], 3);
    expect(without[0].slot).toBe(with_[1].slot);
    expect(without[0].key).toBe(with_[1].key);
  });

  it("names no lanes for the group slot of four lanes", () => {
    const [entry] = connectionLegend([conn([0, 1, 3], 4)], 4);
    expect(entry).toMatchObject({ slot: GROUP_SLOT, lanes: null, count: 1 });
  });

  it("is deterministic", () => {
    const connectors = [conn([2, 3], 4), conn([0, 1], 4), conn([0, 1, 2, 3], 4)];
    expect(connectionLegend(connectors, 4)).toEqual(connectionLegend([...connectors].reverse(), 4));
  });
});

describe("connectionKey", () => {
  it("is 'all' for green and per slot otherwise", () => {
    expect(connectionKey(null)).toBe("all");
    expect(connectionKey(3)).toBe("slot-3");
  });
});
