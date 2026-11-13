/**
 * The chrome-less pages that other sites frame: the player cards on X, a pair's (`/embed/p/<people>`, see `player-cards.ts`) and a quote's
 * (`/embed/q/<people>/<id>`, see `quote-embed.ts`). `next.config.ts` applies `embedHeaders()` to this prefix alone, so the CSP below is sent on these
 * pages and on no other: every other route keeps what it sends today (no `X-Frame-Options`, no CSP; checked against
 * production, which sends neither), so adding the embeds changes nothing for the rest of the site.
 *
 * X draws a `twitter:card=player` card as an iframe of the `twitter:player` page, in the post. The browser refuses a
 * frame unless the framed page's `Content-Security-Policy: frame-ancestors` names the framing origin, and an
 * `X-Frame-Options` header would be refused whatever the CSP says, so the embeds must not send one (and none does).
 */

/** The path prefix of the pages that are framed; the site's footer and search are left out of them (see `SiteChrome`). */
export const EMBED_PREFIX = "/embed";

/** The origins that may frame an embed: the page itself, and X under both of its names (and the subdomains its card frames come from). */
export const EMBED_FRAME_ANCESTORS = ["'self'", "https://x.com", "https://*.x.com", "https://twitter.com", "https://*.twitter.com"] as const;

export const EMBED_CSP = `frame-ancestors ${EMBED_FRAME_ANCESTORS.join(" ")}`;

/** Whether `pathname` is an embed (or the prefix itself). */
export function isEmbedPath(pathname: string | null | undefined): boolean {
  return pathname === EMBED_PREFIX || (pathname?.startsWith(`${EMBED_PREFIX}/`) ?? false);
}

/** The `headers()` of `next.config.ts`: the CSP above on every embed path, and nothing on any other. */
export function embedHeaders(): { source: string; headers: { key: string; value: string }[] }[] {
  return [{ source: `${EMBED_PREFIX}/:path*`, headers: [{ key: "Content-Security-Policy", value: EMBED_CSP }] }];
}
