import type { AwardsSummary } from "@/lib/awards";

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
  /**
   * TMDB's community-written biography (often derived from Wikipedia): `\n` line endings,
   * paragraphs separated by blank lines, capped at about 4000 characters. Null when TMDB has none.
   */
  biography: string | null;
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
  /** TMDB vote_count (0 when unknown); a cheap popularity signal for choosing which films get a poster card. */
  voteCount: number;
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

export interface PersonSearchResult {
  id: number;
  name: string;
  profilePath: string | null;
  /** TMDB's known_for_department. */
  knownFor: string | null;
  /** Up to three titles from TMDB's known_for list. */
  knownForTitles: string[];
}

/** One chip of the "Frequent collaborators" row (`/api/collaborators/{id}`). */
export interface CollaboratorSuggestion {
  id: number;
  name: string;
  profilePath: string | null;
  /** Released, non-minor films shared with the person: the "N films together" of their pair page. */
  sharedCount: number;
  /** The collaborator's roles on those films, as `roleSummary` words them: "Director, Writer". */
  roles: string;
  /** Up to three of the shared films, the most voted first. */
  titles: string[];
}

/**
 * What `/api/collaborators/{id}` returns. `source` says where the candidates came from: "graph"
 * is the precomputed collaborator graph, "live" a count over the person's best-known films.
 */
export interface CollaboratorSuggestions {
  source: "graph" | "live";
  results: CollaboratorSuggestion[];
}

/** The numbers TMDB holds for a film (`getMovieMetrics`). */
export interface MovieMetrics {
  /** TMDB's 0-10 audience score; null when it has none. */
  voteAverage: number | null;
  voteCount: number;
  /** US dollars; null when TMDB has none (it stores 0). */
  budget: number | null;
  /** Worldwide gross in US dollars; null when TMDB has none (it stores 0). */
  revenue: number | null;
  /** ISO yyyy-mm-dd; null when TMDB has none. */
  releaseDate: string | null;
}

/** What `/api/film-metrics/{id}` returns for the hover card: TMDB's numbers plus curated awards. */
export interface FilmMetrics extends MovieMetrics {
  awards: AwardsSummary | null;
}
