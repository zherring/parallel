"use client";

import { useState, type ReactNode } from "react";
import { PersonAvatar } from "@/components/person-avatar";
import {
  CAST_PREVIEW,
  filmMetaLine,
  groupFilmCredits,
  tmdbMovieUrl,
  type PersonRow,
} from "@/lib/film-people";
import { tmdbImage } from "@/lib/images";
import { MAX_PEOPLE, addState, isTimelineFull } from "@/lib/people-nav";
import type { FilmDetails } from "@/lib/types";

interface Props {
  film: FilmDetails;
  titleId: string;
  peopleInView: { id: number; name: string }[];
  /** Person id currently being added (navigation in flight), if any. */
  addingId: number | null;
  onAdd: (person: PersonRow) => void;
}

const FULL_TITLE = `A timeline holds up to ${MAX_PEOPLE} people`;

export function FilmContent({ film, titleId, peopleInView, addingId, onAdd }: Props) {
  const [expandedFor, setExpandedFor] = useState<number | null>(null);
  const showAllCast = expandedFor === film.id;

  const credits = groupFilmCredits(film, peopleInView);
  const full = isTimelineFull(peopleInView);
  const poster = tmdbImage(film.posterPath, "w342");
  const meta = filmMetaLine(film);
  const visibleCast = showAllCast ? credits.cast : credits.cast.slice(0, CAST_PREVIEW);

  function row(person: PersonRow, inTimelineGroup = false) {
    const state = addState(peopleInView, person.id);
    let action: ReactNode = null;

    if (!inTimelineGroup) {
      if (state === "in-view") {
        action = (
          <span className="shrink-0 rounded border border-border px-1.5 py-0.5 text-xs text-body">
            In timeline
          </span>
        );
      } else {
        const adding = addingId === person.id;
        const disabled = full || addingId !== null;
        action = (
          <button
            type="button"
            aria-label={`Add ${person.name} to timeline`}
            title={full ? FULL_TITLE : undefined}
            disabled={disabled}
            onClick={() => onAdd(person)}
            className="shrink-0 rounded bg-accent-green px-3 py-1 text-xs font-semibold text-on-accent hover:bg-accent-green-hover disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-accent-green"
          >
            {adding ? "Adding…" : "Add"}
          </button>
        );
      }
    }

    return (
      <li key={person.id} className="flex items-center gap-3 py-1.5">
        <PersonAvatar name={person.name} profilePath={person.profilePath} size={40} />
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-medium text-strong">{person.name}</p>
          {person.detail && (
            <p className="line-clamp-2 text-xs leading-snug text-muted">{person.detail}</p>
          )}
        </div>
        {action}
      </li>
    );
  }

  return (
    <>
      <div className="flex gap-4">
        <div className="aspect-[2/3] w-28 shrink-0 overflow-hidden rounded-md border border-border bg-surface sm:w-32">
          {poster && (
            <img
              src={poster}
              alt={`Poster for ${film.title}`}
              width={342}
              height={513}
              decoding="async"
              className="h-full w-full object-cover"
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-xl font-semibold leading-tight text-strong">
            {film.title}
          </h2>
          {meta && <p className="mt-1.5 text-sm text-muted">{meta}</p>}
          {film.tagline && <p className="mt-2 text-sm italic text-body">{film.tagline}</p>}
          <a
            href={tmdbMovieUrl(film.id)}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-strong no-underline hover:bg-surface"
          >
            Open on TMDB
            <span aria-hidden="true">↗</span>
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </div>
      </div>

      {film.overview && <p className="mt-5 text-sm leading-relaxed text-body">{film.overview}</p>}

      {full && (
        <p className="mt-5 rounded-md border border-border bg-surface px-3 py-2 text-sm text-body">
          {FULL_TITLE}, so no one else can be added.
        </p>
      )}

      {credits.inTimeline.length > 0 && (
        <section aria-labelledby={`${titleId}-in-timeline`} className="mt-6">
          <h3
            id={`${titleId}-in-timeline`}
            className="text-xs font-semibold uppercase tracking-wide text-accent-green"
          >
            In this timeline
          </h3>
          <ul className="mt-1">{credits.inTimeline.map((person) => row(person, true))}</ul>
        </section>
      )}

      {credits.crew.length > 0 && (
        <section aria-labelledby={`${titleId}-crew`} className="mt-6">
          <h3
            id={`${titleId}-crew`}
            className="text-xs font-semibold uppercase tracking-wide text-strong"
          >
            Crew
          </h3>
          {credits.crew.map((group) => (
            <div key={group.role} className="mt-3">
              <h4 className="text-xs font-medium text-muted">{group.label}</h4>
              <ul className="mt-0.5">{group.people.map((person) => row(person))}</ul>
            </div>
          ))}
        </section>
      )}

      {credits.cast.length > 0 && (
        <section aria-labelledby={`${titleId}-cast`} className="mt-6">
          <h3
            id={`${titleId}-cast`}
            className="text-xs font-semibold uppercase tracking-wide text-strong"
          >
            Cast
          </h3>
          <ul className="mt-1">{visibleCast.map((person) => row(person))}</ul>
          {credits.cast.length > CAST_PREVIEW && (
            <button
              type="button"
              aria-expanded={showAllCast}
              onClick={() => setExpandedFor(showAllCast ? null : film.id)}
              className="mt-2 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-strong hover:bg-surface"
            >
              {showAllCast ? "Show fewer" : `Show all ${credits.cast.length} cast`}
            </button>
          )}
        </section>
      )}
    </>
  );
}
