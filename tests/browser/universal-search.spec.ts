import { test, expect, PEOPLE_PATH, openPeople } from "./fixtures";

const ALPHA_PATH = "/p/90000001-scroll-alpha";

test.beforeEach(async ({ page, next }) => {
  // Activate the shared server-side person fixtures before navigating.
  void next;
  await page.route("**/api/search?*", (route) => route.fulfill({
    json: { results: [
      { id: 90000001, name: "Scroll Alpha", profilePath: null, knownFor: "Acting", knownForTitles: ["Scroll Film"] },
      { id: 90000002, name: "Scroll Beta", profilePath: null, knownFor: "Acting", knownForTitles: ["Scroll Film"] },
    ] },
  }));
});

for (const [name, path] of [["home", "/"], ["timeline", PEOPLE_PATH], ["not found", "/search-test-not-found"]]) {
  test(`Cmd/Ctrl+K opens search on ${name}, even from an input`, async ({ page }) => {
    await page.goto(path);
    const trigger = page.getByRole("button", { name: "Open search", exact: true });
    // A real interaction waits for hydration before testing document-level shortcuts.
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Search people", exact: true });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Close search", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.locator("body > header")).toHaveCount(0);

    for (const shortcut of ["Meta+k", "Control+k"]) {
      const field = page.getByRole("combobox").first();
      if (await field.count()) await field.focus();
      else await trigger.focus();
      await page.keyboard.press(shortcut);
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole("combobox", { name: "Search people", exact: true })).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();
      await expect(await field.count() ? field : trigger).toBeFocused();
    }
  });
}

test("search traps focus, locks scrolling and dismisses from the backdrop", async ({ page }) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Open search", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Search people", exact: true });
  await expect(dialog.getByRole("combobox")).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");

  const close = dialog.getByRole("button", { name: "Close search", exact: true });
  await close.focus();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("link", { name: "Back to home", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();

  await page.mouse.click(5, 5);
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
});

test("shortcut toggles search without interfering with other key combinations", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open search", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Search people", exact: true });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Control+k");
  await expect(dialog).not.toBeVisible();
  for (const key of ["k", "Control+Shift+k", "Control+Alt+k"]) {
    await page.keyboard.press(key);
    await expect(dialog).not.toBeVisible();
  }
  await page.keyboard.press("Control+k");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
});

test("starts an independent timeline from search and stays available after navigation", async ({ page }) => {
  await openPeople(page);
  await page.keyboard.press("Control+k");
  const dialog = page.getByRole("dialog", { name: "Search people", exact: true });
  await dialog.getByRole("combobox").fill("Scroll Alpha");
  const option = dialog.getByRole("option", { name: /Scroll Alpha/ });
  // People already in the current timeline remain selectable in the universal search.
  await expect(option).not.toHaveAttribute("aria-disabled", "true");
  await option.click();
  await dialog.getByRole("button", { name: "Show timeline", exact: true }).click();
  await expect(page).toHaveURL(ALPHA_PATH);
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("combobox", { name: "Add a person", exact: true })).toBeVisible();

  await page.keyboard.press("Meta+k");
  await expect(dialog.getByRole("combobox")).toBeFocused();
  await expect(dialog.getByRole("list", { name: "Selected people", exact: true })).toHaveCount(0);
  await dialog.getByRole("combobox").fill("Scroll Alpha");
  await dialog.getByRole("option", { name: /Scroll Alpha/ }).click();
  // Navigating to the current URL still dismisses search.
  await dialog.getByRole("button", { name: "Show timeline", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page).toHaveURL(ALPHA_PATH);
});

test("Escape dismisses search results and search, leaving a detail panel underneath open", async ({ page }) => {
  await openPeople(page);
  const details = page.getByTitle("Details for Scroll Alpha", { exact: true });
  await details.click();
  const panel = page.getByRole("dialog", { name: "Scroll Alpha", exact: true });
  await expect(panel).toBeVisible();
  await page.keyboard.press("Control+k");
  const search = page.getByRole("dialog", { name: "Search people", exact: true });
  await expect(search.getByRole("combobox")).toBeFocused();
  await search.getByRole("combobox").fill("Scroll");
  await expect(search.getByRole("option")).toHaveCount(2);
  await page.keyboard.press("Escape");
  await expect(search).not.toBeVisible();
  await expect(panel).toBeVisible();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
  await page.keyboard.press("Escape");
  await expect(panel).not.toBeVisible();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
});

test("search is usable on a narrow touch viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open search", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Search people", exact: true });
  await dialog.getByRole("combobox").fill("Scroll");
  await expect(dialog.getByRole("option")).toHaveCount(2);
  const bounds = await dialog.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(375);
  await dialog.getByRole("option", { name: /Scroll Beta/ }).click();
  await expect(dialog.getByRole("button", { name: "Show timeline", exact: true })).toBeEnabled();
  await dialog.getByRole("button", { name: "Close search", exact: true }).click();
  await expect(dialog).not.toBeVisible();
});
