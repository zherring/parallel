/**
 * The landing page's design variants (the hero's, and the genre cards'), compared in the browser through the URL's query (`/?edge=none&layout=wide`) and never on the server, so the
 * page stays static. Pure, so what the query means is tested; the hook that reads it is use-hero-variants.ts.
 *
 * - `edge`: how the cut-out figure's outline meets the photo's own frame edge: "none" (the default: the splash has no outline) draws no outline; "full" strokes the whole polygon, frame edges included.
 * - `layout`: "panels" is two inset panels; "wide" lets each half run out to the viewport's edge.
 * - `cards`: how the people sit on a genre's pairing cards (card-portraits.tsx): "cascade" (the default) is two tilted portrait cards in a diagonal cascade; "split" one square
 *   tile cut by a diagonal seam, A's cut-out in the top left and B's in the bottom right; "duo" the two cut-outs standing bare side by side on one shared backdrop.
 */

export const EDGE_VARIANTS = ["none", "full"] as const;
export const LAYOUT_VARIANTS = ["panels", "wide"] as const;
export type EdgeVariant = (typeof EDGE_VARIANTS)[number];
export const CARDS_VARIANTS = ["cascade", "split", "duo"] as const;
export type LayoutVariant = (typeof LAYOUT_VARIANTS)[number];
export type CardsVariant = (typeof CARDS_VARIANTS)[number];

export interface HeroVariants {
  edge: EdgeVariant;
  layout: LayoutVariant;
  cards: CardsVariant;
}

export const DEFAULT_VARIANTS: HeroVariants = { edge: "none", layout: "panels", cards: "cascade" };

/** The variants a query string (with or without its "?") names; whatever it does not name, or names wrongly, is the default. */
export function parseHeroVariants(search: string): HeroVariants {
  const params = new URLSearchParams(search);
  const edge = EDGE_VARIANTS.find((value) => value === params.get("edge"));
  const layout = LAYOUT_VARIANTS.find((value) => value === params.get("layout"));
  const cards = CARDS_VARIANTS.find((value) => value === params.get("cards"));
  return { edge: edge ?? DEFAULT_VARIANTS.edge, layout: layout ?? DEFAULT_VARIANTS.layout, cards: cards ?? DEFAULT_VARIANTS.cards };
}

/** The query string with `key` set to `value`, every other parameter (`lab` among them) kept as it is; with its "?", or empty when nothing is left. */
export function withVariant(search: string, key: keyof HeroVariants, value: string): string {
  const params = new URLSearchParams(search);
  params.set(key, value);
  const text = params.toString().replace(/(^|&)lab=(?=&|$)/, "$1lab");
  return text ? `?${text}` : "";
}

/** Whether the variants' control shows: always while developing, in production only for a visit that asks (`?lab`). */
export function showsLab(search: string, development: boolean): boolean {
  return development || new URLSearchParams(search).has("lab");
}
