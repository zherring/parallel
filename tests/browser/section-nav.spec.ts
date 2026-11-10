import type { Page } from "next/experimental/testmode/playwright";
import { PAIR, expect, pairTest } from "./almodovar";
import { bar, scene, storedFilmsView } from "./fixtures";

/**
 * Films and Quotes are a vertical nav at the left edge, under the bar's home square, not links in the bar's row: a thin line drops from the square's
 * middle, with the two as text on it, the current one marked by a green tick and bright text. It is on every view of a page that has Quotes (this
 * pair, Almodóvar and Cruz, has; the Scroll fixtures, in together-pill.spec.ts, have none and no nav), from the `sm` breakpoint up, and floats
 * over the page: the flat views' content clears it, and over Focus' scene it takes no pointer events but on its links.
 */

// Ten films of their own each, besides the dozen in common: layers behind the films made together in Focus, as on a real page.
const test = pairTest(10);

// Activate the server-side fetch fixtures before any test navigates to a people page.
test.beforeEach(async ({ next }) => {
  void next;
});

type ViewName = "timeline" | "table" | "clippings" | "focus";
const VIEWS: Record<ViewName, string> = { timeline: "", table: "?view=table", clippings: "?view=clippings", focus: "?view=depth" };
const ALL_VIEWS = Object.keys(VIEWS) as ViewName[];

const nav = (page: Page) => bar(page).locator('nav[aria-label="Sections"]');
// Found by their address rather than by role, so that they are found where they are not shown (a phone has no nav on the screen).
const filmsLink = (page: Page) => nav(page).locator('a:not([href*="view=clippings"])');
const quotesLink = (page: Page) => nav(page).locator('a[href*="view=clippings"]');
const home = (page: Page) => bar(page).getByRole("link", { name: "Parallel home", exact: true });

/** Opens a view and waits until it is live (a view the flat page reads from the address bar once hydrated, Focus its scene). */
async function open(page: Page, view: ViewName) {
  await page.goto(`${PAIR}${VIEWS[view]}`);
  if (view === "focus") {
    await expect(scene(page)).toBeVisible();
    await expect.poll(() => storedFilmsView(page)).toBe("depth");
  } else if (view === "clippings") {
    await expect(quotesLink(page)).toHaveAttribute("aria-current", "page");
  } else {
    await expect(filmsLink(page)).toHaveAttribute("aria-current", "page");
    await expect.poll(() => storedFilmsView(page)).toBe(view);
  }
}

const box = async (locator: ReturnType<typeof nav>) => (await locator.boundingBox())!;

test.describe("at 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("it is down the left edge under the home square, the line dropping from the square's middle, in the same place on every view", async ({ page }) => {
    const boxes: unknown[] = [];
    for (const view of ALL_VIEWS) {
      await open(page, view);
      await expect(nav(page), view).toBeVisible();
      await expect(nav(page).getByRole("link"), view).toHaveText(["Films", "Quotes"]);
      const [navBox, homeBox] = [await box(nav(page)), await box(home(page))];
      // Under the square, a little clear of it, with the line (the nav's own left edge) at the square's middle.
      expect(navBox.y, view).toBeGreaterThanOrEqual(homeBox.y + homeBox.height + 4);
      expect(navBox.y, view).toBeLessThan(homeBox.y + homeBox.height + 16);
      expect(Math.abs(navBox.x - (homeBox.x + homeBox.width / 2)), view).toBeLessThanOrEqual(1);
      // A thin line: the nav's left border, one pixel, in the page's hairline colour.
      const line = await nav(page).evaluate((element) => {
        const css = getComputedStyle(element);
        return { width: css.borderLeftWidth, style: css.borderLeftStyle, pointer: css.pointerEvents };
      });
      expect(line, view).toEqual({ width: "1px", style: "solid", pointer: "none" });
      // As narrow as its text: well clear of the posters of the first band of Focus (it is about 18% across, 259px at this width).
      expect(navBox.x + navBox.width, view).toBeLessThan(120);
      boxes.push(navBox);
    }
    for (const other of boxes.slice(1)) expect(other).toEqual(boxes[0]);
  });

  test("it is fixed: it stays where it is while the page scrolls", async ({ page }) => {
    await open(page, "table");
    const before = await box(nav(page));
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
    expect(await box(nav(page))).toEqual(before);
  });

  test("the current section has a green tick on the line and bright text, the other is muted", async ({ page }) => {
    const brightness = (colour: string) => (colour.match(/[\d.]+/g) ?? []).slice(0, 3).reduce((sum, channel) => sum + Number(channel), 0);
    for (const view of ALL_VIEWS) {
      await open(page, view);
      const current = view === "clippings" ? quotesLink(page) : filmsLink(page);
      const other = view === "clippings" ? filmsLink(page) : quotesLink(page);
      await expect(current, view).toHaveAttribute("aria-current", "page");
      await expect(other, view).not.toHaveAttribute("aria-current", /.+/);
      // One tick, in the current one's box and on the line, in the page's green; the other has none.
      await expect(nav(page).locator("span.bg-accent-green"), view).toHaveCount(1);
      await expect(current.locator("span.bg-accent-green"), view).toHaveCount(1);
      await expect(other.locator("span.bg-accent-green"), view).toHaveCount(0);
      const tick = (await box(current.locator("span.bg-accent-green")))!;
      const navBox = await box(nav(page));
      expect(Math.abs(tick.x + tick.width / 2 - (navBox.x + 0.5)), view).toBeLessThanOrEqual(1);
      expect(tick.width, view).toBe(2);
      // Bright against muted text.
      const [on, off] = await Promise.all([current, other].map((locator) => locator.evaluate((element) => getComputedStyle(element).color)));
      expect(brightness(on), view).toBeGreaterThan(brightness(off));
      expect(await current.locator("span.bg-accent-green").evaluate((element) => getComputedStyle(element).backgroundColor), view).toBe(
        await page.evaluate(() => {
          const probe = document.createElement("span");
          probe.style.color = "var(--green)";
          document.body.append(probe);
          const colour = getComputedStyle(probe).color;
          probe.remove();
          return colour;
        }),
      );
    }
  });

  test("the flat views' content clears it: nothing is under the nav", async ({ page }) => {
    await open(page, "timeline");
    const navBox = await box(nav(page));
    for (const view of ["timeline", "table", "clippings"] as const) {
      await open(page, view);
      const panel = page.locator(`[id$="-panel-${view}"]`);
      await expect(panel, view).toBeVisible();
      if (view === "timeline") continue;
      // The first thing in the panel that is drawn: the table, the first quote or filter.
      const first = view === "table" ? page.getByRole("table") : panel.locator("li, button").first();
      const firstBox = await box(first);
      expect(firstBox.x, view).toBeGreaterThanOrEqual(navBox.x + navBox.width + 4);
      expect(firstBox.y + firstBox.height, view).toBeGreaterThan(navBox.y);
    }
    // The Timeline is the whole screen and has the nav floating over it: its track starts 7rem in (the lane's left spacer, empty), so the earliest film is clear of
    // the nav at load, and the track's own scroll stays at the left edge of the screen.
    await open(page, "timeline");
    const track = page.getByRole("region", { name: "Film timeline. Scroll sideways to see more years.", exact: true });
    const trackBox = await box(track);
    expect(Math.round(trackBox.x)).toBe(0);
    expect(Math.round(trackBox.width)).toBe(1440);
    const inset = await track.evaluate((element) => (element.firstElementChild!.lastElementChild!.firstElementChild as HTMLElement).offsetWidth);
    expect(inset).toBe(112);
    expect(inset).toBeGreaterThanOrEqual(navBox.x + navBox.width);
    // The first film's card, with the track at its left edge, is right of the nav.
    await track.evaluate((element) => {
      element.scrollLeft = 0;
    });
    const firstCard = await box(track.locator("li > button[data-film]").first());
    expect(firstCard.x).toBeGreaterThanOrEqual(navBox.x + navBox.width);
  });

  test("on Focus it floats over the scene and takes no pointer events but on its links: a press beside the text reaches the scene", async ({ page }) => {
    await open(page, "focus");
    const navBox = await box(nav(page));
    const [filmsBox, quotesBox] = [await box(filmsLink(page)), await box(quotesLink(page))];
    // "Films" is a shorter word than "Quotes": the nav is as wide as the longer, and what is right of "Films" is the nav's, not its link's.
    expect(filmsBox.width).toBeLessThan(quotesBox.width);
    const under = (x: number, y: number) =>
      page.evaluate(
        ([px, py]) => {
          const element = document.elementFromPoint(px, py);
          return { inNav: element?.closest('nav[aria-label="Sections"]') !== null, inScene: element?.closest("[data-depth-scene]") !== null };
        },
        [x, y],
      );
    // On the text of each link: the nav's.
    for (const link of [filmsBox, quotesBox]) expect(await under(link.x + 20, link.y + link.height / 2)).toMatchObject({ inNav: true });
    // Right of "Films", inside the nav's own box, and on the line: the scene's.
    expect(await under(navBox.x + navBox.width - 2, filmsBox.y + filmsBox.height / 2)).toEqual({ inNav: false, inScene: true });
    expect(await under(navBox.x + 0.01, filmsBox.y + filmsBox.height + 1)).toEqual({ inNav: false, inScene: true });
    // And left of the line, under the square: the scene's, too.
    expect(await under(navBox.x - 10, filmsBox.y + filmsBox.height / 2)).toEqual({ inNav: false, inScene: true });
  });

  test("on Focus it covers no poster where the scene lands", async ({ page }) => {
    await open(page, "focus");
    // The scene is the 22 films (the dozen made together in front, ten each behind); the first band, the first person's layer, is about 18% across.
    await expect.poll(() => scene(page).locator("[data-poster]").count()).toBeGreaterThan(12);
    const navBox = await box(nav(page));
    const overlapping = await scene(page).evaluate((element, rect) => {
      return [...element.querySelectorAll<HTMLElement>("[data-poster] button")]
        .map((poster) => poster.getBoundingClientRect())
        .filter((p) => p.width > 0 && !(p.right <= rect.x || p.left >= rect.x + rect.width || p.bottom <= rect.y || p.top >= rect.y + rect.height)).length;
    }, navBox);
    expect(overlapping).toBe(0);
  });

  test("it steps aside while the people pill is open, whose card covers its place", async ({ page }) => {
    await open(page, "table");
    await expect(nav(page)).toBeVisible();
    await bar(page).getByRole("button", { name: /^People on this page/ }).click();
    await expect(page.getByRole("dialog", { name: "People", exact: true })).toBeVisible();
    await expect(nav(page)).toBeHidden();
    await page.keyboard.press("Escape");
    await expect(nav(page)).toBeVisible();
  });

  test("it is a nav of links: Films goes to the view last used and Quotes to the quotes, with the period", async ({ page }) => {
    await page.goto(`${PAIR}?view=depth&from=2001&to=2005`);
    await expect(scene(page)).toBeVisible();
    await expect.poll(() => storedFilmsView(page)).toBe("depth");
    await quotesLink(page).click();
    await expect(quotesLink(page)).toHaveAttribute("aria-current", "page");
    expect(Object.fromEntries(new URL(page.url()).searchParams)).toEqual({ from: "2001", to: "2005", view: "clippings" });
    await expect(filmsLink(page)).toHaveAttribute("href", `${PAIR}?from=2001&to=2005&view=depth`);
    await filmsLink(page).click();
    await expect(scene(page)).toBeVisible();
    await expect(filmsLink(page)).toHaveAttribute("aria-current", "page");
  });
});

test.describe("from the small breakpoint up", () => {
  test("it is on from 640px and off below it", async ({ page }) => {
    await page.setViewportSize({ width: 640, height: 800 });
    await open(page, "table");
    await expect(nav(page)).toBeVisible();
    // The content clears it at the narrowest width it is on at.
    const panel = page.locator('[id$="-panel-table"]');
    const navBox = await box(nav(page));
    expect((await box(panel)).x).toBeGreaterThanOrEqual(navBox.x + navBox.width);
    await page.setViewportSize({ width: 639, height: 800 });
    await expect(nav(page)).toBeHidden();
    // And the page has the room back: the gutter is the page's own 12px on the left.
    await expect.poll(async () => Math.round((await box(panel)).x)).toBe(12);
  });
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("there is no left nav: the gear's sheet has Films | Quotes, and the content has no extra padding", async ({ page }) => {
    await open(page, "timeline");
    await expect(nav(page)).toBeHidden();
    // The timeline is the whole screen, with no start inset (there is no nav over it).
    const track = page.getByRole("region", { name: "Film timeline. Scroll sideways to see more years.", exact: true });
    const timelineBox = await box(track);
    expect(Math.round(timelineBox.x)).toBe(0);
    expect(Math.round(timelineBox.width)).toBe(390);
    expect(await track.evaluate((element) => (element.firstElementChild!.lastElementChild!.firstElementChild as HTMLElement).offsetWidth)).toBe(0);

    await page.getByRole("button", { name: "Settings", exact: true }).tap();
    const sheet = page.getByRole("dialog", { name: "Settings", exact: true });
    const sections = sheet.getByRole("navigation", { name: "Sections", exact: true });
    await expect(sections.getByRole("link")).toHaveText(["Films", "Quotes"]);
    await expect(sections.getByRole("link", { name: "Films", exact: true })).toHaveAttribute("aria-current", "page");
    await sections.getByRole("link", { name: "Quotes", exact: true }).tap();
    await expect(sheet).toBeHidden();
    await expect(page.locator('nav[aria-label="Sections"] a[href*="view=clippings"]')).toHaveAttribute("aria-current", "page");
    // Still no nav on the screen, on any view.
    await expect(nav(page)).toBeHidden();
  });
});
