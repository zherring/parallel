/**
 * What the development-only X preview page (`/dev/x-preview`) needs that is not a component: which page it previews (a pair's `/p/<people>` or a quote's
 * `/p/<people>/q/<id>`), the tags it reads from that page's HTML (the same `twitter:*` tags X reads, so that it exercises what the app really sends, not a copy
 * of it), and the move of an absolute URL in them to the origin the preview is served from (the tags name the production site; the preview frames the local one).
 * Pure, so that it is tested without a browser.
 */

/** The presets of the preview's quick picks: a two-person pair with a poster row, the owner's report, a four-person pair, and a quote. */
export const X_PREVIEW_PRESETS = [
  { label: "Spielberg + Williams", target: "/p/488-steven-spielberg+491-john-williams" },
  { label: "Schoonmaker + Scorsese", target: "/p/3661-thelma-schoonmaker+1032-martin-scorsese" },
  { label: "Pitt + Fincher + Norton + Bonham Carter", target: "/p/287-brad-pitt+7467-david-fincher+819-edward-norton+1283-helena-bonham-carter" },
  { label: "Quote: Williams on Spielberg", target: "/p/488-steven-spielberg+491-john-williams/q/john-is-much-more-of-a" },
] as const;

/** The `sandbox` attribute of the "strict guess": a guess, since what X puts on its frame is not published. */
export const STRICT_SANDBOX = "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox";

/** The widths (px) the desktop card is shown at: a narrow and a wide column of X's timeline, and the 1200 x 630 the player is asked to be. */
export const DESKTOP_WIDTHS = [516, 600, 1200] as const;

/** The panel heights (px) of the phone: about 70% of an 844px screen, and the 253 a short panel gives. */
export const PHONE_SCREEN = { width: 390, height: 844 } as const;
export const PANEL_HEIGHTS = [591, 253] as const;

const PAIR_PATH = /^\/p\/[^/?#\s]+(?:\/q\/[^/?#\s]+)?(?:\?[^#\s]*)?$/;
const PEOPLE_TEXT = /^[A-Za-z0-9+\-_%.\s]+$/;

/**
 * The path the input names, or null when it is not a pair's or a quote's: a `/p/...` path, a URL of one (its path is kept, whatever the host), or the people
 * as they are written in the address (`488+491`, `488-steven-spielberg+491-john-williams`; spaces stand for the `+`).
 */
export function previewTarget(input: string | null | undefined): string | null {
  const text = (input ?? "").trim();
  if (!text) return null;
  let path: string;
  if (/^https?:\/\//i.test(text)) {
    try {
      const url = new URL(text);
      path = `${url.pathname}${url.search}`;
    } catch {
      return null;
    }
  } else if (text.startsWith("/")) {
    path = text;
  } else if (PEOPLE_TEXT.test(text)) {
    path = `/p/${text.replace(/\s+/g, "+")}`;
  } else {
    return null;
  }
  return PAIR_PATH.test(path) ? path : null;
}

/** One `<meta>` of the page: the `name` or `property` it is under, and its content. */
export interface MetaTag {
  name: string;
  content: string;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decode(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, entity: string) => {
    if (entity[0] === "#") {
      const code = entity[1].toLowerCase() === "x" ? Number.parseInt(entity.slice(2), 16) : Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[entity.toLowerCase()] ?? whole;
  });
}

const attribute = (tag: string, name: string): string | null => {
  const match = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i").exec(tag);
  return match ? decode(match[1] ?? match[2] ?? "") : null;
};

/** Every `twitter:*` and `og:*` meta tag of an HTML page, in the order the page has them. */
export function parseMetaTags(html: string): MetaTag[] {
  const tags: MetaTag[] = [];
  for (const [tag] of html.matchAll(/<meta\s[^>]*>/gi)) {
    const name = attribute(tag, "name") ?? attribute(tag, "property");
    const content = attribute(tag, "content");
    if (name && content !== null && /^(twitter|og):/i.test(name)) tags.push({ name, content });
  }
  return tags;
}

export interface PreviewMeta {
  tags: MetaTag[];
  card: string | null;
  title: string | null;
  /** The frame X is told to draw (`twitter:player`), its size (`twitter:player:width`, `:height`), and the picture it shows first (`twitter:image`): as the page sends them. */
  player: string | null;
  playerWidth: number | null;
  playerHeight: number | null;
  image: string | null;
}

const first = (tags: readonly MetaTag[], name: string) => tags.find((tag) => tag.name.toLowerCase() === name)?.content ?? null;
const whole = (value: string | null) => {
  const number = value === null ? Number.NaN : Number.parseInt(value, 10);
  return Number.isFinite(number) && number > 0 ? number : null;
};

/** What the preview reads from the page's tags. */
export function previewMeta(tags: MetaTag[]): PreviewMeta {
  return {
    tags,
    card: first(tags, "twitter:card"),
    title: first(tags, "twitter:title") ?? first(tags, "og:title"),
    player: first(tags, "twitter:player"),
    playerWidth: whole(first(tags, "twitter:player:width")),
    playerHeight: whole(first(tags, "twitter:player:height")),
    image: first(tags, "twitter:image") ?? first(tags, "og:image"),
  };
}

/**
 * The URL a tag names, moved to `origin` (the tags name the production site, whatever served the page: the preview frames what is running here), keeping its
 * path and query as they are (a `+` in the people stays one). Null when there is no URL, or it is none.
 */
export function onOrigin(url: string | null, origin: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url, origin);
    return `${origin}${parsed.pathname}${parsed.search}`;
  } catch {
    return null;
  }
}

/** `src` with `?motion=reduce` added (a development build's embed plays its reduced-motion sequence for it); `src` as it is when not asked for. */
export function withMotion(src: string, reduced: boolean): string {
  if (!reduced) return src;
  return `${src}${src.includes("?") ? "&" : "?"}motion=reduce`;
}

/** What is wrong with the tags for X to draw the player, in words; empty when nothing is. */
export function previewProblems(meta: PreviewMeta): string[] {
  const problems: string[] = [];
  if (meta.card !== "player") problems.push(`twitter:card is ${meta.card ?? "missing"}, not "player": X draws no frame for it`);
  if (!meta.player) problems.push("twitter:player is missing");
  else if (!meta.player.startsWith("https://")) problems.push("twitter:player is not an https URL: X refuses it");
  if (meta.playerWidth === null || meta.playerHeight === null) problems.push("twitter:player:width and :height are not both numbers");
  if (!meta.image) problems.push("twitter:image is missing: X has no poster to show before (or on a phone, instead of) the frame");
  return problems;
}
