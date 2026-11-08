import Link from "next/link";
import type { ReactNode } from "react";
import { PersonAvatar } from "@/components/person-avatar";
import type { ExampleCardData } from "@/lib/example-cards";
import { joinNames } from "@/lib/format";

interface FrameProps {
  href: string;
  /** TMDB's canonical names and photos (profile paths). */
  people: { id: number; name: string; profilePath: string }[];
  /** False draws initials only, without requesting the photos. */
  photos?: boolean;
  /** Under the faces: what the card says about the pair. */
  children: ReactNode;
}

/** The card every landing tab shares: the pair's faces, then whatever `children` say about them, as one link. */
export function PairingCardFrame({ href, people, photos = true, children }: FrameProps) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="group flex h-full flex-col gap-4 rounded-lg border border-border bg-surface p-5 no-underline transition-colors hover:border-accent-green/70"
    >
      <div className="flex -space-x-4" aria-hidden="true">
        {people.map((person) => (
          <PersonAvatar
            key={person.id}
            name={person.name}
            profilePath={photos ? person.profilePath : null}
            size={64}
            imageSize="w185"
            className="ring-4 ring-surface"
          />
        ))}
      </div>
      {children}
    </Link>
  );
}

interface Props {
  card: ExampleCardData;
  /** False draws initials only, without requesting the photos. */
  photos?: boolean;
}

export function PairingCard({ card, photos = true }: Props) {
  const names = card.people.map((p) => p.name);
  return (
    <PairingCardFrame href={card.href} people={card.people} photos={photos}>
      <div className="flex flex-1 flex-col gap-1.5">
        <h3 className="text-lg font-semibold leading-snug text-strong">{joinNames(names)}</h3>
        <p className="text-sm leading-relaxed text-body">{card.blurb}</p>
      </div>
      <p className="text-sm font-medium text-accent-green">
        <span className="tabular-nums">{card.sharedCount}</span> {card.sharedCount === 1 ? "film" : "films"} together
      </p>
    </PairingCardFrame>
  );
}
