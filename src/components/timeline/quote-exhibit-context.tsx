"use client";

import type { ClippingsPerson } from "@/lib/clippings";
import { quoteExhibitContextParts } from "@/lib/quote-exhibit";
import type { PersonPanelAccess } from "@/lib/side-panel";
import { buildPeopleSlug } from "@/lib/slug";

/** Real links inside the explainer: ordinary clicks open the biography; modified clicks keep their native destination. */
export function QuoteExhibitContext({ text, people, personPanel }: {
  text: string;
  people: readonly ClippingsPerson[];
  personPanel?: PersonPanelAccess;
}) {
  return quoteExhibitContextParts(text, people).map(({ text: label, person }, index) => {
    if (!person) return label;
    const canOpen = personPanel?.entries.some((entry) => entry.person.id === person.id);
    return (
      <a
        key={index}
        href={`/p/${buildPeopleSlug([person])}`}
        className="quote-exhibit-person-link"
        aria-label={person.name}
        aria-haspopup={canOpen ? "dialog" : undefined}
        title={canOpen ? `Details for ${person.name}` : undefined}
        onClick={(event) => {
          if (!canOpen || !personPanel || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
          event.preventDefault();
          personPanel.open(person.id, event.currentTarget);
        }}
      >
        {label}
      </a>
    );
  });
}
