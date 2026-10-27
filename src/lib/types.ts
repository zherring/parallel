export type RoleKey =
  | "actor"
  | "director"
  | "writer"
  | "cinematographer"
  | "editor"
  | "composer"
  | "producer"
  | "production-designer"
  | "costume-designer"
  | "other";

export interface PersonSummary {
  id: number;
  name: string;
  profilePath: string | null;
  /** TMDB's known_for_department, e.g. "Directing" or "Acting". */
  knownFor: string | null;
  birthday: string | null;
  deathday: string | null;
}

export interface Credit {
  role: RoleKey;
  job: string;
  character?: string;
  order?: number;
  minor: boolean;
}

export interface Film {
  id: number;
  title: string;
  /** ISO yyyy-mm-dd */
  releaseDate: string;
  year: number;
  posterPath: string | null;
  /** Merged: one Film per movie id per person. */
  credits: Credit[];
  /** True only if every credit is minor. */
  minor: boolean;
}

export interface PersonTimeline {
  person: PersonSummary;
  /** Sorted by releaseDate ascending. */
  films: Film[];
}

export interface FilmPerson {
  id: number;
  name: string;
  profilePath: string | null;
  job: string;
  role: RoleKey;
  character?: string;
  order?: number;
}

export interface FilmDetails {
  id: number;
  title: string;
  year: number | null;
  releaseDate: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  runtime: number | null;
  tagline: string | null;
  overview: string | null;
  genres: string[];
  /** By billing order. */
  cast: FilmPerson[];
  /** Key roles first, in ROLE_ORDER. */
  crew: FilmPerson[];
}

export interface SharedFilm {
  id: number;
  title: string;
  year: number;
  releaseDate: string;
  posterPath: string | null;
  byPerson: Record<number, Credit[]>;
}
