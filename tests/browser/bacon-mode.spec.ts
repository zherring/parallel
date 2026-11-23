import type { Page } from "@playwright/test";
import { test, expect, bar, boxOf, intersects, isOnTopAtCentre, viewLink } from "./fixtures";

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

/** The query of each request for his collaborators in this test. */
let collaboratorUrls: string[] = [];

const ORANGE = "rgb(255, 128, 0)";
const GREEN = "rgb(0, 224, 84)";

test.beforeEach(async ({ page, next }) => {
  void next;
  await page.route("**/api/search?*", (route) => {
    const inMode = new URL(route.request().url()).searchParams.get("with") === "4724";
    // The server's order: Hardy (no film with him) ranks above Cruise.
    return route.fulfill({ json: inMode ? { results: [hanks, hardy, cruise], pairings: [] } : { results: [kevin, costner], pairings: [] } });
  });
  // With or without `?fill=` (the mode asks for his list to be filled: his graph row is thin); the addresses asked for are kept to check the mode does.
  collaboratorUrls = [];
  await page.route(/\/api\/collaborators\/4724(\?.*)?$/, (route) => {
    collaboratorUrls.push(new URL(route.request().url()).search);
    return route.fulfill({ json: { source: "graph", results: often } });
  });
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
  // The mode asks for the list to be filled to what the dropdown shows (SUGGESTION_LIMIT), once.
  expect(collaboratorUrls).toEqual(["?fill=8"]);
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

// ---- Sharing a page in the mode (src/lib/bacon-share.ts) -----------------------------------------------------------------------------

/** Opens `path`, then the Share menu of its gear sheet, and shares with every action in turn (the clipboard and the native share sheet are stubbed to keep what they were given): the address each would post. */
async function sharedLinks(page: Page, path: string) {
  await page.addInitScript(() => {
    const w = window as unknown as { __shared: { copied: string[]; shared: string[] } };
    w.__shared = { copied: [], shared: [] };
    Object.defineProperty(navigator, "share", { value: async (data: { url: string }) => void w.__shared.shared.push(data.url), configurable: true });
    Object.defineProperty(navigator, "clipboard", { value: { writeText: async (text: string) => void w.__shared.copied.push(text) }, configurable: true });
  });
  await page.goto(path);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Settings", exact: true });
  const share = sheet.getByRole("button", { name: "Share", exact: true });
  const menu = sheet.getByRole("menu");
  await share.click();
  await expect(menu).toBeVisible();
  const x = new URL((await menu.getByRole("menuitem", { name: /Post on X/ }).getAttribute("href"))!).searchParams.get("url")!;
  const bluesky = new URL((await menu.getByRole("menuitem", { name: /Post on Bluesky/ }).getAttribute("href"))!).searchParams.get("text")!;
  await menu.getByRole("menuitem", { name: "More...", exact: true }).click();
  await expect(menu).toBeHidden();
  await share.click();
  await menu.getByRole("menuitem", { name: "Copy link", exact: true }).click();
  const { copied, shared } = await page.evaluate(() => (window as unknown as { __shared: { copied: string[]; shared: string[] } }).__shared);
  return { origin: new URL(page.url()).origin, x, bluesky, shared: shared[0], copied: copied[0] };
}

test("every way of sharing a page in the mode carries the mode: X, Bluesky, the share sheet and Copy link", async ({ page, next }) => {
  void next;
  const links = await sharedLinks(page, `${BACON_PAIR}?mode=bacon&view=timeline`);
  const link = `${links.origin}${BACON_PAIR}?mode=bacon`;
  expect(links.x).toBe(link);
  expect(links.bluesky).toContain(link);
  expect(links.shared).toBe(link);
  // Copy link is the address as it is, with the view, and the mode in it.
  expect(links.copied).toBe(`${links.origin}${BACON_PAIR}?mode=bacon&view=timeline`);
});

test("out of the mode no way of sharing carries it, and a mode in the address of a page without him is not shared", async ({ page, next }) => {
  void next;
  const plain = await sharedLinks(page, `${BACON_PAIR}?view=timeline`);
  expect([plain.x, plain.bluesky, plain.shared, plain.copied].some((link) => link.includes("mode="))).toBe(false);
  expect(plain.x).toBe(`${plain.origin}${BACON_PAIR}`);
  expect(plain.copied).toBe(`${plain.origin}${BACON_PAIR}?view=timeline`);
});

test("a page that names the mode without him shares as the ordinary page it is", async ({ page, next }) => {
  void next;
  const path = "/p/90000001-scroll-alpha+90000002-scroll-beta";
  const links = await sharedLinks(page, `${path}?mode=bacon&view=timeline`);
  expect(links.x).toBe(`${links.origin}${path}`);
  expect(links.shared).toBe(`${links.origin}${path}`);
  expect(links.copied).toBe(`${links.origin}${path}?view=timeline`);
});

// ---- The pair's embed in the mode (`/embed/p/<people>?mode=bacon`) ---------------------------------------------------------------------

const BACON_EMBED = `/embed/p${BACON_PAIR.slice("/p".length)}`;

test("the pair's embed in the mode draws the films made together orange, with a small mark in its bar; out of the mode it is white and has none", async ({ page, next }) => {
  void next;
  await page.goto(`${BACON_EMBED}?mode=bacon&motion=reduce`);
  const frame = page.locator("[data-bacon-page]");
  await expect(frame).toHaveCount(1);
  expect(await together(page)).toBe("#ff8000");
  // The first frame's shared films are the orange (`data-part="node"`), as the card the link unfurls into draws them.
  await expect(page.locator('[data-part="node"]').first()).toHaveCSS("background-color", ORANGE);
  await expect(page.locator('[data-part="poster"]').first()).toHaveCSS("border-top-color", ORANGE);
  // Once the timeline is up the bar says the mode, and the way to the page leads to it in the mode.
  const mark = page.locator("[data-bacon-mark]");
  await expect(mark).toBeVisible();
  await expect(mark).toHaveText("Kevin Bacon mode");
  await expect(page.getByRole("link", { name: /Open in Parallel/ })).toHaveAttribute("href", `${BACON_PAIR}?mode=bacon`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("(Kevin Bacon mode)");

  await page.goto(`${BACON_EMBED}?motion=reduce`);
  await expect(page.locator("[data-bacon-page]")).toHaveCount(0);
  await expect(page.locator("[data-bacon-mark]")).toHaveCount(0);
  expect(await together(page)).toBe("#fff");
  await expect(page.locator('[data-part="node"]').first()).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(page.getByRole("link", { name: /Open in Parallel/ })).toHaveAttribute("href", BACON_PAIR);
});

test("the embed still has the frame-ancestors policy of every embed, with or without the mode", async ({ page, next }) => {
  void next;
  for (const path of [BACON_EMBED, `${BACON_EMBED}?mode=bacon`]) {
    const response = await page.goto(path);
    expect(response!.headers()["content-security-policy"]).toContain("frame-ancestors");
  }
});

// ---- The landing page's tab ----------------------------------------------------------------------------------------------------

test("the landing page has a Kevin Bacon tab: his pairs as cards, each opening the pair in the mode", async ({ page }) => {
  await page.goto("/#bacon");
  const pill = page.locator("[data-genre-tab='bacon']");
  await expect(pill).toHaveText("Kevin Bacon");
  await expect(pill).toHaveAttribute("aria-selected", "true");
  const cards = page.locator("#pairings-panel-bacon [data-landing-card]");
  const count = await cards.count();
  expect(count).toBeGreaterThanOrEqual(5);
  expect(count).toBeLessThanOrEqual(8);
  for (let index = 0; index < count; index++) {
    await expect(cards.nth(index)).toHaveAttribute("href", /^\/p\/4724-kevin-bacon\+\d+-[a-z-]+\?mode=bacon$/);
  }
  // The other tabs' cards are untouched: no mode in their links.
  await page.goto("/#classic");
  const classic = page.locator("#pairings-panel-classic [data-landing-card]");
  expect(await classic.evaluateAll((links) => links.filter((link) => (link.getAttribute("href") ?? "").includes("mode=")).length)).toBe(0);
});

// ---- Nobody is drawn in the mode's orange (src/lib/person-colors.ts, `portraitPersonHexes`) ----------------------------------------------------------------

const SEDGWICK_PAIR = "/p/4724-kevin-bacon+26467-kyra-sedgwick";
/** The portrait palette's orange, which Kyra Sedgwick's id lands on, and the colour the mode gives her instead (the next entry; the teal before it is Kevin Bacon's). */
const PALETTE_ORANGE = "#F28C28";
const PALETTE_PINK = "#E5487D";
const PALETTE_TEAL = "#1F9E89";

/** The colour of the person in slot `slot` (the URL order), as the page's custom property `--person-N` has it (see `personColorCss`). */
const personColor = (page: Page, slot: number) =>
  page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(`--person-${n}`).trim(), slot + 1);

test("in the mode Kyra Sedgwick is not drawn in the orange, which is what 'made together' is: she takes the next colour, and out of the mode she is as she was", async ({ page, next }) => {
  void next;
  await page.goto(`${SEDGWICK_PAIR}?view=timeline`);
  await expect(bar(page)).toBeVisible();
  expect(await personColor(page, 0)).toBe(PALETTE_TEAL);
  expect(await personColor(page, 1)).toBe(PALETTE_ORANGE);

  await page.goto(`${SEDGWICK_PAIR}?view=timeline&mode=bacon`);
  await expect(bar(page)).toHaveAttribute("data-bacon-page", "");
  expect(await personColor(page, 0)).toBe(PALETTE_TEAL);
  expect(await personColor(page, 1)).toBe(PALETTE_PINK);
  expect(await together(page)).toBe("#ff8000");

  // The Films view, which is another page render, has the same colours.
  await page.goto(`${SEDGWICK_PAIR}?view=depth&mode=bacon`);
  await expect(bar(page)).toHaveAttribute("data-bacon-page", "");
  expect(await personColor(page, 1)).toBe(PALETTE_PINK);
});

test("a page of three in the mode has the person palette without its orange; out of the mode it has it whole", async ({ page, next }) => {
  void next;
  const team = `${SEDGWICK_PAIR}+90000001-scroll-alpha`;
  await page.goto(`${team}?view=timeline`);
  await expect(bar(page)).toBeVisible();
  expect(await personColor(page, 2)).toBe("#d27650");
  await page.goto(`${team}?view=timeline&mode=bacon`);
  await expect(bar(page)).toHaveAttribute("data-bacon-page", "");
  expect(await personColor(page, 0)).toBe("#6f9bd1");
  expect(await personColor(page, 1)).toBe("#d0a845");
  expect(await personColor(page, 2)).toBe("#c487a6");
});

test("the pair's embed in the mode has the same colours as the page: none of them orange", async ({ page, next }) => {
  void next;
  const embed = `/embed/p${SEDGWICK_PAIR.slice("/p".length)}`;
  await page.goto(`${embed}?mode=bacon&motion=reduce`);
  await expect(page.locator("[data-bacon-page]")).toHaveCount(1);
  expect(await personColor(page, 1)).toBe(PALETTE_PINK);
  await page.goto(`${embed}?motion=reduce`);
  expect(await personColor(page, 1)).toBe(PALETTE_ORANGE);
});

test("the landing page's Kevin Bacon tab draws nobody in the orange; another tab's cards keep their colours", async ({ page }) => {
  await page.goto("/#bacon");
  const cards = page.locator("#pairings-panel-bacon [data-landing-card]");
  await expect(cards.first()).toBeVisible();
  // The portraits are drawn once the tab's panel has been shown and measured: every card has them before the colours are read.
  for (let index = 0; index < (await cards.count()); index++) await expect(cards.nth(index).locator("[data-card-portraits] > *").first()).toBeAttached();
  const colours = await cards.evaluateAll((links) => links.map((link) => ({ href: link.getAttribute("href") ?? "", html: link.innerHTML.toLowerCase() })));
  expect(colours.length).toBeGreaterThanOrEqual(5);
  for (const { href, html } of colours) expect(html, href).not.toContain(PALETTE_ORANGE.toLowerCase());
  // Kyra Sedgwick's card has her next colour.
  expect(colours.find(({ href }) => href.includes("26467"))?.html).toContain(PALETTE_PINK.toLowerCase());

  // A pair out of the mode keeps the colours it had: Gary Oldman's orange is on no card of the Bacon tab, and the card's link has no mode.
  await page.goto("/#classic");
  const classicCards = page.locator("#pairings-panel-classic [data-landing-card]");
  await expect(classicCards.last().locator("[data-card-portraits] > *").first()).toBeAttached();
  const classic = await classicCards.evaluateAll((links) => links.map((link) => link.innerHTML.toLowerCase()));
  expect(classic.some((html) => html.includes(PALETTE_ORANGE.toLowerCase()))).toBe(true);
});

// ---- The teams' group when there are none ------------------------------------------------------------------------------------------

test("with no teams the empty field has no Teams group at all: no header, no error row, and nothing waiting once the answer is in", async ({ page }) => {
  // The beforeEach's answer: no teams (what a minimum of three films leaves for him, from live TMDB: none).
  const answered = page.waitForResponse("**/api/teams/4724");
  await openHomeSearch(page);
  const field = page.getByRole("combobox");
  await field.fill("kevin bacon");
  await page.getByRole("option", { name: /Kevin Bacon mode/ }).click();
  await answered;
  // The people he works with are listed; the teams are not.
  await expect(page.getByRole("group", { name: "Often with Kevin Bacon", exact: true })).toBeVisible();
  await expect(page.getByRole("group", { name: "Teams with Kevin Bacon", exact: true })).toHaveCount(0);
  await expect(page.getByText("Teams with Kevin Bacon", { exact: true })).toHaveCount(0);
  await expect(page.locator("[data-teams-error]")).toHaveCount(0);
  await expect(page.locator("[data-teams-loading]")).toHaveCount(0);
  await expect(page.getByRole("listbox")).toHaveAttribute("aria-label", "People");
});
