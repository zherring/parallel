import { test, expect, type Locator, type Page } from "next/experimental/testmode/playwright";

// The slide-out shell (src/components/side-panel/side-panel.tsx) behind both panels on a people page: the
// film's and the person's. A pair whose biographies are long enough to scroll, so the keyboard checks bite.

const PEOPLE_PATH = "/p/90000011-panel-alpha+90000012-panel-beta";
const FILM_TITLE = "Panel Film";

const biography = (name: string) =>
  Array.from(
    { length: 24 },
    (_, index) =>
      `${name} paragraph ${index + 1}. A long biography is what makes the panel's own scroll container scroll, ` +
      "so that the arrow keys, Space and Page Down have somewhere to go once the panel opens.",
  ).join("\n\n");

const people: Record<string, { id: number; name: string; profile_path: null; birthday: string; biography: string }> = {
  "90000011": { id: 90000011, name: "Panel Alpha", profile_path: null, birthday: "1960-01-01", biography: biography("Alpha") },
  "90000012": { id: 90000012, name: "Panel Beta", profile_path: null, birthday: "1962-01-01", biography: biography("Beta") },
};

const film = { id: 300, title: FILM_TITLE, release_date: "2010-06-01", poster_path: null, vote_count: 100, order: 0, character: "Lead" };

test.beforeEach(async ({ next }) => {
  next.onFetch((request) => {
    const url = new URL(request.url);
    if (url.hostname !== "api.themoviedb.org") return "abort";
    const person = url.pathname.match(/^\/3\/person\/(\d+)(\/movie_credits)?$/);
    if (person && people[person[1]]) {
      return person[2] ? Response.json({ cast: [film], crew: [] }) : Response.json(people[person[1]]);
    }
    if (url.pathname === "/3/movie/300") {
      return Response.json({
        id: 300,
        title: FILM_TITLE,
        release_date: film.release_date,
        poster_path: null,
        backdrop_path: null,
        runtime: 100,
        overview: "A film for testing the slide-out panel.",
        genres: [{ name: "Drama" }],
        credits: {
          cast: [
            { id: 90000011, name: "Panel Alpha", profile_path: null, character: "Lead", order: 0 },
            { id: 90000012, name: "Panel Beta", profile_path: null, character: "Second", order: 1 },
            { id: 90000013, name: "Panel Gamma", profile_path: null, character: "Third", order: 2 },
          ],
          crew: [{ id: 90000014, name: "Panel Director", profile_path: null, job: "Director" }],
        },
      });
    }
    if (url.pathname === "/3/discover/movie") return Response.json({ total_pages: 1, results: [] });
    return "abort";
  });
});

interface PanelCase {
  name: string;
  /** What names the dialog once its content is there. */
  dialogName: string;
  trigger: (page: Page) => Locator;
  /** Whether its content is a long biography (the keyboard scroll check needs something to scroll). */
  longContent: boolean;
}

const cases: PanelCase[] = [
  {
    name: "film",
    dialogName: FILM_TITLE,
    trigger: (page) => page.getByRole("button", { name: /^Panel Film, 2010\./ }),
    longContent: false,
  },
  {
    name: "person",
    dialogName: "Panel Alpha",
    // The name in the pair hero's title (a title, not a label: the name stays the button's text).
    trigger: (page) => page.locator("[data-pair-title]").getByTitle("Details for Panel Alpha", { exact: true }),
    longContent: true,
  },
];

/**
 * What a panel makes inert: the page. The page bar always has inert parts of its own (the title or the people pill, whichever is not shown, and
 * the hero's body once it has collapsed), so those are not counted.
 */
const pageInert = (page: Page) => page.locator("[inert]:not([data-people-bar] [inert])");

/** Opens the page on its Timeline and waits until it is live: a state transition (the gear's sheet opening and closing), not a sleep. */
async function openPage(page: Page) {
  await page.goto(`${PEOPLE_PATH}?view=timeline`);
  await expect(page.locator('nav[aria-label="Views"] a[aria-current="page"]').first()).toHaveText("Timeline");
  const settings = page.getByRole("dialog", { name: "Settings", exact: true });
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(settings).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(settings).toBeHidden();
}

/** The dialog's hydrated trigger: open it with a click, wait for the content that names the dialog. */
async function openPanel(page: Page, panel: PanelCase) {
  const trigger = panel.trigger(page);
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: panel.dialogName, exact: true });
  await expect(dialog).toBeVisible();
  return { trigger, dialog, scroller: dialog.locator("[data-side-panel-scroll]") };
}

const focusIsIn = (dialog: Locator) => dialog.evaluate((element) => element.contains(document.activeElement));
const overflow = (page: Page) => page.evaluate(() => document.body.style.overflow);

async function expectPageFree(page: Page) {
  await expect(pageInert(page)).toHaveCount(0);
  await expect.poll(() => overflow(page)).toBe("");
}

for (const panel of cases) {
  test.describe(`${panel.name} panel`, () => {
    test("opens from its trigger onto the scroll container, which takes the keys", async ({ page }) => {
      await openPage(page);
      const { dialog, scroller } = await openPanel(page, panel);
      await expect(dialog).toHaveAttribute("aria-modal", "true");
      await expect(scroller).toBeFocused();
      expect(await focusIsIn(dialog)).toBe(true);
      // Modal: the rest of the page is inert and does not scroll behind it.
      await expect(pageInert(page).first()).toBeAttached();
      expect(await overflow(page)).toBe("hidden");

      if (panel.longContent) {
        const { scrollHeight, clientHeight } = await scroller.evaluate((element) => ({
          scrollHeight: element.scrollHeight,
          clientHeight: element.clientHeight,
        }));
        expect(scrollHeight).toBeGreaterThan(clientHeight * 2);
        expect(await scroller.evaluate((element) => element.scrollTop)).toBe(0);
        await page.keyboard.press("ArrowDown");
        await expect.poll(() => scroller.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
        const afterArrow = await scroller.evaluate((element) => element.scrollTop);
        await page.keyboard.press("PageDown");
        await expect.poll(() => scroller.evaluate((element) => element.scrollTop)).toBeGreaterThan(afterArrow);
      }
      // The film's content is not long enough to scroll with this fixture: the scroll assertions are for the
      // person's biography, the one that is.
    });

    test("keeps Tab and Shift+Tab inside the panel and wraps at both ends", async ({ page }) => {
      await openPage(page);
      const { dialog, scroller } = await openPanel(page, panel);
      const close = dialog.getByRole("button", { name: `Close ${panel.name} details`, exact: true });
      await expect(scroller).toBeFocused();

      // From the scroll container, Shift+Tab goes back to the close button before it.
      await page.keyboard.press("Shift+Tab");
      await expect(close).toBeFocused();

      // From the first control, Shift+Tab wraps to the last, and Tab from there wraps back to the first.
      await page.keyboard.press("Shift+Tab");
      expect(await focusIsIn(dialog)).toBe(true);
      await expect(close).not.toBeFocused();
      await page.keyboard.press("Tab");
      await expect(close).toBeFocused();

      // However far the keyboard goes either way, focus never leaves the dialog.
      for (const key of ["Tab", "Shift+Tab"]) {
        for (let step = 0; step < 12; step++) {
          await page.keyboard.press(key);
          expect(await focusIsIn(dialog)).toBe(true);
        }
      }

      // From the scroll container, Tab goes in (or wraps to the close button when nothing is inside).
      await scroller.focus();
      await page.keyboard.press("Tab");
      expect(await focusIsIn(dialog)).toBe(true);
      await expect(scroller).not.toBeFocused();
    });

    test("closes on Esc and hands focus back to the trigger", async ({ page }) => {
      await openPage(page);
      const { trigger, dialog } = await openPanel(page, panel);
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(trigger).toBeFocused();
      await expectPageFree(page);
    });

    test("closes on a click outside it", async ({ page }) => {
      await openPage(page);
      const { trigger, dialog } = await openPanel(page, panel);
      // The sheet is against the right edge at this width: the left of the page is the backdrop.
      await page.mouse.click(40, 300);
      await expect(dialog).toBeHidden();
      await expect(trigger).toBeFocused();
      await expectPageFree(page);
    });

    test("closes from its own button and opens again", async ({ page }) => {
      await openPage(page);
      const first = await openPanel(page, panel);
      await first.dialog.getByRole("button", { name: `Close ${panel.name} details`, exact: true }).click();
      await expect(first.dialog).toBeHidden();
      await expect(first.trigger).toBeFocused();
      await expectPageFree(page);

      const again = await openPanel(page, panel);
      await expect(again.scroller).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(again.dialog).toBeHidden();
      await expectPageFree(page);
    });
  });
}
