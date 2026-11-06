import { notFound } from "next/navigation";
import { buildPeopleSlug, parsePeopleSlug } from "@/lib/slug";
import type { Film, PersonTimeline } from "@/lib/types";

/**
 * Two people and their films, for the tests of the /p/ page and its card route, which mock `loadPeople` with
 * `stubLoadPeople`: no network and no TMDB token. Both made the same six films (1966 to 1998), none with a poster or a
 * portrait, so drawing the card fetches nothing.
 */
const YEARS = [1966, 1968, 1971, 1981, 1991, 1998];

const films = (): Film[] =>
  YEARS.map((year, i) => ({
    id: i + 1,
    title: `Film ${i + 1}`,
    releaseDate: `${year}-06-01`,
    year,
    posterPath: null,
    voteCount: 100 - i,
    credits: [{ role: "actor", job: "Actor", minor: false }],
    minor: false,
  }));

const person = (id: number, name: string): PersonTimeline => ({
  person: { id, name, profilePath: null, knownFor: null, birthday: null, deathday: null, biography: null },
  films: films(),
});

const PEOPLE: Record<number, PersonTimeline> = {
  3151: person(3151, "Jack Lemmon"),
  6837: person(6837, "Walter Matthau"),
};

/** The slug the pair is at: what every other spelling of it redirects to. */
export const PAIR_SLUG = "3151-jack-lemmon+6837-walter-matthau";
/** The years the pair's films span: a period that covers them all is no period. */
export const PAIR_SPAN = { first: 1966, last: 1998 } as const;

/** `loadPeople` as it behaves, without TMDB: a bad slug or an unknown person is `notFound()`, the rest is the pair. */
export async function stubLoadPeople(slug: string) {
  const parsed = parsePeopleSlug(slug);
  if (!parsed) notFound();
  const timelines = parsed.ids.map((id) => PEOPLE[id] ?? notFound());
  const canonical = buildPeopleSlug(timelines.map((t) => t.person));
  return { timelines, canonical, isCanonical: decodeURIComponent(slug) === canonical };
}
