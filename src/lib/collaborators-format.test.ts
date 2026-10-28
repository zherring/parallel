import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { GRAPH_CANDIDATES, MIN_GRAPH_ROW, MIN_SHARED_FILMS } from "@/lib/collaborator-graph";
import { loadCollaboratorGraph } from "@/lib/collaborators-index";
import {
  encodeCollaborators,
  indexCollaborators,
  type CollaboratorRow,
  type CollaboratorsFile,
} from "@/lib/collaborators-format";
import type { PeopleIndexFile } from "@/lib/people-index-format";

describe("encodeCollaborators / indexCollaborators", () => {
  const rows: CollaboratorRow[] = [
    [9, [1, 2, 3], [4, 3, 2]],
    [3, [7, 8, 9], [5, 5, 2]],
  ];

  it("sorts rows by id and keeps the timestamp", () => {
    const file = encodeCollaborators(rows, "2026-01-01T00:00:00.000Z");
    expect(file.generatedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(file.people.map((r) => r[0])).toEqual([3, 9]);
  });

  it("looks a person up by id, candidates in file order", () => {
    const graph = indexCollaborators(encodeCollaborators(rows, "2026-01-01T00:00:00.000Z"));
    expect(graph.get(9)).toEqual({ ids: [1, 2, 3], counts: [4, 3, 2] });
    expect(graph.get(4)).toBeUndefined();
  });
});

const GENERATED = fileURLToPath(new URL("./collaborators.generated.json", import.meta.url));
const PEOPLE_INDEX = fileURLToPath(new URL("./people-index.generated.json", import.meta.url));

describe.skipIf(!existsSync(GENERATED))("collaborators.generated.json", () => {
  const file = JSON.parse(readFileSync(GENERATED, "utf8")) as CollaboratorsFile;

  it("is one compact line well under the size budget", () => {
    const text = readFileSync(GENERATED, "utf8");
    expect(text.trimEnd().includes("\n")).toBe(false);
    expect(statSync(GENERATED).size).toBeLessThan(2.5 * 1024 * 1024);
  });

  it("carries the timestamp of the people index it was built with", () => {
    const index = JSON.parse(readFileSync(PEOPLE_INDEX, "utf8")) as PeopleIndexFile;
    expect(Number.isNaN(Date.parse(file.generatedAt))).toBe(false);
    expect(file.generatedAt).toBe(index.generatedAt);
  });

  it("has well-formed rows: sorted ids, parallel arrays, counts of at least two, best first", () => {
    expect(file.people.length).toBeGreaterThan(0);
    let previous = 0;
    for (const [id, ids, counts] of file.people) {
      expect(id).toBeGreaterThan(previous);
      previous = id;
      expect(ids.length).toBe(counts.length);
      expect(ids.length).toBeGreaterThanOrEqual(MIN_GRAPH_ROW);
      expect(ids.length).toBeLessThanOrEqual(GRAPH_CANDIDATES);
      expect(ids).not.toContain(id);
      expect(new Set(ids).size).toBe(ids.length);
      for (let i = 0; i < counts.length; i++) {
        expect(counts[i]).toBeGreaterThanOrEqual(MIN_SHARED_FILMS);
        if (i > 0) expect(counts[i]).toBeLessThanOrEqual(counts[i - 1]);
      }
    }
  });

  it("loads through the server loader", async () => {
    const graph = await loadCollaboratorGraph();
    expect(graph.size).toBe(file.people.length);
  });
});
