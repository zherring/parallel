import { test, expect, type Page } from "next/experimental/testmode/playwright";
import { collapseHero } from "./fixtures";

// Adding and removing people while a panel is open (the film's, the people pill's card, the ⌘K people search) only stages the change; closing the last of them
// applies everything staged in one soft navigation to the page of the final people, in the view the visitor is on (src/components/people-staging.tsx). Nothing behind the
// panel is redrawn while it is open, and no full document load happens: a marker on `window` survives, and the history has exactly one new entry.

const PAIR = "/p/90000011-stage-alpha+90000012-stage-beta";
const WITH_GAMMA = "/p/90000011-stage-alpha+90000012-stage-beta+90000013-stage-gamma?view=timeline";
const SHORTCUT = "ControlOrMeta+k";

const film = { id: 300, title: "Stage Film", release_date: "2010-06-01", poster_path: null, vote_count: 100, order: 0, character: "Lead" };
const people: Record<string, string> = { "90000011": "Stage Alpha", "90000012": "Stage Beta", "90000013": "Stage Gamma" };

test.beforeEach(async ({ next }) => {
  next.onFetch((request) => {
    const url = new URL(request.url);
    if (url.hostname !== "api.themoviedb.org") return "abort";
    const person = url.pathname.match(/^\/3\/person\/(\d+)(\/movie_credits)?$/);
    if (person && people[person[1]]) {
      if (person[2]) return Response.json({ cast: [film], crew: [] });
      return Response.json({ id: Number(person[1]), name: people[person[1]], profile_path: null, birthday: "1960-01-01", biography: `${people[person[1]]} is an actor.` });
    }
    if (url.pathname === "/3/movie/300") {
      return Response.json({
        id: 300,
        title: "Stage Film",
        release_date: film.release_date,
        poster_path: null,
        backdrop_path: null,
        runtime: 100,
        overview: "A film for testing the staging of people.",
        genres: [{ name: "Drama" }],
        credits: {
          cast: [
            { id: 90000011, name: "Stage Alpha", profile_path: null, character: "Lead", order: 0 },
            { id: 90000012, name: "Stage Beta", profile_path: null, character: "Second", order: 1 },
            { id: 90000013, name: "Stage Gamma", profile_path: null, character: "Third", order: 2 },
          ],
          crew: [],
        },
      });
    }
    if (url.pathname === "/3/discover/movie") return Response.json({ total_pages: 1, results: [] });
    return "abort";
  });
});

/** The search's answers: Stage Beta is already on the page, Stage Gamma is not. */
async function mockSearch(page: Page) {
  await page.route("**/api/search?*", (route) =>
    route.fulfill({
      json: {
        results: [
          { id: 90000012, name: "Stage Beta", profilePath: null, knownFor: "Acting", knownForTitles: ["Stage Film"] },
          { id: 90000013, name: "Stage Gamma", profilePath: null, knownFor: "Acting", knownForTitles: ["Stage Film"] },
        ],
      },
    }),
  );
}

/** Opens the page on its Timeline and waits until it is live (a state transition: the gear's sheet opens and closes), then marks the document and counts what is pushed onto the history. */
async function openPage(page: Page) {
  await page.goto(`${PAIR}?view=timeline`);
  const gear = page.getByRole("button", { name: "Settings", exact: true });
  await gear.click();
  await expect(page.getByRole("dialog", { name: "Settings", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(gear).toBeFocused();
  await page.evaluate(() => {
    const w = window as unknown as { __marker: string; __pushes: string[] };
    w.__marker = "the same document";
    w.__pushes = [];
    const push = history.pushState.bind(history);
    history.pushState = (data, unused, url) => {
      w.__pushes.push(String(url));
      return push(data, unused, url);
    };
  });
}
const navigation = (page: Page) =>
  page.evaluate(() => ({ marker: (window as unknown as { __marker?: string }).__marker, pushes: (window as unknown as { __pushes: string[] }).__pushes }));
const pillLabel = (page: Page) => page.locator("[data-people-pill] button[aria-label^='People on this page']");
const filmPanel = (page: Page) => page.getByRole("dialog", { name: "Stage Film", exact: true });
const peopleDialog = (page: Page) => page.getByRole("dialog", { name: "People", exact: true });
const openFilm = (page: Page) => page.getByRole("button", { name: /^Stage Film, 2010\./ }).click();

test.describe("the film panel", () => {
  for (const how of ["Escape", "the close button", "a press outside it"] as const) {
    test(`stages Add: the row says Added and can be taken back, the page is untouched, and closing it with ${how} makes one soft navigation that keeps the view`, async ({ page }) => {
      await openPage(page);
      await openFilm(page);
      const dialog = filmPanel(page);
      await expect(dialog).toBeVisible();

      const add = dialog.getByRole("button", { name: "Add Stage Gamma to timeline", exact: true });
      await add.click();
      const added = dialog.getByRole("button", { name: "Stage Gamma is added to the timeline. Press to take it back", exact: true });
      await expect(added).toHaveText("Added ✓");
      await expect(dialog.getByRole("status")).toContainText("Stage Gamma will join the timeline when you close this panel.");
      // Nothing behind the panel has changed: the address, the document, the people.
      await expect(page).toHaveURL(`${PAIR}?view=timeline`);
      expect(await navigation(page)).toEqual({ marker: "the same document", pushes: [] });
      await expect(pillLabel(page)).toHaveAttribute("aria-label", "People on this page: Stage Alpha & Stage Beta");
      // Still open: it is no longer closed by the add, as it was when the add navigated.
      await expect(dialog).toBeVisible();

      // Pressing it again takes it back; pressing Add again stages it again.
      await added.click();
      await expect(add).toBeVisible();
      await expect(dialog.getByRole("status")).toHaveText("");
      await add.click();
      await expect(added).toBeVisible();

      if (how === "Escape") await page.keyboard.press("Escape");
      else if (how === "the close button") await dialog.getByRole("button", { name: "Close film details", exact: true }).click();
      else await page.mouse.click(120, 300);

      // Focus went back to what opened the panel first; the navigation comes after (and its page is a new one).
      await expect(page.getByRole("button", { name: /^Stage Film, 2010\./ })).toBeFocused();
      await expect(page).toHaveURL(WITH_GAMMA);
      await expect(pillLabel(page)).toHaveAttribute("aria-label", /Stage Gamma/);
      expect(await navigation(page)).toEqual({ marker: "the same document", pushes: [WITH_GAMMA] });
    });
  }

  test("an Add that is taken back, or none, leaves the page alone when it closes", async ({ page }) => {
    await openPage(page);
    // Nothing staged.
    await openFilm(page);
    await expect(filmPanel(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(filmPanel(page)).toBeHidden();
    // Added and taken back.
    await openFilm(page);
    await filmPanel(page).getByRole("button", { name: "Add Stage Gamma to timeline", exact: true }).click();
    await filmPanel(page).getByRole("button", { name: /^Stage Gamma is added to the timeline/ }).click();
    await page.keyboard.press("Escape");
    await expect(filmPanel(page)).toBeHidden();

    // A navigation would show up soon after; none does (a check that nothing happens needs a little time to be wrong in).
    await page.waitForTimeout(800);
    await expect(page).toHaveURL(`${PAIR}?view=timeline`);
    expect(await navigation(page)).toEqual({ marker: "the same document", pushes: [] });
  });
});

test.describe("the people pill", () => {
  test("stages a person added in its search and a person removed from its card, and applies both in one navigation when it closes", async ({ page }) => {
    await mockSearch(page);
    await openPage(page);
    await collapseHero(page);
    await pillLabel(page).click();
    const card = peopleDialog(page);
    await expect(card).toBeVisible();
    const search = page.locator("[data-pill-open]").getByRole("combobox", { name: "Add a person", exact: true });
    await expect(search).toBeFocused();

    await search.fill("stage");
    await page.getByRole("option", { name: /Stage Gamma/ }).click();
    await card.getByRole("button", { name: "Remove Stage Beta", exact: true }).click();

    // In the card at once: the new person marked new, the removed one saying it leaves, with Undo.
    await expect(card.locator('[data-staged="added"]')).toContainText("Stage Gamma");
    await expect(card.locator('[data-staged="removed"]')).toContainText("Leaves the page when this closes");
    await expect(card.getByRole("button", { name: "Undo removing Stage Beta", exact: true })).toBeVisible();
    await expect(page).toHaveURL(`${PAIR}?view=timeline`);
    expect(await navigation(page)).toEqual({ marker: "the same document", pushes: [] });

    await page.keyboard.press("Escape");
    await expect(card).toBeHidden();
    const finalUrl = "/p/90000011-stage-alpha+90000013-stage-gamma?view=timeline";
    await expect(page).toHaveURL(finalUrl);
    expect(await navigation(page)).toEqual({ marker: "the same document", pushes: [finalUrl] });
  });
});

test.describe("the ⌘K people search", () => {
  test("a person's panel opened over it does not apply what is staged: only closing the search does", async ({ page }) => {
    await mockSearch(page);
    await openPage(page);
    await page.keyboard.press(SHORTCUT);
    const overlay = peopleDialog(page);
    const search = overlay.getByRole("combobox", { name: "Add a person", exact: true });
    await search.fill("stage");
    await page.getByRole("option", { name: /Stage Gamma/ }).click();
    await expect(overlay.locator('[data-staged="added"]')).toHaveCount(1);

    // A name opens the person's panel over the search; closing the panel gives the search back, and the page has not moved.
    await overlay.getByRole("button", { name: "Stage Alpha", exact: true }).click();
    const panel = page.getByRole("dialog", { name: /Stage Alpha/ });
    await expect(panel).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(overlay).toBeVisible();
    await expect(overlay.locator('[data-staged="added"]')).toHaveCount(1);
    await page.waitForTimeout(500);
    expect(await navigation(page)).toEqual({ marker: "the same document", pushes: [] });

    await page.keyboard.press(SHORTCUT);
    await expect(page).toHaveURL(WITH_GAMMA);
    expect(await navigation(page)).toEqual({ marker: "the same document", pushes: [WITH_GAMMA] });
  });
});
