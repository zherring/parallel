/**
 * The sizes the embeds' browser tests hold the frame to, written once: a component sets them in the frame's unit with a floor in pixels (`embedSize(min, n)`), and the floor is what a
 * test asserts, so that the two cannot drift apart. Free of React, so that a spec can import it.
 */

/**
 * The pair embed's room from the frame's edges, in px at the least (it is more in a bigger frame: the unit follows it): the bar's top and sides, and the sides' inset again under the
 * year axis, so that its labels are clear of the frame's bottom edge and of its rounded corners.
 */
export const EMBED_INSET_PX = { top: 10, x: 14 } as const;

/** The room under the quote embed's footer, below its last part (the picture, the attribution, the pill), in px at the least. */
export const QUOTE_FOOTER_BOTTOM_PX = 12;

/** The size of a person's round picture in the pair embed's bar (px): the pictures' pitch is never less than it, tucked together or not. */
export const EMBED_AVATAR_PX = 22;
