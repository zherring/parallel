"use client";

import { Fragment } from "react";
import type { PillPerson } from "@/components/depth/people-pill";
import { PersonBio } from "@/components/timeline/person-bio";
import { TITLE_SEPARATOR } from "@/lib/pair-hero";

interface PairTitleProps {
  people: readonly PillPerson[];
  /** The line under the names (see `heroSubtitle`): set in capitals, muted. */
  subtitle: string;
}

/**
 * The pair hero's title, which takes the people pill's place in the page bar while the hero is expanded: the names joined with " × ", each a button that opens
 * that person's biography (the pill's own `PersonBio`), and under them, small and in capitals, what each did and how many films they made together. It is
 * not the page's heading: the `h1` is the visually hidden `PageHeadline`, which says the same with "&".
 */
export function PairTitle({ people, subtitle }: PairTitleProps) {
  return (
    <div data-pair-title className="pointer-events-auto flex min-h-(--bar-h) min-w-0 flex-col justify-center">
      <p className="text-xl font-semibold leading-tight tracking-tight text-strong max-sm:text-lg">
        {people.map(({ person, roles }, index) => (
          <Fragment key={person.id}>
            {index > 0 && (
              <span aria-hidden="true" className="text-muted">
                {TITLE_SEPARATOR}
              </span>
            )}
            <PersonBio person={person} roles={roles} nameTrigger />
          </Fragment>
        ))}
      </p>
      <p data-pair-subtitle className="mt-0.5 text-[11px] font-medium uppercase leading-snug tracking-wider text-muted">
        {subtitle}
      </p>
    </div>
  );
}
