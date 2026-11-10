/**
 * The display preferences of a page of films that more than one view of it shares: "Include minor credits", "Show all
 * films" and the flat timeline's layout (one combined track, or one lane each). The Timeline and the Depth view are two
 * components in turn on the same address (`?view=depth` or not), so these cannot live in either one's state: a setting
 * chosen in one has to be there when the visitor moves to the other. Pure, so the rules are testable: `use-film-prefs`
 * holds the value in the browser.
 *
 * The preferences belong to a set of people, as they always did (a different set of people is a different page: it starts
 * over, as the zoom, the selection and the scroll do), so what is held is the preferences and the set they were chosen for.
 */

/** One track for everyone, or one lane each (the timeline as it was). */
export type TrackMode = "combined" | "separate";

/**
 * Whether the separate-lanes layout is on offer. It is parked for now: the flat timeline is always the one combined track (see
 * `effectiveTrackMode`), and no control chooses between them (the page bar's switcher is Timeline, Focus and Table; the layout control that
 * had Lanes is gone). The lanes themselves (the timeline's lane rendering, `TrackMode`) are all still here: set this to `true`, and give
 * `useFilmPrefs`' `trackMode` a control, to bring the option back.
 */
export const LANES_ENABLED = false;

/**
 * The track mode the flat timeline is drawn in: the one asked for, unless lanes are parked (`LANES_ENABLED`), when whatever was
 * asked for ("separate" held from before, say) is the combined track.
 */
export function effectiveTrackMode(mode: TrackMode, lanesEnabled: boolean = LANES_ENABLED): TrackMode {
  return lanesEnabled ? mode : "combined";
}

export interface FilmPrefs {
  /** Count the credits that are not the person's work (a cameo, a thank-you), see `MINOR_TOGGLE_LABEL`. */
  includeMinor: boolean;
  /** Give every film a poster, adding rows as needed: on the flat timeline, and in the Depth view, which has no poster for the films the timeline's row cap leaves as nodes (see `postersLeftOut`). */
  showAll: boolean;
  /** How the flat timeline draws several people. */
  trackMode: TrackMode;
}

export const DEFAULT_FILM_PREFS: FilmPrefs = { includeMinor: false, showAll: false, trackMode: "combined" };

/** What is held: the preferences, and the key of the page (its people) they were chosen on. */
export interface HeldPrefs {
  key: string;
  prefs: FilmPrefs;
}

export const NO_HELD_PREFS: HeldPrefs = { key: "", prefs: DEFAULT_FILM_PREFS };

/** The preferences of the page `key`: what was chosen on it, else the defaults. */
export function prefsFor(held: HeldPrefs, key: string): FilmPrefs {
  return held.key === key ? held.prefs : DEFAULT_FILM_PREFS;
}

/**
 * `held` after `patch` is applied to the page `key`'s preferences. Returns the very same object when nothing changes (so a
 * store can tell: a page whose preferences are the defaults needs nothing held), and starts from the defaults when `held`
 * is for another page.
 */
export function updatePrefs(held: HeldPrefs, key: string, patch: Partial<FilmPrefs>): HeldPrefs {
  const base = prefsFor(held, key);
  const next: FilmPrefs = { ...base, ...patch };
  const same = next.includeMinor === base.includeMinor && next.showAll === base.showAll && next.trackMode === base.trackMode;
  return same ? held : { key, prefs: next };
}
