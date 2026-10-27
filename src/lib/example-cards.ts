import generated from "@/lib/examples.generated.json";
import type { HeroPairing } from "@/lib/hero-scenes";
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
  /** Id of the genre whose panel lists this pairing. */
  genre: string;
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
 * Every two-person pairing as the landing hero's scene data (see hero-scenes.ts), in the
 * pairing's order of people. Posters are left out of ExampleCardData on purpose: the Featured tab
 * ships every card to the browser and has no use for them. Throws like buildGenreSections when
 * the generated JSON is stale.
 */
export function buildHeroPairings(
  pairings: readonly Omit<ExamplePairing, "genre">[] = EXAMPLE_PAIRINGS,
  data: GeneratedExamples = generated,
): HeroPairing[] {
  const out: HeroPairing[] = [];
  for (const pairing of pairings) {
    const entry = data[pairingKey(pairing)];
    const wanted = pairing.people.map((person) => person.id).join(",");
    if (!entry || entry.people.map((person) => person.id).join(",") !== wanted) {
      throw new Error(
        `examples.generated.json is out of date for pairing ${wanted}: run \`npm run examples:refresh\``,
      );
    }
    if (entry.people.length !== 2) continue;
    out.push({
      key: pairingKey(pairing),
      sharedCount: entry.sharedCount,
      people: [entry.people[0], entry.people[1]],
      posters: entry.posters,
    });
  }
  return out;
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
      genre: pairing.genre,
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
