"use client";

import { newsreader } from "@/components/newsreader";
import { SidePanel, useSlideOut } from "@/components/side-panel/side-panel";
import { quoteLinkSearch, truncateQuote } from "@/lib/clippings-view";
import type { ReadingItem } from "@/lib/critics";
import { MoreReading } from "./more-reading";
import type { ExhibitSlide } from "./quote-exhibit-deck";

export type QuoteLibraryView = "quotes" | "reading";

interface Props {
  view: QuoteLibraryView | null;
  slides: readonly ExhibitSlide[];
  current: number;
  reading: readonly ReadingItem[];
  onSelect: (index: number) => void;
  onClose: () => void;
}

/** Quotes and further reading use the same slide-out shell, dismissal and focus handling as film/person details. */
export function QuoteLibraryPanel({ view, slides, current, reading, onSelect, onClose }: Props) {
  const { shown, session, closing, exited } = useSlideOut(view);
  if (shown === null) return null;

  return (
    <SidePanel
      key={session}
      label={shown === "reading" ? "Reading" : "Quotes"}
      closeLabel={shown === "reading" ? "Close more reading" : "Close quote index"}
      contentKey={shown}
      closing={closing}
      onExited={exited}
      onClose={onClose}
    >
      {({ titleId }) => (
        <div className={newsreader.variable}>
          {shown === "reading" ? (
            <MoreReading reading={reading} afterQuotes={false} titleId={titleId} />
          ) : (
            <>
              <h2 id={titleId} className="mb-4 text-xl font-semibold leading-tight text-strong">All quotes</h2>
              <ol className="quote-exhibit-index-list">
                {slides.map((slide, index) => (
                  <li key={slide.id}>
                    <a href={quoteLinkSearch(slide.id)} aria-current={current === index ? "true" : undefined} onClick={(event) => {
                      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
                      event.preventDefault();
                      onSelect(index);
                    }}>
                      <span className="quote-exhibit-index-meta">{slide.speaker} · {slide.publication}{slide.year !== null ? ` · ${slide.year}` : ""}</span>
                      <span className="quote-exhibit-index-words">“{truncateQuote(slide.quote, 180)}”</span>
                    </a>
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      )}
    </SidePanel>
  );
}
