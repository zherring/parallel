/**
 * The landing hero's two design variants, compared in the browser through the URL's query (`/?edge=none&layout=wide`) and never on the server, so the
 * page stays static. Pure, so what the query means is tested; the hook that reads it is use-hero-variants.ts.
 *
 * - `edge`: how the cut-out figure's outline meets the photo's own frame edge: "full" strokes the whole polygon, frame edges included; "none" draws no outline.
 * - `layout`: "panels" is two inset panels; "wide" lets each half run out to the viewport's edge.
 */

export const EDGE_VARIANTS = ["full", "none"] as const;
export const LAYOUT_VARIANTS = ["panels", "wide"] as const;
export type EdgeVariant = (typeof EDGE_VARIANTS)[number];
export type LayoutVariant = (typeof LAYOUT_VARIANTS)[number];

export interface HeroVariants {
  edge: EdgeVariant;
  layout: LayoutVariant;
}

export const DEFAULT_VARIANTS: HeroVariants = { edge: "full", layout: "panels" };

/** The variants a query string (with or without its "?") names; whatever it does not name, or names wrongly, is the default. */
export function parseHeroVariants(search: string): HeroVariants {
  const params = new URLSearchParams(search);
  const edge = EDGE_VARIANTS.find((value) => value === params.get("edge"));
  const layout = LAYOUT_VARIANTS.find((value) => value === params.get("layout"));
  return { edge: edge ?? DEFAULT_VARIANTS.edge, layout: layout ?? DEFAULT_VARIANTS.layout };
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
