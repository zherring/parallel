import { getPairClippingSet } from "@/lib/clippings";
import { pairingBlurb } from "@/lib/examples";
import { getPairDescription } from "@/lib/pair-descriptions";
import { pickHeroNote, type HeroNote } from "@/lib/pair-hero";

/**
 * The note the pair hero shows beside the portraits for the people with these TMDB ids: the pair's featured quote (the first artist quote that fits whole), else its
 * curated description, else the one-line blurb of a curated pairing, else null (see `pickHeroNote`). It reads the quotes, the descriptions and the landing page's pairings, so it belongs to
 * the server: the page works it out once and hands the result to the client.
 */
export function getHeroNote(ids: readonly number[]): HeroNote | null {
  return pickHeroNote({
    clippings: getPairClippingSet(ids),
    description: getPairDescription(ids),
    blurb: pairingBlurb(ids),
  });
}
