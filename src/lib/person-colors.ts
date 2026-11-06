/**
 * The colour of each person on the timeline, in one place so the palette is easy to tweak: edit
 * `PERSON_COLORS` and everything follows (the combined track, each separate lane, the minimap,
 * the people column).
 *
 * People are coloured by their position in the URL, not by who is visible, so hiding someone
 * never recolours the others. The idea is that blue and yellow make green: a film made by
 * several visible people keeps the app's green, and each contributor's colour shows as a dot.
 *
 * The colours are muted so they sit on the dark theme without competing with the posters
 * (5.5:1 or more on --bg), and stay apart from each other under protan, deutan and tritan
 * simulation (CIELAB distance 12 or more, but amber and green stay close under deutan: the dots
 * and the names carry the meaning, never the colour alone). None of them reads as the green.
 */

export const PERSON_COLORS = [
  { name: "blue", hex: "#6f9bd1" },
  { name: "amber", hex: "#d0a845" },
  { name: "orange", hex: "#d27650" },
  { name: "rose", hex: "#c487a6" },
] as const;

/** Opacity of the soft glow around a coloured poster (the green one is 0.45). */
const GLOW_ALPHA = 0.4;

function paletteEntry(slot: number) {
  return PERSON_COLORS[((Math.trunc(slot) % PERSON_COLORS.length) + PERSON_COLORS.length) % PERSON_COLORS.length];
}

/** The custom property of a slot's colour, e.g. `var(--person-1)`; slots past the palette wrap around. */
export function personColor(slot: number): string {
  return `var(--person-${PERSON_COLORS.indexOf(paletteEntry(slot)) + 1})`;
}

/** The custom property of a slot's glow, the colour at partial opacity. */
export function personGlow(slot: number): string {
  return `var(--person-${PERSON_COLORS.indexOf(paletteEntry(slot)) + 1}-glow)`;
}

/** The name of a slot's colour, for tests and tooltips. */
export function personColorName(slot: number): string {
  return paletteEntry(slot).name;
}

function glowOf(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
  return `rgb(${r} ${g} ${b} / ${GLOW_ALPHA})`;
}

/**
 * The palette as CSS custom properties on :root (`--person-1`, `--person-1-glow`, ...). They are
 * global, not set on the timeline, because the film's hover card is rendered in a portal on the body.
 */
export function personColorCss(): string {
  const declarations = PERSON_COLORS.map(
    ({ hex }, i) => `--person-${i + 1}:${hex};--person-${i + 1}-glow:${glowOf(hex)};`,
  );
  return `:root{${declarations.join("")}}`;
}

/** Person id -> palette slot, by position in `people` (the URL order). */
export function personSlots(people: readonly { id: number }[]): Map<number, number> {
  return new Map(people.map((person, index) => [person.id, index]));
}
