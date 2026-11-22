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
  await page.goto("/");
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
  await page.goto("/");
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
  await page.goto("/");
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
  await page.goto("/");
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
