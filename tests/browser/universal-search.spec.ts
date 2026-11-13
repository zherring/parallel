import type { Page } from "@playwright/test";
import { test, expect, PEOPLE_PATH } from "./fixtures";

// The site's one search (src/components/universal-search.tsx): the Search button of the header and ⌘K (Command+K on a Mac, Control+K elsewhere: the people overlay's
// shortcut, which has it on a page with a people bar). The header and the button are not on the landing page (its hero field is its search) and not on a /p/ page that
// has the bar (the header is hidden there, globals.css).

const ALPHA_PATH = "/p/90000001-scroll-alpha";
const NOT_FOUND = "/search-test-not-found";
/** A /p/ address that names nobody is a 404 that has no people bar, and so keeps its header. */
const NOT_FOUND_UNDER_PEOPLE = "/p/not-a-slug";
/** Command+K on a Mac, Control+K elsewhere, as the host's keyboard has it (the page reads the same platform). */
const SHORTCUT = "ControlOrMeta+k";

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

const searchButton = (page: Page) => page.getByRole("banner").getByRole("button", { name: "Search", exact: true });
const searchDialog = (page: Page) => page.getByRole("dialog", { name: "Search people", exact: true });
const peopleDialog = (page: Page) => page.getByRole("dialog", { name: "People", exact: true });

/** Waits for the header's button to be live (it is disabled until its handler is hydrated, and a press waits for it): a real press opens the dialog and the close button shuts it. */
async function openFromButton(page: Page, path: string) {
  await page.goto(path);
  await searchButton(page).click();
  const dialog = searchDialog(page);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("combobox")).toBeFocused();
  return dialog;
}

for (const path of [NOT_FOUND, NOT_FOUND_UNDER_PEOPLE]) {
  test(`${path}: the header has the wordmark and a Search button with the shortcut, and both open the search`, async ({ page }) => {
    await page.goto(path);
    const header = page.getByRole("banner");
    await expect(header).toBeVisible();
    await expect(header.getByRole("link", { name: "Parallel home", exact: true })).toBeVisible();
    const button = searchButton(page);
    await expect(button).toBeVisible();
    // The hint is the platform's own (⌘K on a Mac, Ctrl K elsewhere), the same words the settings sheet's People row uses.
    await expect(button).toContainText(/⌘K|Ctrl K/);
    await expect(button).toHaveAttribute("aria-keyshortcuts", /^(Meta|Control)\+K$/);
    await expect(button).toHaveAttribute("aria-haspopup", "dialog");
    // The floating button is gone.
    await expect(page.getByRole("button", { name: "Open search", exact: true })).toHaveCount(0);

    const dialog = await openFromButton(page, path);
    await dialog.getByRole("button", { name: "Close search", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(button).toBeFocused();

    await page.keyboard.press(SHORTCUT);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("combobox", { name: "Search people", exact: true })).toBeFocused();
    // From inside its own field the shortcut is the way out, and focus goes back to the button.
    await page.keyboard.press(SHORTCUT);
    await expect(dialog).toBeHidden();
    await expect(button).toBeFocused();
  });
}

test("the landing page has its own search: the header is the wordmark alone, and the shortcut does nothing", async ({ page }) => {
  await page.goto("/");
  const header = page.getByRole("banner");
  await expect(header).toBeVisible();
  await expect(header.getByRole("link", { name: "Parallel home", exact: true })).toBeVisible();
  await expect(header.getByRole("button")).toHaveCount(0);
  // The hero's field takes focus on a desktop. Once it answers (the page is live) the key is pressed from the page itself, not from the field.
  const hero = page.getByRole("combobox").first();
  await hero.fill("Scroll");
  await expect(page.getByRole("option")).toHaveCount(2);
  await hero.fill("");
  await hero.evaluate((field) => (field as HTMLInputElement).blur());
  await page.keyboard.press(SHORTCUT);
  await page.waitForTimeout(300);
  await expect(searchDialog(page)).toHaveCount(0);
});

test("a timeline page has no header and no second search: ⌘K opens the people overlay, which has it", async ({ page }) => {
  await page.goto(PEOPLE_PATH);
  const gear = page.getByRole("button", { name: "Settings", exact: true });
  await gear.click();
  await expect(page.getByRole("dialog", { name: "Settings", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(gear).toBeFocused();

  await expect(page.getByRole("banner")).toHaveCount(0);
  await expect(page.locator("body > header")).toBeHidden();
  await page.keyboard.press(SHORTCUT);
  await expect(peopleDialog(page)).toBeVisible();
  await expect(searchDialog(page)).toHaveCount(0);
  await page.keyboard.press(SHORTCUT);
  await expect(peopleDialog(page)).toBeHidden();
  await expect(searchDialog(page)).toHaveCount(0);
});

test("the shortcut is not taken while typing in a text field, nor with the other platform's key, Shift or Alt", async ({ page }) => {
  const dialog = await openFromButton(page, NOT_FOUND);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  const mac = await page.evaluate(() => /^(mac|iphone|ipad|ipod)/i.test((navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.platform));
  for (const key of ["k", mac ? "Control+k" : "Meta+k", "ControlOrMeta+Shift+k", "ControlOrMeta+Alt+k"]) {
    await page.keyboard.press(key);
    await expect(dialog).toBeHidden();
  }

  // A text field of the page keeps the key (the people overlay's rule): the visitor is typing.
  await page.evaluate(() => {
    const field = document.createElement("input");
    field.type = "text";
    field.setAttribute("aria-label", "A field of the page");
    document.querySelector("main")!.append(field);
    field.focus();
  });
  await page.keyboard.press(SHORTCUT);
  await page.waitForTimeout(300);
  await expect(dialog).toBeHidden();
  await page.getByRole("textbox", { name: "A field of the page", exact: true }).evaluate((field) => (field as HTMLInputElement).blur());

  await page.keyboard.press(SHORTCUT);
  await expect(dialog).toBeVisible();
  await page.keyboard.press(SHORTCUT);
  await expect(dialog).toBeHidden();

  // Held, it opens once and does not toggle again as the key repeats.
  await page.keyboard.down("ControlOrMeta");
  await page.keyboard.down("k");
  await expect(dialog).toBeVisible();
  await page.keyboard.down("k");
  await page.keyboard.down("k");
  await page.keyboard.up("k");
  await page.keyboard.up("ControlOrMeta");
  await page.waitForTimeout(300);
  await expect(dialog).toBeVisible();
});

test("search traps focus, locks scrolling, and dismisses only from a press that starts and ends on the backdrop", async ({ page }) => {
  const dialog = await openFromButton(page, NOT_FOUND);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");

  const close = dialog.getByRole("button", { name: "Close search", exact: true });
  await close.focus();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("link", { name: "Back to home", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();

  // A press that starts in the field and is released on the backdrop (a drag that selected its text) is not a press on the backdrop.
  const field = dialog.getByRole("combobox");
  const box = (await field.boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(5, 5);
  await page.mouse.up();
  await expect(dialog).toBeVisible();

  await page.mouse.click(5, 5);
  await expect(dialog).toBeHidden();
  await expect(searchButton(page)).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
});

test("focus goes back to the Search button however the dialog closes, even where the browser did not focus the button when it was pressed (Safari)", async ({ page }) => {
  await page.goto(NOT_FOUND);
  // Safari does not focus a button on a click: a press that is not allowed to move focus does the same here.
  await page.evaluate(() => document.addEventListener("mousedown", (event) => event.preventDefault(), true));
  const button = searchButton(page);
  const dialog = searchDialog(page);
  await button.click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(button).toBeFocused();

  await button.click();
  await expect(dialog).toBeVisible();
  await page.mouse.click(5, 5);
  await expect(dialog).toBeHidden();
  await expect(button).toBeFocused();
});

test("Escape is the field's first (its list, its text) and then closes the search, from the field or from anywhere in it", async ({ page }) => {
  const dialog = await openFromButton(page, NOT_FOUND);
  const field = dialog.getByRole("combobox");
  await field.fill("Scroll");
  await expect(dialog.getByRole("option")).toHaveCount(2);
  await page.keyboard.press("Escape");
  await expect(dialog.getByRole("option")).toHaveCount(0);
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(field).toHaveValue("");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(searchButton(page)).toBeFocused();

  await searchButton(page).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Close search", exact: true }).focus();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test.describe("the server's markup, before any script runs", () => {
  test.use({ javaScriptEnabled: false });

  test("the Search button is there but disabled: a press before its handler exists is not accepted", async ({ page }) => {
    await page.goto(NOT_FOUND);
    await expect(searchButton(page)).toBeVisible();
    await expect(searchButton(page)).toBeDisabled();
  });
});

test("the Search button is enabled once the page is live", async ({ page }) => {
  await page.goto(NOT_FOUND);
  await expect(searchButton(page)).toBeEnabled();
});

test("starts a timeline from search, and the next search starts empty", async ({ page }) => {
  const dialog = await openFromButton(page, NOT_FOUND);
  await dialog.getByRole("combobox").fill("Scroll Alpha");
  await dialog.getByRole("option", { name: /Scroll Alpha/ }).click();
  await dialog.getByRole("button", { name: "Show timeline", exact: true }).click();
  await expect(page).toHaveURL(ALPHA_PATH);
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("banner")).toHaveCount(0);

  // Back on a page with the header (a new document: its button is server-rendered, disabled until hydrated, and the press waits for it), the dialog opens with no draft.
  await page.goBack();
  await expect(page).toHaveURL(NOT_FOUND);
  await searchButton(page).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("list", { name: "Selected people", exact: true })).toHaveCount(0);
  await expect(dialog.getByRole("combobox")).toHaveValue("");
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true });

  test("the button and the field have the 44px touch size, and the dialog fits the screen", async ({ page }) => {
    await page.goto(NOT_FOUND);
    const button = searchButton(page);
    await expect(button).toBeVisible();
    // No keyboard shortcut to show to a finger.
    await expect(button).not.toContainText(/⌘K|Ctrl K/);
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);

    await button.tap();
    const dialog = searchDialog(page);
    await expect(dialog).toBeVisible();
    const field = dialog.getByRole("combobox");
    // The whole box is the field to a finger (a press on it focuses the input): the hero size's, 56px, not the compact 36px.
    expect((await dialog.locator("[data-search-box]").boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect((await dialog.getByRole("button", { name: "Close search", exact: true }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await field.fill("Scroll");
    await expect(dialog.getByRole("option")).toHaveCount(2);
    const bounds = (await dialog.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(375);
    await dialog.getByRole("option", { name: /Scroll Beta/ }).tap();
    await expect(dialog.getByRole("button", { name: "Show timeline", exact: true })).toBeEnabled();
    await dialog.getByRole("button", { name: "Close search", exact: true }).tap();
    await expect(dialog).toBeHidden();
    await expect(button).toBeFocused();
  });
});
