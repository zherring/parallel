import Link from "next/link";
import type { ReactNode } from "react";
import { PairingCount } from "@/components/landing/pairing-count";
import { PairingFace } from "@/components/landing/pairing-face";
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
        {/* Spike: `?portrait=on` cuts the faces out (`PairingFace`); without it they are the round avatars they were. */}
        {people.map((person, slot) => (
          <PairingFace key={person.id} person={person} slot={slot} partnerId={people[1 - slot]?.id ?? person.id} photos={photos} />
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
      <PairingCount count={card.sharedCount} />
    </PairingCardFrame>
  );
}
