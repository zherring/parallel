/**
 * The site's public origin, used for absolute metadata URLs and as the server-rendered base of
 * the share links (the client swaps in the real origin after mount). Set NEXT_PUBLIC_SITE_URL
 * at build time to change it.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://parallel.zachherring.com";
