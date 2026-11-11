/**
 * What a Depth view poster looks like until its image has arrived (a slow connection, or a jump along the rail to posters whose
 * images had not been asked for yet): the dark surface the card is made of, tinted a little with the colour of whoever made the film,
 * and green for a film made together. So the scene is never full of blank holes, and the colours already say whose films are
 * coming. It is the card's own fill, drawn under the image, so nothing is laid out differently when the image replaces it. Pure.
 */

/** How much of the tint (percent) goes into the surface: faint, a hint of colour on a dark card. */
export const PLACEHOLDER_TINT_PERCENT = 14;

/** The fill (a CSS colour) of a poster's face: the surface, tinted with `tint` (a CSS colour such as `var(--lit)`) when there is one. */
export function placeholderFill(tint: string | null): string {
  return tint ? `color-mix(in srgb, ${tint} ${PLACEHOLDER_TINT_PERCENT}%, var(--surface))` : "var(--surface)";
}
