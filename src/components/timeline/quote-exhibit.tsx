"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { useQuoteGlowStyle } from "@/components/pair-wash";
import { usePersonPalette } from "@/components/person-palette";
import { TreatedPortrait } from "@/components/treated-portrait";
import { usePortraitMode } from "@/components/use-portrait-mode";
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
  // Spike: with the portrait flag (the page's palette, `PersonPaletteProvider`), the quote pane is lit from below in the speaker's colour, easing
  // to the next speaker's as the deck moves; a critic's quote glows the muted grey of its marks. Without the flag there is no wash layer at all.
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
            {people.map((person) => (
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
export function QuoteExhibitSlide({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="quote-exhibit-stage">
      <div className="quote-exhibit-plate" tabIndex={0} role="group" aria-label={label}>
        <div className="quote-exhibit-quote">{children}</div>
      </div>
    </div>
  );
}

function Portrait({ person, speaking, quiet }: { person: ClippingsVoice; speaking: boolean; quiet: boolean }) {
  const src = tmdbImage(person.profilePath, "w780");
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  // Spike: `?portrait=on|color` cuts the portrait out (see `TreatedPortrait`) at full panel size, or tears it for a person with no cut; without
  // the flag, or for a person with no photo, the panel is as it was.
  const portraitMode = usePortraitMode();
  const treated = portraitMode !== null && Boolean(person.profilePath);
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
            mode={portraitMode}
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
