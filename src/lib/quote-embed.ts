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
import { clippingYear, quoteLinkSearch, speakerIndex, translatedFrom } from "@/lib/clippings-view";
import type { PairCritics } from "@/lib/critics";
import { criticAbout, criticAvatarName, criticName, criticYear, interleaveQuotes } from "@/lib/critics-view";
import { EMBED_PREFIX } from "@/lib/embed-frame";
import { CHAR_WIDTH } from "@/lib/og-quote";
import type { PeopleKeyEvent, PeopleKeyTarget } from "@/lib/people-shortcut";

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
  /** "Translated from Italian", and the words as the source prints them, for a quote that is our translation; absent otherwise. */
  translation?: { label: string; original: string };
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
    const translated = translatedFrom(clipping);
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
      ...(translated && clipping.original ? { translation: { label: translated, original: clipping.original } } : {}),
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

/** The smallest size (px) the embed sets a quote at to fit its frame: readable in the panel X opens over a phone. A quote still too long at it is cut, with an ellipsis. */
export const QUOTE_FLOOR_PX = 13;

/** The largest size (px) the embed sets a quote at, however much room it has: past it a short quote is a headline, not something to read. */
export const QUOTE_MAX_PX = 37;

/**
 * The fewest characters (about five words) a line of the quote holds in a phone's column: the size is held down in a narrow frame so that a quote is never a wall of short, ragged lines
 * of three or four words (22 was the rule before: it set a quote at 32px in a 383px panel, and its lines ran 19 to 27 characters). At 30 the ceiling is the column's width over 15, so
 * 359px (a 383px panel less its sides) is 23.9px, and its lines run 30 to 45 characters (the face's average character is about 0.45 of its size wide, and a line fills about nine tenths
 * of the column); a longer quote is set smaller by its band (see `QUOTE_BAND`) and its lines are longer. The embed's browser test holds an average line to at least 28.
 */
export const QUOTE_MIN_LINE_CHARS = 30;

/**
 * How much of the room between the bar and the footer the quote may take: the middle 60%, with the rest (20% over it and 20% under it, or a little more under it than over it in a
 * tall frame) left empty so that the quote is a block to read in, not a wall to the bar and the footer. A short quote is set at its ceiling and takes less than this; a long
 * one takes the whole band, by being set smaller, and only at the floor is it cut.
 */
export const QUOTE_BAND = 0.6;

/**
 * The largest size (px) a quote may be set at in a column `width` px wide: the one at which a line holds `QUOTE_MIN_LINE_CHARS` characters, up to `QUOTE_MAX_PX` and never under
 * `QUOTE_FLOOR_PX`. It is a ceiling: the embed sets the quote at the largest size under it at which all of the quote is in its band (see `FittedQuote`).
 */
export function quoteSizeCeiling(width: number): number {
  const byMeasure = Number.isFinite(width) && width > 0 ? width / (QUOTE_MIN_LINE_CHARS * CHAR_WIDTH) : 0;
  return Math.max(QUOTE_FLOOR_PX, Math.min(QUOTE_MAX_PX, byMeasure));
}

/** The line counts the no-script clamp steps through (see `noScriptClampCss`): every one up to twelve, then coarser, to a count no real quote runs to in any frame. */
const CLAMP_STEPS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 24, 32] as const;

/**
 * The stylesheet that sets `--quote-lines` on every element with `selector`, in a page with no script: the number of lines of the quote's type size that the room it is in
 * holds in its band (`QUOTE_BAND`), at least 1. The quote's first paint (and a page whose script never runs or fails) is cut at that many lines with an ellipsis, by `-webkit-line-clamp`,
 * which needs a count and so cannot be told "as many as fit": it is stepped by the room's height in a container query. The room is a size container whose own font size is
 * the quote's, and `em` in a container query is the container's, so a step is `lines * lineHeight / QUOTE_BAND` ems tall, whatever the frame: the same arithmetic the script's
 * fit does (`FittedQuote`), without measuring. When the script runs, the fit takes the clamp off and sets the largest size at which the whole quote is in its band.
 */
export function noScriptClampCss(selector: string, lineHeight: number): string {
  const steps = CLAMP_STEPS.map((lines) => `@container (min-height:${Math.ceil((lines * lineHeight * 1000) / QUOTE_BAND) / 1000}em){${selector}{--quote-lines:${lines}}}`);
  return `${selector}{--quote-lines:1}${steps.join("")}`;
}

/**
 * A font size of the quote's card image (set for 1200px, see `quoteCardType`) as a count of the frame's unit `--u`, which is
 * 1/100 of the frame's width when it is 1200 x 630 (12px, so 72px is 6): the frame sets the quote at the size the card does.
 */
export function quoteUnits(fontSizePx: number): number {
  return Math.round((fontSizePx / (PLAYER_SIZE.width / 100)) * 100) / 100;
}

/**
 * Which way a keydown steps through the quotes: -1 for the left arrow, 1 for the right, or null when the key is not the quotes' to take. It is not
 * theirs with a modifier, with fewer than two quotes to step through, for a key something else already handled (`defaultPrevented`) or an IME
 * composition, nor while the visitor types in a text field or sits in a modal dialog (the site's search, say, whose own arrows move through its
 * results): the same rules as the shortcut's (`peopleKeyAction`), read from the same description of the target (`describeShortcutTarget`). A null
 * target (the document) is the page: the viewer's.
 */
export function quoteKeyStep(event: PeopleKeyEvent, target: PeopleKeyTarget | null, count: number): -1 | 1 | null {
  if (count < 2 || event.defaultPrevented || event.isComposing) return null;
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return null;
  if (target && (target.typing || target.inPeopleDialog || target.inOtherModal)) return null;
  if (event.key === "ArrowLeft") return -1;
  if (event.key === "ArrowRight") return 1;
  return null;
}
