"use client";

import { useEffect, useState } from "react";
import { PersonSearch } from "@/components/person-search/person-search";

// Autofocus only where it helps: a mouse-and-keyboard device, not a phone where it would
// raise the on-screen keyboard over the page.
const DESKTOP = "(hover: hover) and (pointer: fine) and (min-width: 768px)";

export function LandingSearch() {
  // Autofocus is a one-time page-opening decision. Crossing the 768px breakpoint later must not
  // steal focus from whatever the visitor is using or reopen a dismissed result list.
  const [isDesktop, setDesktop] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setDesktop(window.matchMedia(DESKTOP).matches));
    return () => cancelAnimationFrame(frame);
  }, []);
  return <PersonSearch size="hero" mode="chips" autoFocus={isDesktop} persistChips />;
}
