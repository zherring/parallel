// What the app's sheets share: the slide-out panel (film and person details, the Quotes' lists) and the gear's settings on a phone. The breakpoints
// they change shape at and the way they slide in and out are here once, so that the CSS classes, the gesture hooks and the two components cannot
// drift apart: a sheet that is at the bottom by its classes and dismissed sideways by its hook is a bug on one width of phone only.

/** From this width the slide-out panel is a sheet on the right, not one from the bottom: Tailwind's `md`, as the panel's `md:` classes. */
export const SIDE_PANEL_QUERY = "(min-width: 48rem)";
/** A phone's width, under Tailwind's `sm` (where the page bar folds its views into the gear): the gear's settings are a sheet from the bottom there. */
export const PHONE_SHEET_QUERY = "(max-width: 39.9375rem)";
export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/** Which edge a sheet comes from, and so the way a finger drags it away: the bottom (down) or the right (to the right). */
export type SheetEdge = "bottom" | "right";

/** The edge the slide-out panel comes from at this width. */
export const sidePanelEdge = (): SheetEdge => (window.matchMedia(SIDE_PANEL_QUERY).matches ? "right" : "bottom");
export const prefersReducedMotion = (): boolean => window.matchMedia(REDUCED_MOTION_QUERY).matches;

const off = (edge: SheetEdge) => (edge === "right" ? "translateX(100%)" : "translateY(100%)");
/** The curve of a sheet arriving, settling back, or carrying on from a finger that flung it: quick, then easing to rest. */
export const SHEET_EASE_OUT = "cubic-bezier(0.2, 0.8, 0.2, 1)";
const SHEET_EASE_IN = "cubic-bezier(0.4, 0, 1, 1)";

/** A sheet slides in from its edge and its backdrop fades in. Not called for a visitor who asked for less motion. */
export function slideSheetIn(panel: HTMLElement | null, backdrop: HTMLElement | null, edge: SheetEdge): void {
  backdrop?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: "ease-out" });
  panel?.animate([{ transform: off(edge) }, { transform: "none" }], { duration: 240, easing: SHEET_EASE_OUT });
}

/**
 * A sheet slides back out to its edge and its backdrop fades, and both stay there (the caller removes them when the animations finish). Only where
 * they end is given: they start from where they are, which is at rest unless a finger dragged the sheet part of the way; `dragged` says it did, and
 * then the sheet is already moving, so it eases out instead of in.
 */
export function slideSheetOut(panel: HTMLElement | null, backdrop: HTMLElement | null, edge: SheetEdge, dragged: boolean): Animation[] {
  return [
    backdrop?.animate([{ opacity: 0 }], { duration: 160, easing: dragged ? "ease-out" : "ease-in", fill: "forwards" }),
    panel?.animate([{ transform: off(edge) }], { duration: 200, easing: dragged ? SHEET_EASE_OUT : SHEET_EASE_IN, fill: "forwards" }),
  ].filter((animation) => animation !== undefined);
}

/** The bottom sheet's grabber: it can be pulled down from anywhere on it, and this says so. */
export const SHEET_GRABBER_CLASS = "pointer-events-none absolute left-1/2 h-1 w-9 -translate-x-1/2 rounded-full bg-muted/40";
/** The dimmed page behind a sheet. */
export const SHEET_BACKDROP_CLASS = "bg-black/70";
