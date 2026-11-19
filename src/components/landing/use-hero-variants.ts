"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_VARIANTS, parseHeroVariants, showsLab, withVariant, type HeroVariants } from "@/lib/hero-variants";

/**
 * The URL's query as a store: `history.replaceState` fires no event, so the variants' control notifies the subscribers itself, as the genre tabs do for the
 * hash; `popstate` covers back and forward. The server's snapshot (and the hydrating render's) is the empty query, so the first client render matches the
 * server's static markup, and the variants named in the URL apply from the render after.
 */
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("popstate", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("popstate", onChange);
  };
}

const getSearch = () => window.location.search;
const getServerSearch = () => "";

/** The edge, layout and cards variants the URL names (the defaults without a query), as an object that only changes when they do. */
let cached: { search: string; variants: HeroVariants } = { search: "", variants: DEFAULT_VARIANTS };
function variantsOf(search: string): HeroVariants {
  if (cached.search !== search) {
    const next = parseHeroVariants(search);
    cached = { search, variants: next.edge === cached.variants.edge && next.layout === cached.variants.layout && next.cards === cached.variants.cards ? cached.variants : next };
  }
  return cached.variants;
}

export function useHeroVariants(): HeroVariants {
  const search = useSyncExternalStore(subscribe, getSearch, getServerSearch);
  return variantsOf(search);
}

/** Whether the variants' control shows (see `showsLab`): after hydration only, as the query is not known before it. */
export function useShowsLab(): boolean {
  const search = useSyncExternalStore(subscribe, getSearch, getServerSearch);
  return showsLab(search, process.env.NODE_ENV !== "production");
}

/** Sets one variant in the URL (the page's other parameters and its hash are kept) without a navigation, and tells the stage. */
export function setHeroVariant(key: keyof HeroVariants, value: string) {
  const { pathname, search, hash } = window.location;
  window.history.replaceState(window.history.state, "", `${pathname}${withVariant(search, key, value)}${hash}`);
  for (const notify of listeners) notify();
}
