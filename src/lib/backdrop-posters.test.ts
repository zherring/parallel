import { describe, expect, it } from "vitest";
import {
  BACKDROP_POSTERS,
  CORE_POSTERS,
  EXTENSION_COLUMNS,
  EXTENSION_POSTERS,
  MAX_PER_COLLECTION,
  MONTAGE_ROWS,
  NEIGHBOURS,
  WIDEST_SCREEN,
  arrangeBackdrop,
  extensionColumnsFor,
  firstTouching,
  rankFilms,
  selectFilms,
  type BackdropFilm,
} from "@/lib/backdrop-posters";
import { MONTAGE_POSTERS } from "@/lib/portrait-treatment";

/** A film with a poster at `/p<id>.jpg`, in `collection` (null for a standalone film). */
const film = (id: number, votes: number, collection: number | null = null): BackdropFilm => ({ id, poster: `/p${id}.jpg`, votes, collection });

/** Films with decreasing votes: `groups` is the collection of each (a number, or null), the first the best known. */
const films = (groups: (number | null)[]): BackdropFilm[] => groups.map((collection, index) => film(index + 1, 10_000 - index * 10, collection));

/** The collection (or the film, when it has none) of each poster of a list, to hold the collection rules to the posters alone. */
const groupsOf = (list: readonly BackdropFilm[]) => new Map(list.map((entry) => [entry.poster, entry.collection === null ? `film-${entry.id}` : `collection-${entry.collection}`]));

const count = <T>(items: readonly T[]) => items.reduce((counts, item) => counts.set(item, (counts.get(item) ?? 0) + 1), new Map<T, number>());

describe("the montage's size", () => {
  it("is three rows, a core of nine and an extension that reaches the widest screen: what the stage's CSS needs there is `EXTENSION_COLUMNS` columns", () => {
    expect(MONTAGE_ROWS).toBe(3);
    expect(CORE_POSTERS).toBe(9);
    expect(CORE_POSTERS).toBe(MONTAGE_POSTERS);
    expect(extensionColumnsFor(WIDEST_SCREEN)).toBe(EXTENSION_COLUMNS);
    expect(EXTENSION_POSTERS).toBe(EXTENSION_COLUMNS * MONTAGE_ROWS);
    expect(BACKDROP_POSTERS).toBe(CORE_POSTERS + EXTENSION_POSTERS);
  });

  it("needs one extension column on a laptop and a phone, two at 1920, three at 2560, and at no width up to the widest more than it draws (nor fewer at the widest: none is wasted)", () => {
    for (const width of [320, 390, 640, 768, 1024, 1280, 1440, 1600]) expect(extensionColumnsFor(width), `${width}px`).toBe(1);
    expect(extensionColumnsFor(1920)).toBe(2);
    expect(extensionColumnsFor(2560)).toBe(3);
    expect(extensionColumnsFor(3840)).toBe(6);
    const needed = Array.from({ length: WIDEST_SCREEN - 319 }, (_, index) => extensionColumnsFor(320 + index));
    expect(Math.max(...needed)).toBe(EXTENSION_COLUMNS);
  });
});

describe("rankFilms", () => {
  it("orders by votes, the id breaking a tie, and drops a film with no poster and a film or poster it already has", () => {
    const ranked = rankFilms([film(3, 10), film(1, 10), { ...film(4, 500), poster: "" }, film(2, 90), film(1, 5), { ...film(5, 1), poster: "/p2.jpg" }]);
    expect(ranked.map((entry) => entry.id)).toEqual([2, 1, 3]);
  });
});

describe("selectFilms", () => {
  it("takes the best-known film of each collection first, then the second film of each, never a third", () => {
    // Collection 7 has five films, the best-known of everything; 8 has three; four standalone films.
    const list = [film(1, 900, 7), film(2, 800, 7), film(3, 700, 7), film(4, 650, 8), film(5, 600, 8), film(6, 500, 8), film(7, 400), film(8, 300), film(9, 200), film(10, 100)];
    const chosen = selectFilms(list, 99);
    // The firsts in vote order (7, 8, the four standalone), then the seconds (7's, 8's).
    expect(chosen.map((entry) => entry.id)).toEqual([1, 4, 7, 8, 9, 10, 2, 5]);
    const perCollection = count(chosen.filter((entry) => entry.collection !== null).map((entry) => entry.collection));
    expect(Math.max(...perCollection.values())).toBe(MAX_PER_COLLECTION);
  });

  it("leaves a collection's second film out while the person has enough other films to fill the list", () => {
    const list = [film(1, 900, 7), film(2, 890, 7), ...Array.from({ length: 12 }, (_, index) => film(10 + index, 500 - index))];
    const chosen = selectFilms(list, 9);
    expect(chosen).toHaveLength(9);
    expect(chosen.map((entry) => entry.id)).toEqual([1, 10, 11, 12, 13, 14, 15, 16, 17]);
    // With room for more than the other films fill, the second is in.
    expect(selectFilms(list, 99).map((entry) => entry.id).slice(-1)).toEqual([2]);
  });

  it("keeps the nine best-known films of different collections as the core, in vote order", () => {
    const list = films([1, 1, 2, 2, 3, null, null, 4, 5, 6, 6, 7, null, 8, 9]);
    const core = selectFilms(list, 99).slice(0, CORE_POSTERS);
    expect(core.map((entry) => entry.id)).toEqual([1, 3, 5, 6, 7, 8, 9, 10, 12]);
    expect(new Set(core.map((entry) => entry.collection ?? `alone-${entry.id}`)).size).toBe(CORE_POSTERS);
  });
});

describe("arrangeBackdrop", () => {
  /** A person with four films in each of six franchises and sixteen standalone films, the franchises' being the best known (a Spider-Man's). */
  const prolific = () => {
    const list: BackdropFilm[] = [];
    for (let franchise = 1; franchise <= 6; franchise++) for (let n = 0; n < 4; n++) list.push(film(franchise * 100 + n, 9000 - franchise * 100 - n * 10, franchise));
    for (let n = 0; n < 16; n++) list.push(film(1000 + n, 3000 - n * 50));
    return list;
  };

  it("fills every cell with a different poster when the person has enough films, and no collection more than twice", () => {
    const list = prolific();
    const { posters, distinct, relaxed } = arrangeBackdrop(list);
    expect(posters).toHaveLength(BACKDROP_POSTERS);
    expect(distinct).toBe(BACKDROP_POSTERS);
    expect(new Set(posters).size).toBe(BACKDROP_POSTERS);
    expect(relaxed).toBe("none");
    const groups = groupsOf(list);
    for (const [group, n] of count(posters.map((poster) => groups.get(poster)!))) {
      if (group.startsWith("collection-")) expect(n, group).toBeLessThanOrEqual(MAX_PER_COLLECTION);
    }
  });

  it("never puts the same poster or two films of one collection on touching tiles, side by side, above and below, or diagonally, in the left half or the right", () => {
    const list = prolific();
    const groups = groupsOf(list);
    const { posters } = arrangeBackdrop(list);
    expect(firstTouching(posters)).toBeNull();
    expect(firstTouching(posters, (a, b) => groups.get(a) === groups.get(b))).toBeNull();
    // The cells the rule checks: the core's own (a tile and the ones before it that touch it), and the extension's first column with both outer columns of the core, as it is on the left of it in one half and on the right in the other.
    expect(NEIGHBOURS[1]).toEqual([0]);
    expect([...NEIGHBOURS[4]].sort()).toEqual([0, 1, 2, 3]);
    expect([...NEIGHBOURS[CORE_POSTERS]].sort()).toEqual([0, 2, 3, 5]);
  });

  it("shows the nine best-known films of different collections in the core, in order, and the rest of the best-known nearest the core", () => {
    const list = prolific();
    const { posters } = arrangeBackdrop(list);
    // The six franchises' first films, then the best three standalone films.
    expect(posters.slice(0, CORE_POSTERS)).toEqual(["/p100.jpg", "/p200.jpg", "/p300.jpg", "/p400.jpg", "/p500.jpg", "/p600.jpg", "/p1000.jpg", "/p1001.jpg", "/p1002.jpg"]);
    // The extension's first column is the next best known standalone films.
    expect(posters.slice(CORE_POSTERS, CORE_POSTERS + 3)).toEqual(["/p1003.jpg", "/p1004.jpg", "/p1005.jpg"]);
  });

  it("keeps a Spider-Man-heavy filmography to two Spider-Mans, apart", () => {
    const list = [...Array.from({ length: 8 }, (_, index) => film(index + 1, 9000 - index * 10, 556)), ...Array.from({ length: 24 }, (_, index) => film(100 + index, 4000 - index * 20, index % 8 === 0 ? 77 : null))];
    const { posters, relaxed } = arrangeBackdrop(list);
    const groups = groupsOf(list);
    expect(relaxed).toBe("none");
    expect(posters.filter((poster) => groups.get(poster) === "collection-556")).toHaveLength(MAX_PER_COLLECTION);
    expect(firstTouching(posters, (a, b) => groups.get(a) === groups.get(b))).toBeNull();
  });

  it("repeats only when the person has fewer films than cells, uses every film, and never next to itself", () => {
    const list = films([1, 2, 3, null, null, null, null, null, null, null, null, null, null]);
    const { posters, distinct, relaxed } = arrangeBackdrop(list);
    expect(distinct).toBe(13);
    expect(new Set(posters)).toEqual(new Set(list.map((entry) => entry.poster)));
    expect(posters).toHaveLength(BACKDROP_POSTERS);
    expect(relaxed).toBe("none");
    expect(firstTouching(posters)).toBeNull();
    // The core is the person's best-known films, none repeated yet.
    expect(new Set(posters.slice(0, CORE_POSTERS)).size).toBe(CORE_POSTERS);
    // A repeat is a long way from the other copy: no copy within two columns.
    const groups = groupsOf(list);
    expect(firstTouching(posters, (a, b) => groups.get(a) === groups.get(b))).toBeNull();
  });

  it("still keeps like posters off touching tiles for a person with five films, and keeps what it can for fewer: the posters first, collections after", () => {
    const five = arrangeBackdrop(films([null, null, null, null, null]));
    expect(five.relaxed).toBe("none");
    expect(five.distinct).toBe(5);
    expect(firstTouching(five.posters)).toBeNull();

    // Four films, two of them one collection: no arrangement keeps the collection apart on every tile, the posters are still kept apart.
    const fourAlike = arrangeBackdrop(films([1, 1, null, null]));
    expect(fourAlike.distinct).toBe(4);
    expect(firstTouching(fourAlike.posters)).toBeNull();

    // Two or three films cannot be kept apart in a grid where every tile has eight neighbours: the list is still whole.
    for (const group of [[null, null, null], [null, null], [null]]) {
      const few = arrangeBackdrop(films(group));
      expect(few.posters).toHaveLength(BACKDROP_POSTERS);
      expect(new Set(few.posters).size).toBe(group.length);
      expect(few.relaxed).toBe("posters");
    }
  });

  it("is a list of nothing for a person with no film with a poster", () => {
    expect(arrangeBackdrop([])).toEqual({ posters: [], distinct: 0, relaxed: "none" });
    expect(arrangeBackdrop([{ ...film(1, 100), poster: "" }]).posters).toEqual([]);
  });

  it("is the same list whatever the order the films come in", () => {
    const list = prolific();
    const reversed = [...list].reverse();
    expect(arrangeBackdrop(reversed)).toEqual(arrangeBackdrop(list));
  });
});
