import type { Locator, Page } from "next/experimental/testmode/playwright";
import { test as base, expect } from "next/experimental/testmode/playwright";
import type { RawCastCredit } from "../../src/lib/tmdb-types";
import { PIXEL, bar, collapseHero, heroBody, timeline } from "./fixtures";

/**
 * The page bar never covers content. It is fixed over the top of the screen, so what the page puts under it has to start clear of it, or be pinned clear of it:
 *
 *  - a page of one person, on the Timeline: the lane header at the left is as tall as the lane, and the track opens scrolled to its baseline, so the header's top (the name, the
 *    years) was above the screen and what showed under the bar was its tail. Its content now sticks under the bar;
 *  - the Table's and the Quotes' hero body is in the page, under the bar's row: the title in the row wraps on a phone (three or four names), and the body started under it.
 *    The page now starts under the title as it wraps.
 */

const NAMES = ["Bartholomew Featherstonehaugh", "Maximilian Cholmondeley-Warner", "Hieronymus Wolfeschlegelstein"];
const SOLO = "/p/90000041-solo-clearance";
/** Three people with names long enough that the expanded title wraps to three lines on a phone. */
const TRIO = "/p/90000051+90000052+90000053";

/** A film of `year`, `index` in the month: films of one year stack in rows on the Timeline, so a few make the lane taller than a short screen. */
const movie = (id: number, year: number, index = 0): RawCastCredit => ({
  id,
  title: `Clearance Film ${id}`,
  release_date: `${year}-${String(index + 1).padStart(2, "0")}-01`,
  poster_path: `/poster-${id}.png`,
  vote_count: 1000 - index * 10,
  order: 0,
  character: "Lead",
});

const people: Record<string, { id: number; name: string; biography: string }> = {
  "90000041": { id: 90000041, name: "Solo Clearance", biography: "Solo Clearance is an actor whose lane is tall. He made six films in one year." },
  ...Object.fromEntries(NAMES.map((name, index) => [String(90000051 + index), { id: 90000051 + index, name, biography: `${name} is an actor.` }])),
};

const test = base.extend({
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
        const person = people[match[1]];
        if (!match[2]) return Response.json({ ...person, profile_path: null, birthday: "1960-01-01" });
        // One person: six films in 2000 (six rows), and some more across sixty years (the track scrolls sideways too). The three: five films they all made, a year apart.
        const cast =
          match[1] === "90000041"
            ? [...Array.from({ length: 6 }, (_, index) => movie(100 + index, 2000, index)), ...Array.from({ length: 8 }, (_, index) => movie(200 + index, 1960 + index * 9))]
            : Array.from({ length: 5 }, (_, index) => movie(300 + index, 2001 + index));
        return Response.json({ cast, crew: [] });
      }
      if (url.pathname === "/3/discover/movie") return Response.json({ total_pages: 1, results: [] });
      return "abort";
    });
    await provide(next);
  },
});

test.beforeEach(async ({ next }) => {
  void next;
});

type Box = { x: number; y: number; width: number; height: number };
const box = async (locator: Locator): Promise<Box> => (await locator.boundingBox())!;
const intersects = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const bottomOf = (b: Box) => b.y + b.height;

/** Where the track's vertical scroll is, set the way the visitor moves it, with a frame for the sticky header to settle. */
async function scrollTrackTo(page: Page, where: "top" | "bottom") {
  await timeline(page).evaluate(
    (element, to) =>
      new Promise<void>((resolve) => {
        element.scrollTop = to === "top" ? 0 : element.scrollHeight;
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
    where,
  );
}

/** The bar's controls that are shown (the home arrow, the title or the people pill, the view control, the gear), not the hero's body that the bar holds on the Timeline and Films. */
const controlBoxes = (page: Page): Promise<Box[]> =>
  bar(page).evaluate((element) =>
    [...element.querySelectorAll<HTMLElement>("a, button, [data-pair-title]")]
      .filter((control) => !control.closest("[data-hero-body]") && control.getClientRects().length > 0 && getComputedStyle(control).visibility !== "hidden")
      .map((control) => {
        const { x, y, width, height } = control.getBoundingClientRect();
        return { x, y, width, height };
      }),
  );

for (const [width, height] of [
  [1440, 600],
  [390, 700],
] as const) {
  test.describe(`a page of one person, at ${width}px wide`, () => {
    test.use({ viewport: { width, height }, ...(width < 500 ? { hasTouch: true, isMobile: true } : {}) });

    test("the lane header's name and years are under the page bar at the track's baseline and scrolled to its top, never under the bar", async ({ page }) => {
      await page.goto(`${SOLO}?view=timeline`);
      await expect(bar(page)).toHaveAttribute("data-hero", "expanded");
      // The lane is taller than the screen: the track scrolls down as well as sideways, and opens at the baseline (the bottom).
      const state = await timeline(page).evaluate((element) => ({ scrolls: element.scrollHeight > element.clientHeight + 1, atBottom: element.scrollTop + element.clientHeight >= element.scrollHeight - 1 }));
      expect(state).toEqual({ scrolls: true, atBottom: true });
      await collapseHero(page);
      // The body eases shut over 300ms: the bar is the compact one (a row of controls, about 60px) when it has.
      await expect.poll(async () => (await box(bar(page))).height).toBeLessThanOrEqual(64);

      const name = page.locator("[data-lane-head] h2");
      // The years: the first line under the name that is not the roles (wide: "Born 1960 · first film 1990"; a phone's header has the span, "1990–2014").
      const years = page.locator("[data-lane-head] p").filter({ hasText: /\d{4}/ }).filter({ visible: true }).first();
      for (const where of ["bottom", "top"] as const) {
        await scrollTrackTo(page, where);
        const barBox = await box(bar(page));
        for (const [what, locator] of [["the name", name], ["the years", years]] as const) {
          const spot = await box(locator);
          expect(intersects(barBox, spot), `${what} and the bar, scrolled to the ${where}`).toBe(false);
          expect(spot.y, `${what} is below the bar, scrolled to the ${where}`).toBeGreaterThanOrEqual(bottomOf(barBox));
          expect(bottomOf(spot), `${what} is on the screen, scrolled to the ${where}`).toBeLessThanOrEqual(height);
        }
      }
    });
  });
}

test.describe("a page of three people", () => {
  test.describe("at 1440px wide", () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    for (const view of ["timeline", "table", "depth"]) {
      test(`${view}: the hero's body does not overlap the bar's controls, expanded`, async ({ page }) => {
        await page.goto(`${TRIO}?view=${view}`);
        await expect(bar(page)).toHaveAttribute("data-hero", "expanded");
        // The flat page reads ?view= after hydration: wait for the Table's body to move out of the band before measuring it.
        await expect(bar(page)).toHaveAttribute("data-hero-placement", view === "table" ? "page" : "band");
        await expect(heroBody(page)).toBeVisible();
        const body = await box(heroBody(page));
        const controls = await controlBoxes(page);
        expect(controls.length).toBeGreaterThan(2);
        for (const control of controls) expect(intersects(body, control)).toBe(false);
      });
    }
  });

  test.describe("at 390px wide", () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

    for (const view of ["timeline", "table", "depth"]) {
      test(`${view}: three long names wrap in the title, and the hero's body starts under the title, not under the bar`, async ({ page }) => {
        await page.goto(`${TRIO}?view=${view}`);
        await expect(bar(page)).toHaveAttribute("data-hero", "expanded");
        // The title is taller than the compact bar (46px and its 12px of padding): it wraps.
        const title = await box(page.locator("[data-pair-title]"));
        expect(title.height).toBeGreaterThan(60);
        if (view === "table") {
          // The Table's body is in the page, whose top is under the bar once the live page has measured the title (the bar is what is fixed, so the page cannot know before).
          await expect.poll(async () => (await box(heroBody(page))).y - bottomOf(await box(bar(page)))).toBeGreaterThanOrEqual(0);
        } else {
          // The Timeline's and Films' body is in the bar's band, under the title in the bar's own flow.
          expect((await box(heroBody(page))).y).toBeGreaterThanOrEqual(bottomOf(title));
        }
        const body = await box(heroBody(page));
        const controls = await controlBoxes(page);
        expect(controls.length).toBeGreaterThan(2);
        for (const control of controls) expect(intersects(body, control)).toBe(false);
      });
    }
  });
});
