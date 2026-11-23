// The film before and the film after the one whose details are open, for the panel's Previous and Next (and a swipe on a phone's sheet).

export interface SequenceFilm {
  id: number;
  /** ISO yyyy-mm-dd; an empty date sorts first. */
  releaseDate: string;
  /** The people of the page made it together. */
  shared: boolean;
}

export interface FilmNeighbours {
  prev: number | null;
  next: number | null;
}

export const NO_NEIGHBOURS: FilmNeighbours = { prev: null, next: null };

/**
 * The films either side of `id`, in release order (ties by id, so the order is stable). A film the people made together steps
 * through the films they made together, which is what a pair's page is about; any other film steps through every film the
 * view shows. A film listed twice (once per person) counts once, and is shared if any listing says so. Null at either end, and
 * both null for a film that is not listed.
 */
export function filmNeighbours(films: readonly SequenceFilm[], id: number | null): FilmNeighbours {
  if (id === null) return NO_NEIGHBOURS;
  const byId = new Map<number, SequenceFilm>();
  for (const film of films) {
    const seen = byId.get(film.id);
    if (!seen) byId.set(film.id, film);
    else if (film.shared && !seen.shared) byId.set(film.id, { ...seen, shared: true });
  }
  const current = byId.get(id);
  if (!current) return NO_NEIGHBOURS;
  const order = [...byId.values()]
    .filter((film) => !current.shared || film.shared)
    .sort((a, b) => a.releaseDate.localeCompare(b.releaseDate) || a.id - b.id);
  const index = order.findIndex((film) => film.id === id);
  return { prev: order[index - 1]?.id ?? null, next: order[index + 1]?.id ?? null };
}
