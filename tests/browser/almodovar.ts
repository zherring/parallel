import { test as base, expect } from "next/experimental/testmode/playwright";

/**
 * Almodóvar and Cruz: a pair with Quotes (a pair without any has no Quotes section in the bar), with a dozen films in common so that the
 * pages are long enough to scroll. The fixtures of `fixtures.ts` (the Scroll people) have none, so the specs about the Quotes, and the ones
 * that look at the bar of a page that has them, use this.
 */
export const PAIR = "/p/309-pedro-almodovar+955-penelope-cruz";
export const NAMES = ["Pedro Almodóvar", "Penélope Cruz"];
export const FILM_COUNT = 12;
/** The page's h1: the names and the count, for screen readers (it is visually hidden). */
export const HEADLINE = `Pedro Almodóvar & Penélope Cruz, ${FILM_COUNT} films`;

const films = Array.from({ length: FILM_COUNT }, (_, index) => ({
  id: 100 + index,
  title: `Bar Film ${index + 1}`,
  release_date: `${2000 + index}-03-17`,
  poster_path: null,
  vote_count: 100,
  character: "Lead",
  order: 0,
}));

/**
 * The test with the pair's credits mocked. `own` is how many films each of the two has of their own besides the dozen in common (none by default):
 * with some there are layers behind the films made together in Focus, as on a real page.
 */
export function pairTest(own = 0) {
  const ownOf = (offset: number) =>
    Array.from({ length: own }, (_, index) => ({
      id: offset + index,
      title: `Own Film ${offset + index}`,
      release_date: `${1975 + index * 3}-06-01`,
      poster_path: null,
      vote_count: 4000 - index * 300,
      character: "Lead",
      order: 0,
    }));
  return base.extend({
    next: async ({ next }, provide) => {
      next.onFetch((request) => {
        const url = new URL(request.url);
        if (url.hostname !== "api.themoviedb.org") return "abort";
        const match = url.pathname.match(/^\/3\/person\/(309|955)(\/movie_credits)?$/);
        if (match) {
          if (!match[2]) {
            return Response.json({ id: Number(match[1]), name: NAMES[match[1] === "309" ? 0 : 1], profile_path: null, biography: "A biography." });
          }
          return Response.json({ cast: [...films, ...ownOf(match[1] === "309" ? 1000 : 2000)], crew: [] });
        }
        if (url.pathname === "/3/discover/movie") return Response.json({ total_pages: 1, results: [] });
        return "abort";
      });
      await provide(next);
    },
  });
}

export const test = pairTest();

export { expect };
