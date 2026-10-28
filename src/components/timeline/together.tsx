"use client";

import { MINOR_TOGGLE_LABEL } from "@/lib/roles";
import type { PairShared } from "@/lib/shared";
import type { SharedFilm } from "@/lib/types";
import type { PersonRef } from "@/lib/lanes";
import { detailsButtonClass, linkClass, tmdbMovieUrl } from "./film-links";
import { FilmsTable } from "./films-table";
import { ShareActions } from "./share-actions";
import { useFilmsTable } from "./use-films-table";

interface TogetherProps {
  people: PersonRef[];
  shared: SharedFilm[];
  pairwise: PairShared[];
  /** Films that would be added by turning minor credits on; 0 when already on. */
  minorExtra: number;
  /** Films together as the page shows them by default (non-minor credits), for the share text. */
  shareCount: number;
  /** yyyy-mm-dd, the page's date (computed once on the server). */
  today: string;
  onSelect: (id: number, trigger: HTMLElement) => void;
}

export function Together({ people, shared, pairwise, minorExtra, shareCount, today, onSelect }: TogetherProps) {
  const nameById = new Map(people.map((p) => [p.id, p.name]));
  const count = shared.length;
  const table = useFilmsTable(shared, today);

  return (
    <section aria-labelledby="together" className="mt-10">
      <ShareActions
        // The export follows the table: the films in the order they are sorted in right now.
        shared={table.rows}
        names={people.map((p) => p.name)}
        canExport
        share={{ people, count: shareCount }}
        heading={
          <h2 id="together" className="text-xl font-semibold text-strong">
            {count === 0 ? "No films together" : `${count} ${count === 1 ? "film" : "films"} together`}
          </h2>
        }
      />

      {count === 0 ? (
        <p className="mt-4 max-w-xl text-body">
          No films together found on TMDB. Try adding a collaborator in a nearby role, such as the cinematographer,
          editor or a co-star.
          {minorExtra > 0 && ` Turning on "${MINOR_TOGGLE_LABEL}" would add ${minorExtra}.`}
        </p>
      ) : (
        <FilmsTable people={people} table={table} onSelect={onSelect} />
      )}

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
    </section>
  );
}
