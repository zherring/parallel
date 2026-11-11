import type { PersonSummary } from "@/lib/types";

/**
 * What the slide-out panel on a people page shows. There is one panel: opening a person's details
 * while a film's are open (or the other way round) replaces them, and none is open when the state is null.
 */
export type PanelTarget = { kind: "film"; id: number } | { kind: "person"; id: number };

export const openFilm = (id: number): PanelTarget => ({ kind: "film", id });
export const openPerson = (id: number): PanelTarget => ({ kind: "person", id });

/** The film the panel shows, or null when it is closed or shows someone else. */
export function filmIdOf(target: PanelTarget | null): number | null {
  return target?.kind === "film" ? target.id : null;
}

/** The person the panel shows, or null when it is closed or shows a film. */
export function personIdOf(target: PanelTarget | null): number | null {
  return target?.kind === "person" ? target.id : null;
}

/** A person of the page with the roles the person panel gives under the name. */
export interface PersonPanelEntry {
  person: PersonSummary;
  roles: string;
}

/**
 * Opens a person's details in the slide-out panel. The shell hands focus back to the control that opened the panel when it closes, so the opener
 * does not have to: it passes the control it was pressed on (`trigger`, a click's `currentTarget`), which the shell then trusts over whatever has
 * focus (in Safari, which does not focus a pressed button, that is a scroller or dialog round it; see `rememberOpener`).
 */
export type OpenPerson = (personId: number, trigger?: Element | null) => void;

/**
 * Everything a component outside the people column needs to turn a person's name into a button: the people
 * of the page, matched to a name by TMDB id, and the opener. They only work together, so they travel together.
 */
export interface PersonPanelAccess {
  entries: readonly PersonPanelEntry[];
  open: OpenPerson;
}
