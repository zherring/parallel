import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";

// The site's footer (src/components/site-footer.tsx), on the landing page and everywhere else: who made the site and where the code is, at the left; the credits at the right, in
// small type, as three lines (TMDB's mark on its own line, then its notice, then the awards data's source, the two texts the same size); below 768px the credits stack under the first line, at the left.

const footer = (page: Page) => page.locator("body > footer");
const box = async (locator: ReturnType<Page["locator"]>) => (await locator.boundingBox())!;

/** The footer's pieces: the left line, the TMDB mark, the notice, the awards line, and their font sizes. */
async function pieces(page: Page) {
  const project = footer(page).getByText(/^A project by/);
  const notice = footer(page).getByText("This product uses the TMDB API but is not endorsed or certified by TMDB.", { exact: true });
  const awards = footer(page).getByText(/^Awards data from/);
  const mark = footer(page).getByRole("img", { name: "TMDB", exact: true });
  const style = (locator: ReturnType<Page["locator"]>) =>
    locator.evaluate((element) => {
      const css = getComputedStyle(element);
      return { size: parseFloat(css.fontSize), weight: css.fontWeight, color: css.color, align: css.textAlign };
    });
  return {
    project: await box(project),
    notice: await box(notice),
    awards: await box(awards),
    mark: await box(mark),
    // The mark's link is the mark's box, no wider: the click is on the mark.
    markLink: await box(footer(page).getByRole("link", { name: "TMDB", exact: true })),
    styles: { project: await style(project), notice: await style(notice), awards: await style(awards) },
  };
}

test("on a desktop the left line is at the left and the credits at the right, right-aligned, as three lines: TMDB's mark, then its notice, then the awards data, the two texts in the same small type", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(footer(page)).toBeVisible();
  const p = await pieces(page);
  // The footer's content is 1152px wide (max-w-6xl), centred, with 16px of padding.
  const left = (1440 - 1152) / 2 + 16;
  const right = (1440 + 1152) / 2 - 16;
  expect(Math.abs(p.project.x - left)).toBeLessThanOrEqual(1);
  expect(Math.abs(p.mark.x + p.mark.width - right)).toBeLessThanOrEqual(1);
  expect(Math.abs(p.notice.x + p.notice.width - right)).toBeLessThanOrEqual(1);
  expect(Math.abs(p.awards.x + p.awards.width - right)).toBeLessThanOrEqual(1);
  // The credits are right of the left line; the mark is on its own line above the notice (not beside it), and the awards line is under the notice.
  expect(p.notice.x).toBeGreaterThan(p.project.x + p.project.width);
  expect(p.mark.y + p.mark.height).toBeLessThanOrEqual(p.notice.y + 1);
  expect(p.awards.y).toBeGreaterThanOrEqual(p.notice.y + p.notice.height - 1);
  // One line each at this width: the notice is one line of the small type (about 12px x 1.5), not wrapped.
  expect(p.notice.height).toBeLessThan(1.6 * p.styles.notice.size * 1.5);
  // The notice and the awards line are the same: the same font size (exactly), weight and colour, in small type, smaller than the left line; the mark stays small (10px tall, less prominent than the site's own name).
  expect(p.styles.notice.size).toBe(p.styles.awards.size);
  expect(p.styles.notice.weight).toBe(p.styles.awards.weight);
  expect(p.styles.notice.color).toBe(p.styles.awards.color);
  expect(p.styles.notice.size).toBeLessThan(p.styles.project.size);
  expect(p.mark.height).toBeLessThanOrEqual(10.5);
  expect(p.markLink.width).toBeLessThanOrEqual(p.mark.width + 1);
  // The links work: the author, the repository, TMDB's mark and Wikidata.
  await expect(footer(page).getByRole("link", { name: "Zach Herring", exact: true })).toHaveAttribute("href", "https://zachherring.com");
  await expect(footer(page).getByRole("link", { name: "Open source on GitHub", exact: true })).toHaveAttribute("href", "https://github.com/zherring/parallel");
  await expect(footer(page).getByRole("link", { name: "TMDB", exact: true })).toHaveAttribute("href", "https://www.themoviedb.org/");
  await expect(footer(page).getByRole("link", { name: "Wikidata", exact: true })).toHaveAttribute("href", "https://www.wikidata.org/");
});

for (const [width, height] of [[320, 640], [390, 844], [640, 900]] as const) {
  test(`at ${width}px the credits stack under the left line, at the left, the mark above the notice, and nothing overflows`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await expect(footer(page)).toBeVisible();
    const p = await pieces(page);
    // The footer's padding is 16px: everything starts there, the left line first and then the mark, the notice and the awards line under it, in that order.
    expect(Math.abs(p.project.x - 16)).toBeLessThanOrEqual(1);
    expect(Math.abs(p.mark.x - 16)).toBeLessThanOrEqual(1);
    expect(Math.abs(p.notice.x - 16)).toBeLessThanOrEqual(1);
    expect(Math.abs(p.awards.x - 16)).toBeLessThanOrEqual(1);
    expect(p.mark.y).toBeGreaterThanOrEqual(p.project.y + p.project.height - 1);
    expect(p.notice.y).toBeGreaterThanOrEqual(p.mark.y + p.mark.height - 1);
    expect(p.awards.y).toBeGreaterThanOrEqual(p.notice.y + p.notice.height - 1);
    expect(p.styles.notice.align).toBe("start");
    // Inside the screen, whatever wraps.
    for (const part of [p.project, p.mark, p.notice, p.awards]) expect(part.x + part.width).toBeLessThanOrEqual(width - 16 + 1);
    expect(p.styles.notice.size).toBe(p.styles.awards.size);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  });
}

for (const width of [768, 1024]) {
  test(`at ${width}px the credits are right-aligned at the footer's content edge, the mark on its own line above the notice (which may wrap here), and nothing overflows`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(footer(page)).toBeVisible();
    const p = await pieces(page);
    const right = width / 2 + Math.min(1152, width) / 2 - 16;
    for (const part of [p.mark, p.notice, p.awards]) expect(Math.abs(part.x + part.width - right)).toBeLessThanOrEqual(1);
    expect(p.mark.y + p.mark.height).toBeLessThanOrEqual(p.notice.y + 1);
    expect(p.awards.y).toBeGreaterThanOrEqual(p.notice.y + p.notice.height - 1);
    // With the credits, right of the left line by more than the gap between the groups.
    expect(p.mark.x).toBeGreaterThan(p.project.x + p.project.width + 16);
    expect(p.styles.notice.align).toBe("right");
    expect(p.styles.notice.size).toBe(p.styles.awards.size);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  });
}
