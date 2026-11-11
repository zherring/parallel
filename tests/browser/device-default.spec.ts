import type { Page } from "next/experimental/testmode/playwright";
import { PAIR, expect, test } from "./almodovar";
import { bar, collapseHero, scene, switcher, viewLink } from "./fixtures";

/**
 * A link that names no view opens the Films view (the Depth view) on a phone and the Timeline everywhere else. The server decides, from the user agent
 * (`device.type === "mobile"`), so the page never flashes the other view; a view the link names always wins; and every link to the Timeline names it
 * (`?view=timeline`), or a phone would bounce a tap on Timeline back to Films. The device is the user agent's, not the window's: a narrow desktop window is still a desktop.
 */

// Activate the server-side fetch fixtures before any test navigates to a people page.
test.beforeEach(async ({ next }) => {
  void next;
});

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const IPAD = "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

const settingsGear = (page: Page) => page.getByRole("button", { name: "Settings", exact: true });
const sheetViews = (page: Page) => page.getByRole("dialog", { name: "Settings", exact: true }).getByRole("navigation", { name: "Views", exact: true });
const flat = (page: Page) => page.getByRole("region", { name: "Film timeline. Scroll sideways to see more years.", exact: true });

/** The server's HTML of a page: what is on the screen before any script runs. */
async function serverHtml(page: Page, path: string) {
  const response = await page.goto(path);
  return response!.text();
}

test.describe("on a phone", () => {
  test.use({ userAgent: IPHONE, viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("a plain address lands on Films, in the server's own HTML: no flash of the Timeline", async ({ page }) => {
    const html = await serverHtml(page, PAIR);
    expect(html).toContain("data-depth-scene");
    expect(html).not.toContain("data-fullscreen-panel");
    await expect(scene(page)).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-view", "depth");
    // The address stays the plain one: nothing is added to it.
    expect(new URL(page.url()).search).toBe("");
    await settingsGear(page).tap();
    await expect(sheetViews(page).locator('[aria-current="page"]')).toHaveText("Films");
  });

  test("a period alone names no view, so it lands on Films too", async ({ page }) => {
    await page.goto(`${PAIR}?from=2001&to=2005`);
    await expect(scene(page)).toBeVisible();
  });

  for (const [view, ready] of [
    ["timeline", (page: Page) => expect(flat(page)).toBeVisible()],
    ["table", (page: Page) => expect(page.getByRole("heading", { name: /films/i }).first()).toBeAttached()],
    ["clippings", (page: Page) => expect(page.locator('[id^="quote-"]').first()).toBeAttached()],
  ] as const) {
    test(`a link that names the ${view} view wins: it is the flat page, not Films`, async ({ page }) => {
      const html = await serverHtml(page, `${PAIR}?view=${view}`);
      expect(html).not.toContain("data-depth-scene");
      await expect(scene(page)).toHaveCount(0);
      await ready(page);
    });
  }

  test("a link that names Films opens Films, and a quote of the pair's own opens the Quotes", async ({ page }) => {
    await page.goto(`${PAIR}?view=depth`);
    await expect(scene(page)).toBeVisible();
    await page.goto(`${PAIR}?quote=i-was-so-happy-that-he`);
    await expect(scene(page)).toHaveCount(0);
    await expect(page.locator("#quote-i-was-so-happy-that-he")).toBeVisible();
  });

  test("tapping Timeline in the gear's sheet stays on the Timeline: the link says view=timeline, so the phone's default does not bounce it back to Films", async ({ page }) => {
    await page.goto(PAIR);
    await expect(scene(page)).toBeVisible();
    await settingsGear(page).tap();
    const timeline = sheetViews(page).getByRole("link", { name: "Timeline", exact: true });
    await expect(timeline).toHaveAttribute("href", `${PAIR}?view=timeline`);
    await timeline.tap();
    await expect(page.getByRole("dialog", { name: "Settings", exact: true })).toBeHidden();
    await expect(flat(page)).toBeVisible();
    await expect(scene(page)).toHaveCount(0);
    expect(new URL(page.url()).search).toBe("?view=timeline");
    await settingsGear(page).tap();
    await expect(sheetViews(page).locator('[aria-current="page"]')).toHaveText("Timeline");
    await page.keyboard.press("Escape");
    // Reloading that address is still the Timeline.
    await page.reload();
    await expect(flat(page)).toBeVisible();
    await expect(scene(page)).toHaveCount(0);
  });

  test("the Timeline's address stays the Timeline from every other view of the page", async ({ page }) => {
    for (const from of ["?view=table", "?view=clippings", "?view=depth", "?from=2001&to=2005"]) {
      await page.goto(`${PAIR}${from}`);
      await hydrated(page);
      await settingsGear(page).tap();
      const href = await sheetViews(page).getByRole("link", { name: "Timeline", exact: true }).getAttribute("href");
      expect(new URL(href!, "https://parallel.test").searchParams.get("view"), from).toBe("timeline");
      await page.keyboard.press("Escape");
    }
  });

  test("removing a person keeps the view the visitor is on: the Timeline and Films, on a phone", async ({ page }) => {
    await page.goto(`${PAIR}?view=timeline`);
    await expect(flat(page)).toBeVisible();
    await hydrated(page);
    await collapseHero(page);
    await bar(page).getByRole("button", { name: /^People on this page/ }).tap();
    const card = page.getByRole("dialog", { name: "People", exact: true });
    // Remove stages the removal, and closing the card goes to the page without them, in the view the visitor is on.
    await card.getByRole("button", { name: "Remove Pedro Almodóvar", exact: true }).tap();
    await page.getByRole("button", { name: "Close people", exact: true }).tap();
    await expect(page).toHaveURL(/\/p\/955-penelope-cruz\?view=timeline$/);

    // Films (the plain address on a phone): removing someone stays in Films.
    await page.goto(PAIR);
    await expect(scene(page)).toBeVisible();
    await hydrated(page);
    await collapseHero(page);
    await bar(page).getByRole("button", { name: /^People on this page/ }).tap();
    await card.getByRole("button", { name: "Remove Pedro Almodóvar", exact: true }).tap();
    await page.getByRole("button", { name: "Close people", exact: true }).tap();
    await expect(page).toHaveURL(/\/p\/955-penelope-cruz\?view=depth$/);
  });

  test("the canonical address stays the plain one: it never carries a view", async ({ page }) => {
    await page.goto(PAIR);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/p\/309-pedro-almodovar\+955-penelope-cruz$/);
    await page.goto(`${PAIR}?view=timeline`);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/p\/309-pedro-almodovar\+955-penelope-cruz$/);
  });
});

/** Waits until the page is live: a state transition (the gear's sheet opening and closing), not a sleep. */
async function hydrated(page: Page) {
  const sheet = page.getByRole("dialog", { name: "Settings", exact: true });
  await settingsGear(page).click();
  await expect(sheet).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
}

test.describe("on a desktop, and wherever the user agent is not a phone's", () => {
  test("a plain address lands on the Timeline, in the server's own HTML", async ({ page }) => {
    const html = await serverHtml(page, PAIR);
    expect(html).toContain("data-fullscreen-panel");
    expect(html).not.toContain("data-depth-scene");
    await expect(flat(page)).toBeVisible();
    await expect(viewLink(page, "timeline")).toHaveAttribute("aria-current", "page");
    await expect(scene(page)).toHaveCount(0);
  });

  test("a narrow desktop window is still a desktop: the Timeline, not Films", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(PAIR);
    await expect(flat(page)).toBeVisible();
    await expect(scene(page)).toHaveCount(0);
  });

  test("a link that names Films opens Films, as it did", async ({ page }) => {
    await page.goto(`${PAIR}?view=depth`);
    await expect(scene(page)).toBeVisible();
    await expect(viewLink(page, "depth")).toHaveAttribute("aria-current", "page");
  });

  test("the Timeline's segment is a link that says view=timeline, on the desktop too, and tapping it stays", async ({ page }) => {
    await page.goto(`${PAIR}?view=table`);
    await expect(viewLink(page, "table")).toHaveAttribute("aria-current", "page");
    await expect(viewLink(page, "timeline")).toHaveAttribute("href", `${PAIR}?view=timeline`);
    await viewLink(page, "timeline").click();
    await expect(viewLink(page, "timeline")).toHaveAttribute("aria-current", "page");
    expect(new URL(page.url()).search).toBe("?view=timeline");
    // The control is in the bar: the one the page has.
    await expect(switcher(page)).toHaveCount(1);
  });

  test("a plain address is not redirected to anything: the canonical one is plain, and so is the desktop's own", async ({ page }) => {
    await page.goto(PAIR);
    expect(new URL(page.url()).search).toBe("");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/p\/309-pedro-almodovar\+955-penelope-cruz$/);
  });
});

test.describe("on a tablet", () => {
  test.use({ userAgent: IPAD, viewport: { width: 820, height: 1180 }, hasTouch: true });

  test("a plain address lands on the Timeline: only phones get Films by default", async ({ page }) => {
    const html = await serverHtml(page, PAIR);
    expect(html).toContain("data-fullscreen-panel");
    await expect(flat(page)).toBeVisible();
    await expect(scene(page)).toHaveCount(0);
  });
});
