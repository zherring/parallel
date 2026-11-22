"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type TouchEvent } from "react";
import { rememberOpener } from "@/components/side-panel/side-panel";
import type { ClippingsVoice } from "@/lib/clippings";
import { parseQuoteId } from "@/lib/clippings-view";
import type { ReadingItem } from "@/lib/critics";
import { INTERACTIVE_SELECTOR, OVERLAY_SELECTOR } from "@/lib/interaction-target";
import { exhibitSpaceAction, nextExhibitIndex, paneSwipeAdvance, quoteExhibitQuoteSearch, quoteFit, quotePaneCanScroll } from "@/lib/quote-exhibit";
import { QuoteLibraryPanel, type QuoteLibraryView } from "./quote-library-panel";
import { quoteElementId } from "./pull-quote";
import { QuoteExhibit, QuoteExhibitSlide } from "./quote-exhibit";
import { scrollBehavior } from "./scroll-behavior";

export interface ExhibitSlide {
  id: string;
  speakerId: number | null;
  quote: string;
  /** Length of the context line under the quote, which shares the slide's height with it. */
  contextChars?: number;
  /** Length of the source line under that, which shares it too. */
  sourceChars?: number;
  speaker: string;
  publication: string;
  year: number | null;
  content: ReactNode;
}

interface Props {
  slides: readonly ExhibitSlide[];
  quoteId: string | null;
  people: readonly [ClippingsVoice, ClippingsVoice];
  reading: readonly ReadingItem[];
}

/** A native vertical snap scroller: one viewport per quote, with a single Space shortcut and stable quote order. */
export function QuoteExhibitDeck({ slides, quoteId, people, reading }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [library, setLibrary] = useState<QuoteLibraryView | null>(null);
  const initial = Math.max(0, slides.findIndex((slide) => slide.id === quoteId));
  const [current, setCurrent] = useState(initial);
  const currentRef = useRef(initial);
  const motionTarget = useRef<number | null>(null);
  const initialized = useRef(false);
  /**
   * A finger is on the deck: where it came down, and the quote's text pane under it as it was then, if that pane had room to scroll
   * (the browser gives the touch to the pane; see `paneSwipeAdvance`).
   */
  const touch = useRef<{ id: number; y: number; top: number; pane: { scrollTop: number; scrollHeight: number; clientHeight: number } | null } | null>(null);
  const slideKey = slides.map((slide) => slide.id).join("+");
  // What each quote's type is fitted from: its text's width, and how much of the slide's height the lines under it take.
  const fits = useMemo(() => slides.map((slide) => quoteFit(slide.quote, slide.contextChars, slide.sourceChars)), [slides]);

  const publish = useCallback((index: number) => {
    const slide = slides[index];
    if (!slide) return;
    currentRef.current = index;
    setCurrent(index);
    const { pathname, search, hash } = window.location;
    const next = quoteExhibitQuoteSearch(search, slide.id);
    // Let Next copy its private history state and notify useSearchParams; passing history.state bypasses that integration.
    if (next !== search) window.history.replaceState(null, "", `${pathname}${next}${hash}`);
  }, [slides]);

  const goTo = useCallback((index: number, behavior: ScrollBehavior = scrollBehavior()) => {
    const scroller = scrollerRef.current;
    if (!scroller || !slides[index]) return;
    // Cancel a previous smooth movement before a rapid reversal, even if we are still at its starting point.
    scroller.scrollTo({ top: scroller.scrollTop, behavior: "instant" });
    motionTarget.current = Math.abs(scroller.scrollTop - index * scroller.clientHeight) > 1 ? index : null;
    publish(index);
    // Travel visibly back through the deck when wrapping to the start; reduced motion still jumps immediately.
    scroller.scrollTo({ top: index * scroller.clientHeight, behavior: motionTarget.current === null ? "instant" : behavior });
  }, [publish, slides]);

  useLayoutEffect(() => {
    // Read the address bar, not `quoteId`: that is the router's copy, which trails what `publish` writes by a transition, and any urgent re-render
    // of the page in between (the people dialog opening, a metrics response) hands us the older address, which would undo the press just made.
    // `quoteId` stays a dependency, so that a navigation the router makes (back, a pushed link) still runs this.
    const address = parseQuoteId(window.location.search);
    const wanted = Math.max(0, slides.findIndex((slide) => slide.id === address));
    // An address we just wrote is not an instruction to restart the scroll or reorder the deck.
    if (!initialized.current || wanted !== currentRef.current) {
      initialized.current = true;
      goTo(wanted, "instant");
    }
  }, [quoteId, slideKey, slides, goTo]);

  useEffect(() => {
    const scroller = scrollerRef.current!;
    scroller.focus({ preventScroll: true });
    const observer = new ResizeObserver(() => {
      scroller.scrollTo({ top: currentRef.current * scroller.clientHeight, behavior: "instant" });
    });
    observer.observe(scroller);
    return () => observer.disconnect();
  }, []);

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    const target = event.target instanceof Element ? event.target : null;
    const action = exhibitSpaceAction(event, Boolean(target?.closest(`${INTERACTIVE_SELECTOR},${OVERLAY_SELECTOR}`)));
    if (!action) return;
    const pane = target?.closest<HTMLElement>(".quote-exhibit-plate");
    // A focused long quote keeps native scrolling until it reaches the relevant edge.
    if (pane && quotePaneCanScroll(pane, event.shiftKey)) return;
    event.preventDefault();
    if (action === "swallow") return;
    if (pane) scrollerRef.current?.focus({ preventScroll: true });
    goTo(nextExhibitIndex(currentRef.current, slides.length, action === "next" ? 1 : -1));
  });
  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKeyDown(event);
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, []);

  function onScroll() {
    const scroller = scrollerRef.current!;
    if (motionTarget.current !== null) {
      if (Math.abs(scroller.scrollTop - motionTarget.current * scroller.clientHeight) > 1) return;
      motionTarget.current = null;
    }
    // While a finger drags the deck nothing is redrawn under it: a quote halfway past is not yet the current one, and redrawing the deck
    // (and the page, for the address) mid-drag is what makes a touch scroller re-snap or drop the drag. The finger lifting catches up.
    if (touch.current) return;
    const index = Math.max(0, Math.min(slides.length - 1, Math.round(scroller.scrollTop / scroller.clientHeight)));
    if (index !== currentRef.current) publish(index);
  }

  function onTouchStart(event: TouchEvent<HTMLDivElement>) {
    motionTarget.current = null;
    if (event.touches.length !== 1) {
      touch.current = null;
      return;
    }
    const plate = (event.target as Element).closest<HTMLElement>(".quote-exhibit-plate");
    const scrolls = plate !== null && plate.scrollHeight - plate.clientHeight > 1 && /auto|scroll/.test(getComputedStyle(plate).overflowY);
    touch.current = {
      id: event.touches[0].identifier,
      y: event.touches[0].clientY,
      top: event.currentTarget.scrollTop,
      pane: scrolls ? { scrollTop: plate.scrollTop, scrollHeight: plate.scrollHeight, clientHeight: plate.clientHeight } : null,
    };
  }

  function onTouchEnd(event: TouchEvent<HTMLDivElement>) {
    const began = touch.current;
    const lifted = began && Array.from(event.changedTouches).find((point) => point.identifier === began.id);
    if (!began || !lifted) return;
    touch.current = null;
    const scroller = scrollerRef.current!;
    // The deck where the drag left it: the scroll events from here on (the snap) keep it up to date as before.
    onScroll();
    if (!began.pane || event.type !== "touchend") return;
    // The touch was the text pane's, so the deck has not moved: a swipe that went well past what the pane had to scroll moves it on.
    // (Where the browser passed the swipe on to the deck itself, the deck has moved and there is nothing to add.)
    if (Math.abs(scroller.scrollTop - began.top) > 1) return;
    const next = currentRef.current + paneSwipeAdvance(began.y - lifted.clientY, began.pane);
    if (next !== currentRef.current && slides[next]) goTo(next);
  }

  return (
    <div className="quote-exhibit-deck" data-quote-exhibit-deck data-active-quote={slides[current]?.id}>
      <QuoteExhibit people={people} speakerId={slides[current]?.speakerId ?? null}>
        <div
          ref={scrollerRef}
          role="region"
          aria-label="Quotes exhibition"
          tabIndex={0}
          className="quote-exhibit-scroller"
          onScroll={onScroll}
          onWheel={() => { motionTarget.current = null; }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          onTouchCancel={onTouchEnd}
          onPointerDown={(event) => {
            if (!(event.target as Element).closest(`${INTERACTIVE_SELECTOR},.quote-exhibit-plate`)) event.currentTarget.focus({ preventScroll: true });
          }}
        >
          <ol className="quote-exhibit-slides">
            {slides.map((slide, index) => (
              <li
                key={slide.id}
                id={quoteElementId(slide.id)}
                data-quote-slide={slide.id}
                aria-label={`Quote ${index + 1} of ${slides.length}`}
                aria-current={current === index ? "true" : undefined}
                inert={current !== index}
              >
                <QuoteExhibitSlide label={`Quote ${index + 1} text`} fit={fits[index]}>{slide.content}</QuoteExhibitSlide>
              </li>
            ))}
          </ol>
        </div>
        <div className="quote-exhibit-toolbar">
          <p role="status" aria-live="polite" className="quote-exhibit-progress">
            <button type="button" aria-haspopup="dialog" aria-label="Browse all quotes" title="Browse all quotes" onClick={(event) => {
              rememberOpener(event.currentTarget);
              setLibrary("quotes");
            }}>
              Quote {current + 1} of {slides.length}<ChevronDown aria-hidden="true" className="size-3" />
            </button>
          </p>
          <span className="quote-exhibit-key-hint"><kbd>Space</kbd> next · <kbd>⇧ Space</kbd> back</span>
          <div className="quote-exhibit-navigation">
            <button type="button" aria-label="Previous quote" onClick={() => goTo(nextExhibitIndex(currentRef.current, slides.length, -1))}>
              <ChevronUp aria-hidden="true" className="size-4" />
            </button>
            <button type="button" aria-label="Next quote" onClick={() => goTo(nextExhibitIndex(currentRef.current, slides.length, 1))}>
              <ChevronDown aria-hidden="true" className="size-4" />
            </button>
          </div>
          {reading.length > 0 && <button type="button" className="quote-exhibit-reading-link" aria-haspopup="dialog" onClick={(event) => {
            rememberOpener(event.currentTarget);
            setLibrary("reading");
          }}>More reading</button>}
        </div>
        <QuoteLibraryPanel
          view={library}
          slides={slides}
          current={current}
          reading={reading}
          onClose={() => setLibrary(null)}
          onSelect={(index) => {
            setLibrary(null);
            goTo(index);
          }}
        />
      </QuoteExhibit>
    </div>
  );
}
