"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Whether the tab panel a part of the landing page sits in is (or has been) on screen. The default is true: outside a panel, everything is shown.
 * `GenreTabs` sets it per panel, so that what only a panel's visitors see (the treated faces of its cards: a 3 x 3 montage of posters and an SVG each) is
 * not in the server's markup of the panels nobody has opened, which are `hidden` and would send the browser a megabyte of them for nothing.
 */
const PanelShownContext = createContext(true);

export const PanelShownProvider = PanelShownContext.Provider;

/**
 * `children` once the panel they are in has been shown, `placeholder` (what takes their room, or nothing) until then. The panel is `hidden` while it
 * has not been shown, so the placeholder is never seen: the faces are drawn in the same render that shows the panel (a click on its tab, or a
 * deep link such as `/#horror` once the page has hydrated). The cards' links, names and blurbs are in the markup either way.
 */
export function WhenPanelShown({ children, placeholder = null }: { children: ReactNode; placeholder?: ReactNode }) {
  return useContext(PanelShownContext) ? children : placeholder;
}
