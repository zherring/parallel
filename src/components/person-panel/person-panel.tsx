"use client";

import Link, { useLinkStatus } from "next/link";
import { useMemo } from "react";
import { Portrait } from "@/components/portrait";
import { SidePanel } from "@/components/side-panel/side-panel";
import { Spinner } from "@/components/spinner";
import { lifeLine, splitParagraphs } from "@/lib/biography";
import { tmdbPersonUrl } from "@/lib/film-people";
import { tmdbImage } from "@/lib/images";
import { peopleHref } from "@/lib/lanes";
import { initials } from "@/lib/person-labels";
import type { PersonPanelEntry } from "@/lib/side-panel";

export interface PersonPanelProps {
  /** The person to show, with the roles the page gives them; null keeps the panel closed. */
  entry: PersonPanelEntry | null;
  /** Everyone on the page: the link to the person's own timeline is left out where it would lead nowhere. */
  peopleInView: { id: number; name: string }[];
  onClose: () => void;
}

/**
 * A person's details in the slide-out panel the films use: headshot, name (a link to TMDB), roles, life
 * and the full biography. The person is already in the page's payload, so unlike the film's there is
 * nothing to load.
 */
export function PersonPanel({ entry, peopleInView, onClose }: PersonPanelProps) {
  if (!entry) return null;
  return (
    <SidePanel label="Person" closeLabel="Close person details" contentKey={entry.person.id} onClose={onClose}>
      {({ titleId }) => <PersonContent entry={entry} titleId={titleId} peopleInView={peopleInView} />}
    </SidePanel>
  );
}

export function PersonContent({
  entry,
  titleId,
  peopleInView,
}: {
  entry: PersonPanelEntry;
  titleId: string;
  peopleInView: PersonPanelProps["peopleInView"];
}) {
  const { person, roles } = entry;
  const photo = tmdbImage(person.profilePath, "w342");
  const life = lifeLine(person);
  const paragraphs = useMemo(() => splitParagraphs(person.biography ?? ""), [person.biography]);
  // Their own timeline; nowhere new to go from the page that is already theirs alone.
  const onOwnPage = peopleInView.length === 1 && peopleInView[0].id === person.id;
  const soloHref = onOwnPage ? null : peopleHref([person]);

  return (
    <>
      <div className="flex gap-4">
        <Portrait src={photo} alt={`Photo of ${person.name}`} fallback={initials(person.name)} />
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="break-words text-xl font-semibold leading-tight text-strong">
            <a
              href={tmdbPersonUrl(person.id)}
              target="_blank"
              rel="noopener noreferrer"
              title={`${person.name} on TMDB (opens in a new tab)`}
              className="rounded text-strong underline-offset-2 hover:underline"
            >
              {person.name}
            </a>
          </h2>
          {roles && <p className="mt-1.5 text-sm text-body">{roles}</p>}
          {life && <p className="mt-1 text-sm text-muted">{life}</p>}
          {soloHref && (
            <Link
              href={soloHref}
              prefetch={false}
              className="mt-3 inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-strong no-underline hover:bg-surface"
            >
              View their timeline
              <LinkArrow />
            </Link>
          )}
        </div>
      </div>

      <div className="mt-5 space-y-4 text-sm leading-relaxed text-body">
        {paragraphs.length === 0 && <p>No biography available on TMDB.</p>}
        {paragraphs.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>

      <p className="mt-6 text-xs text-muted">
        Biography from TMDB
        <span aria-hidden="true"> · </span>
        <a
          href={tmdbPersonUrl(person.id)}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded text-strong underline-offset-2 hover:underline"
        >
          Read more on TMDB
          <span aria-hidden="true"> ↗</span>
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </p>
    </>
  );
}

/** The arrow after "View their timeline": a spinner of the same size while the page loads (the link is not prefetched). */
function LinkArrow() {
  const { pending } = useLinkStatus();
  return (
    <>
      <span aria-hidden="true" className="flex h-4 w-4 items-center justify-center">
        {pending ? <Spinner className="h-3.5 w-3.5" /> : "→"}
      </span>
      {/* A persistent live region (the text changes, the element does not): the arrow is decorative, the wait is not. */}
      <span role="status" aria-live="polite" className="sr-only">
        {pending ? "Loading their timeline" : ""}
      </span>
    </>
  );
}
