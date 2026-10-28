/** Shared bits of the film lists on the "films together" section: the TMDB page of a film and the link styles. */

export const tmdbMovieUrl = (id: number) => `https://www.themoviedb.org/movie/${id}`;

export const linkClass = "font-medium text-strong underline-offset-2 hover:underline";
export const detailsButtonClass = "rounded text-sm text-accent-blue underline-offset-2 hover:underline";
