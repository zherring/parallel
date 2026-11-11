"use client";

import type { ReactNode, RefObject } from "react";
import { PersonAvatar } from "@/components/person-avatar";
import { Portrait } from "@/components/portrait";
import { joinNames } from "@/lib/format";
import { filmMetaLine, groupFilmCredits, tmdbMovieUrl, type PersonRow } from "@/lib/film-people";
import { tmdbImage } from "@/lib/images";
import { MAX_PEOPLE, addState } from "@/lib/people-nav";
import type { FilmDetails } from "@/lib/types";
import { FilmTabs } from "./film-tabs";

interface Props {
  film: FilmDetails;
  titleId: string;
  /** The people on the page now: they are the "In this timeline" group, and have the badge in the cast. */
  peopleInView: { id: number; name: string }[];
  /** The people staged to join the page (see `PeopleStagingProvider`), in the order they were added: their button says "Added", and pressing it takes it back. */
  added: readonly { id: number; name: string }[];
  /** The page will be full (`MAX_PEOPLE`) once the staged people join: no one else can be added. */
  full: boolean;
  /** Stages adding a person, or takes it back for one already staged. Nothing is redrawn until the panel closes. */
  onToggleAdd: (person: PersonRow) => void;
  /** The panel's scroll container, for the sticky cast/crew tabs. */
  scrollRef: RefObject<HTMLElement | null>;
}

const FULL_TITLE = `A timeline holds up to ${MAX_PEOPLE} people`;

export function FilmContent({ film, titleId, peopleInView, added, full, onToggleAdd, scrollRef }: Props) {
  const credits = groupFilmCredits(film, peopleInView);
  const addedIds = new Set(added.map((person) => person.id));
  const poster = tmdbImage(film.posterPath, "w342");
  const meta = filmMetaLine(film);

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
      } else if (addedIds.has(person.id)) {
        // Staged to join: the page has them once the panel closes. Pressing it again takes it back.
        action = (
          <button
            type="button"
            aria-label={`${person.name} is added to the timeline. Press to take it back`}
            title="Added when you close this panel. Press to take it back"
            onClick={() => onToggleAdd(person)}
            className="shrink-0 rounded border border-accent-green px-3 py-1 text-xs font-semibold text-accent-green hover:bg-surface"
          >
            Added ✓
          </button>
        );
      } else {
        action = (
          <button
            type="button"
            aria-label={`Add ${person.name} to timeline`}
            title={full ? FULL_TITLE : undefined}
            disabled={full}
            onClick={() => onToggleAdd(person)}
            className="shrink-0 rounded bg-accent-green px-3 py-1 text-xs font-semibold text-on-accent hover:bg-accent-green-hover disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-accent-green"
          >
            Add
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
        <Portrait src={poster} alt={`Poster for ${film.title}`} />
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

      {/* What adding someone does while this is open: the page changes when it closes. A live region, always there, so that it is spoken as it fills. */}
      <p
        role="status"
        aria-live="polite"
        className={added.length > 0 ? "mt-5 rounded-md border border-accent-green/50 bg-surface px-3 py-2 text-sm text-body" : "sr-only"}
      >
        {added.length > 0 ? `${joinNames(added.map((person) => person.name))} will join the timeline when you close this panel.` : ""}
      </p>

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

      {(credits.cast.length > 0 || credits.crew.length > 0) && (
        <FilmTabs
          idBase={titleId}
          cast={credits.cast}
          crew={credits.crew}
          renderRow={(person) => row(person)}
          scrollRef={scrollRef}
        />
      )}
    </>
  );
}
