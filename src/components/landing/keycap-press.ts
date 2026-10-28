import type { NavDirection } from "@/lib/hero-history";

/**
 * The quick press of the hero's Previous and Next keycaps. Pure timing, no DOM: it says which cap
 * is down, and the component draws it (CSS eases the cap down and back up). It lives here, apart
 * from the buttons, because both a click and an arrow key press the same cap.
 */

/**
 * How long a cap is held down. The CSS takes about 50ms to push it down and 90ms to let it up, so
 * a whole press is about 160ms.
 */
export const KEYCAP_DOWN_MS = 70;

export interface KeycapPress {
  /**
   * Pushes the cap for `direction` down, then lets it up KEYCAP_DOWN_MS later. A press while one
   * is still down starts the hold over: it never stacks, and a cap cannot be left down. Only one
   * cap is down at a time, so pressing the other direction lifts the first.
   */
  press: (direction: NavDirection) => void;
  /** Drops a pending release (the component is going away). */
  dispose: () => void;
}

/** `onChange` hears every change of which cap is down: a direction, or null when none is. */
export function createKeycapPress(
  onChange: (pressed: NavDirection | null) => void,
  downMs: number = KEYCAP_DOWN_MS,
): KeycapPress {
  let down: NavDirection | null = null;
  let release: ReturnType<typeof setTimeout> | undefined;

  const set = (next: NavDirection | null) => {
    if (next === down) return;
    down = next;
    onChange(next);
  };

  return {
    press(direction) {
      clearTimeout(release);
      set(direction);
      release = setTimeout(() => {
        release = undefined;
        set(null);
      }, downMs);
    },
    dispose() {
      clearTimeout(release);
      release = undefined;
      down = null;
    },
  };
}
