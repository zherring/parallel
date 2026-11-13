/**
 * One quote of a pair as the player card draws it, and the paths around it. Pure, and free of the JSON itself (see
 * `quote-embed-data.ts`), so that the client component and the tests can import it.
 *
 * A quote's id is the one the Clippings tab already links to (`?view=clippings&quote=<id>`, `Clipping.id` and
 * `Critic.id`): a slug that never changes once shared, unique within its pair (the critics' ones, which start with
 * "critic-", are unique everywhere). Nothing is derived for the embed: its URLs carry that id as it is.
 *
 *   share URL   /p/<people>/q/<id>          what a post links to: the page with the `twitter:card=player` tags
 *   embed URL   /embed/q/<people>/<id>      what X frames in the post: the quote, with the pair's others a click away
 *   card image  /p/<people>/og?quote=<id>   the poster (`twitter:image`), as for any link to the quote
 */

import type { VoicedClippings } from "@/lib/clippings";
import { clippingYear, quoteLinkSearch, speakerIndex } from "@/lib/clippings-view";
import type { PairCritics } from "@/lib/critics";
import { criticAbout, criticAvatarName, criticName, criticYear, interleaveQuotes } from "@/lib/critics-view";
import { EMBED_PREFIX } from "@/lib/embed-frame";

/** A quote with everything the embed shows of it, whether an artist said it about the other or a critic wrote it about the pair. */
export interface EmbedQuote {
  /** The stable id (see above). */
  id: string;
  /** Verbatim. */
  quote: string;
  /** Who said it (the critic, or the publication for an unsigned piece). */
  speaker: string;
  /** Who it is about: the other artist's name, or the pair's family names ("Spielberg & Williams") for a critic. */
  about: string;
  /** The speaker's colour slot on the page (see `person-colors.ts`); null for a critic or a speaker outside the pair, whose marks are quiet. */
  slot: number | null;
  /** The round picture: the speaker's headshot, or the critic's initials; null when there is none to draw. */
  avatar: { name: string; profilePath: string | null } | null;
  film: string | null;
  /** Where it was published, the link under the quote, and the year the quote goes under (see `clippingYear`). */
  publication: string;
  year: number | null;
  url: string;
}

/** The size X is told to give the player: the shape of the poster, so that the frame and the card image agree. */
export const PLAYER_SIZE = { width: 1200, height: 630 } as const;

/** The path of a quote's share URL: the page whose tags make X draw the player. */
export function quotePath(slug: string, id: string): string {
  return `/p/${slug}/q/${encodeURIComponent(id)}`;
}

/** The path of a quote's embed: the page X frames. */
export function embedPath(slug: string, id: string): string {
  return `${EMBED_PREFIX}/q/${slug}/${encodeURIComponent(id)}`;
}

/**
 * The share URL of the quote `id` for the visitor on the pair page at `pathname` (`/p/<people>`): what the share
 * button copies. The pair page's own address is already canonical (any other spelling redirects to it).
 */
export function quoteSharePath(pathname: string, id: string): string {
  return `${pathname.replace(/\/+$/, "")}/q/${encodeURIComponent(id)}`;
}

/** The page's own view of the quote, for a human who wants the whole pair: its Clippings tab, opened on the quote. */
export function quoteInPairPath(slug: string, id: string): string {
  return `/p/${slug}${quoteLinkSearch(id)}`;
}

/** The landing page's Quotes tab: more pairs with quotes of their own. */
export const MORE_PAIRS_PATH = "/#clippings";

/**
 * Every quote of the pair as the Clippings tab lists them (the artists' and the critics' in one list, oldest first,
 * see `interleaveQuotes`): the order the embed steps through. `clippings` is the pair's quotes with the colour and
 * headshot of each speaker on the page (`voiceClippings`), `critics` what the critics wrote.
 */
export function embedQuotes(clippings: VoicedClippings | null, critics: PairCritics | null): EmbedQuote[] {
  const people = clippings?.people ?? null;
  return interleaveQuotes(clippings?.clippings ?? [], critics?.critics ?? []).map((entry): EmbedQuote => {
    if (entry.kind === "critic") {
      const { critic } = entry;
      return {
        id: critic.id,
        quote: critic.quote,
        speaker: criticName(critic),
        about: critics ? criticAbout(critics.people) : "",
        slot: null,
        avatar: { name: criticAvatarName(critic), profilePath: null },
        film: null,
        publication: critic.publication,
        year: criticYear(critic),
        url: critic.url,
      };
    }
    const { clipping } = entry;
    const side = people ? speakerIndex(clipping, people) : null;
    const voice = people && side !== null ? people[side] : null;
    return {
      id: clipping.id,
      quote: clipping.quote,
      speaker: clipping.speaker,
      about: clipping.about,
      slot: voice ? voice.slot : null,
      avatar: voice ? { name: voice.name, profilePath: voice.profilePath } : null,
      film: clipping.film,
      publication: clipping.publication,
      year: clippingYear(clipping),
      url: clipping.url,
    };
  });
}

/**
 * Where the quote named by `id` is in `quotes`, or -1: no id, an id the pair does not have, or one that is not a
 * well-formed path segment. The id is the whole of what the URL names, so an unknown one is a 404, never a guess.
 */
export function findQuoteIndex(quotes: readonly Pick<EmbedQuote, "id">[], id: string | null | undefined): number {
  if (!id) return -1;
  let wanted: string;
  try {
    wanted = decodeURIComponent(id).trim();
  } catch {
    return -1;
  }
  return wanted ? quotes.findIndex((quote) => quote.id === wanted) : -1;
}

/**
 * A font size of the quote's card image (set for 1200px, see `quoteCardType`) as a count of the frame's unit `--u`, which is
 * 1/100 of the frame's width when it is 1200 x 630 (12px, so 72px is 6): the frame sets the quote at the size the card does.
 */
export function quoteUnits(fontSizePx: number): number {
  return Math.round((fontSizePx / (PLAYER_SIZE.width / 100)) * 100) / 100;
}
