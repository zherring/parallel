import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";

// The site's footer (src/components/site-footer.tsx), on the landing page and everywhere else: who made the site and where the code is, at the left; the credits at the right, in
// small type (TMDB's notice with its small mark, then the awards data's source); below 768px the credits stack under the first line, at the left.

const footer = (page: Page) => page.locator("body > footer");
const box = async (locator: ReturnType<Page["locator"]>) => (await locator.boundingBox())!;

/** The footer's pieces: the left line, the TMDB mark, the notice, the awards line, and their font sizes. */
async function pieces(page: Page) {
  const project = footer(page).getByText(/^A project by/);
  const notice = footer(page).getByText("This product uses the TMDB API but is not endorsed or certified by TMDB.", { exact: true });
  const awards = footer(page).getByText(/^Awards data from/);
  const mark = footer(page).getByRole("img", { name: "TMDB", exact: true });
  const size = (locator: ReturnType<Page["locator"]>) => locator.evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
  return {
    project: await box(project),
    notice: await box(notice),
    awards: await box(awards),
    mark: await box(mark),
    sizes: { project: await size(project), notice: await size(notice), awards: await size(awards) },
  };
}

test("on a desktop the left line is at the left and the credits at the right, right-aligned: TMDB's notice with its mark, then the awards data, both in the same small type", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(footer(page)).toBeVisible();
  const p = await pieces(page);
  // The footer's content is 1152px wide (max-w-6xl), centred, with 16px of padding.
  const left = (1440 - 1152) / 2 + 16;
  const right = (1440 + 1152) / 2 - 16;
  expect(Math.abs(p.project.x - left)).toBeLessThanOrEqual(1);
  expect(Math.abs(p.notice.x + p.notice.width - right)).toBeLessThanOrEqual(1);
  expect(Math.abs(p.awards.x + p.awards.width - right)).toBeLessThanOrEqual(1);
  // The credits are right of the left line, the notice first and the awards line under it; the mark is before the notice, on its line.
  expect(p.notice.x).toBeGreaterThan(p.project.x + p.project.width);
  expect(p.awards.y).toBeGreaterThanOrEqual(p.notice.y + p.notice.height - 1);
  expect(p.mark.x + p.mark.width).toBeLessThanOrEqual(p.notice.x);
  expect(Math.abs(p.mark.y + p.mark.height / 2 - (p.notice.y + p.notice.height / 2))).toBeLessThanOrEqual(2);
  // The same small type for both credits, smaller than the left line; the mark stays small (10px tall, less prominent than the site's own name).
  expect(p.sizes.notice).toBe(p.sizes.awards);
  expect(p.sizes.notice).toBeLessThan(p.sizes.project);
  expect(p.mark.height).toBeLessThanOrEqual(10.5);
  // The links work: the author, the repository, TMDB's mark and Wikidata.
  await expect(footer(page).getByRole("link", { name: "Zach Herring", exact: true })).toHaveAttribute("href", "https://zachherring.com");
  await expect(footer(page).getByRole("link", { name: "Open source on GitHub", exact: true })).toHaveAttribute("href", "https://github.com/zherring/parallel");
  await expect(footer(page).getByRole("link", { name: "TMDB", exact: true })).toHaveAttribute("href", "https://www.themoviedb.org/");
  await expect(footer(page).getByRole("link", { name: "Wikidata", exact: true })).toHaveAttribute("href", "https://www.wikidata.org/");
});

for (const [width, height] of [[320, 640], [390, 844], [640, 900]] as const) {
  test(`at ${width}px the credits stack under the left line, at the left, and nothing overflows`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await expect(footer(page)).toBeVisible();
    const p = await pieces(page);
    // The footer's padding is 16px: everything starts there, the left line first and then the mark, the notice and the awards line under it.
    expect(Math.abs(p.project.x - 16)).toBeLessThanOrEqual(1);
    expect(Math.abs(p.mark.x - 16)).toBeLessThanOrEqual(1);
    expect(Math.abs(p.awards.x - 16)).toBeLessThanOrEqual(1);
    expect(p.mark.y).toBeGreaterThanOrEqual(p.project.y + p.project.height - 1);
    expect(p.awards.y).toBeGreaterThanOrEqual(p.notice.y + p.notice.height - 1);
    expect(p.notice.x).toBeGreaterThanOrEqual(p.mark.x + p.mark.width);
    // Inside the screen, whatever wraps.
    for (const part of [p.project, p.notice, p.awards]) expect(part.x + part.width).toBeLessThanOrEqual(width - 16 + 1);
    expect(p.sizes.notice).toBe(p.sizes.awards);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  });
}
