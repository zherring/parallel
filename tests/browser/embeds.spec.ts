import type { Locator, Page } from "@playwright/test";
import { test as base, expect } from "next/experimental/testmode/playwright";
import { embedPath, quotePath } from "../../src/lib/quote-embed";
import { pairQuotes } from "../../src/lib/quote-embed-data";
import type { PersonTimeline } from "../../src/lib/types";
import { PIXEL } from "./fixtures";

// The pages X frames in a post (src/components/embed): a quote's share page and embed, which step through the pair's quotes and keep the address on the one shown, and a
// pair's embed, whose bar holds the people, Replay and the way to the page in a frame as small as the panel X opens over a phone.

const PEOPLE = [
  { id: 488, name: "Steven Spielberg", slug: "488-steven-spielberg" },
  { id: 491, name: "John Williams", slug: "491-john-williams" },
  { id: 287, name: "Brad Pitt", slug: "287-brad-pitt" },
  { id: 7467, name: "David Fincher", slug: "7467-david-fincher" },
] as const;
/** Spielberg and Williams: a pair with quotes (the Clippings and the critics' are real data; only TMDB is stubbed). */
const PAIR = `${PEOPLE[0].slug}+${PEOPLE[1].slug}`;
/** The quote the link opens on, and the one after it in the list, as in the report this spec came from. */
const START_ID = "john-is-much-more-of-a";

/** Six films all four made together, and two each of their own. */
const film = (id: number, year: number) => ({ id, title: `Embed Film ${id}`, release_date: `${year}-03-17`, poster_path: `/poster-${id}.png`, vote_count: 500, character: "Lead", order: 0 });
const SHARED = Array.from({ length: 6 }, (_, index) => film(100 + index, 2001 + index));

const test = base.extend({
  page: async ({ page }, provide) => {
    await page.route("https://image.tmdb.org/**", (route) => route.fulfill({ contentType: "image/png", body: PIXEL }));
    // The universal search's results (the header of the share page has the Search button).
    await page.route("**/api/search?*", (route) =>
      route.fulfill({ json: { results: PEOPLE.map((person) => ({ id: person.id, name: person.name, profilePath: null, knownFor: "Acting", knownForTitles: ["Embed Film"] })) } }),
    );
    await provide(page);
  },
  next: async ({ next }, provide) => {
    next.onFetch((request) => {
      const url = new URL(request.url);
      if (url.hostname !== "api.themoviedb.org") return "abort";
      const match = url.pathname.match(/^\/3\/person\/(\d+)(\/movie_credits)?$/);
      const person = match && PEOPLE.find((p) => p.id === Number(match[1]));
      if (match && person) {
        if (!match[2]) return Response.json({ id: person.id, name: person.name, profile_path: null, biography: "A biography." });
        return Response.json({ cast: [...SHARED, film(person.id * 10, 1990), film(person.id * 10 + 1, 1995)], crew: [] });
      }
      if (url.pathname === "/3/discover/movie") return Response.json({ total_pages: 1, results: [] });
      return "abort";
    });
    await provide(next);
  },
});

// The server's TMDB stub (`next`, above) must be in place before the first page: the fixture is only set up for a test that asks for it.
test.beforeEach(async ({ next }) => {
  void next;
});

/** The pair's quotes in the order the embed steps through them: the page's own list, read from the same data. */
const QUOTES = pairQuotes(PEOPLE.slice(0, 2).map((person) => ({ person: { id: person.id, name: person.name, profilePath: null }, films: [] })) as unknown as PersonTimeline[]);
const START = QUOTES.findIndex((quote) => quote.id === START_ID);
const COUNT = QUOTES.length;

const pathname = (page: Page) => page.evaluate(() => window.location.pathname);

/** The quote at `index` is what the page shows, in its counter, its text and its address; and what a reload of the address shows, too. */
async function expectAt(page: Page, path: (id: string) => string, index: number) {
  const quote = QUOTES[index];
  await expect(page.getByRole("navigation", { name: "Browse quotes", exact: true })).toContainText(`${index + 1} / ${COUNT}`);
  await expect(page.locator("blockquote")).toContainText(quote.quote);
  await expect.poll(() => pathname(page)).toBe(path(quote.id));
}

async function expectReloadStays(page: Page, path: (id: string) => string, index: number) {
  await page.reload();
  await expectAt(page, path, index);
}

test("the quotes are real: the one the link opens on is in the list, with others to step through", () => {
  expect(START).toBeGreaterThanOrEqual(0);
  expect(COUNT).toBeGreaterThan(2);
});

const VARIANTS = [
  { name: "share page", path: (id: string) => quotePath(PAIR, id) },
  { name: "embed", path: (id: string) => embedPath(PAIR, id) },
] as const;

for (const { name, path } of VARIANTS) {
  test.describe(`${name}: the address follows the quote`, () => {
    test("Next and then Previous is back on the quote the link opened on, in its address, and a reload stays on it", async ({ page }) => {
      await page.goto(path(START_ID));
      await expectAt(page, path, START);

      // No reload in between: a reload would make the quote it lands on the one the page "opened on".
      await page.getByRole("button", { name: "Next quote", exact: true }).click();
      await expectAt(page, path, (START + 1) % COUNT);
      await page.getByRole("button", { name: "Previous quote", exact: true }).click();
      await expectAt(page, path, START);
      await expect.poll(() => pathname(page)).toBe(path(START_ID));
      await expectReloadStays(page, path, START);

      // And the other way: Previous and then Next.
      await page.getByRole("button", { name: "Previous quote", exact: true }).click();
      await expectAt(page, path, (START - 1 + COUNT) % COUNT);
      await page.getByRole("button", { name: "Next quote", exact: true }).click();
      await expectAt(page, path, START);
      await expectReloadStays(page, path, START);
    });

    test("stepping all the way round, either way, wraps back to the quote it opened on, and the address, the quote and a reload agree at every step", async ({ page }) => {
      await page.goto(path(START_ID));
      await expectAt(page, path, START);
      const next = page.getByRole("button", { name: "Next quote", exact: true });
      const previous = page.getByRole("button", { name: "Previous quote", exact: true });

      for (let step = 1; step <= COUNT; step++) {
        await next.click();
        await expectAt(page, path, (START + step) % COUNT);
      }
      await expectReloadStays(page, path, START);

      for (let step = 1; step <= COUNT; step++) {
        await previous.click();
        await expectAt(page, path, (START - step + COUNT * 2) % COUNT);
      }
      await expectReloadStays(page, path, START);
    });

    test("the first quote's Previous is the last, and the last quote's Next is the first, in the address and after a reload", async ({ page }) => {
      const first = 0;
      const last = COUNT - 1;

      await page.goto(path(QUOTES[first].id));
      await expectAt(page, path, first);
      await page.getByRole("button", { name: "Previous quote", exact: true }).click();
      await expectAt(page, path, last);
      await expectReloadStays(page, path, last);
      await page.getByRole("button", { name: "Next quote", exact: true }).click();
      await expectAt(page, path, first);
      await expectReloadStays(page, path, first);

      // Opened on the last, stepped on to the first and back: the address is the last's again.
      await page.goto(path(QUOTES[last].id));
      await expectAt(page, path, last);
      await page.getByRole("button", { name: "Next quote", exact: true }).click();
      await expectAt(page, path, first);
      await page.getByRole("button", { name: "Previous quote", exact: true }).click();
      await expectAt(page, path, last);
      await expectReloadStays(page, path, last);
    });

    test("the arrow keys step it from the page, and the address follows", async ({ page }) => {
      await page.goto(path(START_ID));
      await expectAt(page, path, START);
      await page.locator("blockquote").click();
      await page.keyboard.press("ArrowRight");
      await expectAt(page, path, (START + 1) % COUNT);
      await page.keyboard.press("ArrowLeft");
      await expectAt(page, path, START);
      await page.keyboard.press("ArrowLeft");
      await expectAt(page, path, (START - 1 + COUNT) % COUNT);
      await page.keyboard.press("ArrowRight");
      await expectAt(page, path, START);
      // A modifier is the browser's (Alt+Left is back), not the quotes'.
      await page.keyboard.press("Shift+ArrowRight");
      await expectAt(page, path, START);
    });
  });
}

test.describe("share page: the quotes' arrow keys are not taken from the search", () => {
  const path = VARIANTS[0].path;

  test("typing in the Search field, or any key in its dialog, leaves the quote and the address where they were; the page has them back once it is closed", async ({ page }) => {
    await page.goto(path(START_ID));
    await expectAt(page, path, START);

    await page.getByRole("banner").getByRole("button", { name: "Search", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Search people", exact: true });
    await expect(dialog).toBeVisible();
    const field = dialog.getByRole("combobox");
    await expect(field).toBeFocused();

    await field.fill("Steven");
    await expect(dialog.getByRole("option").first()).toBeVisible();
    for (const key of ["ArrowRight", "ArrowLeft", "ArrowRight", "ArrowRight"]) await page.keyboard.press(key);
    await expect(field).toHaveValue("Steven");
    await expectAt(page, path, START);

    // From the dialog's close button, too: it is the dialog's, not the page's.
    await dialog.getByRole("button", { name: "Close search", exact: true }).focus();
    await page.keyboard.press("ArrowRight");
    await expectAt(page, path, START);
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expectAt(page, path, START);

    // Closed, the focus is on the Search button, which is not a field: the arrows are the quotes' again.
    await page.keyboard.press("ArrowRight");
    await expectAt(page, path, (START + 1) % COUNT);
    await page.locator("blockquote").click();
    await page.keyboard.press("ArrowLeft");
    await expectAt(page, path, START);
  });

  test("a key the search handled itself (prevented) is not a step either", async ({ page }) => {
    await page.goto(path(START_ID));
    await expectAt(page, path, START);
    await page.evaluate(() => {
      // Something earlier in the page took the key, as a field's own handler does.
      document.addEventListener("keydown", (event) => event.key === "ArrowRight" && event.preventDefault());
    });
    await page.keyboard.press("ArrowRight");
    await expectAt(page, path, START);
    await page.keyboard.press("ArrowLeft");
    await expectAt(page, path, (START - 1 + COUNT) % COUNT);
  });
});

/** Where a control is, in the frame's pixels. */
async function boxOf(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("the control has no box");
  return box;
}

/** What is on top at the middle of the control is the control (or something inside it). */
async function isOnTopAtCentre(page: Page, locator: Locator) {
  const box = await boxOf(locator);
  return locator.evaluate((node, [x, y]) => {
    const hit = document.elementFromPoint(x, y);
    return Boolean(hit) && node.contains(hit);
  }, [box.x + box.width / 2, box.y + box.height / 2]);
}

const intersects = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

const FRAMES = [
  { width: 390, height: 253, what: "the panel X opens over a phone" },
  { width: 600, height: 315, what: "an inline card on a desktop timeline" },
  { width: 320, height: 253, what: "the smallest phone" },
] as const;

test.describe("pair embed: the bar's controls are separate targets", () => {
  test.use({ reducedMotion: "reduce" });

  for (const count of [2, 3, 4]) {
    for (const frame of FRAMES) {
      test(`${count} people in ${frame.width} x ${frame.height} (${frame.what}): the people, Replay and Open in Parallel are each on top at their own middle, and apart`, async ({ page }) => {
        await page.setViewportSize({ width: frame.width, height: frame.height });
        const slug = PEOPLE.slice(0, count).map((person) => person.slug).join("+");
        await page.goto(`/embed/p/${slug}`);

        // Under reduced motion the timeline is up at once, and with it the bar's controls.
        const replay = page.getByRole("button", { name: "Replay", exact: true });
        await expect(replay).toBeVisible();
        const people = page.getByRole("list", { name: "The people", exact: true }).getByRole("link");
        await expect(people).toHaveCount(count);
        const open = page.getByRole("link", { name: /^Open in Parallel/ });
        await expect(open).toBeVisible();
        const wordmark = page.getByRole("link", { name: "Parallel: home", exact: true });

        const personLinks = await people.all();
        const controls: { name: string; locator: Locator }[] = [
          ...personLinks.map((locator, index) => ({ name: PEOPLE[index].name, locator })),
          { name: "Replay", locator: replay },
          { name: "Open in Parallel", locator: open },
          // The wordmark gives way to the people in a narrow frame with 3 or 4 of them: it is a control only while it is shown.
          ...((await wordmark.isVisible()) ? [{ name: "Parallel: home", locator: wordmark }] : []),
        ];

        const boxes = await Promise.all(controls.map(({ locator }) => boxOf(locator)));
        for (const [index, { name, locator }] of controls.entries()) {
          // In the frame, and what is on top at its middle is itself.
          const box = boxes[index];
          expect(box.x, `${name} starts inside the frame`).toBeGreaterThanOrEqual(0);
          expect(box.x + box.width, `${name} ends inside the frame`).toBeLessThanOrEqual(frame.width);
          expect(await isOnTopAtCentre(page, locator), `${name} is on top at its middle`).toBe(true);
        }

        // Every control is apart from every other; but in the smallest frame the people are tucked under each other a little (the one on the right is on top, the
        // same as on the site's lane avatars), and each is a target of at least 22px.
        const peopleCount = personLinks.length;
        const tucked = frame.width < 352;
        for (let a = 0; a < controls.length; a++) {
          for (let b = a + 1; b < controls.length; b++) {
            if (tucked && b < peopleCount) continue; // both are people
            expect(intersects(boxes[a], boxes[b]), `${controls[a].name} and ${controls[b].name} do not overlap`).toBe(false);
          }
        }
        for (let i = 0; i + 1 < peopleCount; i++) {
          expect(boxes[i + 1].x - boxes[i].x, `${controls[i].name} is a target of at least 22px`).toBeGreaterThanOrEqual(22);
        }
      });
    }
  }
});
