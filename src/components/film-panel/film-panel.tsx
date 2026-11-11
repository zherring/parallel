"use client";

import { usePeopleStaging, useStagingSurface } from "@/components/people-staging";
import { SidePanel, useSlideOut } from "@/components/side-panel/side-panel";
import { Spinner } from "@/components/spinner";
import { errorMessage } from "@/lib/api-client";
import type { PersonRow } from "@/lib/film-people";
import { isTimelineFull } from "@/lib/people-nav";
import { FilmContent } from "./film-content";
import { useFilmDetails } from "./use-film-details";

export interface FilmPanelProps {
  /** TMDB movie id to show; null keeps the panel closed. */
  filmId: number | null;
  /** People on the timeline now, so the panel can mark them and offer "add" for everyone else. */
  peopleInView: { id: number; name: string }[];
  onClose: () => void;
}

export function FilmPanel({ filmId, peopleInView, onClose }: FilmPanelProps) {
  // The dialog stays mounted for as long as its exit animation takes (see `useSlideOut`).
  const { shown, session, closing, exited } = useSlideOut(filmId);
  if (shown === null) return null;
  return (
    <FilmDialog
      key={session}
      filmId={shown}
      peopleInView={peopleInView}
      closing={closing}
      onExited={exited}
      onClose={onClose}
    />
  );
}

function FilmDialog({
  filmId,
  peopleInView,
  closing,
  onExited,
  onClose,
}: {
  filmId: number;
  peopleInView: FilmPanelProps["peopleInView"];
  /** The panel was closed: it slides out (and the page is the visitor's again at once), then `onExited` removes it. */
  closing: boolean;
  onExited: () => void;
  onClose: () => void;
}) {
  const { state, retry } = useFilmDetails(filmId);

  // Adding someone from the cast only stages it while the panel is open: the row says "Added", pressing it again takes it back, and nothing behind the panel is
  // redrawn. The page changes once, when the panel starts to close (see `PeopleStagingProvider`).
  const staging = usePeopleStaging();
  useStagingSurface(!closing);
  const full = isTimelineFull(staging.people);

  function toggleAdd(person: PersonRow) {
    if (staging.pending.added.some((added) => added.id === person.id)) staging.removePerson(person.id);
    else staging.addPerson({ id: person.id, name: person.name, profilePath: person.profilePath });
  }

  return (
    <SidePanel
      label="Film"
      closeLabel="Close film details"
      busy={state.status === "loading"}
      contentKey={filmId}
      closing={closing}
      onExited={onExited}
      onClose={onClose}
    >
      {({ titleId, scrollRef }) => (
        <>
          {state.status === "success" && (
            <FilmContent
              film={state.film}
              titleId={titleId}
              peopleInView={peopleInView}
              added={staging.pending.added}
              full={full}
              onToggleAdd={toggleAdd}
              scrollRef={scrollRef}
            />
          )}
          {state.status === "loading" && <FilmSkeleton titleId={titleId} />}
          {state.status === "error" && (
            <div role="alert" className="py-10 text-center">
              <h2 id={titleId} className="text-lg font-semibold text-strong">
                Couldn’t load this film
              </h2>
              <p className="mx-auto mt-2 max-w-xs text-sm text-body">
                {errorMessage(state.error, "film")}
              </p>
              <div className="mt-5 flex justify-center gap-3">
                {state.error !== "not-found" && (
                  <button
                    type="button"
                    onClick={retry}
                    className="rounded-md bg-accent-green px-4 py-2 text-sm font-semibold text-on-accent hover:bg-accent-green-hover"
                  >
                    Try again
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md border border-border px-4 py-2 text-sm font-medium text-strong hover:bg-surface"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </SidePanel>
  );
}

function FilmSkeleton({ titleId }: { titleId: string }) {
  const bar = "rounded bg-surface";
  return (
    <div role="status">
      <h2 id={titleId} className="sr-only">
        Loading film details
      </h2>
      <div aria-hidden="true" className="motion-safe:animate-pulse">
        <div className="flex gap-4">
          <div className={`aspect-[2/3] w-28 shrink-0 rounded-md sm:w-32 ${bar}`} />
          <div className="flex-1 space-y-3 pt-1">
            <div className={`h-6 w-3/4 ${bar}`} />
            <div className={`h-4 w-1/2 ${bar}`} />
            <div className={`h-4 w-2/3 ${bar}`} />
          </div>
        </div>
        <div className="mt-5 space-y-2">
          <div className={`h-3 w-full ${bar}`} />
          <div className={`h-3 w-full ${bar}`} />
          <div className={`h-3 w-4/5 ${bar}`} />
        </div>
        <div className="-mx-4 mt-8 flex gap-6 border-b border-border px-4">
          <div className="-mb-px border-b-2 border-surface px-0.5 pb-2.5 pt-3">
            <div className={`h-3.5 w-9 ${bar}`} />
          </div>
          <div className="border-b-2 border-transparent px-0.5 pb-2.5 pt-3">
            <div className={`h-3.5 w-9 ${bar}`} />
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className={`h-10 w-10 shrink-0 rounded-full ${bar}`} />
              <div className="flex-1 space-y-2">
                <div className={`h-3 w-1/3 ${bar}`} />
                <div className={`h-3 w-1/2 ${bar}`} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-6 flex items-center justify-center gap-2 text-sm text-muted">
        <Spinner /> Loading…
      </p>
    </div>
  );
}
