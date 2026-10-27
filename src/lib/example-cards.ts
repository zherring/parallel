import generated from "@/lib/examples.generated.json";
import {
  EXAMPLE_PAIRINGS,
  GENRES,
  pairingHref,
  pairingKey,
  type ExamplePairing,
  type GeneratedExamples,
  type Genre,
} from "@/lib/examples";

export interface ExampleCardData {
  href: string;
  blurb: string;
  /** Films all people share by the pair page's default rules, as recorded by examples:refresh. */
  sharedCount: number;
  /** TMDB's canonical names and photos (profile paths), in the pairing's order. */
  people: { id: number; name: string; profilePath: string }[];
}

export interface GenreSection {
  genre: Genre;
  cards: ExampleCardData[];
}

/**
 * The landing page's cards, grouped by genre in display order (genres with no pairings are
 * left out). Everything comes from the hand-curated pairings plus the checked-in
 * examples.generated.json, so rendering never calls TMDB. Throws when the JSON has no entry for
 * a pairing, or one for different people: it is stale, so run `npm run examples:refresh`.
 */
export function buildGenreSections(
  pairings: readonly (Omit<ExamplePairing, "genre"> & { genre: string })[] = EXAMPLE_PAIRINGS,
  data: GeneratedExamples = generated,
  genres: readonly Genre[] = GENRES,
): GenreSection[] {
  const cards = new Map<string, ExampleCardData[]>();

  for (const pairing of pairings) {
    const entry = data[pairingKey(pairing)];
    const wanted = pairing.people.map((person) => person.id).join(",");
    if (!entry || entry.people.map((person) => person.id).join(",") !== wanted) {
      throw new Error(
        `examples.generated.json is out of date for pairing ${wanted}: run \`npm run examples:refresh\``,
      );
    }
    const card: ExampleCardData = {
      href: pairingHref(entry),
      blurb: pairing.blurb,
      sharedCount: entry.sharedCount,
      people: entry.people,
    };
    cards.set(pairing.genre, [...(cards.get(pairing.genre) ?? []), card]);
  }

  return genres
    .filter((genre) => cards.has(genre.id))
    .map((genre) => ({ genre, cards: cards.get(genre.id)! }));
}
