import { test as base, expect, type Locator, type Page } from "next/experimental/testmode/playwright";
import type { RawCastCredit, RawPerson } from "../../src/lib/tmdb-types";

export const PEOPLE_PATH = "/p/90000001-scroll-alpha+90000002-scroll-beta";

const movie = (id: number, date: string, votes = 100): RawCastCredit => ({
  id,
  title: `Scroll Film ${id}`,
  release_date: date,
  poster_path: `/poster-${id}.png`,
  vote_count: votes,
  order: 0,
  character: "Lead",
});

/** A cameo (the character is "Himself"): the film is minor for the person, so it shows only with "Include minor credits" on. */
const cameo = (id: number, date: string): RawCastCredit => ({ ...movie(id, date, 9000), title: `Scroll Cameo ${id}`, character: "Himself" });

/**
 * Minor credits (see `cameo`): three each of the people's own, at ids 1100 and 2100 + index, and one both have, 300. Well-voted, so
 * that it is what "minor" does, not the film's votes, that makes the Depth view draw them faint and far back.
 */
export const MINOR_FILM_COUNT = 7;
const minorOf = (offset: number) => [cameo(offset, "1992-03-01"), cameo(offset + 1, "1996-03-01"), cameo(offset + 2, "2003-03-01")];
const sharedCameo = cameo(300, "2010-03-01");

// Shared films need at least four poster rows even with the default row cap, so a short
// viewport genuinely overflows. Period fitting/zooming changes the number of packed rows.
const shared = [
  ...Array.from({ length: 8 }, (_, index) => movie(
    100 + index,
    `${2000 + Math.floor(index / 4)}-${String((index % 4) * 3 + 1).padStart(2, "0")}-01`,
  )),
  movie(200, "2020-06-01"),
];

/**
 * Votes of each person's own films by index (a film's id is the person's offset + index, its year 1990 + index): the first is
 * the best-known of the page (the Depth view's obscurity 0, a poster at rest at 0.8 opacity), the one with none is the most
 * obscure (obscurity 1, 0.45), and the rest fall in between. Both people's lists are alike, so the page's best-known film is a tie.
 */
export const OWN_FILM_VOTES = [12_000, 5200, 2400, 1100, 560, 300, 150, 80, 40, 20, 9, 4, 2, 1, 0, 700];

const people: Record<string, RawPerson> = {
  "90000001": { id: 90000001, name: "Scroll Alpha", profile_path: null, birthday: "1960-01-01", biography: "An actor whose filmography exercises the timeline's scroll transitions." },
  "90000002": { id: 90000002, name: "Scroll Beta", profile_path: null, birthday: "1962-01-01", biography: "Another actor whose filmography shares a cluster of closely released films." },
  // Not on the default page: the one a test adds from the people pill's search.
  "90000003": { id: 90000003, name: "Scroll Gamma", profile_path: null, birthday: "1964-01-01", biography: "A third actor, for the tests that add someone to the page." },
};

/** A 1x1 PNG: every poster request is answered with it, so the browser tests need no network and still load images. */
const PIXEL = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

export const test = base.extend({
  page: async ({ page }, provide) => {
    await page.route("https://image.tmdb.org/**", (route) => route.fulfill({ contentType: "image/png", body: PIXEL }));
    await provide(page);
  },
  next: async ({ next }, provide) => {
    next.onFetch((request) => {
      const url = new URL(request.url);
      if (url.hostname !== "api.themoviedb.org") return "abort";
      const match = url.pathname.match(/^\/3\/person\/(\d+)(\/movie_credits)?$/);
      if (match && people[match[1]]) {
        if (!match[2]) return Response.json(people[match[1]]);
        const offset = { "90000001": 1000, "90000002": 2000, "90000003": 3000 }[match[1]]!;
        return Response.json({
          cast: [
            ...shared,
            ...minorOf(offset + 100),
            ...(match[1] === "90000003" ? [] : [sharedCameo]),
            ...Array.from({ length: 16 }, (_, index) => movie(offset + index, `${1990 + index}-06-01`, OWN_FILM_VOTES[index])),
          ],
          crew: [],
        });
      }
      if (url.pathname === "/3/discover/movie") return Response.json({ total_pages: 1, results: [] });
      // Any accidentally introduced outbound API call must fail rather than use a real token.
      return "abort";
    });
    await provide(next);
  },
});

export { expect };

export const timeline = (page: Page) => page.getByRole("region", { name: "Film timeline. Scroll sideways to see more years.", exact: true });

/** Wait for hydration via a real state transition, not a sleep or private React fields. */
export async function openPeople(page: Page, search = "") {
  await page.goto(`${PEOPLE_PATH}${search}`);
  const layout = page.getByRole("button", { name: "Combined timeline", exact: true });
  await expect(layout).toHaveAttribute("aria-pressed", "true");
  const gear = page.getByRole("button", { name: "Film settings", exact: true });
  await gear.click();
  await expect(page.getByRole("dialog", { name: "Film settings", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
}

export async function scrollState(track: Locator) {
  return track.evaluate((element) => {
    const corner = element.firstElementChild!.lastElementChild!.firstElementChild as HTMLElement;
    return {
      top: element.scrollTop,
      max: element.scrollHeight - element.clientHeight,
      inset: corner.offsetWidth,
      // The scale and axis range do not change when the panel undocks: this track coordinate
      // therefore identifies the same centred year without reaching into component state.
      centre: element.scrollLeft + (element.clientWidth - corner.offsetWidth) / 2,
    };
  });
}
