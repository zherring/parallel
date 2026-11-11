import { test, expect, type Page } from "next/experimental/testmode/playwright";
import { bar, collapseHero, heroState, scene } from "./fixtures";

// ⌘K (Command+K on a Mac, Control+K elsewhere) opens the full-screen people search on every view of a `/p/` page, whether the pair hero is expanded or collapsed
// (src/components/people-overlay.tsx). The people pill is only in reach once the hero has collapsed, and a pair with no films together has an empty Table too
// short to scroll: the shortcut is the way to change who is on the page from there.

const QUIET_PATH = "/p/90000021-quiet-alpha+90000022-quiet-beta";
/** The pair has made no film together: its Table is the empty state, and the page is shorter than the screen. */
const TABLE = `${QUIET_PATH}?view=table`;

const film = (id: number, title: string, date: string) => ({ id, title, release_date: date, poster_path: null, vote_count: 100, order: 0, character: "Lead" });
const people: Record<string, { name: string; films: ReturnType<typeof film>[] }> = {
  "90000021": { name: "Quiet Alpha", films: [film(501, "Quiet Film A", "2001-06-01")] },
  "90000022": { name: "Quiet Beta", films: [film(502, "Quiet Film B", "2003-06-01")] },
  "90000023": { name: "Quiet Gamma", films: [film(503, "Quiet Film C", "2005-06-01")] },
};

test.beforeEach(async ({ next }) => {
  next.onFetch((request) => {
    const url = new URL(request.url);
    if (url.hostname !== "api.themoviedb.org") return "abort";
    const match = url.pathname.match(/^\/3\/person\/(\d+)(\/movie_credits)?$/);
    const found = match ? people[match[1]] : undefined;
    if (match && found) {
      if (match[2]) return Response.json({ cast: found.films, crew: [] });
      return Response.json({ id: Number(match[1]), name: found.name, profile_path: null, birthday: "1960-01-01", biography: `${found.name} is an actor.` });
    }
    if (url.pathname === "/3/discover/movie") return Response.json({ total_pages: 1, results: [] });
    return "abort";
  });
});

/** The search's answers: Quiet Beta is already on the page, Quiet Gamma is not. */
async function mockSearch(page: Page) {
  await page.route("**/api/search?*", (route) =>
    route.fulfill({
      json: {
        results: [
          { id: 90000022, name: "Quiet Beta", profilePath: null, knownFor: "Acting", knownForTitles: ["Quiet Film B"] },
          { id: 90000023, name: "Quiet Gamma", profilePath: null, knownFor: "Acting", knownForTitles: ["Quiet Film C"] },
        ],
      },
    }),
  );
}

/** Opens the page and waits for it to be live (a state transition, not a sleep: the gear's sheet opens and closes). The gear has focus after it. */
async function openPage(page: Page, path = TABLE) {
  await page.goto(path);
  const gear = page.getByRole("button", { name: "Settings", exact: true });
  await gear.click();
  await expect(page.getByRole("dialog", { name: "Settings", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(gear).toBeFocused();
  return gear;
}

const overlay = (page: Page) => page.getByRole("dialog", { name: "People", exact: true });
const overlaySearch = (page: Page) => overlay(page).getByRole("combobox", { name: "Add a person", exact: true });
/** Command+K on a Mac, Control+K elsewhere, as the host's keyboard has it (the page reads the same platform). */
const SHORTCUT = "ControlOrMeta+k";

test("⌘K opens a full-screen people search on a page too short to scroll, with the field focused and the people listed; Escape closes it and puts focus back", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const gear = await openPage(page);

  // The premise: the hero cannot collapse, so the people pill is inert and out of reach, and the page has nothing to scroll.
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);
  await page.mouse.wheel(0, 600);
  expect(await heroState(page)).toBe("expanded");
  await expect(page.locator("[data-people-pill]").locator("xpath=..")).toHaveAttribute("inert", "");

  await page.keyboard.press(SHORTCUT);
  const dialog = overlay(page);
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  // Full screen (once its fade-and-grow is over).
  await expect.poll(() => dialog.boundingBox()).toEqual({ x: 0, y: 0, width: 1440, height: 900 });
  // The field to add a person has focus, and the people on the page are listed with a way to remove each: the pill's card's rows.
  await expect(overlaySearch(page)).toBeFocused();
  await expect(dialog.getByRole("button", { name: "Details for Quiet Alpha", exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Quiet Alpha", exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Quiet Beta", exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Remove Quiet Alpha", exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Remove Quiet Beta", exact: true })).toBeVisible();
  // Each person's portrait is ringed in their colour (the pill's blue and amber).
  const heads = dialog.locator("[data-row-head] > button > span");
  await expect(heads).toHaveCount(2);
  await expect(heads.nth(0)).toHaveCSS("box-shadow", /rgb\(111, 155, 209\)/);
  await expect(heads.nth(1)).toHaveCSS("box-shadow", /rgb\(208, 168, 69\)/);
  // The rest of the page is out of reach while it is open (the bar, with its gear, is inert), and gives way to it again after.
  const barInert = () => page.evaluate(() => document.querySelector("[data-people-bar]")?.closest("[inert]") !== null);
  expect(await barInert()).toBe(true);

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(gear).toBeFocused();
  expect(await barInert()).toBe(false);
});

test("⌘K again closes it, the close button does too, and each puts focus back where it was", async ({ page }) => {
  const gear = await openPage(page);

  await page.keyboard.press(SHORTCUT);
  await expect(overlay(page)).toBeVisible();
  await expect(overlaySearch(page)).toBeFocused();
  // From inside its own field.
  await page.keyboard.press(SHORTCUT);
  await expect(overlay(page)).toBeHidden();
  await expect(gear).toBeFocused();

  await page.keyboard.press(SHORTCUT);
  await expect(overlay(page)).toBeVisible();
  await overlay(page).getByRole("button", { name: "Close people", exact: true }).click();
  await expect(overlay(page)).toBeHidden();
  await expect(gear).toBeFocused();
});

test("the browser's own ⌘K is not let through", async ({ page }) => {
  await openPage(page);
  await page.evaluate(() => {
    const seen: boolean[] = [];
    (window as unknown as { __prevented: boolean[] }).__prevented = seen;
    // After the page's own listener (which is on the document, in the bubbling phase): the last word on whether the key's default was prevented.
    window.addEventListener("keydown", (event) => { if (event.key.toLowerCase() === "k") seen.push(event.defaultPrevented); });
  });
  await page.keyboard.press(SHORTCUT);
  await expect(overlay(page)).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __prevented: boolean[] }).__prevented)).toEqual([true]);
});

test("Tab stays inside the overlay, and the page behind keeps its place", async ({ page, browserName }) => {
  // Safari's Tab skips buttons and links unless full keyboard access is on (Playwright's WebKit is Safari's default): there is no cycle to trap.
  test.skip(browserName === "webkit", "Tab does not reach buttons and links in Safari by default");
  await openPage(page);
  await page.keyboard.press(SHORTCUT);
  const dialog = overlay(page);
  await expect(overlaySearch(page)).toBeFocused();
  const insideDialog = () => page.evaluate(() => Boolean(document.activeElement?.closest("[data-people-overlay]")));
  // More Tabs than the overlay has controls, forwards and back: focus never leaves it.
  for (let step = 0; step < 14; step++) {
    await page.keyboard.press("Tab");
    expect(await insideDialog(), `Tab ${step + 1}`).toBe(true);
  }
  for (let step = 0; step < 14; step++) {
    await page.keyboard.press("Shift+Tab");
    expect(await insideDialog(), `Shift+Tab ${step + 1}`).toBe(true);
  }
  await expect(dialog).toBeVisible();
});

test("it is not taken while the visitor types in a text field or textarea elsewhere, and not by the other platform's chord", async ({ page }) => {
  await openPage(page);

  for (const tag of ["input", "textarea"]) {
    await page.evaluate((name) => {
      const field = document.createElement(name);
      field.id = "typing-elsewhere";
      document.body.append(field);
      field.focus();
    }, tag);
    await page.keyboard.type("ab");
    await page.keyboard.press(SHORTCUT);
    await expect(overlay(page)).toHaveCount(0);
    await expect(page.locator("#typing-elsewhere")).toBeFocused();
    await expect(page.locator("#typing-elsewhere")).toHaveValue("ab");
    await page.locator("#typing-elsewhere").evaluate((field) => field.remove());
  }

  // Control on a Mac and Meta elsewhere: not the shortcut.
  const mac = await page.evaluate(() => /^(mac|iphone|ipad|ipod)/i.test(navigator.platform));
  await page.getByRole("button", { name: "Settings", exact: true }).focus();
  await page.keyboard.press(mac ? "Control+k" : "Meta+k");
  await expect(overlay(page)).toHaveCount(0);
  await page.keyboard.press(SHORTCUT);
  await expect(overlay(page)).toBeVisible();
});

/** Marks this document and counts what the page pushes onto the history, so that a test can tell a soft navigation (one push, the marker kept) from a reload or from several. */
async function watchNavigation(page: Page) {
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
const navigation = (page: Page) => page.evaluate(() => ({ marker: (window as unknown as { __marker?: string }).__marker, pushes: (window as unknown as { __pushes: string[] }).__pushes }));

test("adding a person from the overlay stages it: the person is in the list at once, marked new, and the page is not touched until the overlay closes, in one soft navigation that keeps the view", async ({ page }) => {
  await mockSearch(page);
  const gear = await openPage(page);
  await watchNavigation(page);

  await page.keyboard.press(SHORTCUT);
  const search = overlaySearch(page);
  await expect(search).toBeFocused();
  await search.fill("quiet");
  // Quiet Beta is on the page already; Quiet Gamma is the one to add.
  await expect(page.getByRole("option", { name: /Quiet Beta/ })).toHaveAttribute("aria-disabled", "true");
  await page.getByRole("option", { name: /Quiet Gamma/ }).click();

  // In the list now, marked new, with a way to take it back; the field is empty and still has focus, for another; and the search knows they are in.
  const added = overlay(page).locator('[data-staged="added"]');
  await expect(added).toHaveCount(1);
  await expect(added).toContainText("Quiet Gamma");
  await expect(added).toContainText("New");
  await expect(added.getByRole("button", { name: "Remove Quiet Gamma", exact: true })).toBeVisible();
  await expect(search).toBeFocused();
  await expect(search).toHaveValue("");
  await search.fill("quiet");
  await expect(page.getByRole("option", { name: /Quiet Gamma/ })).toHaveAttribute("aria-disabled", "true");
  // Nothing has happened to the page: the address, the document and the people behind.
  await expect(page).toHaveURL(/\/p\/90000021-quiet-alpha\+90000022-quiet-beta\?view=table$/);
  expect(await navigation(page)).toEqual({ marker: "the same document", pushes: [] });
  await expect(page.locator("[data-people-pill] button[aria-label^='People on this page']")).toHaveAttribute("aria-label", "People on this page: Quiet Alpha & Quiet Beta");

  // Closing it applies the change, once, as a soft navigation, to the page with them in the view the visitor is on.
  await page.keyboard.press(SHORTCUT);
  await expect(overlay(page)).toHaveCount(0);
  // Focus is back where it was before the navigation starts (the page that opens is a new one).
  await expect(gear).toBeFocused();
  await expect(page).toHaveURL(/\/p\/90000021-quiet-alpha\+90000022-quiet-beta\+90000023-quiet-gamma\?view=table$/);
  await expect(page.locator("[data-people-pill] button[aria-label^='People on this page']")).toHaveAttribute("aria-label", /Quiet Gamma/);
  expect(await navigation(page)).toEqual({ marker: "the same document", pushes: ["/p/90000021-quiet-alpha+90000022-quiet-beta+90000023-quiet-gamma?view=table"] });
  // The page is live and its scroll is the visitor's again.
  await expect(page.getByRole("button", { name: "Settings", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
});

test("removing a person from the overlay stages it: the row says it leaves, with Undo, and closing it goes to the page without them", async ({ page }) => {
  await openPage(page);
  await watchNavigation(page);
  await page.keyboard.press(SHORTCUT);
  const dialog = overlay(page);
  await dialog.getByRole("button", { name: "Remove Quiet Beta", exact: true }).click();

  const removed = dialog.locator('[data-staged="removed"]');
  await expect(removed).toHaveCount(1);
  await expect(removed).toContainText("Quiet Beta");
  await expect(removed).toContainText("Leaves the page when this closes");
  expect(await navigation(page)).toEqual({ marker: "the same document", pushes: [] });
  await expect(page).toHaveURL(/\/p\/90000021-quiet-alpha\+90000022-quiet-beta\?view=table$/);

  // Undo takes it back (the row is as it was), and Remove stages it again.
  await removed.getByRole("button", { name: "Undo removing Quiet Beta", exact: true }).click();
  await expect(dialog.locator("[data-staged]")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Remove Quiet Beta", exact: true }).click();
  await expect(dialog.locator('[data-staged="removed"]')).toHaveCount(1);

  await page.keyboard.press(SHORTCUT);
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/p\/90000021-quiet-alpha\?view=table$/);
  expect(await navigation(page)).toEqual({ marker: "the same document", pushes: ["/p/90000021-quiet-alpha?view=table"] });
  await expect(page.locator("[data-people-pill] button[aria-label^='People on this page']")).toHaveAttribute("aria-label", "People on this page: Quiet Alpha");
});

test("changes that cancel out, or none, leave the page alone when the overlay closes", async ({ page }) => {
  await mockSearch(page);
  await openPage(page);
  await watchNavigation(page);

  // Nothing staged.
  await page.keyboard.press(SHORTCUT);
  await expect(overlaySearch(page)).toBeFocused();
  await page.keyboard.press(SHORTCUT);
  await expect(overlay(page)).toHaveCount(0);

  // Added and taken back; removed and undone.
  await page.keyboard.press(SHORTCUT);
  await overlaySearch(page).fill("quiet");
  await page.getByRole("option", { name: /Quiet Gamma/ }).click();
  await overlay(page).getByRole("button", { name: "Remove Quiet Gamma", exact: true }).click();
  await overlay(page).getByRole("button", { name: "Remove Quiet Alpha", exact: true }).click();
  await overlay(page).getByRole("button", { name: "Undo removing Quiet Alpha", exact: true }).click();
  await expect(overlay(page).locator("[data-staged]")).toHaveCount(0);
  await overlay(page).getByRole("button", { name: "Close people", exact: true }).click();
  await expect(overlay(page)).toHaveCount(0);

  // A navigation would show up soon after; none does (a check that nothing happens needs a little time to be wrong in).
  await page.waitForTimeout(800);
  await expect(page).toHaveURL(/\/p\/90000021-quiet-alpha\+90000022-quiet-beta\?view=table$/);
  expect(await navigation(page)).toEqual({ marker: "the same document", pushes: [] });
});

test("every change staged in one session is applied in one navigation: someone out, two in, in the order they were added", async ({ page }) => {
  await mockSearch(page);
  await openPage(page);
  await watchNavigation(page);
  await page.keyboard.press(SHORTCUT);
  await overlay(page).getByRole("button", { name: "Remove Quiet Alpha", exact: true }).click();
  await overlaySearch(page).fill("quiet");
  await page.getByRole("option", { name: /Quiet Gamma/ }).click();
  await overlay(page).getByRole("button", { name: "Close people", exact: true }).click();

  await expect(page).toHaveURL(/\/p\/90000022-quiet-beta\+90000023-quiet-gamma\?view=table$/);
  expect(await navigation(page)).toEqual({ marker: "the same document", pushes: ["/p/90000022-quiet-beta+90000023-quiet-gamma?view=table"] });
});

test("a name in the overlay opens the person's panel over it, and closing the panel gives the overlay back, with focus on the name", async ({ page }) => {
  await openPage(page);
  await page.keyboard.press(SHORTCUT);
  const name = overlay(page).getByRole("button", { name: "Quiet Alpha", exact: true });
  await name.click();
  const panel = page.getByRole("dialog", { name: /Quiet Alpha/ });
  await expect(panel).toBeVisible();

  // Escape is the panel's own: it closes the panel and not the overlay under it, and focus is back on the name.
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(overlay(page)).toBeVisible();
  await expect(name).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(overlay(page)).toBeHidden();
});

test("where a pressed button is not focused (Safari), the person's panel still hands focus back to the name that opened it", async ({ page }) => {
  await openPage(page);
  await page.keyboard.press(SHORTCUT);
  const name = overlay(page).getByRole("button", { name: "Quiet Alpha", exact: true });
  // Safari does not focus a button on a click: focus stays where it was, in the overlay's field, whichever the engine.
  await page.evaluate(() => document.addEventListener("mousedown", (event) => event.preventDefault(), true));
  await expect(overlaySearch(page)).toBeFocused();
  await name.click();
  const panel = page.getByRole("dialog", { name: /Quiet Alpha/ });
  await expect(panel).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(name).toBeFocused();
});

test("a visitor who asked for less motion gets no animation, and anyone else a quick one", async ({ page }) => {
  const animated = async () => {
    await page.evaluate(() => {
      const seen: string[] = [];
      (window as unknown as { __animated: string[] }).__animated = seen;
      const animate = HTMLElement.prototype.animate;
      HTMLElement.prototype.animate = function (this: HTMLElement, keyframes, options) {
        if (this.hasAttribute("data-people-overlay")) seen.push("overlay");
        return animate.call(this, keyframes, options);
      };
    });
    await page.keyboard.press(SHORTCUT);
    await expect(overlay(page)).toBeVisible();
    const seen = await page.evaluate(() => (window as unknown as { __animated: string[] }).__animated);
    await page.keyboard.press(SHORTCUT);
    await expect(overlay(page)).toBeHidden();
    return seen;
  };

  await page.emulateMedia({ reducedMotion: "reduce" });
  await openPage(page);
  expect(await animated()).toEqual([]);

  await page.emulateMedia({ reducedMotion: "no-preference" });
  expect((await animated()).length).toBeGreaterThan(0);
});

for (const view of ["timeline", "table", "depth"] as const) {
  // The Table of a pair with nothing together is the page too short to scroll: its hero never collapses (the premise of the test above).
  const collapses = view !== "table";
  test(`on the ${view} view, with the hero expanded${collapses ? " and collapsed" : ""}, ⌘K opens the overlay and ⌘K closes it`, async ({ page }) => {
    await openPage(page, `${QUIET_PATH}?view=${view}`);
    await expect(bar(page)).toHaveAttribute("data-hero", "expanded");
    await page.keyboard.press(SHORTCUT);
    await expect(overlaySearch(page)).toBeFocused();
    await page.keyboard.press(SHORTCUT);
    await expect(overlay(page)).toBeHidden();
    if (!collapses) return;

    await collapseHero(page);
    await page.keyboard.press(SHORTCUT);
    await expect(overlaySearch(page)).toBeFocused();
    await expect(overlay(page).getByRole("button", { name: "Remove Quiet Alpha", exact: true })).toBeVisible();
    await page.keyboard.press(SHORTCUT);
    await expect(overlay(page)).toBeHidden();
    if (view === "depth") await expect(scene(page)).toBeVisible();
  });
}
