import Link from "next/link";
import { PersonAvatar } from "@/components/person-avatar";
import type { ExampleCardData } from "@/lib/example-cards";
import { joinNames } from "@/lib/format";

export function PairingCard({ card }: { card: ExampleCardData }) {
  const names = card.people.map((p) => p.name);
  return (
    <Link
      href={card.href}
      prefetch={false}
      className="group flex h-full flex-col gap-4 rounded-lg border border-border bg-surface p-5 no-underline transition-colors hover:border-accent-green/70"
    >
      <div className="flex -space-x-4" aria-hidden="true">
        {card.people.map((person) => (
          <PersonAvatar
            key={person.id}
            name={person.name}
            profilePath={person.profilePath}
            size={64}
            imageSize="w185"
            className="ring-4 ring-surface"
          />
        ))}
      </div>
      <div className="flex flex-1 flex-col gap-1.5">
        <h3 className="text-lg font-semibold leading-snug text-strong">{joinNames(names)}</h3>
        <p className="text-sm leading-relaxed text-body">{card.blurb}</p>
      </div>
      {card.filmsTogether !== null && (
        <p className="text-sm font-medium text-accent-green">
          <span className="tabular-nums">{card.filmsTogether}</span>{" "}
          {card.filmsTogether === 1 ? "film" : "films"} together
        </p>
      )}
    </Link>
  );
}
