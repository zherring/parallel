import type { Page } from "next/experimental/testmode/playwright";
import { PAIR, expect, test } from "./almodovar";
import { PEOPLE_PATH, test as scrollTest, bar, quotesLink, scene, switcher, viewLink, type FilmsViewName } from "./fixtures";

/**
 * The page's views are one segmented control in the bar: Films | Timeline | Table, and Quotes as its fourth segment for a pair that has quotes. "Films" is the
 * Depth view (`?view=depth`: the address still says depth). These specs are about that control: its words and order, the one segment that is current, where each
 * segment goes (the period kept), and the phone's sheet, which has the same four. The pair is Almodóvar and Cruz, who have Quotes; the Scroll pair of `fixtures.ts`
 * has none.
 */

// Activate the server-side fetch fixtures before any test navigates to a people page.
test.beforeEach(async ({ next }) => {
  void next;
});
scrollTest.beforeEach(async ({ next }) => {
  void next;
});

const QUERY: Record<FilmsViewName | "clippings", string> = { timeline: "?view=timeline", table: "?view=table", depth: "?view=depth", clippings: "?view=clippings" };
const PERIOD = "from=2001&to=2005";
const params = (page: Page) => Object.fromEntries(new URL(page.url()).searchParams);

/** Opens a view and waits until it is live: the flat page reads its view from the address bar once hydrated; Films is its scene. */
async function open(page: Page, view: FilmsViewName | "clippings", search = QUERY[view]) {
  await page.goto(`${PAIR}${search}`);
  if (view === "clippings") await expect(quotesLink(page)).toHaveAttribute("aria-current", "page");
  else if (view === "depth") await expect(scene(page)).toBeVisible();
  else await expect(viewLink(page, view)).toHaveAttribute("aria-current", "page");
}

test("the control is Films, Timeline, Table and Quotes, in that order, one nav, and Focus is nowhere on the page", async ({ page }) => {
  await open(page, "timeline");
  await expect(switcher(page)).toHaveCount(1);
  await expect(switcher(page).getByRole("link")).toHaveText(["Films", "Timeline", "Table", "Quotes"]);
  // Links with the words as their names, titles for the tooltips, and the addresses each goes to (the Timeline's says so, the Films view is depth).
  const hrefs = await switcher(page).getByRole("link").evaluateAll((links) => links.map((link) => new URL((link as HTMLAnchorElement).href).search));
  expect(hrefs).toEqual(["?view=depth", "?view=timeline", "?view=table", "?view=clippings"]);
  await expect(viewLink(page, "depth")).toHaveAttribute("title", /^Films · /);
  await expect(quotesLink(page)).toHaveAttribute("title", /^Quotes · /);
  // No Focus anywhere: not in the bar, not in the gear's sheet, not in an aria-label or a title.
  expect(await page.locator("body").innerText()).not.toContain("Focus");
  expect(await page.locator('[aria-label*="Focus"], [title*="Focus"]').count()).toBe(0);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Settings", exact: true })).not.toContainText("Focus");
});

test("the Quotes segment is the current one on the Quotes, and the control is the same four segments on every view", async ({ page }) => {
  for (const view of ["timeline", "table", "clippings", "depth"] as const) {
    await open(page, view);
    await expect(switcher(page).getByRole("link")).toHaveText(["Films", "Timeline", "Table", "Quotes"]);
    // Exactly one segment is current: the view the page is on, Quotes included.
    await expect(switcher(page).locator('[aria-current="page"]')).toHaveCount(1);
    if (view === "clippings") await expect(quotesLink(page)).toHaveAttribute("aria-current", "page");
    else await expect(viewLink(page, view)).toHaveAttribute("aria-current", "page");
  }
  // No segment of its own beside the control: Quotes is not a separate link or box in the bar.
  await expect(bar(page).getByRole("link", { name: "Quotes", exact: true })).toHaveCount(1);
});

scrollTest("a pair without quotes has the three segments, and no Quotes anywhere in the bar", async ({ page }) => {
  await page.goto(PEOPLE_PATH);
  await expect(switcher(page).getByRole("link")).toHaveText(["Films", "Timeline", "Table"]);
  await expect(quotesLink(page)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Quotes", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Settings", exact: true }).getByRole("link", { name: "Quotes", exact: true })).toHaveCount(0);
});

// ---- the control, from every view -------------------------------------------------------------------------------------

const STARTS = ["timeline", "table", "clippings", "depth"] as const;
const TARGETS = ["depth", "timeline", "table", "clippings"] as const;
const label = (view: string) => (view === "depth" ? "Films" : view === "clippings" ? "Quotes" : view);

for (const start of STARTS) {
  for (const target of TARGETS) {
    test(`the control goes from ${label(start)} to ${label(target)}, and keeps the period`, async ({ page }) => {
      await open(page, start, `?${PERIOD}&view=${start}`);
      const segment = target === "clippings" ? quotesLink(page) : viewLink(page, target);
      await segment.click();
      await expect(segment).toHaveAttribute("aria-current", "page");
      await expect(switcher(page).locator('[aria-current="page"]')).toHaveCount(1);
      if (target === "depth") await expect(scene(page)).toBeVisible();
      else await expect(scene(page)).toHaveCount(0);
      // The period goes along, and the view is written out (the Timeline's too); nothing of the one that was left (a sort, a quote) stays.
      expect(params(page)).toEqual({ from: "2001", to: "2005", view: target });
      expect(new URL(page.url()).pathname).toBe(PAIR);
    });
  }
}

test("a click with a modifier on a segment is the browser's, not the page's: the link opens elsewhere and the page stays", async ({ page }) => {
  await open(page, "timeline", `?${PERIOD}&view=timeline`);
  const [popup] = await Promise.all([page.context().waitForEvent("page"), viewLink(page, "table").click({ modifiers: ["ControlOrMeta"] })]);
  await popup.waitForLoadState("domcontentloaded");
  expect(Object.fromEntries(new URL(popup.url()).searchParams)).toEqual({ from: "2001", to: "2005", view: "table" });
  await expect(viewLink(page, "timeline")).toHaveAttribute("aria-current", "page");
  expect(params(page)).toEqual({ from: "2001", to: "2005", view: "timeline" });
});

test("the remembered view is gone: nothing is written to the browser's storage, and a plain address is never redirected to the last view", async ({ page }) => {
  await open(page, "table");
  await viewLink(page, "depth").click();
  await expect(scene(page)).toBeVisible();
  expect(await page.evaluate(() => Object.keys(window.localStorage).filter((key) => key.startsWith("parallel:films-view")))).toEqual([]);
  // A desktop's plain address is the Timeline, whatever view was used last.
  await page.goto(PAIR);
  await expect(viewLink(page, "timeline")).toHaveAttribute("aria-current", "page");
  await expect(scene(page)).toHaveCount(0);
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("the gear's sheet has the same four segments, in the same order: the same round trip, with the period", async ({ page }) => {
    await page.goto(`${PAIR}?view=depth&${PERIOD}`);
    await expect(scene(page)).toBeVisible();
    const gear = page.getByRole("button", { name: "Settings", exact: true });
    const sheet = page.getByRole("dialog", { name: "Settings", exact: true });
    const control = sheet.getByRole("navigation", { name: "Views", exact: true });

    // The bar has no control on a phone; the sheet has it, four segments.
    await expect(switcher(page)).toBeHidden();
    await gear.tap();
    await expect(control.getByRole("link")).toHaveText(["Films", "Timeline", "Table", "Quotes"]);
    await expect(control.locator('[aria-current="page"]')).toHaveText("Films");

    // Films → Table → Quotes → Timeline → Films.
    await control.getByRole("link", { name: "Table", exact: true }).tap();
    await expect(scene(page)).toHaveCount(0);
    expect(params(page)).toEqual({ from: "2001", to: "2005", view: "table" });

    await gear.tap();
    await control.getByRole("link", { name: "Quotes", exact: true }).tap();
    await expect(sheet).toBeHidden();
    expect(params(page)).toEqual({ from: "2001", to: "2005", view: "clippings" });
    await gear.tap();
    await expect(control.locator('[aria-current="page"]')).toHaveText("Quotes");

    await control.getByRole("link", { name: "Timeline", exact: true }).tap();
    await expect(sheet).toBeHidden();
    expect(params(page)).toEqual({ from: "2001", to: "2005", view: "timeline" });

    await gear.tap();
    await control.getByRole("link", { name: "Films", exact: true }).tap();
    await expect(scene(page)).toBeVisible();
    expect(params(page)).toEqual({ from: "2001", to: "2005", view: "depth" });
  });
});
