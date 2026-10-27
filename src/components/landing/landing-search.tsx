"use client";

import { useSyncExternalStore } from "react";
import { PersonSearch } from "@/components/person-search/person-search";

// Autofocus only where it helps: a mouse-and-keyboard device, not a phone where it would
// raise the on-screen keyboard over the page.
const DESKTOP = "(hover: hover) and (pointer: fine) and (min-width: 768px)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(DESKTOP);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function LandingSearch() {
  const isDesktop = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(DESKTOP).matches,
    () => false,
  );
  return <PersonSearch size="hero" autoFocus={isDesktop} />;
}
