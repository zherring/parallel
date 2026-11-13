import { EMBED_PREFIX } from "@/lib/embed-frame";
import { PLAYER_SIZE, embedPath } from "@/lib/quote-embed";
import type { PlayerCard } from "@/lib/seo";

/**
 * Whether a link to a pair, or to one of its quotes, asks X for a player card (`twitter:card=player`, the post frames
 * the page's embed and animates it) instead of the plain large-image card. On by default; set
 * `NEXT_PUBLIC_PLAYER_CARDS=0` (or `false`, `off`, `no`) to switch it back to `summary_large_image` at once, without a
 * code change, should X not render player cards for the domain. Read where the page's metadata is made, so a build
 * with the variable set draws every link as the plain card; the Open Graph tags are the same either way.
 */
export function playerCardsOn(raw: string | undefined): boolean {
  return !["0", "false", "off", "no"].includes((raw ?? "").trim().toLowerCase());
}

export const PLAYER_CARDS = playerCardsOn(process.env.NEXT_PUBLIC_PLAYER_CARDS);

/** The path of a pair's embed, the page X frames for a link to the pair: `/embed/p/<people>`. */
export function pairEmbedPath(slug: string): string {
  return `${EMBED_PREFIX}/p/${slug}`;
}

/** The player of a link to a pair (`/p/<people>`), or undefined where the flag is off: what `peopleSocial` is given. */
export function pairPlayer(slug: string): PlayerCard | undefined {
  return PLAYER_CARDS ? { path: pairEmbedPath(slug), ...PLAYER_SIZE } : undefined;
}

/** The player of a link to a pair's quote (`/p/<people>/q/<id>`), or undefined where the flag is off. */
export function quotePlayer(slug: string, id: string): PlayerCard | undefined {
  return PLAYER_CARDS ? { path: embedPath(slug, id), ...PLAYER_SIZE } : undefined;
}
