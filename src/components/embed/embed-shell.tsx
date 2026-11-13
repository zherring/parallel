import { ExternalLink } from "lucide-react";
import type { CSSProperties } from "react";
import { Wordmark } from "@/components/wordmark";

/**
 * What the embeds share (the quote's, `quote-embed.tsx`, and the pair's, `pair-embed.tsx`): the pages X frames inside a post. Both are
 * sized in the frame's own unit and open every link in a new tab (X sandboxes the frame; a link that navigates it would be refused).
 */

/**
 * A size that follows the frame: `n` of the frame's unit (`--u`, 12px at the 1200 x 630 the player is asked to be, shrinking with the frame down to what
 * X gives a post on a desktop timeline), but never under `min` pixels, so that a phone's panel (390 wide, about 120 tall once X's own bar is off it) still reads.
 */
export const embedSize = (min: number, n: number) => `max(${min}px, calc(${n} * var(--u)))`;

/** The frame's own size is the container (its units, `cqw` and `cqh`, are what the type and the spacing are set in), and `--u` is the unit: 1% of its width, or 1.9% of its height where that is smaller. */
export const FRAME_STYLE = { containerType: "size", "--u": "min(1cqw, 1.9cqh)" } as CSSProperties;

/** What a link out of a frame needs: a new tab, with no `opener`. */
export const EXTERNAL = { target: "_blank", rel: "noopener" } as const;

/** The classes of the frame's round buttons and pills (a hairline, the text colour of the page, a hover that lights the border). */
export const EMBED_BUTTON =
  "inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full border border-border text-body transition-colors hover:border-muted hover:text-strong motion-reduce:transition-none";
export const EMBED_PILL =
  "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-border font-medium text-strong no-underline transition-colors hover:border-muted motion-reduce:transition-none";

/** The wordmark as a link to `href` (a new tab when `external`): how the frame leads to more of the site. */
export function EmbedWordmark({ href, title, label, external }: { href: string; title: string; label: string; external: boolean }) {
  return (
    <a
      href={href}
      {...(external ? EXTERNAL : {})}
      title={title}
      aria-label={label}
      className="inline-flex shrink-0 items-center gap-2 no-underline"
      style={{ fontSize: embedSize(18, 2.4) }}
    >
      <Wordmark className="leading-none" />
    </a>
  );
}

/** "Open in Parallel": the same view on the site, as a pill. */
export function OpenInParallel({ href, external, style }: { href: string; external: boolean; style?: CSSProperties }) {
  return (
    <a
      href={href}
      {...(external ? EXTERNAL : {})}
      className={EMBED_PILL}
      style={{ fontSize: embedSize(12, 1.6), padding: `${embedSize(7, 0.9)} ${embedSize(12, 1.5)}`, ...style }}
    >
      Open in Parallel
      <ExternalLink aria-hidden="true" className="size-3.5" />
      {external && <span className="sr-only">(opens in a new tab)</span>}
    </a>
  );
}
