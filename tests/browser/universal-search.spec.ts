import type { Locator, Page } from "@playwright/test";
import { test, expect, PEOPLE_PATH } from "./fixtures";

// The site's one search (src/components/universal-search.tsx): the Search button of the header and ⌘K (Command+K on a Mac, Control+K elsewhere: the people overlay's
// shortcut, routed by SearchProvider to the registered page search). Home keeps its hero field and no Search button, but the shortcut is still available.
// On /p/ pages the header is hidden (globals.css); the shortcut opens the contextual People overlay instead.

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

test("the landing page keeps its hero search and opens universal search with the shortcut", async ({ page }) => {
  await page.goto("/");
  const header = page.getByRole("banner");
  await expect(header).toBeVisible();
  await expect(header.getByRole("link", { name: "Parallel home", exact: true })).toBeVisible();
  await expect(header.getByRole("button")).toHaveCount(0);
  // The hero's field takes focus on a desktop. Once it answers (the page is live) the key is pressed from the page itself, not from the field.
  const hero = page.getByRole("combobox").first();
  await hero.fill("Scroll");
  await expect(page.getByRole("option")).toHaveCount(2);
  await hero.evaluate((field) => (field as HTMLInputElement).blur());
  await page.keyboard.press(SHORTCUT);
  const dialog = searchDialog(page);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("combobox")).toBeFocused();
  await expect(dialog.getByRole("combobox")).toHaveValue("");
  await expect(peopleDialog(page)).toHaveCount(0);
  await page.keyboard.press(SHORTCUT);
  await expect(dialog).toHaveCount(0);
  // Opening another search does not overwrite the draft in the landing page's hero.
  await expect(hero).toHaveValue("Scroll");
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

test("one shortcut follows soft navigation and browser history without keeping the old page's search", async ({ page }) => {
  await page.goto("/");
  const hero = page.getByRole("combobox").first();
  await hero.fill("Scroll");
  await expect(page.getByRole("option")).toHaveCount(2);
  await hero.fill("");
  const home = page.getByRole("banner").getByRole("link", { name: "Parallel home", exact: true });
  await home.focus();
  await page.keyboard.press(SHORTCUT);
  const dialog = searchDialog(page);
  await expect(dialog).toBeVisible();
  await page.evaluate(() => { document.documentElement.dataset.searchSession = "same document"; });
  await dialog.getByRole("combobox").fill("Scroll Alpha");
  await dialog.getByRole("option", { name: /Scroll Alpha/ }).click();
  await dialog.getByRole("button", { name: "Show timeline", exact: true }).click();
  await expect(page).toHaveURL(ALPHA_PATH);
  const gear = page.getByRole("button", { name: "Settings", exact: true });
  await gear.click();
  await expect(page.getByRole("dialog", { name: "Settings", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.keyboard.press(SHORTCUT);
  await expect(peopleDialog(page)).toBeVisible();
  await expect(dialog).toHaveCount(0);
  await expect(peopleDialog(page).getByRole("combobox", { name: "Add a person", exact: true })).toBeFocused();
  await page.keyboard.press(SHORTCUT);
  await expect(peopleDialog(page)).toHaveCount(0);
  await expect(gear).toBeFocused();

  await page.getByRole("link", { name: "Back to Parallel home", exact: true }).click();
  await expect(page).toHaveURL("/");
  await home.focus();
  await page.keyboard.press(SHORTCUT);
  await expect(dialog).toBeVisible();
  await expect(peopleDialog(page)).toHaveCount(0);
  await expect(dialog.getByRole("combobox")).toHaveValue("");

  // Navigate away while search is open: its draft and modal effects must not survive the route.
  await dialog.getByRole("combobox").fill("Unfinished draft");
  await page.goBack();
  await expect(page).toHaveURL(ALPHA_PATH);
  await expect(dialog).toHaveCount(0);
  await gear.focus();
  await page.keyboard.press(SHORTCUT);
  await expect(peopleDialog(page)).toBeVisible();
  await expect(dialog).toHaveCount(0);
  await page.keyboard.press(SHORTCUT);
  await expect(peopleDialog(page)).toHaveCount(0);

  await page.goBack();
  await expect(page).toHaveURL("/");
  await home.focus();
  await page.keyboard.press(SHORTCUT);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("combobox")).toHaveValue("");
  await expect(peopleDialog(page)).toHaveCount(0);
  await page.keyboard.press(SHORTCUT);
  await expect(dialog).toHaveCount(0);
  await expect(page.locator("[inert]")).toHaveCount(0);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
  await expect(page.locator("html")).toHaveAttribute("data-search-session", "same document");
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

/**
 * The geometry of a chip field (`PersonSearch`, chips mode): the input, the chips and the Show timeline button all inside the box, the input clear of the button, and
 * nothing of the field running past the box or the viewport.
 */
async function expectFieldFits(page: Page, scope: Locator, viewportWidth: number) {
  const field = scope.locator("[data-search-box]");
  const box = (await field.boundingBox())!;
  const input = (await scope.getByRole("combobox").boundingBox())!;
  const submit = (await scope.getByRole("button", { name: "Show timeline", exact: true }).boundingBox())!;
  const EPSILON = 0.5;

  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewportWidth + EPSILON);
  // The input is inside the box and ends where the button begins: it never runs under it.
  expect(input.x).toBeGreaterThanOrEqual(box.x - EPSILON);
  expect(input.x + input.width).toBeLessThanOrEqual(submit.x + EPSILON);
  expect(submit.x + submit.width).toBeLessThanOrEqual(box.x + box.width + EPSILON);
  expect(submit.y).toBeGreaterThanOrEqual(box.y - EPSILON);
  expect(submit.y + submit.height).toBeLessThanOrEqual(box.y + box.height + EPSILON);
  // Still a field to type in, not a sliver.
  expect(input.width).toBeGreaterThanOrEqual(120);
  // The chips wrap inside the box.
  for (const chip of await scope.getByRole("list", { name: "Selected people", exact: true }).getByRole("listitem").all()) {
    const chipBox = (await chip.boundingBox())!;
    expect(chipBox.x).toBeGreaterThanOrEqual(box.x - EPSILON);
    expect(chipBox.x + chipBox.width).toBeLessThanOrEqual(box.x + box.width + EPSILON);
  }
  // Nothing overflows the box (its scrollable width is its own), and the page has no sideways scroll.
  expect(await field.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
}

/** A long name, as a pasted or runaway query: the input scrolls its text and keeps its box. */
const LONG_QUERY = "Scroll Alpha ".repeat(8).trim();

async function pick(scope: Locator, name: RegExp, query: string) {
  await scope.getByRole("combobox").fill(query);
  await scope.getByRole("option", { name }).click();
}

test.describe("at 320 CSS px, the narrowest width a page must reflow to", () => {
  test.use({ viewport: { width: 320, height: 568 }, hasTouch: true, isMobile: true });

  test("the dialog's field keeps its input clear of the Show timeline button, empty, with chips and with a long query", async ({ page }) => {
    await page.goto(NOT_FOUND);
    await searchButton(page).tap();
    const dialog = searchDialog(page);
    await expect(dialog).toBeVisible();
    const field = dialog.getByRole("combobox");
    await expect(field).toBeFocused();

    const bounds = (await dialog.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
    await expectFieldFits(page, dialog, 320);

    await field.fill(LONG_QUERY);
    await expectFieldFits(page, dialog, 320);
    await field.fill("");

    await pick(dialog, /Scroll Alpha/, "Scroll");
    await expect(dialog.getByRole("list", { name: "Selected people", exact: true }).getByRole("listitem")).toHaveCount(1);
    await expectFieldFits(page, dialog, 320);

    await pick(dialog, /Scroll Beta/, "Scroll");
    await expect(dialog.getByRole("list", { name: "Selected people", exact: true }).getByRole("listitem")).toHaveCount(2);
    await expectFieldFits(page, dialog, 320);

    await field.fill(LONG_QUERY);
    await expect(dialog.getByRole("option")).toHaveCount(2);
    await expectFieldFits(page, dialog, 320);
    await expect(dialog.getByRole("button", { name: "Show timeline", exact: true })).toBeEnabled();
  });

  test("the landing hero's field, which is the same chip field, fits as well", async ({ page }) => {
    await page.goto("/");
    const hero = page.locator("[data-hero-search]");
    const field = hero.getByRole("combobox");
    await field.fill("Scroll");
    await expect(page.getByRole("option")).toHaveCount(2);
    await page.getByRole("option", { name: /Scroll Alpha/ }).click();
    await expect(hero.getByRole("list", { name: "Selected people", exact: true }).getByRole("listitem")).toHaveCount(1);
    await expectFieldFits(page, hero, 320);

    await field.fill(LONG_QUERY);
    await expectFieldFits(page, hero, 320);
  });

  test("the people overlay's field, the same hero size without chips, fits beside its close button", async ({ page }) => {
    await page.goto(PEOPLE_PATH);
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Settings", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.keyboard.press(SHORTCUT);
    const overlay = peopleDialog(page);
    await expect(overlay).toBeVisible();
    const field = overlay.getByRole("combobox", { name: "Add a person", exact: true });
    await field.fill(LONG_QUERY);
    const box = (await overlay.locator("[data-search-box]").boundingBox())!;
    const input = (await field.boundingBox())!;
    const close = (await overlay.getByRole("button", { name: "Close people", exact: true }).boundingBox())!;
    expect(input.x).toBeGreaterThanOrEqual(box.x - 0.5);
    expect(input.x + input.width).toBeLessThanOrEqual(box.x + box.width + 0.5);
    expect(box.x + box.width).toBeLessThanOrEqual(close.x + 0.5);
    expect(close.x + close.width).toBeLessThanOrEqual(320);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });
});
