"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { SidePanel, useRememberPressed } from "@/components/side-panel/side-panel";
import { Spinner } from "@/components/spinner";
import { errorMessage } from "@/lib/api-client";
import type { PersonRow } from "@/lib/film-people";
import { extendedPeopleHref } from "@/lib/people-nav";
import { FilmContent } from "./film-content";
import { useFilmDetails } from "./use-film-details";

export interface FilmPanelProps {
  /** TMDB movie id to show; null keeps the panel closed. */
  filmId: number | null;
  /** People already on the timeline, so the panel can mark them and offer "add" for everyone else. */
  peopleInView: { id: number; name: string }[];
  onClose: () => void;
}

export function FilmPanel({ filmId, peopleInView, onClose }: FilmPanelProps) {
  useRememberPressed();
  if (filmId === null) return null;
  return <FilmDialog filmId={filmId} peopleInView={peopleInView} onClose={onClose} />;
}

function FilmDialog({
  filmId,
  peopleInView,
  onClose,
}: {
  filmId: number;
  peopleInView: FilmPanelProps["peopleInView"];
  onClose: () => void;
}) {
  const router = useRouter();
  const onCloseRef = useRef(onClose);
  const { state, retry } = useFilmDetails(filmId);

  const [addingId, setAddingId] = useState<number | null>(null);
  const [isAdding, startAdding] = useTransition();
  const wasAdding = useRef(false);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Close once an "Add" navigation has finished, so the new lane is visible.
  useEffect(() => {
    if (wasAdding.current && !isAdding) onCloseRef.current();
    wasAdding.current = isAdding;
  }, [isAdding]);

  function add(person: PersonRow) {
    const href = extendedPeopleHref(peopleInView, { id: person.id, name: person.name }, window.location.search);
    if (!href) return;
    setAddingId(person.id);
    startAdding(() => router.push(href));
  }

  return (
    <SidePanel
      label="Film"
      closeLabel="Close film details"
      busy={state.status === "loading"}
      contentKey={filmId}
      onClose={onClose}
    >
      {({ titleId, scrollRef }) => (
        <>
          {state.status === "success" && (
            <FilmContent
              film={state.film}
              titleId={titleId}
              peopleInView={peopleInView}
              addingId={isAdding ? addingId : null}
              onAdd={add}
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
