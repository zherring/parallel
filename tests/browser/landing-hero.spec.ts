import { test, expect } from "./fixtures";

// The landing page's first screen: the sticky top bar (the wordmark, the search that opens the universal search, and the genre pills) over the stage (two portrait panels with
// the headline over the seam, and the pair's films on a timeline). The stage is drawn in the browser once its images are in (or after 2.5s, TMDB's host being out of reach here).

const stageLink = (page: import("@playwright/test").Page) => page.locator("[data-hero-stage]").getByRole("link", { name: /films? together$/ });

test("the headline is the one h1, the stage is one labelled link to a pair, and the top bar sticks to the top of the screen", async ({ page }) => {
  await page.goto("/");
  const h1 = page.getByRole("heading", { level: 1 });
  await expect(h1).toHaveCount(1);
  await expect(h1).toHaveText("Watch filmmakers cross paths");

  const link = stageLink(page);
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", /^\/p\/\d+-[^+]+\+\d+-[^+]+$/);
  // The decorative layers are inside it and carry no text of their own: its name is the label.
  await expect(link.locator("[aria-hidden='true']").first()).toBeAttached();
  await expect(link.getByRole("link")).toHaveCount(0);
  await expect(link.getByRole("button")).toHaveCount(0);
  // Previous and Next are outside the link.
  await expect(page.locator("[data-hero-stage]").getByRole("button", { name: "Previous pairing", exact: true })).toBeVisible();
  await expect(page.locator("[data-hero-stage]").getByRole("button", { name: "Next pairing", exact: true })).toBeVisible();

  const bar = page.locator("[data-landing-bar]");
  await expect(bar.getByRole("tablist", { name: "Genres", exact: true })).toBeVisible();
  await expect(bar.getByRole("tab")).toHaveCount(10);
  await page.evaluate(() => window.scrollTo(0, 1400));
  await expect.poll(() => bar.evaluate((element) => Math.round(element.getBoundingClientRect().top))).toBe(0);
});

test("the stage has a year cap at each end and the posters stand on the line, each with a dot and its year", async ({ page }) => {
  await page.goto("/");
  await expect(stageLink(page)).toBeVisible();
  const stage = page.locator("[data-hero-stage]");
  // Three to five posters at this width, each with one dot and one year; the caps are the pair's first and last year.
  const posters = stage.locator("[data-part='poster']");
  await expect.poll(async () => (await posters.count()) >= 3 && (await posters.count()) <= 5).toBe(true);
  const count = await posters.count();
  await expect(stage.locator("[data-part='dot']")).toHaveCount(count);
  const caps = stage.locator("span.tabular-nums.text-strong");
  await expect(caps).toHaveCount(2);
  const [first, last] = await caps.allInnerTexts();
  expect(first).toMatch(/^\d{4}$/);
  expect(last).toMatch(/^\d{4}$/);
  expect(Number(first)).toBeLessThanOrEqual(Number(last));
  // The line runs under the posters' dots, and is the one line of the page.
  await expect(stage.locator("[data-line]")).toHaveCount(1);
  const line = (await stage.locator("[data-line]").boundingBox())!;
  const dot = (await stage.locator("[data-part='dot']").first().boundingBox())!;
  expect(Math.abs(dot.y + dot.height / 2 - (line.y + line.height / 2))).toBeLessThanOrEqual(1);
});

test("the pills in the bar choose the panel in the grid below: the hash, the ARIA wiring, the arrow keys, and a pointer press brings the grid into view", async ({ page }) => {
  await page.goto("/");
  const bar = page.locator("[data-landing-bar]");
  const featured = bar.getByRole("tab", { name: "Featured", exact: true });
  const horror = bar.getByRole("tab", { name: "Horror", exact: true });
  await expect(featured).toHaveAttribute("aria-selected", "true");
  await expect(horror).toHaveAttribute("aria-controls", "pairings-panel-horror");
  await expect(page.locator("#pairings-panel-horror")).toBeHidden();

  await horror.click();
  await expect(page).toHaveURL(/#horror$/);
  await expect(horror).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#pairings-panel-horror")).toBeVisible();
  await expect(page.locator("#pairings-panel-featured")).toBeHidden();
  // The grid is below the stage: the press brings it up under the bar.
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(300);
  await expect(page.locator("#pairings-panel-horror").getByRole("link").first()).toBeInViewport();

  // The arrow keys move between pills (and wrap) without scrolling the page; Home and End jump.
  await horror.focus();
  // The press's own scroll is smooth: wait for it to come to rest before looking at where the keys leave the page.
  let last = -1;
  await expect.poll(async () => {
    const now = await page.evaluate(() => window.scrollY);
    const rest = now === last;
    last = now;
    return rest;
  }).toBe(true);
  const before = await page.evaluate(() => window.scrollY);
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/#sci-fi$/);
  await expect(bar.getByRole("tab", { name: "Sci-Fi", exact: true })).toBeFocused();
  await page.keyboard.press("End");
  await expect(page).toHaveURL(/#animation$/);
  await page.keyboard.press("ArrowRight");
  await expect(page).not.toHaveURL(/#/);
  await expect(featured).toBeFocused();
  await expect(featured).toHaveAttribute("aria-selected", "true");
  expect(await page.evaluate(() => window.scrollY)).toBe(before);
});

test("a link to a genre opens on its grid", async ({ page }) => {
  await page.goto("/#comedy");
  await expect(page.locator("#pairings-panel-comedy")).toBeVisible();
  await expect(bar(page).getByRole("tab", { name: "Comedy", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(300);
});

const bar = (page: import("@playwright/test").Page) => page.locator("[data-landing-bar]");

test.describe("on a phone", () => {
  test.use({ viewport: { width: 320, height: 640 }, hasTouch: true, isMobile: true });

  test("the headline is under the stage, nothing overflows sideways and the pills scroll in their own row", async ({ page }) => {
    await page.goto("/");
    await expect(stageLink(page)).toBeVisible();
    const stage = (await page.locator("[data-hero-stage]").boundingBox())!;
    const h1 = (await page.getByRole("heading", { level: 1 }).boundingBox())!;
    expect(h1.y).toBeGreaterThanOrEqual(stage.y + stage.height - 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    // The pills are a row of their own under the search, and the row scrolls (it is wider than the screen) without the page doing so.
    const search = (await bar(page).getByRole("button", { name: /Search any film artist/ }).boundingBox())!;
    const pills = (await bar(page).getByRole("tablist").boundingBox())!;
    expect(pills.y).toBeGreaterThanOrEqual(search.y + search.height - 1);
    expect(await bar(page).getByRole("tablist").evaluate((list) => list.parentElement!.scrollWidth > list.parentElement!.clientWidth)).toBe(true);
  });
});
