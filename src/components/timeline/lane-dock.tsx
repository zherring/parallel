"use client";

import { PersonAvatar } from "@/components/person-avatar";
import type { PersonSummary } from "@/lib/types";
import { cn } from "./cn";

/** Height of the strip reserved under the last lane for the dock, so it never covers a lane header. */
export const DOCK_HEIGHT = 48;

interface LaneDockProps {
  people: Pick<PersonSummary, "id" | "name" | "profilePath">[];
  /** Index of the lane most in view; gets the green ring. */
  activeIndex: number;
  onJump: (index: number) => void;
}

/**
 * Small overlapping avatars pinned to the bottom of the timeline's left column. Each one
 * scrolls its person's lane to the top. Position it with the parent (sticky, bottom).
 */
export function LaneDock({ people, activeIndex, onJump }: LaneDockProps) {
  return (
    <div
      className="absolute bottom-0 left-0 flex w-full items-center border-r border-t border-border bg-canvas px-1.5 sm:px-3"
      style={{ height: DOCK_HEIGHT }}
    >
      <div
        role="group"
        aria-label="Jump to a person's lane"
        // The narrow lane header fits three 28px avatars with a little overlap, four with a lot.
        className={cn("flex items-center sm:-space-x-2", people.length > 3 ? "-space-x-3.5" : "-space-x-1.5")}
      >
        {people.map((person, index) => {
          const active = index === activeIndex;
          return (
            <button
              key={person.id}
              type="button"
              aria-label={`Jump to ${person.name}`}
              aria-current={active ? "true" : undefined}
              title={person.name}
              onClick={() => onJump(index)}
              className={cn(
                "relative flex cursor-pointer rounded-full ring-2 hover:z-10 focus-visible:z-10",
                active ? "z-10 ring-lit" : "ring-canvas hover:ring-muted",
              )}
            >
              <PersonAvatar name={person.name} profilePath={person.profilePath} size={32} className="max-sm:size-7!" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
