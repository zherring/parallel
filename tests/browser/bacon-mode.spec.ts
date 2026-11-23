import type { Page } from "@playwright/test";
import { test, expect, bar, viewLink } from "./fixtures";

// Kevin Bacon mode (src/lib/bacon-mode.ts): a search for him offers the mode; in it the field is orange, holds him and one
// other person, and only people who share a film with him can be added.
const kevin = { id: 4724, name: "Kevin Bacon", profilePath: null, knownFor: "Acting", knownForTitles: ["Footloose", "Apollo 13"] };
const costner = { id: 1269, name: "Kevin Costner", profilePath: null, knownFor: "Acting", knownForTitles: ["JFK"] };
const hanks = { id: 31, name: "Tom Hanks", profilePath: null, knownFor: "Acting", knownForTitles: ["Apollo 13"], together: 1 };
const hardy = { id: 2524, name: "Tom Hardy", profilePath: null, knownFor: "Acting", knownForTitles: ["Locke"], together: 0 };
const cruise = { id: 500, name: "Tom Cruise", profilePath: null, knownFor: "Acting", knownForTitles: ["Top Gun"], together: 1 };
const often = [
  { id: 3197, name: "Tom Sizemore", profilePath: null, sharedCount: 2, roles: "Actor", titles: ["Film A", "Film B"] },
  { id: 2228, name: "Sean Penn", profilePath: null, sharedCount: 2, roles: "Actor", titles: ["Mystic River"] },
];

/** The landing page's search is the site's search dialog, opened from the field-shaped button in its top bar: the chip field the mode starts in. */
async function openHomeSearch(page: Page) {
  await page.goto("/");
  await page.locator("[data-landing-bar]").getByRole("button", { name: /Search any film artist/ }).click();
  await expect(page.getByRole("dialog", { name: "Search people", exact: true })).toBeVisible();
}

const ORANGE = "rgb(255, 128, 0)";
const GREEN = "rgb(0, 224, 84)";

test.beforeEach(async ({ page, next }) => {
  void next;
  await page.route("**/api/search?*", (route) => {
    const inMode = new URL(route.request().url()).searchParams.get("with") === "4724";
    // The server's order: Hardy (no film with him) ranks above Cruise.
    return route.fulfill({ json: inMode ? { results: [hanks, hardy, cruise], pairings: [] } : { results: [kevin, costner], pairings: [] } });
  });
  await page.route("**/api/collaborators/4724", (route) => route.fulfill({ json: { source: "graph", results: often } }));
  // No teams unless a test has some (a later route for the same address wins).
  await page.route("**/api/teams/4724", (route) => route.fulfill({ json: { results: [] } }));
});

test("a search for Kevin Bacon offers the mode after him; choosing it turns the field orange and lists who he works with", async ({ page }) => {
  await openHomeSearch(page);
  const field = page.getByRole("combobox");
  const go = page.getByRole("button", { name: "Show timeline", exact: true });
  await field.fill("kevin bacon");
  const options = page.getByRole("option");
  await expect(options).toHaveCount(3);
  await expect(options.nth(0)).toContainText("Kevin Bacon");
  await expect(options.nth(1)).toContainText("Kevin Bacon mode");
  await expect(options.nth(2)).toContainText("Kevin Costner");
  await expect(go).toHaveCSS("background-color", GREEN);

  await options.nth(1).click();
  const chips = page.getByRole("list", { name: "Selected people" });
  await expect(chips.getByRole("listitem")).toHaveCount(1);
  await expect(chips.locator("[data-mode-chip]")).toContainText("Kevin Bacon");
  await expect(chips.locator("[data-mode-chip]")).toHaveCSS("background-color", ORANGE);
  await expect(go).toHaveCSS("background-color", ORANGE);
  await expect(field).toBeFocused();
  await expect(field).toHaveValue("");
  await expect(page.locator("[data-mode-rule]")).toContainText("Only people who have shared a film with Kevin Bacon");
  const suggested = page.getByRole("group", { name: "Often with Kevin Bacon", exact: true }).getByRole("option");
  await expect(suggested).toHaveCount(2);
  await expect(suggested.first()).toContainText("Tom Sizemore");
});

test("in the mode only his co-workers can be added, one at a time, and the pair opens with Enter", async ({ page }) => {
  await openHomeSearch(page);
  const field = page.getByRole("combobox");
  await field.fill("kevin bacon");
  await page.getByRole("option", { name: /Kevin Bacon mode/ }).click();

  await field.fill("tom");
  const options = page.getByRole("option");
  await expect(options).toHaveCount(3);
  // The two who have a film with him first; the one who has none is listed, and cannot be picked.
  await expect(options.nth(0)).toContainText("Tom Hanks");
  await expect(options.nth(0)).toContainText("1 film with Kevin Bacon");
  await expect(options.nth(1)).toContainText("Tom Cruise");
  await expect(options.nth(2)).toContainText("Tom Hardy");
  await expect(options.nth(2)).toContainText("No films with Kevin Bacon");
  await expect(options.nth(2)).toHaveAttribute("aria-disabled", "true");
  // A press on him does nothing (forced: Playwright waits for a disabled option otherwise).
  await options.nth(2).click({ force: true });
  const chips = page.getByRole("list", { name: "Selected people" }).getByRole("listitem");
  await expect(chips).toHaveCount(1);

  await field.press("Enter");
  await expect(chips).toHaveCount(2);
  await expect(chips.nth(1)).toContainText("Tom Hanks");

  // Full at two: nobody else can be added.
  await field.fill("tom");
  await expect(page.locator("[data-mode-rule]")).toContainText("one person at a time");
  await expect(options.nth(1)).toHaveAttribute("aria-disabled", "true");
  await field.press("Enter");
  await expect(chips).toHaveCount(2);

  await field.fill("");
  await field.press("Enter");
  // The mode goes on to the page, in its address.
  await expect(page).toHaveURL(/\/p\/4724-kevin-bacon\+31-tom-hanks\?mode=bacon$/);
});

test("removing his chip leaves the mode: the field is green again and keeps the other person", async ({ page }) => {
  await openHomeSearch(page);
  const field = page.getByRole("combobox");
  const go = page.getByRole("button", { name: "Show timeline", exact: true });
  await field.fill("kevin bacon");
  await page.getByRole("option", { name: /Kevin Bacon mode/ }).click();
  await page.getByRole("option", { name: /Sean Penn/ }).click();
  await expect(go).toHaveCSS("background-color", ORANGE);

  await page.getByRole("button", { name: "Remove Kevin Bacon and leave Kevin Bacon mode", exact: true }).click();
  const chips = page.getByRole("list", { name: "Selected people" }).getByRole("listitem");
  await expect(chips).toHaveCount(1);
  await expect(chips.first()).toContainText("Sean Penn");
  await expect(go).toHaveCSS("background-color", GREEN);
  await expect(page.locator("[data-mode-rule]")).toHaveCount(0);
});

// ---- The mode on the pair's page (`?mode=bacon`) -------------------------------------------------------------------------------------

const BACON_PAIR = "/p/4724-kevin-bacon+90000001-scroll-alpha";
const SHORTCUT = "ControlOrMeta+k";
const beta = { id: 90000002, name: "Scroll Beta", profilePath: null, knownFor: "Acting", knownForTitles: ["Scroll Film"], together: 9 };
const gamma = { id: 90000003, name: "Scroll Gamma", profilePath: null, knownFor: "Acting", knownForTitles: ["Scroll Film"], together: 0 };

/** The colour of "made together" on the page: white on a pair's page, orange in the mode. */
const together = (page: Page) => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--together").trim());

/** The page's search answers a mode's search (`with=4724`) with one co-worker and one stranger, and nothing otherwise. */
async function mockModeSearch(page: Page) {
  await page.route("**/api/search?*", (route) => {
    const inMode = new URL(route.request().url()).searchParams.get("with") === "4724";
    return route.fulfill({ json: { results: inMode ? [gamma, beta] : [], pairings: [] } });
  });
}

test("the pair's page in the mode is orange, says so in its bar, and keeps the mode from view to view", async ({ page, next }) => {
  void next;
  await page.goto(`${BACON_PAIR}?mode=bacon`);
  await expect(bar(page)).toHaveAttribute("data-bacon-page", "");
  expect(await together(page)).toBe("#ff8000");
  const badge = bar(page).getByRole("link", { name: "Leave Kevin Bacon mode", exact: true });
  await expect(badge).toBeVisible();

  await viewLink(page, "timeline").click();
  await expect(page).toHaveURL(/mode=bacon/);
  await expect(page).toHaveURL(/view=timeline/);
  await viewLink(page, "depth").click();
  await expect(page).toHaveURL(/view=depth/);
  await expect(page).toHaveURL(/mode=bacon/);
  await expect(bar(page)).toHaveAttribute("data-bacon-page", "");

  // The badge is the way out: the same page and view, white again.
  await bar(page).getByRole("link", { name: "Leave Kevin Bacon mode", exact: true }).click();
  await expect(page).not.toHaveURL(/mode=bacon/);
  await expect(page).toHaveURL(/view=depth/);
  await expect(bar(page)).not.toHaveAttribute("data-bacon-page");
  expect(await together(page)).toBe("#fff");
});

test("the address alone does not make a page his: without him it is an ordinary page", async ({ page, next }) => {
  void next;
  await page.goto("/p/90000001-scroll-alpha+90000002-scroll-beta?mode=bacon");
  await expect(bar(page)).toBeVisible();
  await expect(bar(page)).not.toHaveAttribute("data-bacon-page");
  expect(await together(page)).toBe("#fff");
});

test("on the page the people search keeps the mode's rules: a pair is full, and only a co-worker can take the other's place", async ({ page, next }) => {
  void next;
  await mockModeSearch(page);
  await page.goto(`${BACON_PAIR}?mode=bacon&view=timeline`);
  await expect(bar(page)).toHaveAttribute("data-bacon-page", "");
  await page.keyboard.press(SHORTCUT);
  const dialog = page.getByRole("dialog", { name: "People", exact: true });
  const field = dialog.getByRole("combobox", { name: "Add a person", exact: true });
  await expect(field).toHaveAttribute("placeholder", "Kevin Bacon mode is full");
  await field.fill("scroll");
  await expect(dialog.getByRole("option")).toHaveCount(2);
  // Him and one other is all the mode holds: nobody can be added, co-worker or not.
  await expect(dialog.getByRole("option", { name: /Scroll Beta/ })).toHaveAttribute("aria-disabled", "true");

  await field.fill("");
  await dialog.getByRole("button", { name: "Remove Scroll Alpha", exact: true }).click();
  await field.fill("scroll");
  const options = dialog.getByRole("option");
  await expect(options.nth(0)).toContainText("Scroll Beta");
  await expect(options.nth(0)).toContainText("9 films with Kevin Bacon");
  await expect(options.nth(0)).not.toHaveAttribute("aria-disabled", "true");
  await expect(options.nth(1)).toContainText("No films with Kevin Bacon");
  await expect(options.nth(1)).toHaveAttribute("aria-disabled", "true");
  await options.nth(0).click();

  await dialog.getByRole("button", { name: "Close people", exact: true }).click();
  await expect(page).toHaveURL(/\/p\/4724-kevin-bacon\+90000002-scroll-beta\?/);
  await expect(page).toHaveURL(/mode=bacon/);
  await expect(page).toHaveURL(/view=timeline/);
  await expect(bar(page)).toHaveAttribute("data-bacon-page", "");
});

test("removing him from the page leaves the mode with him", async ({ page, next }) => {
  void next;
  await mockModeSearch(page);
  await page.goto(`${BACON_PAIR}?mode=bacon&view=timeline`);
  await expect(bar(page)).toHaveAttribute("data-bacon-page", "");
  await page.keyboard.press(SHORTCUT);
  const dialog = page.getByRole("dialog", { name: "People", exact: true });
  await dialog.getByRole("button", { name: "Remove Kevin Bacon", exact: true }).click();
  await dialog.getByRole("button", { name: "Close people", exact: true }).click();
  await expect(page).toHaveURL("/p/90000001-scroll-alpha?view=timeline");
  await expect(bar(page)).not.toHaveAttribute("data-bacon-page");
});

test("the empty field lists the teams he has worked with most, and a team opens the page of the three, in the mode", async ({ page, next }) => {
  void next;
  await page.route("**/api/teams/4724", (route) =>
    route.fulfill({
      json: {
        results: [
          {
            people: [{ id: 90000001, name: "Scroll Alpha", profilePath: null }, { id: 90000002, name: "Scroll Beta", profilePath: null }],
            sharedCount: 9,
            titles: ["Scroll Film 100", "Scroll Film 101"],
          },
        ],
      },
    }),
  );
  await openHomeSearch(page);
  const field = page.getByRole("combobox");
  await field.fill("kevin bacon");
  await page.getByRole("option", { name: /Kevin Bacon mode/ }).click();
  const team = page.getByRole("group", { name: "Teams with Kevin Bacon", exact: true }).getByRole("option");
  await expect(team).toHaveCount(1);
  await expect(team).toContainText("Scroll Alpha × Scroll Beta");
  await expect(team).toContainText("9 films with Kevin Bacon");
  // The keyboard reaches it after the people: two of them, then the team.
  await field.press("ArrowDown");
  await field.press("End");
  await expect(team).toHaveAttribute("aria-selected", "true");
  await field.press("Enter");
  await expect(page).toHaveURL("/p/4724-kevin-bacon+90000001-scroll-alpha+90000002-scroll-beta?mode=bacon");
  await expect(bar(page)).toHaveAttribute("data-bacon-page", "");
});

// ---- Review follow-ups ---------------------------------------------------------------------------------------------------------------

test("a search answer with a result that could not be checked is not kept: typing it again asks again", async ({ page }) => {
  let asked = 0;
  await page.route("**/api/search?*", (route) => {
    const inMode = new URL(route.request().url()).searchParams.get("with") === "4724";
    if (!inMode) return route.fulfill({ json: { results: [kevin, costner], pairings: [] } });
    asked += 1;
    // The first answer could not check Tom Cruise's filmography in time (null); the second can.
    return route.fulfill({ json: { results: [hanks, asked === 1 ? { ...cruise, together: null } : cruise], pairings: [] } });
  });
  await openHomeSearch(page);
  const field = page.getByRole("combobox");
  await field.fill("kevin bacon");
  await page.getByRole("option", { name: /Kevin Bacon mode/ }).click();

  await field.fill("tom");
  const options = page.getByRole("option");
  await expect(options).toHaveCount(2);
  await expect(options.nth(1)).toContainText("Could not check for films with Kevin Bacon");
  await expect(options.nth(1)).toHaveAttribute("aria-disabled", "true");

  await field.fill("");
  await field.fill("tom");
  await expect(options.nth(1)).toContainText("1 film with Kevin Bacon");
  await expect(options.nth(1)).not.toHaveAttribute("aria-disabled", "true");
  expect(asked).toBe(2);
});

test("the teams that fail to load say so, with a Retry that asks again", async ({ page }) => {
  let asked = 0;
  await page.route("**/api/teams/4724", (route) => {
    asked += 1;
    if (asked === 1) return route.fulfill({ status: 502, json: { error: "TMDB is unavailable, try again shortly" } });
    return route.fulfill({
      json: {
        results: [
          {
            people: [{ id: 90000001, name: "Scroll Alpha", profilePath: null }, { id: 90000002, name: "Scroll Beta", profilePath: null }],
            sharedCount: 9,
            titles: ["Scroll Film 100"],
          },
        ],
      },
    });
  });
  await openHomeSearch(page);
  const field = page.getByRole("combobox");
  await field.fill("kevin bacon");
  await page.getByRole("option", { name: /Kevin Bacon mode/ }).click();

  const failed = page.locator("[data-teams-error]");
  await expect(failed).toContainText("Couldn’t load teams");
  await failed.getByRole("button", { name: "Retry", exact: true }).click();
  const team = page.getByRole("group", { name: "Teams with Kevin Bacon", exact: true }).getByRole("option");
  await expect(team).toHaveCount(1);
  await expect(team).toContainText("Scroll Alpha × Scroll Beta");
  await expect(failed).toHaveCount(0);
  expect(asked).toBe(2);
});

/** Waits until the page is live: the gear's sheet opens and closes, which only a hydrated page does (a press before that does nothing). */
async function waitUntilLive(page: Page) {
  const gear = page.getByRole("button", { name: "Settings", exact: true });
  await gear.click();
  await expect(page.getByRole("dialog", { name: "Settings", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(gear).toBeFocused();
}

// A name's own page (the person panel's "View their timeline") keeps the mode where he is on it, and takes no view along, as before. (The lane header's remove link and
// name link are the separate-lanes layout's, which is parked: `LANES_ENABLED`; the remove link keeps the view and the mode by `carriedPeopleHref`, which bacon-mode.test.ts covers.)
test("on a page in the mode, a person panel's link to their own page keeps the mode on his page only", async ({ page, next }) => {
  void next;
  await page.goto(`${BACON_PAIR}?mode=bacon&view=timeline`);
  await expect(bar(page)).toHaveAttribute("data-bacon-page", "");
  await waitUntilLive(page);

  await page.getByRole("button", { name: "Kevin Bacon", exact: true }).first().click();
  const panel = page.getByRole("dialog", { name: "Kevin Bacon", exact: true });
  await expect(panel.getByRole("link", { name: /View their timeline/ })).toHaveAttribute("href", "/p/4724-kevin-bacon?mode=bacon");
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();

  await page.getByRole("button", { name: "Scroll Alpha", exact: true }).first().click();
  const other = page.getByRole("dialog", { name: "Scroll Alpha", exact: true });
  await expect(other.getByRole("link", { name: /View their timeline/ })).toHaveAttribute("href", "/p/90000001-scroll-alpha");
});

test("a stale ?mode=bacon on a page without him is dropped by the canonical redirect, and does not carry anywhere", async ({ page, next }) => {
  void next;
  // A shorthand slug with an address that names the mode, and he is not on the page: the redirect keeps the view and drops the word.
  await page.goto("/p/90000001+90000002?mode=bacon&view=timeline");
  await expect(page).toHaveURL("/p/90000001-scroll-alpha+90000002-scroll-beta?view=timeline");
  await expect(bar(page)).not.toHaveAttribute("data-bacon-page");

  // The same word with him on the page is kept.
  await page.goto("/p/4724+90000001?mode=bacon&view=timeline");
  await expect(page).toHaveURL("/p/4724-kevin-bacon+90000001-scroll-alpha?view=timeline&mode=bacon");
  await expect(bar(page)).toHaveAttribute("data-bacon-page", "");
});

// A film's panel in the mode: the cast of a film he is in can be added only where the pair page would count the film for him and them.
const FILM = {
  id: 100,
  title: "Scroll Film 100",
  year: 2000,
  releaseDate: "2000-01-01",
  posterPath: null,
  backdropPath: null,
  runtime: 120,
  tagline: null,
  overview: "A film for the mode's panel.",
  genres: ["Drama"],
  cast: [
    { id: 4724, name: "Kevin Bacon", profilePath: null, job: "Actor", role: "actor", character: "Lead", order: 0 },
    { id: 90000003, name: "Scroll Gamma", profilePath: null, job: "Actor", role: "actor", character: "Second", order: 1 },
    { id: 90000009, name: "Scroll Walkon", profilePath: null, job: "Actor", role: "actor", character: "Himself", order: 30 },
  ],
  crew: [],
};

test("in a film's panel, a person who is only a cameo there cannot be added: the row is dimmed with the search's note", async ({ page, next }) => {
  void next;
  await page.route("**/api/movie/100", (route) => route.fulfill({ json: FILM }));
  await page.goto("/p/4724-kevin-bacon?mode=bacon&view=timeline");
  await expect(bar(page)).toHaveAttribute("data-bacon-page", "");
  await waitUntilLive(page);
  await page.getByRole("button", { name: /^Scroll Film 100, 2000\./ }).click();
  const dialog = page.getByRole("dialog", { name: "Scroll Film 100", exact: true });
  await expect(dialog).toBeVisible();

  await expect(dialog.getByRole("button", { name: "Add Scroll Gamma to timeline", exact: true })).toBeEnabled();
  const walkon = dialog.getByRole("listitem").filter({ hasText: "Scroll Walkon" });
  await expect(walkon).toHaveAttribute("data-mode-blocked", "");
  await expect(walkon).toContainText("No films with Kevin Bacon");
  await expect(walkon.getByRole("button", { name: "Add Scroll Walkon to timeline", exact: true })).toBeDisabled();
  await expect(dialog.locator("[data-film-blocked]")).toHaveCount(0);
});
