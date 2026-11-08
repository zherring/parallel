"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SidePanel, useRememberPressed } from "@/components/side-panel/side-panel";
import type { BioPerson } from "@/components/timeline/person-bio";
import { lifeLine, splitParagraphs } from "@/lib/biography";
import { tmdbPersonUrl } from "@/lib/film-people";
import { tmdbImage } from "@/lib/images";
import { soloPersonHref } from "@/lib/people-nav";
import { initials } from "@/lib/person-labels";

export interface PersonPanelProps {
  /** The person to show, with the roles the page gives them; null keeps the panel closed. */
  entry: BioPerson | null;
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
  useRememberPressed();
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
  entry: BioPerson;
  titleId: string;
  peopleInView: PersonPanelProps["peopleInView"];
}) {
  const { person, roles } = entry;
  const photo = tmdbImage(person.profilePath, "w342");
  // The url that failed, not a flag, so the next person's photo gets its own chance.
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
  const life = lifeLine(person);
  const paragraphs = useMemo(() => splitParagraphs(person.biography ?? ""), [person.biography]);
  const soloHref = soloPersonHref(peopleInView, person);

  return (
    <>
      <div className="flex gap-4">
        <div className="relative aspect-[2/3] w-28 shrink-0 overflow-hidden rounded-md border border-border bg-surface sm:w-32">
          {/* The initials stay underneath: they show while the photo loads, and when TMDB has none or it fails. */}
          <span
            aria-hidden="true"
            className="absolute inset-0 flex select-none items-center justify-center text-3xl font-medium text-muted"
          >
            {initials(person.name)}
          </span>
          {photo && photo !== failedPhoto && (
            <img
              src={photo}
              alt={`Photo of ${person.name}`}
              width={342}
              height={513}
              decoding="async"
              onError={() => setFailedPhoto(photo)}
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
        </div>
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
              <span aria-hidden="true">→</span>
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
