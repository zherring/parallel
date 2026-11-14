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

/**
 * What makes a control of the frame a touch target. In a phone-width frame (30rem or less) it is at least 32px tall (and a round button 32px wide), and an invisible
 * hit area round it (`before`, as the site's own small buttons have, see the search's) reaches 4px to each side beyond its border box, which the gap between neighbours (8px)
 * holds, and 6px above and under, which the bar has room for (the `before` is placed against the padding box, 1px inside the border, hence the 5px and the 7px of the classes):
 * about 40 wide by 44 tall round a 32px button. A pill that is taller than 32px for its type has the same added to its own height. The browser tests assert the floor.
 */
const HIT_AREA = "relative before:absolute before:-inset-x-[5px] before:-inset-y-[7px]";

/** The classes of the frame's round buttons and pills (a hairline, the text colour of the page, a hover that lights the border). */
export const EMBED_BUTTON = `${HIT_AREA} inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full border border-border text-body transition-colors hover:border-muted hover:text-strong motion-reduce:transition-none @max-[30rem]:min-h-8 @max-[30rem]:min-w-8`;
export const EMBED_PILL = `${HIT_AREA} inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-border font-medium text-strong no-underline transition-colors hover:border-muted motion-reduce:transition-none @max-[30rem]:min-h-8`;

/** The classes of a person's round picture in the bar that is a link: the same hit area, round it. */
export const EMBED_AVATAR_LINK = "relative inline-flex rounded-full no-underline before:absolute before:-inset-1.5";

/** The wordmark as a link to `href` (a new tab when `external`): how the frame leads to more of the site. */
export function EmbedWordmark({ href, title, label, external }: { href: string; title: string; label: string; external: boolean }) {
  return (
    <a
      href={href}
      {...(external ? EXTERNAL : {})}
      title={title}
      aria-label={label}
      className="inline-flex shrink-0 items-center gap-2 no-underline"
      style={{ fontSize: embedSize(15, 2.04) }}
    >
      <Wordmark className="leading-none" />
    </a>
  );
}

/**
 * "Open in Parallel": the same view on the site, as a pill that is always one line. With `short`, a frame narrower than 26rem (a phone's panel) draws it as "Open" and the
 * arrow, so that it fits the footer's row beside the attribution instead of wrapping under it (its name stays the whole of it, for a screen reader and for the visitor's tooltip).
 */
export function OpenInParallel({ href, external, short = false, style }: { href: string; external: boolean; short?: boolean; style?: CSSProperties }) {
  return (
    <a
      href={href}
      {...(external ? EXTERNAL : {})}
      aria-label={external ? "Open in Parallel (opens in a new tab)" : "Open in Parallel"}
      title="Open in Parallel"
      className={EMBED_PILL}
      style={{ fontSize: embedSize(10.5, 1.36), padding: `${embedSize(6, 0.76)} ${embedSize(10, 1.28)}`, ...style }}
    >
      {short ? (
        <>
          <span className="@max-[26rem]:hidden">Open in Parallel</span>
          <span aria-hidden="true" className="hidden @max-[26rem]:inline">
            Open
          </span>
        </>
      ) : (
        "Open in Parallel"
      )}
      <ExternalLink aria-hidden="true" className="size-3" />
    </a>
  );
}
