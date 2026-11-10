"use client";

import type { ReactNode } from "react";
import type { VoicedClippings } from "@/lib/clippings";
import type { PairCritics } from "@/lib/critics";
import type { TableRow } from "@/lib/film-rows";
import { MINOR_TOGGLE_LABEL } from "@/lib/roles";
import type { PairShared } from "@/lib/shared";
import type { PersonRef } from "@/lib/lanes";
import { detailsButtonClass, linkClass, tmdbMovieUrl } from "./film-links";
import { FilmsSection } from "./films-section";
import type { BioPerson } from "./person-bio";
import type { FilmsTableModel } from "./use-films-table";

interface TogetherProps {
  people: PersonRef[];
  /** The films the people made together, as the table lists them (see `sharedRows`). */
  rows: TableRow[];
  /** The table's state, held by the page (see `FilmsSection`). */
  table: FilmsTableModel;
  /** Counts up each time the visitor chooses a view (see `FilmsSection`). */
  revealTick: number;
  pairwise: PairShared[];
  /** Films that would be added by turning minor credits on; 0 when already on. */
  minorExtra: number;
  /** Films they share that are not out yet (and so not counted); only set when no film is shared yet. */
  upcomingExtra: number;
  /** The note over the section's panels (see `FilmsSection`). */
  note?: ReactNode;
  /** The Timeline panel of the section. */
  timeline: ReactNode;
  onSelect: (id: number, trigger: HTMLElement) => void;
  /** The quotes the two people of the page have about each other, when it has any (see `FilmsSection`). */
  clippings?: VoicedClippings | null;
  /** What the critics have written about the collaboration, when there is any: the Clippings tab's critics' quotes and "More reading" (see `FilmsSection`). */
  critics?: PairCritics | null;
  /** The page's people, for the names in the Clippings tab (see `FilmsSection`). */
  bioPeople?: readonly BioPerson[];
}

const joinNames = (names: string[]) => new Intl.ListFormat("en", { style: "long", type: "conjunction" }).format(names);

export function Together({
  people,
  rows,
  table,
  revealTick,
  pairwise,
  minorExtra,
  upcomingExtra,
  note,
  timeline,
  onSelect,
  clippings,
  critics,
  bioPeople,
}: TogetherProps) {
  const nameById = new Map(people.map((p) => [p.id, p.name]));
  const names = people.map((p) => p.name);

  return (
    <FilmsSection
      headingId="together"
      together
      rows={rows}
      caption={`Films ${joinNames(names)} made together`}
      table={table}
      revealTick={revealTick}
      note={note}
      timeline={timeline}
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
      bioPeople={bioPeople}
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
