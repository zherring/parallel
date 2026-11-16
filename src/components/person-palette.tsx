"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { usePortraitMode } from "@/components/use-portrait-mode";
import { portraitPersonHexes } from "@/lib/portrait-cuts";

/**
 * Spike (zherring/spike-portraits): the page's person colours by slot when the portrait flag is on (a pair's `pairPortraitColors`, as the landing
 * page gives them), for the places that need a hex rather than `var(--person-N)`: the treated portraits' edge, flat background and montage tint.
 * The custom properties themselves are overridden where they are written (`personColorCss`). Null, the default, is the app as it is.
 */
const PersonPaletteContext = createContext<readonly string[] | null>(null);

export function PersonPaletteProvider({ hexes, children }: { hexes: readonly string[] | null; children: ReactNode }) {
  return <PersonPaletteContext.Provider value={hexes}>{children}</PersonPaletteContext.Provider>;
}

/** The page's override of the person colours (see `PersonPaletteProvider`); null without the flag. */
export function usePersonPalette(): readonly string[] | null {
  return useContext(PersonPaletteContext);
}

/**
 * The override for these people (in the URL order) when the portrait flag is on, else null. From the ids alone, so the server and the
 * hydrating render agree; a flag remembered by the tab (not in the address) applies after hydration, as `usePortraitMode` does.
 */
export function usePortraitPersonHexes(personIds: readonly number[]): readonly string[] | null {
  const mode = usePortraitMode();
  const key = personIds.join("+");
  // Keyed by the ids, not the array's identity.
  return useMemo(() => (mode ? portraitPersonHexes(key.split("+").map(Number)) : null), [mode, key]);
}
