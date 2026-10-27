"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PersonAvatar } from "@/components/person-avatar";
import { bioSnippet, lifeLine, splitParagraphs } from "@/lib/biography";
import type { PersonSummary } from "@/lib/types";

/** Teaser length; the header clamps it to as many lines as the lane has room for. */
const SNIPPET_CHARS = 150;

const tmdbPersonUrl = (id: number) => `https://www.themoviedb.org/person/${id}`;

interface PersonBioProps {
  person: PersonSummary;
  /** Union of the person's roles across the films shown, e.g. "Director, Writer". */
  roles: string;
}

/**
 * Biography teaser for a lane header, with a "More" button that opens the full text in a modal.
 * Renders nothing when TMDB has no biography for the person.
 *
 * The teaser lives in a size container that takes whatever height the lane leaves over (up to
 * six rem) and clamps the text to the lines that fit, so a one-row lane never clips the header:
 * the teaser shrinks line by line, down to just the button. The full text is only rendered
 * while the dialog is open.
 */
export function PersonBio({ person, roles }: PersonBioProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const biography = person.biography;
  const snippet = useMemo(() => (biography ? bioSnippet(biography, SNIPPET_CHARS) : ""), [biography]);

  // Native <dialog> returns focus to the opener on its own, but not in Safari, where a clicked
  // button is never focused. The page is only usable again once the dialog is gone, so this
  // runs after it unmounts rather than in the close handler. preventScroll matters: the header
  // is sticky inside the timeline's scroller, and scrolling "to" it would snap the timeline
  // back to the first year.
  useEffect(() => {
    if (wasOpen.current && !open) buttonRef.current?.focus({ preventScroll: true });
    wasOpen.current = open;
  }, [open]);

  if (!biography || !snippet) return null;

  return (
    <div data-person-bio className="mt-1.5 sm:mt-2 sm:min-h-6 sm:shrink sm:grow-0 sm:basis-24 sm:[container-type:size]">
      <p className="mb-1 max-sm:hidden line-clamp-1 text-xs leading-snug text-body [@container(max-height:2.74rem)]:sr-only [@container(min-height:3.8rem)]:line-clamp-2 [@container(min-height:4.8rem)]:line-clamp-3 [@container(min-height:5.85rem)]:line-clamp-4">
        {snippet}
      </p>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="flex h-6 w-full cursor-pointer items-center justify-center rounded-md border border-border bg-surface text-[10px] leading-none text-body hover:border-muted hover:text-strong sm:inline-flex sm:w-auto sm:-translate-x-1.5 sm:justify-start sm:border-transparent sm:bg-transparent sm:px-1.5 sm:text-xs sm:font-medium sm:text-accent-blue sm:hover:border-transparent sm:hover:text-accent-blue sm:hover:underline"
      >
        <span className="sm:hidden">
          Bio<span className="sr-only"> of {person.name}</span>
        </span>
        <span className="max-sm:hidden">
          More<span className="sr-only"> about {person.name}</span>
        </span>
      </button>
      {open && createPortal(<BioDialog person={person} roles={roles} onClose={() => setOpen(false)} />, document.body)}
    </div>
  );
}

function BioDialog({ person, roles, onClose }: PersonBioProps & { onClose: () => void }) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // A drag that starts inside the dialog and ends on the backdrop is not a click on the backdrop.
  const pressedBackdrop = useRef(false);
  const paragraphs = useMemo(() => splitParagraphs(person.biography ?? ""), [person.biography]);
  const life = lifeLine(person);

  // showModal() gives the focus trap, Esc to close and an inert page behind it. Focus starts on
  // the name rather than the first control so that screen readers read from the top and arrow
  // keys scroll the text.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    // Strict Mode runs this twice; a second showModal() on an open dialog would throw.
    if (!dialog.open) dialog.showModal();
    headingRef.current?.focus({ preventScroll: true });
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      dialog.animate(
        [{ opacity: 0, transform: "translateY(8px) scale(0.98)" }, { opacity: 1, transform: "none" }],
        { duration: 160, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
      );
    }
  }, []);

  // Lock page scroll without shifting the layout when the scrollbar disappears.
  useEffect(() => {
    const { body, documentElement } = document;
    const previous = { overflow: body.style.overflow, paddingRight: body.style.paddingRight };
    const scrollbar = window.innerWidth - documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
    return () => {
      body.style.overflow = previous.overflow;
      body.style.paddingRight = previous.paddingRight;
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      // Fires after Esc as well as after close(); the dialog is already closed by then.
      onClose={onClose}
      onPointerDown={(event) => {
        pressedBackdrop.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        // The dialog has no padding, so a click that lands on the dialog itself hit its backdrop.
        if (pressedBackdrop.current && event.target === event.currentTarget) onClose();
        pressedBackdrop.current = false;
      }}
      className="m-auto w-[36rem] max-w-[calc(100vw-1rem)] overflow-hidden rounded-xl border border-border bg-canvas p-0 text-body shadow-2xl shadow-black/60 backdrop:bg-black/70"
    >
      <div className="flex max-h-[80dvh] flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 pt-5 sm:px-6">
          <div className="flex items-center gap-4">
            <PersonAvatar name={person.name} profilePath={person.profilePath} size={72} imageSize="w185" />
            <div className="min-w-0">
              <h2
                ref={headingRef}
                id={titleId}
                tabIndex={-1}
                className="break-words text-xl font-semibold leading-tight text-strong outline-none!"
              >
                {person.name}
              </h2>
              {roles && <p className="mt-1 text-sm text-body">{roles}</p>}
              {life && <p className="mt-0.5 text-xs text-muted">{life}</p>}
            </div>
          </div>
          <div className="mt-5 space-y-4 text-[0.9375rem] leading-7 text-body">
            {paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border px-5 py-3 sm:px-6">
          <p className="text-xs text-muted">
            Biography from TMDB
            <span aria-hidden="true"> · </span>
            <a
              href={tmdbPersonUrl(person.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded text-accent-blue underline-offset-2 hover:underline"
            >
              Read more on TMDB
              <span aria-hidden="true"> ↗</span>
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </p>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-md border border-border px-4 py-2 text-sm font-medium text-strong hover:bg-surface"
          >
            Close
          </button>
        </div>
      </div>
    </dialog>
  );
}
