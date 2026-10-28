/**
 * The `?nodes=` URL parameter that picks where each lane's line (with its nodes) sits: `?nodes=top`
 * (the default, and what any other value means) puts it at the top of the lane with the posters
 * below it; `?nodes=bottom` puts it at the bottom with the posters above, next to the year axis.
 * Pure parsing only: the timeline reads it in the browser once the page has hydrated (see
 * `useNodeLine`), so the server always renders the default and the URL never changes what it sends.
 */

import { DEFAULT_NODE_LINE, type NodeLine } from "@/lib/timeline-layout";

export const NODES_PARAM = "nodes";

/** The values the parameter accepts. */
export const NODE_LINES: readonly NodeLine[] = ["top", "bottom"];

/** The layout a parameter value names; anything missing, empty or unknown is the default. Case-insensitive. */
export function parseNodeLine(value: string | null | undefined): NodeLine {
  const lower = value?.trim().toLowerCase();
  return NODE_LINES.find((candidate) => candidate === lower) ?? DEFAULT_NODE_LINE;
}

/** The layout named by a query string (`"?nodes=bottom&x=1"`, with or without the leading `?`). */
export function nodeLineFromSearch(search: string | null | undefined): NodeLine {
  return parseNodeLine(new URLSearchParams(search ?? "").get(NODES_PARAM));
}
