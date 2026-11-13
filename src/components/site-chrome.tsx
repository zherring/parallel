"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { isEmbedPath } from "@/lib/embed-frame";

/**
 * The site's header (the wordmark and the Search button, which holds the universal search and its Cmd/Ctrl+K) and footer, left out of the embeds
 * (`/embed/...`): those are framed inside a post on X, where the site's search and links have no place. The pathname is known while the server renders,
 * so the chrome is absent from the embed's HTML rather than hidden after it loads.
 */
export function SiteChrome({ children }: { children: ReactNode }) {
  return isEmbedPath(usePathname()) ? null : children;
}
