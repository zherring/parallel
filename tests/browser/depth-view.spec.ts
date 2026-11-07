import { test, expect, PEOPLE_PATH } from "./fixtures";
import type { Page } from "next/experimental/testmode/playwright";

// Activate the server-side fetch fixtures before any test navigates to a people page.
test.beforeEach(async ({ next }) => { void next; });

const scene = (page: Page) => page.getByRole("region", { name: "Film timeline. Scroll down for later years.", exact: true });
const rail = (page: Page) => page.getByRole("scrollbar", { name: "Timeline position", exact: true });
const pill = (page: Page) => page.getByRole("button", { name: /^People on this page/ });
const peopleCard = (page: Page) => page.getByRole("dialog", { name: "People", exact: true });

/** The first of the fixture's shared films (2000-01-01): the scene opens with it in the middle of the screen. */
const FIRST_SHARED = /^Scroll Film 100, 2000\./;

/**
 * Opens the Depth view and waits for it to settle: the rail's handle reports where the scene is, and the scene
 * opens on the first collaboration (2000), not at the top of the axis (1990), so a position past 0 means the
 * initial scroll has happened.
 */
async function openDepth(page: Page, search = "") {
  await page.goto(`${PEOPLE_PATH}?view=depth${search}`);
  await expect(scene(page)).toBeVisible();
  await expect.poll(async () => Number(await rail(page).getAttribute("aria-valuenow"))).toBeGreaterThan(0);
}

test("the scene opens scrolled to the first collaboration", async ({ page }) => {
  await openDepth(page);
  const region = scene(page);

  await expect.poll(() => region.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  // Collaborations are the layer at the screen plane, so the first one is level with the middle of the screen.
  const poster = region.getByRole("button", { name: FIRST_SHARED });
  await expect(poster).toBeVisible();
  const box = (await poster.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(Math.abs(box.y + box.height / 2 - viewport.height / 2)).toBeLessThan(24);

  // The depth: collaborations in front, then one layer behind per person.
  await expect(region.locator("ol")).toHaveCount(3);
  // The scene covers the site's header and footer rather than sitting between them.
  await expect(page.locator("html")).toHaveAttribute("data-view", "depth");
});

test("a linked period dims the posters outside it", async ({ page }) => {
  await openDepth(page, "&from=2000&to=2001");
  const region = scene(page);

  // 1990 is outside 2000-2001 (opacity fades in over a moment); 2000 is inside.
  await expect(region.locator('[data-poster="1000"]')).toHaveCSS("opacity", "0.25");
  await expect(region.locator('[data-poster="100"]')).toHaveCSS("opacity", "1");
  await expect(region.locator('[data-poster="1010"]')).toHaveCSS("opacity", "1");
});

test("a poster opens the film dialog, and Escape closes it and returns focus", async ({ page }) => {
  await openDepth(page);
  const poster = scene(page).getByRole("button", { name: FIRST_SHARED });

  await poster.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("aria-modal", "true");

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(poster).toBeFocused();
});

test("the people pill opens on a press and closes when the scene scrolls", async ({ page }) => {
  await openDepth(page);
  const button = pill(page);
  const region = scene(page);

  await expect(button).toHaveAttribute("aria-expanded", "false");
  await expect(peopleCard(page)).toHaveCount(0);
  await expect(button.locator("[data-pill-open]")).toHaveCount(0);
  // The pill carries no logo or home link, closed or open.
  const bubble = page.locator("[data-people-pill]");
  await expect(bubble).not.toContainText("Parallel");
  await expect(bubble.locator('a[href="/"]')).toHaveCount(0);

  await button.click();
  await expect(button).toHaveAttribute("aria-expanded", "true");
  const card = peopleCard(page);
  await expect(card).toBeVisible();
  // The capsule says what the card is where the heads were (they have flown into its rows).
  await expect(button.locator("[data-pill-open]")).toContainText("People");
  await expect(bubble).not.toContainText("Parallel");
  await expect(bubble.locator('a[href="/"]')).toHaveCount(0);
  await expect(card.getByRole("link", { name: "Remove Scroll Alpha", exact: true })).toHaveAttribute("href", /view=depth/);
  await expect(card.getByRole("link", { name: "Flat timeline", exact: true })).not.toHaveAttribute("href", /view=/);

  const top = await region.evaluate((element) => element.scrollTop);
  await region.evaluate((element, to) => { element.scrollTop = to; }, top + 200);
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await expect(card).toBeHidden();
  await expect(button.locator("[data-pill-open]")).toHaveCount(0);
});

test("the Flat timeline link leaves the Depth view and keeps the period", async ({ page }) => {
  await openDepth(page, "&from=2000&to=2001");
  await pill(page).click();
  await peopleCard(page).getByRole("link", { name: "Flat timeline", exact: true }).click();

  await expect(page.getByRole("tab", { name: "Timeline", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page).toHaveURL(/from=2000&to=2001/);
  expect(new URL(page.url()).searchParams.has("view")).toBe(false);
  await expect(scene(page)).toHaveCount(0);
});

test("the plain address still renders the Timeline and Table tabs", async ({ page }) => {
  await page.goto(PEOPLE_PATH);
  await expect(page.getByRole("tab", { name: "Timeline", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: "Table", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Film timeline. Scroll sideways to see more years.", exact: true })).toBeVisible();
  await expect(scene(page)).toHaveCount(0);
  await expect(page.locator("html")).not.toHaveAttribute("data-view", /.+/);
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("the rail is thin, the pill is collapsed and nothing scrolls sideways", async ({ page }) => {
    await openDepth(page);

    const railBox = (await page.locator("[data-depth-rail]").boundingBox())!;
    expect(railBox.width).toBeLessThanOrEqual(28);
    expect(railBox.x + railBox.width).toBeLessThanOrEqual(390);

    await expect(pill(page)).toHaveAttribute("aria-expanded", "false");
    await expect(peopleCard(page)).toHaveCount(0);

    const overflow = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      x: window.scrollX,
    }));
    expect(overflow).toEqual({ page: 0, x: 0 });

    // A tap opens the card, and it fits the screen.
    await pill(page).tap();
    const card = peopleCard(page);
    await expect(card).toBeVisible();
    const cardBox = (await card.boundingBox())!;
    expect(cardBox.x).toBeGreaterThanOrEqual(0);
    expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(390);
  });
});
