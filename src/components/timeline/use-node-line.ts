"use client";

import { useSearchParams } from "next/navigation";
import { useSyncExternalStore } from "react";
import { nodeLineFromSearch } from "@/lib/node-line";
import { DEFAULT_NODE_LINE, type NodeLine } from "@/lib/timeline-layout";

// `popstate` covers back and forward between two URLs of the page that differ in `?nodes=`.
const subscribe = (onChange: () => void) => {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
};
const clientSearch = () => window.location.search;
// The default on the server and while hydrating, so the first client render matches the server HTML.
const serverSearch = () => "";

/**
 * The layout `?nodes=top|bottom` asks for. The server always renders the default; the address bar
 * is read only once the page has hydrated (the same way the table's `?sort=` is), so a link with
 * the parameter never changes the HTML the server sends and a hydration mismatch is not possible.
 *
 * `useSearchParams` is only here to re-render when a soft navigation (a Link or `router.push`)
 * changes the query string without a page load; the value comes from the address bar.
 */
export function useNodeLine(): NodeLine {
  useSearchParams();
  const search = useSyncExternalStore(subscribe, clientSearch, serverSearch);
  return search === "" ? DEFAULT_NODE_LINE : nodeLineFromSearch(search);
}
