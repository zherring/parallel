import {
  BACON_MODE_LABEL,
  isBaconPage,
  namesBaconMode,
  searchWithoutBaconMode,
  withBaconMode,
} from "@/lib/bacon-mode";
import { searchWithPeriod, type Period } from "@/lib/period";
import { parsePeopleSlug } from "@/lib/slug";

/**
 * What Kevin Bacon mode (src/lib/bacon-mode.ts) does outside the page itself: the links, previews and frames that carry a page to somewhere else. A
 * link to a page in the mode opens in the mode (`?mode=bacon` in the address), and its preview (the title, the card, the player's frame) says so.
 * Pure and free of the browser, so that the server's metadata, the card's renderer, the embed and the share menu all read one rule.
 */

/**
 * The colour of "made together" on a pair's card and in its embed: white, as on the page (`--together` in globals.css), and in the mode the orange of that page.
 * The card is drawn where CSS cannot be read (the image renderer, and the embed's first frame, which is the card's picture), so the two values are repeated here;
 * bacon-share.test.ts holds them to globals.css (`--together` on `:root`, and `--orange`, which `:root:has([data-bacon-page])` makes it).
 */
export const TOGETHER_WHITE = "#ffffff";
export const BACON_ORANGE = "#ff8000";

/** The colour of the films a pair made together on a card or in a frame, in the mode or out of it. */
export function togetherColor(bacon: boolean): string {
  return bacon ? BACON_ORANGE : TOGETHER_WHITE;
}

/**
 * Whether the pair's preview (its metadata, its card and its embed) is in the mode: the address names it, he is one of the people (`isBaconPage`) and there are
 * two or more of them. The mode's colour is the films they made together, which one person's page has none of, so a page of him alone previews as it does out of the mode.
 */
export function isBaconCard(query: Parameters<typeof isBaconPage>[0], personIds: readonly number[]): boolean {
  return personIds.length > 1 && isBaconPage(query, personIds);
}

/** Whether the page at `pathname` (`/p/<people>`) with the query `search` is in the mode: what a handler in the browser reads, with no page's props to hand. */
export function baconOnPage(pathname: string, search: string): boolean {
  const slug = /^\/p\/([^/?#]+)/.exec(pathname)?.[1];
  const ids = slug ? (parsePeopleSlug(slug)?.ids ?? []) : [];
  return isBaconPage(search, ids);
}

/** The title of a pair's page in the mode: the page's own, then the mode ("Kevin Bacon & Kyra Sedgwick: films made together · Kevin Bacon mode"). */
export function baconTitle(title: string): string {
  return `${title} · ${BACON_MODE_LABEL}`;
}

/** The description of a pair's page in the mode: the mode first, then the page's own ("Kevin Bacon mode. Films made together by …"). */
export function baconDescription(description: string): string {
  return `${BACON_MODE_LABEL}. ${description}`;
}

/** The query (with its "?") of a card in the mode: its period when it has one (as `searchWithPeriod` writes it), then the mode. */
export function baconCardSearch(period: Period | null): string {
  return withBaconMode(searchWithPeriod("", period));
}

/** Where the card of a pair in the mode is drawn: the `/og` route next to the page's own `opengraph-image`, asked for the mode (and the period, if the link has one). */
export function baconImagePath(canonicalSlug: string, period: Period | null): string {
  return `/p/${canonicalSlug}/og${baconCardSearch(period)}`;
}

/** The query (with its "?") and the hash (with its "#") of `href`, split from what comes before them. */
function splitHref(href: string): { path: string; query: string; hash: string } {
  const hashAt = href.indexOf("#");
  const beforeHash = hashAt === -1 ? href : href.slice(0, hashAt);
  const queryAt = beforeHash.indexOf("?");
  return {
    path: queryAt === -1 ? beforeHash : beforeHash.slice(0, queryAt),
    query: queryAt === -1 ? "" : beforeHash.slice(queryAt),
    hash: hashAt === -1 ? "" : href.slice(hashAt),
  };
}

/**
 * `href` as every way of sharing the page writes it: in the mode when `bacon` (a link that already names it is left exactly as it is), and out of it when not
 * (a `mode=bacon` that means nothing on a page without him is dropped). The one rule of the share menu's links to X and Bluesky, its native share, its Copy link
 * and a quote's share button.
 */
export function shareHref(href: string, bacon: boolean): string {
  const { path, query, hash } = splitHref(href);
  if (bacon) return namesBaconMode(query) ? href : withBaconMode(href);
  return namesBaconMode(query) ? `${path}${searchWithoutBaconMode(query)}${hash}` : href;
}
