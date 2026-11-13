"use client";

import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { EMBED_BUTTON, FRAME_STYLE, EmbedWordmark, OpenInParallel, embedSize as size } from "@/components/embed/embed-shell";
import { newsreader } from "@/components/newsreader";
import { PersonAvatar } from "@/components/person-avatar";
import { cn } from "@/components/timeline/cn";
import type { ElementLike } from "@/lib/hero-keys";
import { quoteCardType } from "@/lib/og-quote";
import { describeShortcutTarget } from "@/lib/people-shortcut";
import { personColor, personColorCss } from "@/lib/person-colors";
import { MORE_PAIRS_PATH, QUOTE_FLOOR_PX, embedPath, quoteInPairPath, quoteKeyStep, quotePath, quoteUnits, type EmbedQuote } from "@/lib/quote-embed";

/** The colour of a quote whose speaker is neither of the pair, and of every critic: the Clippings tab's quiet one. */
const MUTED = "var(--text-muted)";

const QUOTE_LINE_HEIGHT = 1.28;
/** The size the fit stops searching at: to a quarter of a pixel. */
const FIT_STEP_PX = 0.25;

/**
 * The quote, set at the largest size at which all of it is in the room the frame leaves it, and never in a box that scrolls. The first paint (the server's HTML, and
 * the page before the script has run) is the size the quote's card image sets it at (`quoteCardType`, picked by its length, as a count of the frame's unit), which is
 * close for a frame of the card's own shape; then, in the browser and before the next paint, the size is searched down from it (a binary search, to a quarter of a pixel)
 * against the room's height, again whenever the room changes (a frame that is resized, the fonts arriving) and for each quote (it is a new element for each: see `key`).
 * It is never set under `QUOTE_FLOOR_PX`; a quote that does not fit even then is cut at the last line that does, with an ellipsis, and the footer, which is outside the
 * room, keeps its link.
 */
function FittedQuote({ quote, url, color, firstPaintSize }: { quote: string; url: string; color: string; firstPaintSize: string }) {
  const roomRef = useRef<HTMLDivElement>(null);
  const quoteRef = useRef<HTMLQuoteElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    const room = roomRef.current;
    const block = quoteRef.current;
    const text = textRef.current;
    if (!room || !block || !text) return;
    const fit = () => {
      const style = getComputedStyle(room);
      const available = room.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      // Start again from the first paint's size, uncut: the room may have grown since the last fit.
      text.style.cssText = "";
      block.style.fontSize = firstPaintSize;
      const start = parseFloat(getComputedStyle(block).fontSize);
      const fits = (px: number) => {
        block.style.fontSize = `${px}px`;
        return block.offsetHeight <= available;
      };
      if (block.offsetHeight <= available || !Number.isFinite(start)) return;
      if (fits(QUOTE_FLOOR_PX)) {
        let low = QUOTE_FLOOR_PX;
        let high = start;
        while (high - low > FIT_STEP_PX) {
          const mid = (low + high) / 2;
          if (fits(mid)) low = mid;
          else high = mid;
        }
        block.style.fontSize = `${low}px`;
        return;
      }
      // Too long even at the floor: as many lines as the room has, the last of them ending in an ellipsis.
      const lines = Math.max(1, Math.floor(available / (QUOTE_FLOOR_PX * QUOTE_LINE_HEIGHT)));
      text.style.cssText = `display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:${lines};line-clamp:${lines};overflow:hidden`;
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(room);
    void document.fonts?.ready.then(fit);
    return () => observer.disconnect();
  }, [quote, firstPaintSize]);

  return (
    <div ref={roomRef} className="flex h-full flex-col justify-center" style={{ padding: `${size(8, 2)} 0` }}>
      <blockquote ref={quoteRef} cite={url} className="font-serif text-quote text-pretty" style={{ fontSize: firstPaintSize, lineHeight: QUOTE_LINE_HEIGHT }}>
        <p ref={textRef}>
          <span aria-hidden="true" style={{ color }}>
            &ldquo;
          </span>
          {quote}
          <span aria-hidden="true" style={{ color }}>
            &rdquo;
          </span>
        </p>
      </blockquote>
    </div>
  );
}

interface QuoteEmbedProps {
  /** The pair's canonical slug (`/p/<slug>`), what every link of the frame is built from. */
  slug: string;
  /** "Spielberg & Williams": who the quotes are about, in the family names the Clippings tab uses. */
  pair: string;
  /** Every quote of the pair, in the Clippings tab's order: what the arrows step through. */
  quotes: readonly EmbedQuote[];
  /** Where in `quotes` it opens: the quote the link named. */
  start: number;
  /**
   * "frame": the page X frames in the post (the whole viewport, links open in a new tab, the address follows the quote
   * so that a reload stays on it). "card": the same quote set in a card on the share URL's page for a visitor (links
   * open in the same tab, the address follows the quote on the share URL).
   */
  variant: "frame" | "card";
}

/**
 * One quote of a pair, large, with the pair's other quotes a click (or the arrow keys) away: what X shows inside a post for a
 * link to a quote (`twitter:card=player`), and the card of the page that link opens. It is the Clippings tab's pull quote
 * in the frame's proportions: the big serif quote between marks in the speaker's colour, the round headshot, "Speaker on
 * About" and the source line (film, publication, year, the link to the original).
 *
 * Built for what X does with it. On a desktop timeline the frame is the card's own 1200 x 630 shrunk to the column
 * (about 500 wide), so everything is sized in the frame's unit (container query units, see `size`) and set at the quote's
 * card image's type size, which fits the text to the frame. On a phone X shows the poster and opens this page in a panel
 * over the bottom of the screen, a short viewport: the arrows are in the top bar, where they stay in view, the quote
 * is set smaller (down to `QUOTE_FLOOR_PX`, then cut with an ellipsis) if it is too long for the room, and the footer's link sits under it. X sandboxes the frame (no forms, no popups
 * but links), so nothing here needs a cookie, a login or a request: stepping is local state, and the links open a new tab.
 */
export function QuoteEmbed({ slug, pair, quotes, start, variant }: QuoteEmbedProps) {
  const [index, setIndex] = useState(start);
  const count = quotes.length;
  const current = quotes[index] ?? quotes[0];
  const framed = variant === "frame";

  // The address follows the quote (no navigation, no reload), so that reopening or reloading the frame stays on it. It is set whenever the quote
  // is not the one the address names (stepping on and then back to the quote the link opened on must put its address back too).
  useEffect(() => {
    const path = framed ? embedPath(slug, current.id) : quotePath(slug, current.id);
    try {
      if (window.location.pathname !== path) window.history.replaceState(null, "", path);
    } catch {
      // A frame that may not touch its own history just keeps the address it was opened on.
    }
  }, [slug, current.id, framed]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? (event.target as ElementLike) : null;
      const delta = quoteKeyStep(event, describeShortcutTarget(target), count);
      // A modal dialog open anywhere (the site's search, on the share page) has the keys, wherever the focus has got to.
      if (delta === null || document.querySelector('[aria-modal="true"]')) return;
      event.preventDefault();
      setIndex((i) => (i + delta + count) % count);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [count]);

  const color = current.slot === null ? MUTED : personColor(current.slot);
  const type = quoteCardType(current.quote);
  const step = (delta: number) => setIndex((i) => (i + delta + count) % count);
  const button = EMBED_BUTTON;
  const buttonSize: CSSProperties = { width: size(40, 4), height: size(40, 4) };

  return (
    <div
      className={cn(
        newsreader.variable,
        framed ? "fixed inset-0" : "relative h-[30rem] w-full overflow-hidden rounded-2xl border border-border sm:h-auto sm:aspect-[1200/630]",
      )}
      style={FRAME_STYLE}
    >
      {/* The palette's custom properties: the page's own view sets them (see `PeopleView`), and a frame has no page. */}
      <style>{personColorCss()}</style>
      <section
        aria-label={`Quotes on ${pair}`}
        className="flex h-full w-full flex-col bg-canvas text-body"
        // A faint wash of the speaker's colour from the top left, as the quote's card image has behind it.
        style={{ backgroundImage: `radial-gradient(ellipse 75% 95% at 0% 0%, color-mix(in srgb, ${color} 15%, transparent), transparent 70%)` }}
      >
        <header className="flex items-center justify-between gap-3" style={{ padding: `${size(10, 2.8)} ${size(14, 6.67)} 0` }}>
          {/* More pairs: the wordmark leads to the landing page's Quotes tab. */}
          <EmbedWordmark href={MORE_PAIRS_PATH} title="More pairs on Parallel" label="Parallel: more pairs" external={framed} />
          <p className="hidden min-w-0 flex-1 truncate text-muted @2xl:block" style={{ fontSize: size(13, 1.7) }}>
            {pair}
          </p>
          {count > 1 && (
            <nav aria-label="Browse quotes" className="flex shrink-0 items-center" style={{ gap: size(6, 0.8) }}>
              <button type="button" onClick={() => step(-1)} aria-label="Previous quote" title="Previous quote" className={button} style={buttonSize}>
                <ChevronLeft aria-hidden="true" className="size-1/2" />
              </button>
              <span className="min-w-[3.5ch] text-center tabular-nums text-muted" style={{ fontSize: size(12, 1.5) }}>
                {index + 1} / {count}
              </span>
              <button type="button" onClick={() => step(1)} aria-label="Next quote" title="Next quote" className={button} style={buttonSize}>
                <ChevronRight aria-hidden="true" className="size-1/2" />
              </button>
            </nav>
          )}
        </header>

        {/* The quote is set to fit the room the frame leaves it (see `FittedQuote`): nothing in a frame scrolls, so a scrollbar never takes the room or the feed's gesture. */}
        <div key={current.id} className="min-h-0 flex-1 overflow-hidden" style={{ padding: `0 ${size(14, 6.67)}` }}>
          <FittedQuote quote={current.quote} url={current.url} color={color} firstPaintSize={`max(${QUOTE_FLOOR_PX}px, calc(${quoteUnits(type.fontSize)} * var(--u)))`} />
        </div>
        <p role="status" aria-live="polite" className="sr-only">
          {`Quote ${index + 1} of ${count}: ${current.speaker} on ${current.about}`}
        </p>

        <footer
          className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2"
          style={{ padding: `${size(6, 1.5)} ${size(14, 6.67)} ${size(12, 3.6)}` }}
        >
          <div className="flex min-w-0 items-center" style={{ gap: size(10, 1.4) }}>
            {current.avatar && (
              <>
                {/* In a short, narrow frame (the panel X opens over a phone) the picture goes, and its room is the quote's. */}
                <span className="@2xl:hidden [@container(max-height:300px)_and_(max-width:480px)]:hidden">
                  <PersonAvatar name={current.avatar.name} profilePath={current.avatar.profilePath} size={36} imageSize="w185" ringColor={color} />
                </span>
                <span className="hidden @2xl:inline-flex [@container(max-height:300px)_and_(max-width:480px)]:hidden">
                  <PersonAvatar name={current.avatar.name} profilePath={current.avatar.profilePath} size={64} imageSize="w185" ringColor={color} />
                </span>
              </>
            )}
            <div className="min-w-0">
              <p className="leading-snug" style={{ fontSize: size(14, 2) }}>
                <span className="font-medium text-strong">{current.speaker}</span> <span className="text-muted">on {current.about}</span>
              </p>
              {/* The film, then the source as the link to the original, as the pull quote of the Clippings tab sets them. */}
              <p className="flex flex-wrap items-center gap-x-1.5 leading-snug text-muted" style={{ fontSize: size(12, 1.5) }}>
                {current.film && (
                  <>
                    <i>{current.film}</i>
                    <span aria-hidden="true">&middot;</span>
                  </>
                )}
                <a
                  href={current.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded text-strong underline decoration-border underline-offset-4 transition-colors hover:decoration-strong motion-reduce:transition-none"
                >
                  {current.publication}
                  <span className="whitespace-nowrap">
                    {current.year !== null && <> &middot; {current.year}</>}
                    <ExternalLink aria-hidden="true" className="ml-1 inline size-3 align-[-0.1em]" />
                    <span className="sr-only">(opens in a new tab)</span>
                  </span>
                </a>
              </p>
            </div>
          </div>
          <OpenInParallel href={quoteInPairPath(slug, current.id)} external={framed} />
        </footer>
      </section>
    </div>
  );
}
