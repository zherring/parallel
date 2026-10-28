"use client";

import { useMemo, type ReactNode } from "react";
import { sharedRows } from "@/lib/film-rows";
import { MINOR_TOGGLE_LABEL } from "@/lib/roles";
import type { PairShared } from "@/lib/shared";
import type { SharedFilm } from "@/lib/types";
import type { PersonRef } from "@/lib/lanes";
import { detailsButtonClass, linkClass, tmdbMovieUrl } from "./film-links";
import { FilmsSection } from "./films-section";

interface TogetherProps {
  people: PersonRef[];
  shared: SharedFilm[];
  pairwise: PairShared[];
  /** Films that would be added by turning minor credits on; 0 when already on. */
  minorExtra: number;
  /** Films they share that are not out yet (and so not counted); only set when no film is shared yet. */
  upcomingExtra: number;
  /** Films together as the page shows them by default (non-minor credits), for the share text. */
  shareCount: number;
  /** yyyy-mm-dd, the page's date (computed once on the server). */
  today: string;
  /** The Timeline tab of the section. */
  timeline: ReactNode;
  includeMinor: boolean;
  onIncludeMinorChange: (next: boolean) => void;
  onSelect: (id: number, trigger: HTMLElement) => void;
}

const joinNames = (names: string[]) => new Intl.ListFormat("en", { style: "long", type: "conjunction" }).format(names);

export function Together({
  people,
  shared,
  pairwise,
  minorExtra,
  upcomingExtra,
  shareCount,
  today,
  timeline,
  includeMinor,
  onIncludeMinorChange,
  onSelect,
}: TogetherProps) {
  const rows = useMemo(() => sharedRows(shared, people), [shared, people]);
  const nameById = new Map(people.map((p) => [p.id, p.name]));
  const names = people.map((p) => p.name);
  const count = shared.length;

  return (
    <FilmsSection
      headingId="together"
      count={count}
      together
      rows={rows}
      names={names}
      caption={`Films ${joinNames(names)} made together`}
      share={{ people, count: shareCount }}
      today={today}
      timeline={timeline}
      includeMinor={includeMinor}
      onIncludeMinorChange={onIncludeMinorChange}
      empty={
        <>
          No films together found on TMDB. Try adding a collaborator in a nearby role, such as the cinematographer,
          editor or a co-star.
          {minorExtra > 0 && ` Turning on "${MINOR_TOGGLE_LABEL}" would add ${minorExtra}.`}
          {upcomingExtra > 0 &&
            ` ${upcomingExtra} announced ${upcomingExtra === 1 ? "film they share is" : "films they share are"} not out yet and will count once ${upcomingExtra === 1 ? "it is" : "they are"} released.`}
        </>
      }
      onSelect={onSelect}
    >
      {pairwise.length > 0 && (
        <details className="mt-6 rounded-lg border border-border bg-surface">
          <summary className="cursor-pointer select-none px-4 py-3 font-semibold text-strong">
            By pair <span className="font-normal text-muted">({pairwise.length} pairs)</span>
          </summary>
          <div className="space-y-4 px-4 pb-4">
            {pairwise.map(({ a, b, films }) => (
              <section key={`${a}-${b}`}>
                <h3 className="text-strong">
                  {nameById.get(a)} & {nameById.get(b)}
                </h3>
                {films.length === 0 ? (
                  <p className="text-sm text-muted">No films together found on TMDB.</p>
                ) : (
                  <ul className="mt-1 space-y-1 text-sm">
                    {films.map((film) => (
                      <li key={film.id}>
                        <time dateTime={film.releaseDate} className="mr-2 tabular-nums text-muted">
                          {film.year}
                        </time>
                        <a href={tmdbMovieUrl(film.id)} className={linkClass}>
                          {film.title}
                        </a>{" "}
                        <button
                          type="button"
                          className={`${detailsButtonClass} ml-1 cursor-pointer`}
                          onClick={(event) => onSelect(film.id, event.currentTarget)}
                        >
                          Details
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        </details>
      )}
    </FilmsSection>
  );
}
