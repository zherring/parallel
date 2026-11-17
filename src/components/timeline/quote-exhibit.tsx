"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { useQuoteGlowStyle } from "@/components/pair-wash";
import { usePersonPalette } from "@/components/person-palette";
import { TreatedPortrait } from "@/components/treated-portrait";
import type { ClippingsVoice } from "@/lib/clippings";
import { tmdbImage } from "@/lib/images";
import { initials } from "@/lib/person-labels";
import { personColor } from "@/lib/person-colors";
import { cn } from "./cn";
import "./quote-exhibit.css";

interface Props {
  people: readonly [ClippingsVoice, ClippingsVoice];
  speakerId: number | null;
  children: ReactNode;
}

/** A stationary image pane beside the scrolling quote pane. */
export function QuoteExhibit({ people, speakerId, children }: Props) {
  // With the page's palette (`PersonPaletteProvider`: a pair's), the quote pane is lit from below in the speaker's colour, easing
  // to the next speaker's as the deck moves; a critic's quote glows the muted grey of its marks. Without a palette there is no wash layer at all.
  const palette = usePersonPalette();
  const speaker = people.find((person) => person.id === speakerId);
  const glowColor = palette ? (speaker ? (palette[speaker.slot] ?? null) : "var(--text-muted)") : null;
  const wash = useQuoteGlowStyle(glowColor);
  return (
    <div className="quote-exhibit" data-quote-exhibit="portraits">
      {wash && <div className="quote-exhibit-wash" aria-hidden="true" style={wash} />}
      <div className="quote-exhibit-media">
        <div className="quote-exhibit-visual">
          <div className="quote-exhibit-diptych" role="group" aria-label="Artist portraits">
            {/* The URL's order (slot = slug position) whoever speaks, as the share cards (`treatedQuotePortraits`); only colour/grey follows the speaker. */}
            {[...people].sort((a, b) => a.slot - b.slot).map((person) => (
              <Portrait key={person.id} person={person} speaking={speakerId === person.id} quiet={speakerId !== null && speakerId !== person.id} />
            ))}
          </div>
          <a
            className="quote-exhibit-credit"
            href="https://www.themoviedb.org/"
            target="_blank"
            rel="noopener noreferrer"
            title="Portrait images sourced from TMDB"
          >
            Portraits via TMDB
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </div>
      </div>
      {children}
    </div>
  );
}

/** Only quote content moves. Imagery and image attribution belong to the stationary pane. */
export function QuoteExhibitSlide({ children, label, chars }: { children: ReactNode; label: string; chars?: number }) {
  // A quote's length steps its type down (see `.quote-exhibit-words`), so that every quote fits its slide without a scroller of its own.
  const fitted = chars !== undefined;
  return (
    <div className="quote-exhibit-stage" style={fitted ? ({ "--quote-chars": Math.max(1, chars) } as CSSProperties) : undefined}>
      <div className={cn("quote-exhibit-plate", fitted && "quote-exhibit-plate-fitted")} tabIndex={0} role="group" aria-label={label}>
        <div className="quote-exhibit-quote">{children}</div>
      </div>
    </div>
  );
}

function Portrait({ person, speaking, quiet }: { person: ClippingsVoice; speaking: boolean; quiet: boolean }) {
  const src = tmdbImage(person.profilePath, "w780");
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  // The portrait is cut out (see `TreatedPortrait`) at full panel size, or torn for a person with no cut; a person with no photo is their initials.
  const treated = Boolean(person.profilePath);
  return (
    <div
      className={cn("quote-exhibit-portrait", quiet && "quote-exhibit-quiet")}
      role="img"
      aria-label={`${person.name}${speaking ? ", speaking" : ""}`}
      data-portrait-person={person.id}
      data-speaking={speaking}
      data-quiet={quiet}
      style={{ "--voice-color": personColor(person.slot) } as CSSProperties}
    >
      {treated ? (
        <span className="quote-exhibit-treated">
          <TreatedPortrait
            personId={person.id}
            slot={person.slot}
            name={person.name}
            profilePath={person.profilePath}
            imageSize="w780"
            posterSize="w185"
            rounded={false}
            className="h-full w-full"
          />
        </span>
      ) : (
        <span className="quote-exhibit-initials" aria-hidden="true">{initials(person.name)}</span>
      )}
      {!treated && src && src !== failedSrc && (
        <img
          src={src}
          alt=""
          width={600}
          height={900}
          loading="lazy"
          decoding="async"
          onError={() => setFailedSrc(src)}
          ref={(image) => {
            if (image?.complete && image.naturalWidth === 0) setFailedSrc(src);
          }}
        />
      )}
    </div>
  );
}
