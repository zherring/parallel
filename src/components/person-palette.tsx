"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { portraitPersonHexes } from "@/lib/portrait-cuts";

/**
 * A pair page's person colours by slot (a pair's `pairPortraitColors`, as the landing page gives them), for the places that need a hex rather than
 * `var(--person-N)`: the portraits' edge, flat background and montage tint. The custom properties themselves are overridden where they are written
 * (`personColorCss`). It is also the gate of the white "made together": on a pair's page a film made together is white; null, for one person or three and
 * more, keeps the app's green for it and the `PERSON_COLORS` for the people.
 */
const PersonPaletteContext = createContext<readonly string[] | null>(null);

export function PersonPaletteProvider({ hexes, children }: { hexes: readonly string[] | null; children: ReactNode }) {
  return <PersonPaletteContext.Provider value={hexes}>{children}</PersonPaletteContext.Provider>;
}

/** The page's override of the person colours (see `PersonPaletteProvider`); null for one person, or three and more. */
export function usePersonPalette(): readonly string[] | null {
  return useContext(PersonPaletteContext);
}

/** The override for these people (in the URL order): a pair's, else null. From the ids alone, so the server and the hydrating render agree. */
export function usePortraitPersonHexes(personIds: readonly number[]): readonly string[] | null {
  const key = personIds.join("+");
  // Keyed by the ids, not the array's identity.
  return useMemo(() => portraitPersonHexes(key.split("+").map(Number)), [key]);
}
