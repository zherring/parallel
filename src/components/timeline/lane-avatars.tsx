"use client";

import { PersonAvatar } from "@/components/person-avatar";
import type { PersonSummary } from "@/lib/types";
import { cn } from "./cn";

interface LaneAvatarsProps {
  people: Pick<PersonSummary, "id" | "name" | "profilePath">[];
  /** Index of the lane most in view; gets the green ring. */
  activeIndex: number;
  onJump: (index: number) => void;
}

/**
 * Small overlapping avatars of everyone on the timeline, at the left end of the sticky top bar
 * beside the minimap. Each one scrolls its person's lane to the top (and the timeline rings it
 * briefly); the lane most in view has the green ring and `aria-current`.
 */
export function LaneAvatars({ people, activeIndex, onJump }: LaneAvatarsProps) {
  return (
    <div
      role="group"
      aria-label="Jump to a person's lane"
      // Up to four 28px avatars overlap enough to stay narrow on a phone, where the minimap needs the room.
      className="flex shrink-0 items-center -space-x-2.5 sm:-space-x-2"
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
  );
}
