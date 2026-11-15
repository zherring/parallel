"use client";

import { Suspense } from "react";
import { PersonAvatar } from "@/components/person-avatar";
import { TreatedPortrait } from "@/components/treated-portrait";
import { usePortraitMode } from "@/components/use-portrait-mode";

interface Props {
  person: { id: number; name: string; profilePath: string };
  /** The person's place in the pair (the URL's order), which is their colour's slot. */
  slot: number;
  photos: boolean;
}

/** A landing card's face as it has always been: the round avatar. */
function Avatar({ person, photos }: Omit<Props, "slot">) {
  return <PersonAvatar name={person.name} profilePath={photos ? person.profilePath : null} size={64} imageSize="w185" className="ring-4 ring-surface" />;
}

/**
 * Spike (zherring/spike-portraits): a landing card's face, cut out (`TreatedPortrait`, 2:3 like the hero's) behind `?portrait=on|color`, and the
 * round avatar otherwise. The flag is read from the address, so the face sits in its own Suspense boundary, whose fallback is the avatar: the
 * landing page renders as it did on the server and, without the flag, in the browser too.
 */
export function PairingFace(props: Props) {
  return (
    <Suspense fallback={<Avatar person={props.person} photos={props.photos} />}>
      <FlaggedFace {...props} />
    </Suspense>
  );
}

function FlaggedFace({ person, slot, photos }: Props) {
  const mode = usePortraitMode();
  if (!mode || !photos || !person.profilePath) return <Avatar person={person} photos={photos} />;
  return (
    <TreatedPortrait
      mode={mode}
      personId={person.id}
      slot={slot}
      name={person.name}
      profilePath={person.profilePath}
      className="h-20 w-[3.375rem] ring-4 ring-surface"
    />
  );
}
