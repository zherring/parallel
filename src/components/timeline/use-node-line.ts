"use client";

import { useSearchParams } from "next/navigation";
import { useSyncExternalStore } from "react";
import { NODES_PARAM, parseNodeLine } from "@/lib/node-line";
import { DEFAULT_NODE_LINE, type NodeLine } from "@/lib/timeline-layout";

const noSubscription = () => () => {};

/**
 * The layout `?nodes=top|bottom` asks for. The server always renders the default: until the page
 * has hydrated this answers the default whatever the address bar says (the same way the table's
 * `?sort=` is read only afterwards), so a link with the parameter never changes the HTML the server
 * sends and the first client render matches it. Afterwards the layout follows the query string,
 * including a soft navigation (a Link, `router.push`, back and forward) that only changes it.
 */
export function useNodeLine(): NodeLine {
  const searchParams = useSearchParams();
  // False on the server and during hydration, true from the next render on the client.
  const hydrated = useSyncExternalStore(noSubscription, () => true, () => false);
  return hydrated ? parseNodeLine(searchParams.get(NODES_PARAM)) : DEFAULT_NODE_LINE;
}
