import { test as base, expect, type Locator, type Page } from "next/experimental/testmode/playwright";
import { pairQuotes } from "../../src/lib/quote-embed-data";
import type { RawCastCredit, RawPerson } from "../../src/lib/tmdb-types";
import type { PersonTimeline } from "../../src/lib/types";

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
export const PIXEL = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

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

/** The page bar, which every view of a `/p/` page has. */
export const bar = (page: Page) => page.locator("[data-people-bar]");

/** The three films views, as the bar's control names them (see `ViewSwitcher`): Films (the Depth view), Timeline and Table. */
export type FilmsViewName = "timeline" | "depth" | "table";
const SWITCHER_LABEL: Record<FilmsViewName, string> = { timeline: "Timeline", depth: "Films", table: "Table" };
/** The view control in the bar: Films | Timeline | Table, and Quotes as its fourth segment for a pair that has quotes (not on a phone's bar: its sheet has the same links, see `ViewSwitcher`). */
export const switcher = (page: Page) => bar(page).getByRole("navigation", { name: "Views", exact: true });
export const viewLink = (page: Page, view: FilmsViewName) => switcher(page).getByRole("link", { name: SWITCHER_LABEL[view], exact: true });
/** The control's Quotes segment (only for a pair that has quotes). */
export const quotesLink = (page: Page) => switcher(page).getByRole("link", { name: "Quotes", exact: true });
/** The Depth view's scene. */
export const scene = (page: Page) => page.getByRole("region", { name: "Film timeline. Scroll down for later years.", exact: true });

/** The pair hero's state, as the bar says it: "expanded" on arrival, "collapsed" once the view's main scroller has moved 48px or more from where it landed. */
export const heroState = (page: Page) => bar(page).getAttribute("data-hero");

/** The pair hero's body: the portraits, the note and the chips (in the bar's band on the Timeline and Films, in the page on the Table and the Quotes). */
export const heroBody = (page: Page) => page.locator("[data-hero-body]");

/**
 * The view's main scroller moves by `delta` px, the way the visitor moves it: the Films scene down, the Timeline's track sideways, the page (Table, Quotes) down. A Timeline
 * whose track has nothing to scroll in either direction (a short career on a wide screen) cannot move: the visitor presses on it instead, which also collapses the hero.
 */
export async function scrollView(page: Page, delta: number) {
  await page.evaluate((by) => {
    const scene = document.querySelector<HTMLElement>("[data-depth-scene]");
    const track = [...document.querySelectorAll<HTMLElement>('[aria-label^="Film timeline. Scroll sideways"]')].find((element) => element.getClientRects().length > 0);
    if (scene) scene.scrollTop += by;
    else if (track && track.scrollWidth <= track.clientWidth + 1 && track.scrollHeight <= track.clientHeight + 1) track.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    else if (track) track.scrollLeft += by;
    else window.scrollBy(0, by);
  }, delta);
}

/** Moves the view's main scroller (120px unless told otherwise), past the 48px that collapses the hero, and waits for the hero to have collapsed into the compact bar. */
export async function collapseHero(page: Page, by = 120) {
  await scrollView(page, by);
  await expect(bar(page)).toHaveAttribute("data-hero", "collapsed");
}

/** Wait for hydration via a real state transition, not a sleep or private React fields. */
export async function openPeople(page: Page, search = "") {
  await page.goto(`${PEOPLE_PATH}${search}`);
  const gear = page.getByRole("button", { name: "Settings", exact: true });
  await gear.click();
  await expect(page.getByRole("dialog", { name: "Settings", exact: true })).toBeVisible();
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

// ---- What the embeds' specs share (`embeds*.spec.ts`, and any spec of a page a post frames) ----------------------------------------------------------------------

/** Where a control is, in the frame's pixels. */
export async function boxOf(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("the control has no box");
  return box;
}

/** What is on top at the middle of the control is the control (or something inside it). */
export async function isOnTopAtCentre(page: Page, locator: Locator) {
  const box = await boxOf(locator);
  return locator.evaluate((node, [x, y]) => {
    const hit = document.elementFromPoint(x, y);
    return Boolean(hit) && node.contains(hit);
  }, [box.x + box.width / 2, box.y + box.height / 2]);
}

export const intersects = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** The size of a control's invisible hit area (its `::before`, which extends past its box), and of its box: what a finger has to hit, and what is drawn. */
export async function touchTarget(locator: Locator) {
  return locator.evaluate((node) => {
    const area = getComputedStyle(node, "::before");
    const box = node.getBoundingClientRect();
    return { width: box.width, height: box.height, areaWidth: Number.parseFloat(area.width), areaHeight: Number.parseFloat(area.height) };
  });
}

/** A frame of a phone's width (the controls are touch targets in it): at most 30rem. */
export const isPhoneWidth = (frame: { width: number }) => frame.width <= 480;

/** Every element of the page that is a vertical scroller (`overflow-y` auto or scroll) or has a vertical overflow that is not clipped, and the document itself. */
export async function verticalScrollers(page: Page) {
  return page.evaluate(() => {
    const found: { what: string; overflowY: string; scrollHeight: number; clientHeight: number }[] = [];
    for (const el of document.querySelectorAll("*")) {
      const { overflowY } = getComputedStyle(el);
      if (overflowY === "auto" || overflowY === "scroll") found.push({ what: `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)}`, overflowY, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight });
    }
    const root = document.scrollingElement ?? document.documentElement;
    found.push({ what: "document", overflowY: "document", scrollHeight: root.scrollHeight, clientHeight: root.clientHeight });
    return found;
  });
}

/** An average line of a quote, the last (which is a rest of it, as long as it is) left out: the characters a reader's eye takes in along a line. */
export const averageLine = (lines: readonly number[]) => {
  const body = lines.slice(0, -1);
  return body.reduce((sum, n) => sum + n, 0) / body.length;
};

/** The frames a pair's embed and a quote's are checked at: the panel X opens over a phone, an inline card on a desktop timeline, and a narrow desktop column. */
export const EMBED_FIT_FRAMES = [
  { width: 600, height: 315, what: "an inline card on a desktop timeline" },
  { width: 516, height: 271, what: "a narrow desktop column" },
  { width: 390, height: 253, what: "the panel X opens over a phone" },
] as const;

/** Frames taller than they are wide: the panel X opens over a phone when it is tall (70% of the screen), and the X preview page's mobile panel. */
export const EMBED_TALL_FRAMES = [
  { width: 383, height: 555, what: "a phone's panel (the report of the clipped footer)" },
  { width: 390, height: 591, what: "a phone's 70% panel" },
  { width: 435, height: 600, what: "the X preview page's mobile panel" },
] as const;

export const EMBED_PEOPLE = [
  { id: 488, name: "Steven Spielberg", slug: "488-steven-spielberg" },
  { id: 491, name: "John Williams", slug: "491-john-williams" },
  { id: 287, name: "Brad Pitt", slug: "287-brad-pitt" },
  { id: 7467, name: "David Fincher", slug: "7467-david-fincher" },
] as const;
/** Spielberg and Williams: a pair with quotes (the Clippings and the critics' are real data; only TMDB is stubbed). */
export const EMBED_PAIR = `${EMBED_PEOPLE[0].slug}+${EMBED_PEOPLE[1].slug}`;
/** The quote the link opens on, and the one after it in the list, as in the report the embeds' specs came from. */
export const EMBED_START_ID = "john-is-much-more-of-a";

/** Six films all four made together, and two each of their own. */
const embedFilm = (id: number, year: number) => ({ id, title: `Embed Film ${id}`, release_date: `${year}-03-17`, poster_path: `/poster-${id}.png`, vote_count: 500, character: "Lead", order: 0 });
const EMBED_SHARED = Array.from({ length: 6 }, (_, index) => embedFilm(100 + index, 2001 + index));

/**
 * `test` for the pages of the embeds: the four people above by name, and every other id (the pairs of the Clippings, for the longest quote) as "Person <id>", with the same
 * films. The server's stub must be in place before the first page: the fixture is only set up for a test that asks for it, so a spec calls `test.beforeEach(({ next }) => void next)`.
 */
export const embedTest = base.extend({
  page: async ({ page }, provide) => {
    await page.route("https://image.tmdb.org/**", (route) => route.fulfill({ contentType: "image/png", body: PIXEL }));
    // The universal search's results (the header of the share page has the Search button).
    await page.route("**/api/search?*", (route) =>
      route.fulfill({ json: { results: EMBED_PEOPLE.map((person) => ({ id: person.id, name: person.name, profilePath: null, knownFor: "Acting", knownForTitles: ["Embed Film"] })) } }),
    );
    await provide(page);
  },
  next: async ({ next }, provide) => {
    next.onFetch((request) => {
      const url = new URL(request.url);
      if (url.hostname !== "api.themoviedb.org") return "abort";
      const match = url.pathname.match(/^\/3\/person\/(\d+)(\/movie_credits)?$/);
      // Any person: the four above by name, and every other id (the pairs of the Clippings, for the longest quote) as "Person <id>".
      const person = match && (EMBED_PEOPLE.find((p) => p.id === Number(match[1])) ?? { id: Number(match[1]), name: `Person ${match[1]}` });
      if (match && person) {
        if (!match[2]) return Response.json({ id: person.id, name: person.name, profile_path: null, biography: "A biography." });
        return Response.json({ cast: [...EMBED_SHARED, embedFilm(person.id * 10, 1990), embedFilm(person.id * 10 + 1, 1995)], crew: [] });
      }
      if (url.pathname === "/3/discover/movie") return Response.json({ total_pages: 1, results: [] });
      return "abort";
    });
    await provide(next);
  },
});

/** The pair's quotes in the order the embed steps through them: the page's own list, read from the same data. */
export const EMBED_QUOTES = pairQuotes(EMBED_PEOPLE.slice(0, 2).map((person) => ({ person: { id: person.id, name: person.name, profilePath: null }, films: [] })) as unknown as PersonTimeline[]);
export const EMBED_START = EMBED_QUOTES.findIndex((quote) => quote.id === EMBED_START_ID);
export const EMBED_COUNT = EMBED_QUOTES.length;

export const pathnameOf = (page: Page) => page.evaluate(() => window.location.pathname);

/** The quote at `index` is what the page shows, in its counter, its text and its address (`path` of its id). */
export async function expectQuoteAt(page: Page, path: (id: string) => string, index: number) {
  const quote = EMBED_QUOTES[index];
  await expect(page.getByRole("navigation", { name: "Browse quotes", exact: true })).toContainText(`${index + 1} / ${EMBED_COUNT}`);
  await expect(page.locator("blockquote")).toContainText(quote.quote);
  await expect.poll(() => pathnameOf(page)).toBe(path(quote.id));
}
