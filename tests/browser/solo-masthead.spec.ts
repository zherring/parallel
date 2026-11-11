import type { Locator, Page } from "next/experimental/testmode/playwright";
import { test as base, expect } from "next/experimental/testmode/playwright";
import type { RawCastCredit, RawCrewCredit } from "../../src/lib/tmdb-types";
import { PIXEL, bar, collapseHero, heroBody, timeline } from "./fixtures";

/**
 * The masthead of a page of one person: the pair hero's own component and layout with one portrait. Their name and portrait open their details; under the name their
 * main roles, the years they were active and the count of their films; the three best-known films (by TMDB votes) as chips and "+N more"; and the start of their TMDB
 * biography, in whole sentences, with a More that opens the panel. It collapses on scroll as the pair hero does, and the lane header under it no longer says the biography.
 */

const SOLO = "/p/90000061-solo-masthead";
const QUIET = "/p/90000062-solo-quiet";

/** The sentences of the biography: the first two fit within the hero's 240 characters together, the third does not. */
const SENTENCES = [
  "Solo Masthead is an American actor who made ten films between 1990 and 2008, most of them comedies.",
  "He began on the stage in Chicago, where he met the director who cast him in his first picture.",
  "A third sentence follows that says a good deal more about his later years, his family and his many awards, and it is a long one, so that it does not fit.",
] as const;
const CREDIT = "Description above from the Wikipedia article Solo Masthead, licensed under CC-BY-SA, full list of contributors on Wikipedia.";
const BIOGRAPHY = `${SENTENCES.join(" ")}\n\n${CREDIT}`;
const NOTE = `${SENTENCES[0]} ${SENTENCES[1]}`;

/** Votes by film number (1 to 10): the best known are films 2, 4 and 5, not the first three. */
const VOTES = [100, 9000, 50, 7000, 3000, 20, 10, 5, 2, 1];
const FILM_COUNT = VOTES.length;
const title = (n: number) => `Masthead Film ${n}`;
const FAME = [2, 4, 5];

const films = VOTES.map((votes, index) => ({
  id: 100 + index,
  title: title(index + 1),
  release_date: `${1990 + index * 2}-05-01`,
  poster_path: `/poster-${100 + index}.png`,
  vote_count: votes,
}));
const cast: RawCastCredit[] = films.map((film) => ({ ...film, order: 0, character: "Lead" }));
// A director credit on two of them: an actor still, by the films (the main role is the one on the most).
const crew: RawCrewCredit[] = films.slice(0, 2).map((film) => ({ ...film, job: "Director" }));

const people: Record<string, { id: number; name: string; biography: string }> = {
  "90000061": { id: 90000061, name: "Solo Masthead", biography: BIOGRAPHY },
  "90000062": { id: 90000062, name: "Solo Quiet", biography: "" },
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
        if (!match[2]) return Response.json({ ...people[match[1]], profile_path: null, birthday: "1960-01-01" });
        return Response.json({ cast, crew });
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

const note = (page: Page) => heroBody(page).locator('[data-hero-note="bio"]');
const more = (page: Page) => note(page).getByRole("button", { name: "More about Solo Masthead", exact: true });
const chips = (page: Page) => heroBody(page).locator("[data-hero-chip]");
const pill = (page: Page) => bar(page).getByRole("button", { name: /^People on this page/ });
const panel = (page: Page, name = "Solo Masthead") => page.getByRole("dialog", { name, exact: true });

/** Waits until the page is live: a state transition (the gear's sheet opening and closing), not a sleep. */
async function hydrated(page: Page) {
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Settings", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Settings", exact: true })).toBeHidden();
}

async function openView(page: Page, path: string, view: string) {
  await page.goto(`${path}?view=${view}`);
  await expect(bar(page)).toHaveAttribute("data-hero", "expanded");
  await hydrated(page);
}

/** The bar's controls that are shown (not the hero's body that the bar holds on the Timeline and Films). */
const controlBoxes = (page: Page): Promise<Box[]> =>
  bar(page).evaluate((element) =>
    [...element.querySelectorAll<HTMLElement>("a, button, [data-pair-title]")]
      .filter((control) => !control.closest("[data-hero-body]") && control.getClientRects().length > 0 && getComputedStyle(control).visibility !== "hidden")
      .map((control) => {
        const { x, y, width, height } = control.getBoundingClientRect();
        return { x, y, width, height };
      }),
  );

/** How far down the screen the masthead reaches before any scroll: the bar's band (Timeline, Films) or the body in the page under the bar (Table). */
const mastheadBottom = async (page: Page) => Math.max(bottomOf(await box(bar(page))), bottomOf(await box(heroBody(page))));

test.describe("at 1440px wide", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("the Timeline opens on a masthead: name, roles and years, one portrait, the best-known films, and the start of the biography; it is clear of the bar", async ({ page }) => {
    await openView(page, SOLO, "timeline");

    // The name, a button that opens their details, and the line under it: main role, the years they were active and the count the table lists, in capitals.
    const heading = bar(page).locator("[data-pair-title]");
    await expect(heading.locator("p").first()).toHaveText("Solo Masthead");
    await expect(heading.getByRole("button", { name: "Solo Masthead", exact: true })).toBeVisible();
    const subtitle = bar(page).locator("[data-pair-subtitle]");
    await expect(subtitle).toHaveText(`Actor · 1990–2008 · ${FILM_COUNT} films`);
    expect(await subtitle.evaluate((element) => getComputedStyle(element).textTransform)).toBe("uppercase");

    // One portrait, which opens the details too.
    await expect(heroBody(page).locator("[data-hero-portrait]")).toHaveCount(1);
    await expect(heroBody(page).getByRole("button", { name: "Details for Solo Masthead", exact: true })).toBeVisible();

    // The note: the first two sentences of the biography, whole and nothing after them: no third sentence, no ellipsis, no credit line.
    await expect(note(page)).toBeVisible();
    const words = (await note(page).innerText()).replace(/\s+/g, " ").trim();
    // (The button says "More"; the rest of its name is read, not seen.)
    expect(words.replace(/ about Solo Masthead$/, "")).toBe(`${NOTE} More`);
    expect(words).not.toContain("…");
    expect(words).not.toContain("Wikipedia");
    expect(words).not.toContain("A third sentence");

    // The three best-known films by votes, not the first three by date, then "+N more" on one line.
    await expect(chips(page)).toHaveCount(3);
    for (const [index, n] of FAME.entries()) await expect(chips(page).nth(index)).toContainText(title(n));
    await expect(heroBody(page).locator("[data-hero-more]")).toContainText(`+${FILM_COUNT - 3} more`);
    const tops = await heroBody(page).evaluate((body) => [...new Set([...body.querySelectorAll<HTMLElement>("[data-hero-chip], [data-hero-more]")].map((item) => item.offsetTop))]);
    expect(tops).toHaveLength(1);

    // The masthead does not overlap the bar's controls (the home arrow, the title, the view control, the gear).
    const body = await box(heroBody(page));
    const controls = await controlBoxes(page);
    expect(controls.length).toBeGreaterThan(2);
    for (const control of controls) expect(intersects(body, control)).toBe(false);
    // And no pill yet: it is where the title is, and shows only once the masthead has collapsed.
    await expect(pill(page)).toBeHidden();
  });

  test("the pill shows only once the masthead has collapsed, and the lane header's name is under the bar then", async ({ page }) => {
    await openView(page, SOLO, "timeline");
    await expect(bar(page).locator("[data-pair-title]")).toBeVisible();
    await collapseHero(page);
    await expect(pill(page)).toBeVisible();
    await expect(bar(page).locator("[data-pair-title]")).toBeHidden();
    // The body eases shut over 300ms: the bar is the compact one when it has.
    await expect.poll(async () => (await box(bar(page))).height).toBeLessThanOrEqual(64);

    // The lane header's name, which the bar covered before: below the bar, and not on top of anything of the bar's.
    const name = page.locator("[data-lane-head] h2");
    await expect(name).toHaveText("Solo Masthead");
    const barBox = await box(bar(page));
    const spot = await box(name);
    expect(intersects(barBox, spot)).toBe(false);
    expect(spot.y).toBeGreaterThanOrEqual(bottomOf(barBox));
    for (const control of await controlBoxes(page)) expect(intersects(control, spot)).toBe(false);
  });

  test("the biography is said once: the masthead has it, the lane header does not", async ({ page }) => {
    await openView(page, SOLO, "timeline");
    await expect(page.locator("[data-lane-head]")).toHaveCount(1);
    await expect(page.locator("[data-lane-head] [data-person-bio]")).toHaveCount(0);
    await expect(page.locator("[data-person-bio]")).toHaveCount(0);
    await expect(page.getByText(SENTENCES[0])).toHaveCount(1);
    // The lane header still names the person, with the roles and the years.
    await expect(page.locator("[data-lane-head]")).toContainText("Solo Masthead");
    await expect(page.locator("[data-lane-head]")).toContainText("first film 1990");
  });

  test("More opens the person panel, which has all of the biography, and hands focus back to More", async ({ page }) => {
    await openView(page, SOLO, "timeline");
    await more(page).click();
    const dialog = panel(page);
    await expect(dialog).toBeVisible();
    // What the masthead left out is in the panel.
    await expect(dialog.getByText("A third sentence follows")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(more(page)).toBeFocused();
  });

  test("the name and the portrait open the panel too, as everywhere else", async ({ page }) => {
    await openView(page, SOLO, "timeline");
    await bar(page).locator("[data-pair-title]").getByRole("button", { name: "Solo Masthead", exact: true }).click();
    await expect(panel(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(panel(page)).toBeHidden();
    await heroBody(page).getByRole("button", { name: "Details for Solo Masthead", exact: true }).click();
    await expect(panel(page)).toBeVisible();
  });

  test("the Table and Films have the same masthead, and every view opens at its start", async ({ page }) => {
    for (const view of ["table", "depth"]) {
      await openView(page, SOLO, view);
      await expect(note(page)).toBeVisible();
      await expect(chips(page).first()).toContainText(title(FAME[0]));
      await expect(bar(page).locator("[data-pair-subtitle]")).toHaveText(`Actor · 1990–2008 · ${FILM_COUNT} films`);
      const start = await page.evaluate(() => ({ window: window.scrollY, scene: document.querySelector("[data-depth-scene]")?.scrollTop ?? 0 }));
      expect(start).toEqual({ window: 0, scene: 0 });
    }
    // The Timeline: at its left end.
    await openView(page, SOLO, "timeline");
    expect(await timeline(page).evaluate((element) => element.scrollLeft)).toBe(0);
  });

  test("a person with no biography has no note, no More, and no space left for them", async ({ page }) => {
    await openView(page, QUIET, "timeline");
    await expect(heroBody(page).locator("[data-hero-note]")).toHaveCount(0);
    await expect(heroBody(page).locator("[data-person-more]")).toHaveCount(0);
    await expect(heroBody(page).locator("[data-hero-portrait]")).toHaveCount(1);
    await expect(chips(page)).toHaveCount(3);
    await expect(page.locator("[data-person-bio]")).toHaveCount(0);
    // The portrait and the chips are all it has: nothing between them where the note was.
    const portrait = await box(heroBody(page).locator("[data-hero-portrait]"));
    const group = await box(heroBody(page).getByRole("group"));
    expect(group.y - bottomOf(portrait)).toBeLessThan(24);
  });
});

test.describe("at 390px wide", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  for (const view of ["timeline", "table", "depth"]) {
    test(`${view}: the masthead is 220px tall at most before any scroll, with the biography whole and More on the screen`, async ({ page }) => {
      await openView(page, SOLO, view);
      await expect(note(page)).toBeVisible();
      // Whole: no clamp or clip cuts it, and More is in the note, on the screen.
      const state = await note(page).evaluate((element) => {
        const css = getComputedStyle(element);
        const button = element.querySelector("[data-person-more]")!.getBoundingClientRect();
        return { clamped: css.overflow !== "visible" || css.webkitLineClamp !== "none", more: button.width > 0 && button.left >= 0 && button.right <= window.innerWidth && button.bottom <= element.getBoundingClientRect().bottom + 2 };
      });
      expect(state).toEqual({ clamped: false, more: true });
      expect((await note(page).innerText()).replace(/\s+/g, " ")).toContain(SENTENCES[1]);
      expect(await mastheadBottom(page)).toBeLessThanOrEqual(220);
      // One line of chips, and nothing wider than the screen.
      const wide = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(wide).toBe(false);
    });
  }

  test("the masthead of a person with no biography is shorter: the note's space is not kept", async ({ page }) => {
    await openView(page, SOLO, "timeline");
    const withNote = await mastheadBottom(page);
    await openView(page, QUIET, "timeline");
    const without = await mastheadBottom(page);
    expect(without).toBeLessThan(withNote);
  });

  test("More opens the panel on a phone too", async ({ page }) => {
    await openView(page, SOLO, "table");
    await more(page).tap();
    await expect(panel(page)).toBeVisible();
  });

  test("the lane header's name is under the bar on a phone, collapsed", async ({ page }) => {
    await openView(page, SOLO, "timeline");
    await collapseHero(page);
    await expect.poll(async () => (await box(bar(page))).height).toBeLessThanOrEqual(64);
    const barBox = await box(bar(page));
    const name = await box(page.locator("[data-lane-head] h2"));
    expect(intersects(barBox, name)).toBe(false);
  });
});
