"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
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
  return (
    <div className="quote-exhibit" data-quote-exhibit="portraits">
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
  return (
    <div
      className={cn("quote-exhibit-portrait", quiet && "quote-exhibit-quiet")}
      role="img"
      aria-label={`${person.name}${speaking ? ", speaking" : quiet ? ", grayscale portrait" : ""}`}
      data-portrait-person={person.id}
      data-speaking={speaking}
      data-quiet={quiet}
      style={{ "--voice-color": personColor(person.slot) } as CSSProperties}
    >
      <span className="quote-exhibit-initials" aria-hidden="true">{initials(person.name)}</span>
      {src && src !== failedSrc && (
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
