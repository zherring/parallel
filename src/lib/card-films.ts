import { isReleased } from "@/lib/released";
import { sharedFilms } from "@/lib/shared";
import type { Film, PersonTimeline } from "@/lib/types";

/** What the preview card needs to know of a film. */
export interface CardFilm {
  id: number;
  title: string;
  year: number;
  /** ISO yyyy-mm-dd */
  releaseDate: string;
  posterPath: string | null;
  voteCount: number;
}

export interface CardFilms {
  films: CardFilm[];
  /** "shared": the films every person made; "career": the films of the people's careers, when they share none (and for one person). */
  source: "shared" | "career";
}

const asCardFilm = ({ id, title, year, releaseDate, posterPath, voteCount }: Film, votes = voteCount): CardFilm => ({
  id,
  title,
  year,
  releaseDate,
  posterPath,
  voteCount: votes,
});

/**
 * The films of everyone's careers, one entry per film (the card's grey dots, see `og-card`): those already out (all of them when none
 * is), without minor ones (shorts, cameos, thanks) unless that leaves nothing. A film's votes are
 * the most any person's entry for it has.
 */
export function careerFilms(timelines: PersonTimeline[], today: string): CardFilm[] {
  const merged = new Map<number, { film: Film; minor: boolean; votes: number }>();
  for (const { films } of timelines) {
    for (const film of films) {
      const seen = merged.get(film.id);
      merged.set(film.id, {
        film: seen?.film ?? film,
        minor: (seen?.minor ?? true) && film.minor,
        votes: Math.max(seen?.votes ?? 0, film.voteCount),
      });
    }
  }
  const all = [...merged.values()];
  const out = all.filter(({ film }) => isReleased(film.releaseDate, today));
  const base = out.length > 0 ? out : all;
  const plain = base.filter(({ minor }) => !minor);
  return (plain.length > 0 ? plain : base).map(({ film, votes }) => asCardFilm(film, votes));
}

/**
 * The films a /p/ page's preview card is about, and so the films a shared period is cut from:
 * for two or more people the films they all made together (released, non-minor credits, as the
 * page counts them), for one person, or when they share none, the films of their careers.
 */
export function cardFilms(timelines: PersonTimeline[], today: string): CardFilms {
  if (timelines.length > 1) {
    const shared = sharedFilms(timelines, { includeMinor: false, today });
    if (shared.length > 0) {
      const votes = new Map<number, number>();
      for (const { films } of timelines) {
        for (const film of films) votes.set(film.id, Math.max(votes.get(film.id) ?? 0, film.voteCount));
      }
      const films = shared.map(
        ({ id, title, year, releaseDate, posterPath }): CardFilm => ({
          id,
          title,
          year,
          releaseDate,
          posterPath,
          voteCount: votes.get(id) ?? 0,
        }),
      );
      return { films, source: "shared" };
    }
  }
  return { films: careerFilms(timelines, today), source: "career" };
}
