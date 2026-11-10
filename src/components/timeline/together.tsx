"use client";

import { useMemo, type ReactNode } from "react";
import type { VoicedClippings } from "@/lib/clippings";
import type { PairCritics } from "@/lib/critics";
import { sharedRows } from "@/lib/film-rows";
import { MINOR_TOGGLE_LABEL } from "@/lib/roles";
import type { PairShared } from "@/lib/shared";
import type { SharedFilm } from "@/lib/types";
import type { PersonRef } from "@/lib/lanes";
import { detailsButtonClass, linkClass, tmdbMovieUrl } from "./film-links";
import { FilmsSection } from "./films-section";
import type { PersonPanelAccess } from "@/lib/side-panel";

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
  /** The year of each film the preview card shows, for the Share menu's Period choices. */
  shareYears: readonly number[];
  /** yyyy-mm-dd, the page's date (computed once on the server). */
  today: string;
  /** The note in the section's toolbar (see `FilmsSection`). */
  note?: ReactNode;
  /** The Timeline tab of the section. */
  timeline: ReactNode;
  settingsControl: ReactNode;
  onSelect: (id: number, trigger: HTMLElement) => void;
  /** The quotes the two people of the page have about each other, when it has any (see `FilmsSection`). */
  clippings?: VoicedClippings | null;
  /** What the critics have written about the collaboration, when there is any: the Clippings tab's critics' quotes and "More reading" (see `FilmsSection`). */
  critics?: PairCritics | null;
  /** The page's people and the opener for them, for the names in the Clippings tab (see `FilmsSection`). */
  personPanel?: PersonPanelAccess;
}

const joinNames = (names: string[]) => new Intl.ListFormat("en", { style: "long", type: "conjunction" }).format(names);

export function Together({
  people,
  shared,
  pairwise,
  minorExtra,
  upcomingExtra,
  shareCount,
  shareYears,
  note,
  today,
  timeline,
  settingsControl,
  onSelect,
  clippings,
  critics,
  personPanel,
}: TogetherProps) {
  const rows = useMemo(() => sharedRows(shared, people), [shared, people]);
  const nameById = new Map(people.map((p) => [p.id, p.name]));
  const names = people.map((p) => p.name);

  return (
    <FilmsSection
      headingId="together"
      together
      rows={rows}
      names={names}
      caption={`Films ${joinNames(names)} made together`}
      share={{ people, count: shareCount, years: shareYears }}
      note={note}
      today={today}
      timeline={timeline}
      settingsControl={settingsControl}
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
      clippings={clippings}
      critics={critics}
      personPanel={personPanel}
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
