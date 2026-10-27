/** The subset of TMDB v3 response fields this app reads. */

export interface RawPerson {
  id: number;
  name: string;
  profile_path: string | null;
  known_for_department?: string | null;
  birthday?: string | null;
  deathday?: string | null;
}

export interface RawSearchPerson {
  id: number;
  name: string;
  profile_path: string | null;
  known_for_department?: string | null;
  known_for?: { title?: string; name?: string }[];
}

export interface RawSearchPeople {
  results: RawSearchPerson[];
}

interface RawCreditMovie {
  id: number;
  title: string;
  release_date?: string;
  poster_path: string | null;
  vote_count?: number;
  /** TMDB's "video" flag: music videos, video compilations and other non-theatrical extras. */
  video?: boolean;
}

export interface RawCastCredit extends RawCreditMovie {
  character?: string;
  order?: number;
}

export interface RawCrewCredit extends RawCreditMovie {
  job: string;
}

export interface RawMovieCredits {
  cast: RawCastCredit[];
  crew: RawCrewCredit[];
}

/** One page of `/discover/movie`; only the ids are read. */
export interface RawDiscoverMovies {
  total_pages?: number;
  results: { id: number }[];
}

interface RawFilmPerson {
  id: number;
  name: string;
  profile_path: string | null;
}

export interface RawMovieDetails {
  id: number;
  title: string;
  release_date?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  runtime?: number | null;
  tagline?: string | null;
  overview?: string | null;
  genres?: { name: string }[];
  credits?: {
    cast: (RawFilmPerson & { character?: string; order?: number })[];
    crew: (RawFilmPerson & { job: string })[];
  };
}
