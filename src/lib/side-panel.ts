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
