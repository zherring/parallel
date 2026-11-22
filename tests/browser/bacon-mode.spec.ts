import { test, expect } from "./fixtures";

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
  await expect(page).toHaveURL(/\/p\/4724-kevin-bacon\+31-tom-hanks$/);
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
