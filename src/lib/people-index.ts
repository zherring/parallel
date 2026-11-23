import "server-only";
import { decodePeopleIndex, type PeopleIndexFile } from "@/lib/people-index-format";
import { buildMatchIndex, type MatchIndex } from "@/lib/people-match";
import { withShownPhotos } from "@/lib/profile-path";

let loading: Promise<MatchIndex> | null = null;

/**
 * The people index, ready to search. Loaded on first use and kept for the life of the server
 * process; the dynamic import keeps the multi-megabyte JSON out of every route that does not
 * search, and (with "server-only") out of the client bundle. A failed load is not remembered, so
 * the next request tries again. Each person's photo is the one the app shows (`withShownPhotos`), not
 * necessarily the one the index was written with.
 */
export function loadPeopleMatchIndex(): Promise<MatchIndex> {
  loading ??= import("@/lib/people-index.generated.json").then(
    (module) => buildMatchIndex(withShownPhotos(decodePeopleIndex(module.default as unknown as PeopleIndexFile))),
    (error: unknown) => {
      loading = null;
      throw error;
    },
  );
  return loading;
}
