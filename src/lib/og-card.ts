import { initials } from "@/lib/person-labels";
import { sharedFilms } from "@/lib/shared";
import { headingNames } from "@/lib/short-name";
import type { Film, PersonTimeline } from "@/lib/types";

/** Posters on a card at most; films without a poster are skipped. */
export const MAX_OG_POSTERS = 4;

/** Longest label per number of people on the card; longer names are cut with an ellipsis. */
const LABEL_MAX_CHARS: Record<number, number> = { 1: 36, 2: 26, 3: 17, 4: 13 };

export interface OgPerson {
  /** Full name, for alt text. */
  name: string;
  /** What is printed under the portrait: full name for one or two people, family name for three or four. */
  label: string;
  /** Name size, the same for everyone on the card: shrunk until the longest word of any name fits its column. */
  fontSize: number;
  initials: string;
  profilePath: string | null;
}

export interface OgPoster {
  id: number;
  title: string;
  year: number;
  posterPath: string;
}

export interface OgCard {
  /** One person: a career card; two or more: a collaboration card. */
  kind: "solo" | "pair";
  people: OgPerson[];
  /** Up to MAX_OG_POSTERS films, most voted for first picked, shown oldest first. */
  posters: OgPoster[];
  /**
   * The big line. `figure` is set in the accent color when there is a number to show:
   * "5" + "films together", or null + "1995-2024" for one person.
   */
  headline: { figure: string | null; text: string };
  /** A quieter line under the headline; null when there is nothing to add. */
  subline: string | null;
}

/** `text` cut to at most `max` characters, ending in an ellipsis when it was cut. */
export function truncateName(text: string, max: number): string {
  const chars = Array.from(text.trim());
  if (chars.length <= max) return chars.join("");
  return `${chars.slice(0, Math.max(1, max - 1)).join("").trimEnd()}…`;
}

interface PosterCandidate {
  id: number;
  title: string;
  year: number;
  releaseDate: string;
  posterPath: string | null;
  voteCount: number;
}

/** The `max` best-known films that have a poster, in release order. */
export function pickPosters(films: readonly PosterCandidate[], max: number = MAX_OG_POSTERS): OgPoster[] {
  return films
    .filter((film): film is PosterCandidate & { posterPath: string } => Boolean(film.posterPath))
    .sort((a, b) => b.voteCount - a.voteCount || a.releaseDate.localeCompare(b.releaseDate) || a.id - b.id)
    .slice(0, max)
    .sort((a, b) => a.releaseDate.localeCompare(b.releaseDate) || a.id - b.id)
    .map(({ id, title, year, posterPath }) => ({ id, title, year, posterPath }));
}

/** Width of the card's content box: 1200 minus 60px of padding on each side. */
export const OG_CONTENT_WIDTH = 1080;
/** Space kept between the people block and the poster fan. */
const BLOCK_GAP = 36;
/** Allowance for the tilted posters sticking out sideways. */
const TILT_ALLOWANCE = 28;

export interface PeopleLayout {
  /** Portrait diameter. */
  diameter: number;
  /** Distance between portrait centers; also the width of each name column. Less than `diameter`, so portraits overlap. */
  pitch: number;
  /** Largest name size. */
  font: number;
  /** Width a name may take: the column, less a margin so neighbors do not touch. */
  labelWidth: number;
  /** Width the block takes in the row. */
  width: number;
}

/** Portrait and name sizes for one to four people; a single person gets a big portrait with the name beside it. */
export function peopleLayout(count: number): PeopleLayout {
  switch (Math.min(4, Math.max(1, count))) {
    case 1:
      return { diameter: 232, pitch: 0, font: 62, labelWidth: 300, width: 232 + 28 + 300 };
    case 2:
      return { diameter: 244, pitch: 224, font: 36, labelWidth: 216, width: 2 * 224 };
    case 3:
      return { diameter: 214, pitch: 196, font: 32, labelWidth: 192, width: 3 * 196 };
    default:
      return { diameter: 172, pitch: 156, font: 28, labelWidth: 160, width: 4 * 156 };
  }
}

/** Smallest name size; below this a longer name is cut with an ellipsis instead. */
const MIN_LABEL_FONT = 22;

/**
 * Font size at which the longest word of `text` fits `maxWidth`, between `minFont` and
 * `maxFont`. Inter SemiBold is about 0.6em per character on average.
 */
export function fitFont(text: string, maxWidth: number, maxFont: number, minFont: number): number {
  const longest = Math.max(1, ...text.split(/\s+/).map((word) => Array.from(word).length));
  return Math.max(minFont, Math.min(maxFont, Math.floor(maxWidth / (longest * 0.6))));
}

export interface PosterSlot {
  width: number;
  height: number;
  /** Distance from the previous poster's left edge. */
  pitch: number;
  /** Degrees. */
  rotate: number;
  /** Vertical nudge in px, alternating so the posters look dealt rather than lined up. */
  dy: number;
}

const DEALT: Record<number, { rotate: number; dy: number }[]> = {
  1: [{ rotate: 3, dy: 0 }],
  2: [
    { rotate: -4, dy: 10 },
    { rotate: 4, dy: -10 },
  ],
  3: [
    { rotate: -6, dy: 14 },
    { rotate: 0, dy: -10 },
    { rotate: 6, dy: 14 },
  ],
  4: [
    { rotate: -7, dy: 18 },
    { rotate: -2.5, dy: -14 },
    { rotate: 2.5, dy: 14 },
    { rotate: 7, dy: -12 },
  ],
};

const POSTER_MAX_WIDTH: Record<number, number> = { 1: 224, 2: 212, 3: 200, 4: 190 };
/** Where the next poster starts, as a share of a poster's width: it covers the other 34%, so titles stay readable. */
const POSTER_PITCH = 0.66;

/**
 * How the `count` (0 to 4) posters sit in a fan that has `available` px of width: as large as
 * fits (up to a cap), 2:3 posters, each overlapping the previous one.
 */
export function posterSlots(available: number, count: number): PosterSlot[] {
  const k = Math.min(MAX_OG_POSTERS, Math.max(0, count));
  if (k === 0) return [];
  const room = Math.max(0, available - TILT_ALLOWANCE);
  const width = Math.floor(Math.min(POSTER_MAX_WIDTH[k], room / (1 + (k - 1) * POSTER_PITCH)));
  return DEALT[k].map((deal, i) => ({
    width,
    height: Math.round(width * 1.5),
    pitch: i === 0 ? 0 : Math.round(width * POSTER_PITCH),
    ...deal,
  }));
}

/** Width left for the poster fan next to the people block. */
export function fanWidth(peopleCount: number): number {
  return OG_CONTENT_WIDTH - peopleLayout(peopleCount).width - BLOCK_GAP;
}

const filmsWord = (count: number) => (count === 1 ? "film" : "films");

/** "1995-2024" from the first film to the latest one already released (`today` is yyyy-mm-dd); one year alone when they match. */
export function careerSpan(films: readonly Pick<Film, "year" | "releaseDate">[], today: string): string | null {
  if (films.length === 0) return null;
  const released = films.filter((film) => film.releaseDate <= today);
  const first = Math.min(...films.map((film) => film.year));
  const latest = Math.max(...(released.length > 0 ? released : films).map((film) => film.year));
  return first >= latest ? String(first) : `${first}–${latest}`;
}

/**
 * Decides what the preview card for a /p/ page shows; the route only draws it. `today` is
 * yyyy-mm-dd and keeps films that have not been released yet out of a career's end year.
 */
export function buildOgCard(timelines: PersonTimeline[], today: string): OgCard {
  const people = timelines.map((t) => ({ id: t.person.id, name: t.person.name }));
  const labelMax = LABEL_MAX_CHARS[Math.min(4, Math.max(1, people.length))];
  const layout = peopleLayout(people.length);
  const labels = headingNames(people);
  const shown = labels.map((label) => truncateName(label, labelMax));
  // One size for the whole row: the largest at which every name fits, so the names look alike.
  const fontSize = Math.min(layout.font, ...shown.map((label) => fitFont(label, layout.labelWidth, layout.font, MIN_LABEL_FONT)));
  const ogPeople: OgPerson[] = timelines.map(({ person }, i) => ({
    name: person.name,
    label: shown[i],
    fontSize,
    initials: initials(person.name),
    profilePath: person.profilePath,
  }));

  if (timelines.length === 1) {
    const films = timelines[0].films.filter((film) => !film.minor);
    const span = careerSpan(films, today);
    return {
      kind: "solo",
      people: ogPeople,
      posters: pickPosters(films),
      headline: { figure: null, text: span ?? "Filmography" },
      subline: films.length > 0 ? `${films.length} ${filmsWord(films.length)} on a timeline` : null,
    };
  }

  const shared = sharedFilms(timelines, { includeMinor: false });
  const votes = new Map<number, number>();
  for (const { films } of timelines) {
    for (const film of films) votes.set(film.id, Math.max(votes.get(film.id) ?? 0, film.voteCount));
  }
  const posters = pickPosters(shared.map((film) => ({ ...film, voteCount: votes.get(film.id) ?? 0 })));

  return {
    kind: "pair",
    people: ogPeople,
    posters,
    headline:
      shared.length > 0
        ? { figure: String(shared.length), text: `${filmsWord(shared.length)} together` }
        : { figure: null, text: "Careers side by side" },
    subline: null,
  };
}
