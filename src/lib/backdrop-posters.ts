/**
 * The poster montage behind a person on the landing hero (hero-parts.tsx `PanelParts`) and behind a cut on the cards and the pair pages (`TreatedPortrait`): which of the
 * person's films' posters it draws, and where. Pure, with no data in it: `npm run portraits:cut -- --posters` (scripts/portraits/posters.ts) reads TMDB, runs these rules and
 * stores the result (`posters` in portrait-cuts.json for the 3 x 3 core, portrait-backdrops.json for the columns past it); the tests hold them to the rules.
 *
 * The grid of a half: three rows, a core of three columns (the 3 x 3 tile a card's montage is, inset from the screen's edge) and, out to the screen's edge, more columns
 * of the same width on the outer side. A half is the left one (the columns go left of the core) or the right one (right of it), and a person can be in either, so the
 * arrangement has to hold on both.
 */

import { corePadAt, seamAt } from "@/lib/stage-geometry";

/** The montage's rows, the same at every width: a tile is a third of the half's height. */
export const MONTAGE_ROWS = 3;
/** The core's columns: its 3 x 3 tile is what a card shows behind a cut. */
export const CORE_COLUMNS = 3;
/** The core's cells, row by row: the posters the cards and the pair pages draw (`MONTAGE_POSTERS`). */
export const CORE_POSTERS = CORE_COLUMNS * MONTAGE_ROWS;

/**
 * The widest screen the montage fills (a 4K display at 100%): past it the outer edge of the half shows its dark base, not another poster. Widths between the ones a
 * browser test measures follow from `extensionColumnsFor`.
 */
export const WIDEST_SCREEN = 3840;
/** The columns the extension draws past the core: what `extensionColumnsFor` gives at `WIDEST_SCREEN` (a test holds the two together). */
export const EXTENSION_COLUMNS = 6;
/** The extension's cells, column by column from the core outward, each column top to bottom. */
export const EXTENSION_POSTERS = EXTENSION_COLUMNS * MONTAGE_ROWS;
/** Every cell of a half's montage: the number of posters a person needs for it to repeat none. */
export const BACKDROP_POSTERS = CORE_POSTERS + EXTENSION_POSTERS;

/**
 * The most posters of one collection (a franchise, as TMDB groups films: `belongs_to_collection`) a person's list has. The first poster of a collection is its best-known
 * film (the most votes); the second comes only after every collection's first and the standalone films have had their turn, so a person with enough other films shows
 * a franchise once, and one with fewer shows it twice at most.
 */
export const MAX_PER_COLLECTION = 2;

/** How many more films than the montage has cells the arrangement may choose among: room to leave out a poster that cannot sit anywhere left. */
const ARRANGEMENT_SPARES = 9;

/** How many placements a search tries before it gives up and the next, looser, rule is tried. */
const SEARCH_LIMIT = 400_000;

/** A film of the person's, as the montage sees it. */
export interface BackdropFilm {
  id: number;
  /** TMDB poster path. */
  poster: string;
  votes: number;
  /** TMDB's `belongs_to_collection` id, or null for a film in none. */
  collection: number | null;
}

/** What makes two films kin: their collection, else only themselves. */
const groupOf = (film: BackdropFilm): string => (film.collection === null ? `film-${film.id}` : `collection-${film.collection}`);

/** The films with a poster, most-voted first (the id breaks a tie, so the pick is the same on every run), each film and each poster once. */
export function rankFilms(films: readonly BackdropFilm[]): BackdropFilm[] {
  const ids = new Set<number>();
  const posters = new Set<string>();
  return films
    .filter((film) => film.poster)
    .sort((a, b) => b.votes - a.votes || a.id - b.id)
    .filter((film) => {
      if (ids.has(film.id) || posters.has(film.poster)) return false;
      ids.add(film.id);
      posters.add(film.poster);
      return true;
    });
}

/**
 * The films the montage draws, best first, at most `limit` of them and at most `MAX_PER_COLLECTION` of one collection: first the best-known film of each collection (and
 * every standalone film), then, only if `limit` is not reached, the second film of each collection, in the same order. So the first nine (the core) are nine different
 * collections whenever the person has that many, and a franchise's second film is in the list only when the person has fewer than `limit` other films.
 */
export function selectFilms(films: readonly BackdropFilm[], limit: number = BACKDROP_POSTERS): BackdropFilm[] {
  const seen = new Map<string, number>();
  const turns = rankFilms(films).map((film) => {
    const group = groupOf(film);
    const turn = seen.get(group) ?? 0;
    seen.set(group, turn + 1);
    return { film, turn };
  });
  const chosen: BackdropFilm[] = [];
  for (let round = 0; round < MAX_PER_COLLECTION; round++) {
    for (const { film, turn } of turns) if (turn === round && chosen.length < limit) chosen.push(film);
  }
  return chosen;
}

/** A tile's place in a half's grid: its row, and its column in the half's own coordinates (the core is 0 to 2, the extension past it on the outer side). */
interface Cell {
  row: number;
  column: number;
}

/**
 * The cells of a half in the order a list is stored: the core's nine row by row, then the extension, column by column from the core outward, each top to bottom. In the
 * left half (`slot` 0) the extension is at negative columns, to the left of the core; in the right half (`slot` 1) it is at columns 3 and on.
 */
function cellsOf(slot: 0 | 1): Cell[] {
  return Array.from({ length: BACKDROP_POSTERS }, (_, index): Cell => {
    if (index < CORE_POSTERS) return { row: Math.floor(index / CORE_COLUMNS), column: index % CORE_COLUMNS };
    const at = index - CORE_POSTERS;
    const out = Math.floor(at / MONTAGE_ROWS);
    return { row: at % MONTAGE_ROWS, column: slot === 1 ? CORE_COLUMNS + out : -1 - out };
  });
}

const touching = (a: Cell, b: Cell) => Math.abs(a.row - b.row) <= 1 && Math.abs(a.column - b.column) <= 1;

/**
 * For each cell of the list (`cellsOf`), the earlier cells it touches (side or corner) in the left half or in the right. The same person can stand in either, so a list is
 * arranged for both at once.
 */
export const NEIGHBOURS: readonly (readonly number[])[] = (() => {
  const halves = [cellsOf(0), cellsOf(1)];
  return Array.from({ length: BACKDROP_POSTERS }, (_, index) => {
    const found = new Set<number>();
    for (const cells of halves) for (let earlier = 0; earlier < index; earlier++) if (touching(cells[earlier], cells[index])) found.add(earlier);
    return [...found];
  });
})();

/** How strictly the arrangement keeps like films apart: `none` is not relaxed at all (the rule), `collections` allowed films of one collection to touch, `posters` the same poster too. */
export type Relaxation = "none" | "collections" | "posters";

export interface Arrangement {
  /** `BACKDROP_POSTERS` poster paths in the order of `cellsOf` (the first `CORE_POSTERS` are the core), empty when there are no films. */
  posters: string[];
  /** How many different posters the list has: `BACKDROP_POSTERS` unless the person has fewer films to show. */
  distinct: number;
  relaxed: Relaxation;
}

/**
 * Searches an arrangement of `pool` over the cells: the best-known films first (the pool's order) in the first cells, and no two touching cells holding films `conflict`
 * says are kin. The pool's films are used once each, and used again only when the pool is smaller than the montage, and then the farthest from where they last were.
 * Null when there is none, or the search gives up.
 */
function search(pool: readonly BackdropFilm[], conflict: (a: BackdropFilm, b: BackdropFilm) => boolean): number[] | null {
  const cells = BACKDROP_POSTERS;
  const reuseBudget = Math.max(0, cells - pool.length);
  const chosen: number[] = new Array(cells).fill(-1);
  const uses: number[] = new Array(pool.length).fill(0);
  const lastAt: number[] = new Array(pool.length).fill(-1);
  let tried = 0;
  let unused = pool.length;

  const fits = (cell: number, film: number) => NEIGHBOURS[cell].every((earlier) => !conflict(pool[chosen[earlier]], pool[film]));

  const place = (cell: number, reuses: number): boolean => {
    if (cell === cells) return true;
    if (++tried > SEARCH_LIMIT) return false;
    // Every film is used before the cells run out, when the pool is no bigger than the montage.
    if (pool.length <= cells && unused > cells - cell) return false;
    const take = (film: number, reuse: boolean): boolean => {
      chosen[cell] = film;
      const lastBefore = lastAt[film];
      lastAt[film] = cell;
      uses[film]++;
      if (uses[film] === 1) unused--;
      if (place(cell + 1, reuses + (reuse ? 1 : 0))) return true;
      if (uses[film] === 1) unused++;
      uses[film]--;
      lastAt[film] = lastBefore;
      chosen[cell] = -1;
      return false;
    };
    for (let film = 0; film < pool.length; film++) if (uses[film] === 0 && fits(cell, film) && take(film, false)) return true;
    if (reuses < reuseBudget) {
      const again = pool.map((_, film) => film).filter((film) => uses[film] > 0).sort((a, b) => uses[a] - uses[b] || lastAt[a] - lastAt[b] || a - b);
      for (const film of again) if (fits(cell, film) && take(film, true)) return true;
    }
    return false;
  };

  return place(0, 0) ? chosen : null;
}

/**
 * Arranges a person's films over a half's cells: the best-known films nearest the core (the core is the nine best-known of different collections, when the person has that
 * many), no poster and no collection on two touching tiles in either half, and a poster repeated only when the person has fewer films than cells, and then far from itself.
 * When no arrangement keeps every collection apart, collections may touch (never a poster) and `relaxed` says so; when even that is impossible (a person with two or three
 * films), nothing is kept apart. Pure and deterministic.
 */
export function arrangeBackdrop(films: readonly BackdropFilm[]): Arrangement {
  const pool = selectFilms(films, BACKDROP_POSTERS + ARRANGEMENT_SPARES);
  if (pool.length === 0) return { posters: [], distinct: 0, relaxed: "none" };
  const rules: [Relaxation, (a: BackdropFilm, b: BackdropFilm) => boolean][] = [
    ["none", (a, b) => a.poster === b.poster || groupOf(a) === groupOf(b)],
    ["collections", (a, b) => a.poster === b.poster],
    ["posters", () => false],
  ];
  for (const [relaxed, conflict] of rules) {
    const chosen = search(pool, conflict);
    if (chosen) {
      const posters = chosen.map((film) => pool[film].poster);
      return { posters, distinct: new Set(posters).size, relaxed };
    }
  }
  // Unreachable: with no rule at all the search always places. Kept so a future rule that can fail still leaves a list.
  const posters = Array.from({ length: BACKDROP_POSTERS }, (_, cell) => pool[cell % pool.length].poster);
  return { posters, distinct: new Set(posters).size, relaxed: "posters" };
}

/** The screen's columns a half's extension needs at a screen `width` wide, from the stage's geometry (stage-geometry.ts: the gutter, the seam and `--core-pad` that the CSS is set from). */
export function extensionColumnsFor(width: number): number {
  const corePad = corePadAt(width);
  const core = width / 2 - seamAt(width) / 2 - corePad;
  // A width too small to have a core (or none given) is drawn whole.
  return core > 0 ? Math.ceil(corePad / (core / CORE_COLUMNS)) : EXTENSION_COLUMNS;
}

/** Whether any two touching cells of a list (`cellsOf`, in either half) are `like`: the first pair that is, or null. For the tests and the generator's report. */
export function firstTouching(posters: readonly string[], like: (a: string, b: string) => boolean = (a, b) => a === b): [number, number] | null {
  for (let cell = 0; cell < posters.length; cell++) {
    for (const earlier of NEIGHBOURS[cell] ?? []) if (like(posters[earlier], posters[cell])) return [earlier, cell];
  }
  return null;
}
