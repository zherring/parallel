import "server-only";
import { indexCollaborators, type CollaboratorsFile, type GraphEntry } from "@/lib/collaborators-format";

let loading: Promise<ReadonlyMap<number, GraphEntry>> | null = null;

/**
 * The collaborator graph, ready to look up by person id. Loaded on first use and kept for the
 * life of the server process; the dynamic import keeps the JSON out of every route that does not
 * suggest collaborators, and (with "server-only") out of the client bundle. A failed load is not
 * remembered, so the next request tries again.
 */
export function loadCollaboratorGraph(): Promise<ReadonlyMap<number, GraphEntry>> {
  loading ??= import("@/lib/collaborators.generated.json").then(
    (module) => indexCollaborators(module.default as unknown as CollaboratorsFile),
    (error: unknown) => {
      loading = null;
      throw error;
    },
  );
  return loading;
}
