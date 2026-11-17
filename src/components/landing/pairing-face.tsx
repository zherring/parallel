import { WhenPanelShown } from "@/components/landing/panel-shown";
import { PersonAvatar } from "@/components/person-avatar";
import { TreatedPortrait } from "@/components/treated-portrait";
import { pairPortraitColors } from "@/lib/portrait-cuts";

interface Props {
  person: { id: number; name: string; profilePath: string };
  /** The person's place in the pair (the URL's order), which is their colour's slot. */
  slot: number;
  /** The other person's TMDB id: the colour is the pair's (`pairPortraitColors`), so the two never share one. */
  partnerId: number;
  photos: boolean;
}

/**
 * A landing card's face: cut out (`TreatedPortrait`, 2:3 like the hero's) in the pair's colour, or, for a card that draws initials only (`photos` false) or a
 * person with no photo, the round avatar. The cut-out is drawn once its panel has been shown (`WhenPanelShown`): a hidden panel's faces are not in the
 * server's markup, where each is a 3 x 3 montage of posters and an SVG.
 */
export function PairingFace({ person, slot, partnerId, photos }: Props) {
  if (!photos || !person.profilePath) {
    return <PersonAvatar name={person.name} profilePath={photos ? person.profilePath : null} size={64} imageSize="w185" className="ring-4 ring-surface" />;
  }
  const [color] = pairPortraitColors(person.id, partnerId);
  return (
    <WhenPanelShown placeholder={<span aria-hidden="true" className="h-20 w-[3.375rem] shrink-0" />}>
      <TreatedPortrait
        personId={person.id}
        slot={slot}
        color={color}
        name={person.name}
        profilePath={person.profilePath}
        className="h-20 w-[3.375rem] ring-4 ring-surface"
      />
    </WhenPanelShown>
  );
}
