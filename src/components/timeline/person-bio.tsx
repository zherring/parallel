"use client";

import { useMemo } from "react";
import { bioSnippet } from "@/lib/biography";
import type { PersonSummary } from "@/lib/types";

/** Teaser length; the header clamps it to as many lines as the lane has room for. */
const SNIPPET_CHARS = 150;

/** Opens a person's details in the slide-out panel; `trigger` is the control to hand focus back to when it closes. */
export type OpenPerson = (personId: number, trigger: HTMLElement) => void;

interface PersonBioProps {
  person: PersonSummary;
  onOpen: OpenPerson;
  /**
   * The teaser sits in a panel that takes the height it needs (the combined timeline's people
   * column) instead of the fixed-height lane header: three lines, with the same More button.
   */
  flow?: boolean;
  /** Use the person's name as the opener, without a teaser. Works even when no biography is available. */
  nameTrigger?: boolean;
  /** With `nameTrigger`: what the opener says in place of the full name ("Spielberg"); the panel still opens on the full name. */
  label?: string;
}

/**
 * Biography teaser for a lane header, with a "More" button that opens the person's details in the
 * slide-out panel. Renders nothing when TMDB has no biography for the person.
 *
 * The teaser lives in a size container that takes whatever height the lane leaves over (up to
 * six rem) and clamps the text to the lines that fit, so a one-row lane never clips the header:
 * the teaser shrinks line by line, down to just the button. The full text is only in the panel.
 */
export function PersonBio({ person, onOpen, flow = false, nameTrigger = false, label }: PersonBioProps) {
  const biography = person.biography;
  const snippet = useMemo(() => (biography ? bioSnippet(biography, SNIPPET_CHARS) : ""), [biography]);

  if (nameTrigger) {
    return (
      <button
        type="button"
        aria-haspopup="dialog"
        // A title, not an aria-label: the button is the content of its row's heading and of a lane
        // region's name, and a label would name both "Details for ...". The title is only a description.
        title={`Details for ${person.name}`}
        onClick={(event) => onOpen(person.id, event.currentTarget)}
        className="cursor-pointer rounded text-left text-strong underline-offset-2 hover:underline"
      >
        {label ?? person.name}
      </button>
    );
  }

  if (!biography || !snippet) return null;

  if (flow) {
    return (
      <div data-person-bio className="mt-2">
        <p className="line-clamp-3 text-xs leading-snug text-body">{snippet}</p>
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={(event) => onOpen(person.id, event.currentTarget)}
          className="mt-0.5 inline-flex h-6 cursor-pointer items-center rounded-md text-xs font-medium text-strong underline-offset-2 hover:underline"
        >
          More<span className="sr-only"> about {person.name}</span>
        </button>
      </div>
    );
  }

  return (
    <div data-person-bio className="mt-1.5 sm:mt-2 sm:min-h-6 sm:shrink sm:grow-0 sm:basis-24 sm:[container-type:size]">
      <p className="mb-1 max-sm:hidden line-clamp-1 text-xs leading-snug text-body [@container(max-height:2.74rem)]:sr-only [@container(min-height:3.8rem)]:line-clamp-2 [@container(min-height:4.8rem)]:line-clamp-3 [@container(min-height:5.85rem)]:line-clamp-4">
        {snippet}
      </p>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={(event) => onOpen(person.id, event.currentTarget)}
        className="flex h-6 w-full cursor-pointer items-center justify-center rounded-md border border-border bg-surface text-[10px] leading-none text-strong underline-offset-2 hover:border-muted sm:inline-flex sm:w-auto sm:-translate-x-1.5 sm:justify-start sm:border-transparent sm:bg-transparent sm:px-1.5 sm:text-xs sm:font-medium sm:hover:border-transparent sm:hover:underline"
      >
        <span className="sm:hidden">
          Bio<span className="sr-only"> of {person.name}</span>
        </span>
        <span className="max-sm:hidden">
          More<span className="sr-only"> about {person.name}</span>
        </span>
      </button>
    </div>
  );
}
