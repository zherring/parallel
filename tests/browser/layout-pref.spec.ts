import { test, expect, openPeople, PEOPLE_PATH, timeline } from "./fixtures";
import type { Page } from "next/experimental/testmode/playwright";

// Activate the server-side fetch fixtures before any test navigates to a people page.
test.beforeEach(async ({ next }) => { void next; });

// Every test gets a fresh browser context, so a layout chosen in one is never there in the next: a new visitor.
const KEY = "parallel:timeline-layout";
const stored = (page: Page) => page.evaluate((key) => window.localStorage.getItem(key), KEY);

const scene = (page: Page) => page.getByRole("region", { name: "Film timeline. Scroll down for later years.", exact: true });
const layoutGroup = (page: Page) => page.getByRole("group", { name: "Timeline layout", exact: true });
const timelineTab = (page: Page) => page.getByRole("tab", { name: "Timeline", exact: true });
const tableTab = (page: Page) => page.getByRole("tab", { name: "Table", exact: true });
const depthViews = (page: Page) => page.getByRole("navigation", { name: "Views", exact: true });

/** The flat page, then Focus through the layout control. */
async function chooseFocus(page: Page, search = "") {
  await openPeople(page, search);
  await layoutGroup(page).getByRole("button", { name: "Focus view", exact: true }).click();
  await expect(scene(page)).toBeVisible();
}

test("Focus, then Table, then Timeline lands on Focus, with the people and the period", async ({ page }) => {
  await chooseFocus(page, "?from=2000&to=2001");
  expect(await stored(page)).toBe("focus");

  // Table is a link out of the Focus bar to the flat page's table; the period goes along.
  await depthViews(page).getByRole("link", { name: "Table", exact: true }).click();
  await expect(tableTab(page)).toHaveAttribute("aria-selected", "true");
  await expect(scene(page)).toHaveCount(0);
  expect(Object.fromEntries(new URL(page.url()).searchParams)).toEqual({ from: "2000", to: "2001", view: "table" });

  // The flat page's Timeline tab is the layout they chose: Focus, as a navigation to the same page on `?view=depth`.
  await timelineTab(page).click();
  await expect(scene(page)).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-view", "depth");
  expect(new URL(page.url()).pathname).toBe("/p/90000001-scroll-alpha+90000002-scroll-beta");
  expect(Object.fromEntries(new URL(page.url()).searchParams)).toEqual({ from: "2000", to: "2001", view: "depth" });
});

test("Combined, then Table, then Timeline lands on the flat timeline", async ({ page }) => {
  await chooseFocus(page);
  await layoutGroup(page).getByRole("button", { name: "Combined timeline", exact: true }).click();
  await expect(timelineTab(page)).toHaveAttribute("aria-selected", "true");
  await expect(scene(page)).toHaveCount(0);
  expect(await stored(page)).toBe("combined");

  await tableTab(page).click();
  await expect(tableTab(page)).toHaveAttribute("aria-selected", "true");
  await timelineTab(page).click();
  await expect(timelineTab(page)).toHaveAttribute("aria-selected", "true");
  await expect(timeline(page)).toBeVisible();
  await expect(scene(page)).toHaveCount(0);
  expect(new URL(page.url()).searchParams.get("view")).toBeNull();
});

test("a visitor who never chose gets the flat timeline from the Timeline tab", async ({ page }) => {
  // The tab reads `?view=` after hydration, so the Table being selected says the page is live.
  await page.goto(`${PEOPLE_PATH}?view=table`);
  await expect(tableTab(page)).toHaveAttribute("aria-selected", "true");
  await timelineTab(page).click();
  await expect(timelineTab(page)).toHaveAttribute("aria-selected", "true");
  await expect(timeline(page)).toBeVisible();
  await expect(scene(page)).toHaveCount(0);
  expect(await stored(page)).toBeNull();
});

test("the choice outlives a reload, but a plain address is never redirected to Focus", async ({ page }) => {
  await chooseFocus(page);
  expect(await stored(page)).toBe("focus");

  // A shared link, a bookmark, a reload of the plain page: the page's own default, the flat Timeline.
  await page.goto(PEOPLE_PATH);
  await expect(timelineTab(page)).toHaveAttribute("aria-selected", "true");
  await expect(layoutGroup(page).getByRole("button", { name: "Combined timeline", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(scene(page)).toHaveCount(0);
  expect(new URL(page.url()).search).toBe("");

  // Only the Timeline tab honours it: from the table (a fresh load, so read from storage), it is Focus.
  await page.goto(`${PEOPLE_PATH}?view=table`);
  await expect(tableTab(page)).toHaveAttribute("aria-selected", "true");
  await timelineTab(page).click();
  await expect(scene(page)).toBeVisible();
  await expect(page).toHaveURL(/\?view=depth$/);
});

test("on the Focus page the Timeline link goes where the layout choice says: here for Focus, the flat timeline for Combined", async ({ page }) => {
  // Arriving by a link chooses nothing: the Timeline link is the default's, the flat timeline.
  await page.goto(`${PEOPLE_PATH}?view=depth&from=2000&to=2001`);
  await expect(scene(page)).toBeVisible();
  const link = depthViews(page).getByRole("link", { name: "Timeline", exact: true });
  await expect(link).toHaveAttribute("href", `${new URL(page.url()).pathname}?from=2000&to=2001`);

  // Choosing Focus in the control (already the layout) remembers it, and the link then stays on this page, the period kept.
  await layoutGroup(page).getByRole("button", { name: "Focus view", exact: true }).click();
  await expect(link).toHaveAttribute("href", `${new URL(page.url()).pathname}?from=2000&to=2001&view=depth`);
  expect(await stored(page)).toBe("focus");
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("the Timeline link in the gear's sheet follows the choice too", async ({ page }) => {
    await page.goto(`${PEOPLE_PATH}?view=depth`);
    await expect(scene(page)).toBeVisible();
    const settings = page.getByRole("button", { name: "Settings", exact: true });
    await settings.tap();
    const sheet = page.getByRole("dialog", { name: "Settings", exact: true });
    const link = sheet.getByRole("navigation", { name: "Views", exact: true }).getByRole("link", { name: "Timeline", exact: true });
    await expect(link).toHaveAttribute("href", new URL(page.url()).pathname);

    await sheet.getByRole("button", { name: "Focus view", exact: true }).tap();
    await expect(link).toHaveAttribute("href", `${new URL(page.url()).pathname}?view=depth`);
  });
});

test("without browser storage the choice still lasts for the session", async ({ page }) => {
  // localStorage that throws on every access, as in a window with site data blocked.
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("blocked", "SecurityError");
      },
    });
  });
  await chooseFocus(page);
  await depthViews(page).getByRole("link", { name: "Table", exact: true }).click();
  await expect(tableTab(page)).toHaveAttribute("aria-selected", "true");
  await timelineTab(page).click();
  await expect(scene(page)).toBeVisible();
});
