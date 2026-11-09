import { test as base, expect } from "next/experimental/testmode/playwright";
import type { Locator, Page } from "next/experimental/testmode/playwright";

/**
 * The page bar of a `/p/` page is the same on every view: the flat Timeline, Table and Clippings, and the Depth view (Focus). These tests measure
 * it, so that moving between the views moves nothing in it, and check what goes with it: the headline under it (the page's `h1`, on every view)
 * and what is no longer on the page (the site's header, the title row's Add a person field, the row of Export and Share: Export and Share are
 * in the gear).
 *
 * The pair is Almodóvar and Cruz, who have Clippings (a pair without any has no third tab), with a dozen films in common so that the pages
 * are long enough to scroll.
 */
const PAIR = "/p/309-pedro-almodovar+955-penelope-cruz";
const NAMES = ["Pedro Almodóvar", "Penélope Cruz"];
const HEADLINE = "Pedro Almodóvar & Penélope Cruz, 12 films";

const films = Array.from({ length: 12 }, (_, index) => ({
  id: 100 + index,
  title: `Bar Film ${index + 1}`,
  release_date: `${2000 + index}-03-17`,
  poster_path: null,
  vote_count: 100,
  character: "Lead",
  order: 0,
}));

const test = base.extend({
  next: async ({ next }, provide) => {
    next.onFetch((request) => {
      const url = new URL(request.url);
      if (url.hostname !== "api.themoviedb.org") return "abort";
      const match = url.pathname.match(/^\/3\/person\/(309|955)(\/movie_credits)?$/);
      if (match) {
        if (!match[2]) {
          return Response.json({ id: Number(match[1]), name: NAMES[match[1] === "309" ? 0 : 1], profile_path: null, biography: "A biography." });
        }
        return Response.json({ cast: films, crew: [] });
      }
      if (url.pathname === "/3/discover/movie") return Response.json({ total_pages: 1, results: [] });
      return "abort";
    });
    await provide(next);
  },
});

// Activate the server-side fetch fixtures before any test navigates to a people page.
test.beforeEach(async ({ next }) => {
  void next;
});

type ViewName = "timeline" | "table" | "clippings" | "focus";
const VIEWS: Record<ViewName, string> = { timeline: "", table: "?view=table", clippings: "?view=clippings", focus: "?view=depth" };
const TAB_NAME: Record<Exclude<ViewName, "focus">, string> = { timeline: "Timeline", table: "Table", clippings: "Clippings" };

const bar = (page: Page) => page.locator("[data-people-bar]");
const scene = (page: Page) => page.getByRole("region", { name: "Film timeline. Scroll down for later years.", exact: true });
const settingsGear = (page: Page) => page.getByRole("button", { name: "Settings", exact: true });
const settingsSheet = (page: Page) => page.getByRole("dialog", { name: "Settings", exact: true });
const headline = (page: Page) => page.getByRole("heading", { level: 1 });

/** Opens a view of the pair and waits until it is live (the flat page reads its view from the address bar once hydrated). */
async function openView(page: Page, view: ViewName) {
  await page.goto(`${PAIR}${VIEWS[view]}`);
  if (view === "focus") await expect(scene(page)).toBeVisible();
  // By id, not by role: the tabs are not shown on a phone (the gear's sheet has the views), which a role query leaves out.
  else await expect(page.locator(`[role="tab"][id$="-tab-${view}"]`)).toHaveAttribute("aria-selected", "true");
}

type Box = { x: number; y: number; width: number; height: number };
const round = (box: Box | null): Box | null =>
  box && Object.fromEntries(Object.entries(box).map(([key, value]) => [key, Math.round(value * 100) / 100])) as Box;

/** Where each of the bar's items is on the screen (null for one that is not shown: the home pill and the tabs are not on a phone). */
async function measureBar(page: Page) {
  const root = bar(page);
  const box = async (locator: Locator) => ((await locator.count()) > 0 && (await locator.first().isVisible()) ? round(await locator.first().boundingBox()) : null);
  return {
    bar: await box(root),
    home: await box(root.getByRole("link", { name: "Parallel home", exact: true })),
    people: await box(root.getByRole("button", { name: /^People on this page/ })),
    // The views: tabs on the flat page, links on Focus, in the same box either way.
    tabs: await box(root.locator('[role="tablist"], nav[aria-label="Views"]')),
    tabItems: await Promise.all(
      ["Timeline", "Table", "Clippings"].map((name) => box(root.locator(`[role="tab"], nav[aria-label="Views"] a`).filter({ hasText: name }))),
    ),
    gear: await box(root.getByRole("button", { name: "Settings", exact: true })),
  };
}

for (const [label, viewport] of [
  ["desktop", { width: 1440, height: 900 }],
  ["phone", { width: 390, height: 844 }],
] as const) {
  test.describe(`at ${viewport.width}px`, () => {
    test.use({ viewport, hasTouch: label === "phone", isMobile: label === "phone" });

    test("the bar's items are in the same place and size on the Timeline, the Table, the Clippings and Focus", async ({ page }) => {
      const measured = {} as Record<ViewName, Awaited<ReturnType<typeof measureBar>>>;
      for (const view of Object.keys(VIEWS) as ViewName[]) {
        await openView(page, view);
        measured[view] = await measureBar(page);
      }

      const timeline = measured.timeline;
      // It is the bar: the people and the gear are there on every view, the home pill and the views only from the small breakpoint up (a phone's gear holds them).
      expect(timeline.people).not.toBeNull();
      expect(timeline.gear).not.toBeNull();
      expect(timeline.home === null).toBe(label === "phone");
      expect(timeline.tabs === null).toBe(label === "phone");
      for (const view of ["table", "clippings", "focus"] as const) expect(measured[view], `the bar on ${view}`).toEqual(timeline);
      // The bar spans the screen and its items are over the top of the page, clear of the edges.
      expect(timeline.bar!.x).toBe(0);
      expect(timeline.bar!.width).toBe(viewport.width);
      expect(timeline.people!.x).toBeGreaterThanOrEqual(8);
      expect(timeline.gear!.x + timeline.gear!.width).toBeLessThan(viewport.width - 16);
    });

    test("switching the flat page's views moves nothing in the bar", async ({ page }) => {
      await openView(page, "timeline");
      const before = await measureBar(page);
      for (const view of ["table", "clippings", "timeline"] as const) {
        if (label === "phone") {
          // The views are in the gear's sheet on a phone: choosing one closes the sheet and leaves the bar where it was.
          await settingsGear(page).tap();
          await settingsSheet(page).getByRole("navigation", { name: "Views", exact: true }).getByRole("link", { name: TAB_NAME[view], exact: true }).tap();
          await expect(settingsSheet(page)).toBeHidden();
        } else {
          await bar(page).getByRole("tab", { name: TAB_NAME[view], exact: true }).click();
        }
        await expect(page.getByRole("tabpanel").and(page.locator(`[id$="-panel-${view}"]`))).toBeVisible();
        expect(await measureBar(page), `the bar on ${view}`).toEqual(before);
      }
    });

    test("the headline is the page's h1 on every view, under the bar in the same place, and scrolls away", async ({ page }) => {
      const where = {} as Record<ViewName, Box>;
      for (const view of Object.keys(VIEWS) as ViewName[]) {
        await openView(page, view);
        await expect(headline(page)).toHaveCount(1);
        await expect(headline(page)).toHaveText(HEADLINE);
        // The names bright and the count muted: the same markup and styles on every view.
        await expect(headline(page).locator("span")).toHaveText(", 12 films");
        const [names, count] = await headline(page).evaluate((element) => [
          getComputedStyle(element).color,
          getComputedStyle(element.querySelector("span")!).color,
        ]);
        expect(count).not.toBe(names);

        // On Focus too it is where the page lands: under the bar, as on the flat pages (see the mid-career test in depth-view.spec.ts).
        await expect(headline(page).locator("..").locator("..")).toHaveCSS("opacity", "1");
        where[view] = (await headline(page).boundingBox())!;
        const barBox = (await bar(page).boundingBox())!;
        const people = (await bar(page).getByRole("button", { name: /^People on this page/ }).boundingBox())!;
        // Under the bar's controls and at the top left, in the same place relative to the bar on every view.
        expect(where[view].y).toBeGreaterThanOrEqual(people.y + people.height);
        expect(where[view].x).toBeLessThan(16);
        expect(barBox.y).toBe(0);
      }
      for (const view of ["table", "clippings", "focus"] as const) expect(where[view], `the headline on ${view}`).toEqual(where.timeline);

      // It scrolls away with the page: out of sight above the screen, and not fixed. (A screen short enough for every page to scroll by more than its height.)
      await page.setViewportSize({ width: viewport.width, height: 600 });
      for (const view of Object.keys(VIEWS) as ViewName[]) {
        await openView(page, view);
        if (view === "focus") {
          await scene(page).evaluate((element) => {
            element.scrollTop = element.scrollHeight;
          });
        } else {
          await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        }
        await expect.poll(async () => (await headline(page).boundingBox())!.y + (await headline(page).boundingBox())!.height, { message: view }).toBeLessThan(0);
        // The bar stays.
        expect(round(await bar(page).boundingBox())).toMatchObject({ y: 0 });
      }
    });
  });
}

test.describe("in the Depth view", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("the headline is a plain block in the scroller: nothing 3D, nothing fixed, and no parallax", async ({ page }) => {
    await openView(page, "focus");
    const region = scene(page);
    await expect(headline(page).locator("..").locator("..")).toHaveCSS("opacity", "1");

    // No transform on the headline or anything between it and the scroller (a translateZ would scale and parallax it), and no `fixed` in the scroller.
    const flat = await headline(page).evaluate((element) => {
      const chain: Element[] = [];
      for (let node: Element | null = element; node && node.getAttribute("role") !== "region"; node = node.parentElement) chain.push(node);
      return chain.map((node) => ({ transform: getComputedStyle(node).transform, style: getComputedStyle(node).transformStyle }));
    });
    expect(flat.length).toBeGreaterThan(1);
    for (const link of flat) expect(link).toEqual({ transform: "none", style: "flat" });
    expect(await region.evaluate((element) => [...element.querySelectorAll("*")].some((node) => getComputedStyle(node).position === "fixed"))).toBe(false);

    // It moves with the scroll one for one, in either direction (a layer behind would move at a different rate), and is no bigger or smaller.
    const start = await region.evaluate((element) => element.scrollTop);
    const rest = (await headline(page).boundingBox())!;
    for (const delta of [16, 90, 400]) {
      await region.evaluate((element, value) => {
        element.scrollTop = value;
      }, start + delta);
      await expect.poll(() => region.evaluate((element) => element.scrollTop)).toBe(start + delta);
      const box = (await headline(page).boundingBox())!;
      expect(box.y).toBeCloseTo(rest.y - delta, 1);
      expect(box.x).toBeCloseTo(rest.x, 1);
      expect(box.width).toBeCloseTo(rest.width, 1);
      expect(box.height).toBeCloseTo(rest.height, 1);
    }
    await expect(headline(page)).toHaveCount(1);
  });
});

test.describe("what is no longer on the page", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("the site's header, the Add a person field and the row of Export and Share are gone from the flat views: the bar has them", async ({ page }) => {
    for (const view of ["timeline", "table", "clippings", "focus"] as const) {
      await openView(page, view);
      // No site header (it is the same wordmark as the bar's home pill, which is the only way home on the page) and no header search.
      await expect(page.getByRole("banner")).toHaveCount(0);
      await expect(page.getByRole("link", { name: "Parallel home", exact: true })).toHaveCount(1);
      // No field to add a person outside the people pill (closed, it has none), and Export and Share are not on the page itself.
      await expect(page.getByRole("combobox", { name: "Add a person", exact: true })).toHaveCount(0);
      await expect(page.locator("main").getByRole("button", { name: "Share", exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Export List as CSV" })).toHaveCount(0);
    }
    // The other pages keep their header.
    await page.goto("/");
    await expect(page.getByRole("banner")).toBeVisible();
    await expect(bar(page)).toHaveCount(0);
  });

  test("the people pill is on the flat page: it opens on its field and the people, and closes when the page scrolls", async ({ page }) => {
    await openView(page, "table");
    await page.getByRole("button", { name: /^People on this page/ }).click();
    // The same pill as the Depth view's: the app's search field to add someone (focused) and a row for each person, with a way to remove them.
    await expect(page.getByRole("combobox", { name: "Add a person", exact: true })).toBeFocused();
    const card = page.getByRole("dialog", { name: "People", exact: true });
    await expect(card.getByRole("link", { name: "Remove Pedro Almodóvar", exact: true })).toHaveAttribute("href", /^\/p\/955-penelope-cruz/);
    // The page is what scrolls here (the Depth view's scroller is what closes it there).
    await page.mouse.wheel(0, 300);
    await expect(card).toBeHidden();
    await page.evaluate(() => window.scrollTo(0, 0));
    // With it closed there is no field on the page.
    await expect(page.getByRole("combobox", { name: "Add a person", exact: true })).toHaveCount(0);
  });
});

test.describe("the people pill's rows open the biography, as names do everywhere else", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const view of ["table", "focus"] as const) {
    test(`on the ${view}: the name and the portrait open it, the pill stays open under it, and focus comes back to the opener`, async ({ page }) => {
      await openView(page, view);
      await page.getByRole("button", { name: /^People on this page/ }).click();
      const card = page.getByRole("dialog", { name: "People", exact: true });
      await expect(card).toBeVisible();
      const name = card.getByRole("button", { name: "Pedro Almodóvar", exact: true });
      const bio = page.getByRole("dialog", { name: "Pedro Almodóvar", exact: true });

      // A click on the name: the biography the people column's names and the Clippings' open, the same dialog (the TMDB link on the name, the text).
      await name.click();
      await expect(bio).toBeVisible();
      await expect(bio.getByText("A biography.")).toBeVisible();
      await expect(bio.getByRole("heading").getByRole("link")).toHaveAttribute("href", "https://www.themoviedb.org/person/309");
      // Its Close button is a press outside the pill's box: the pill stays, and the focus goes back to the name.
      await bio.getByRole("button", { name: "Close", exact: true }).click();
      await expect(bio).toBeHidden();
      await expect(card).toBeVisible();
      await expect(name).toBeFocused();

      // Escape closes the biography and not the pill under it; so does a press on the backdrop.
      await name.click();
      await expect(bio).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(bio).toBeHidden();
      await expect(card).toBeVisible();
      await expect(name).toBeFocused();
      await name.click();
      await expect(bio).toBeVisible();
      await page.mouse.click(4, 450);
      await expect(bio).toBeHidden();
      await expect(card).toBeVisible();
      await expect(name).toBeFocused();

      // The portrait is the same opener, for the mouse and the touch (the name beside it is the keyboard's).
      const cruz = page.getByRole("dialog", { name: "Penélope Cruz", exact: true });
      await card.getByRole("button", { name: "Biography of Penélope Cruz", exact: true }).click();
      await expect(cruz).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(cruz).toBeHidden();
      await expect(card).toBeVisible();
      await expect(card.getByRole("button", { name: "Biography of Penélope Cruz", exact: true })).toBeFocused();

      // Remove is still there, with the film count and roles beside the name as the people column writes them.
      await expect(card.getByRole("link", { name: "Remove Pedro Almodóvar", exact: true })).toHaveAttribute("href", /^\/p\/955-penelope-cruz/);
      await expect(card.getByText("12 films")).toHaveCount(2);
    });
  }

  test("by keyboard: Tab reaches the name, and Enter opens the biography", async ({ page }) => {
    await openView(page, "timeline");
    await page.getByRole("button", { name: /^People on this page/ }).click();
    const card = page.getByRole("dialog", { name: "People", exact: true });
    await expect(page.getByRole("combobox", { name: "Add a person", exact: true })).toBeFocused();
    // The field, then the close button, then the rows: the first name, not the portrait (which is out of the Tab order).
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Close people", exact: true })).toBeFocused();
    await page.keyboard.press("Tab");
    const name = card.getByRole("button", { name: "Pedro Almodóvar", exact: true });
    await expect(name).toBeFocused();
    await expect(name).toHaveCSS("cursor", "pointer");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog", { name: "Pedro Almodóvar", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Pedro Almodóvar", exact: true })).toBeHidden();
    await expect(card).toBeVisible();
    await expect(name).toBeFocused();
    // Tab goes on to the next row's name and its Remove link.
    await page.keyboard.press("Tab");
    await expect(card.getByRole("link", { name: "Remove Pedro Almodóvar", exact: true })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(card.getByRole("button", { name: "Penélope Cruz", exact: true })).toBeFocused();
  });
});

test.describe("Export and Share are in the gear on every view", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const view of ["timeline", "table", "clippings", "focus"] as const) {
    test(`on the ${view}`, async ({ page }) => {
      await openView(page, view);
      await settingsGear(page).click();
      const sheet = settingsSheet(page);
      await expect(sheet.getByRole("button", { name: "Share", exact: true })).toBeVisible();
      // The film settings, and Export for the views that list films (it is the table's films: not the Clippings).
      await expect(sheet.getByRole("checkbox", { name: "Show all films", exact: true })).toBeVisible();
      await expect(sheet.getByRole("button", { name: "Export List as CSV", exact: true })).toHaveCount(view === "clippings" ? 0 : 1);
    });
  }

  test("Export writes the table's films as a CSV file", async ({ page }) => {
    await openView(page, "table");
    // In the order the table is sorted in: newest first, after a click on Year.
    await page.getByRole("button", { name: /^Year/ }).click();
    await settingsGear(page).click();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      settingsSheet(page).getByRole("button", { name: "Export List as CSV", exact: true }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("pedro-almodovar-penelope-cruz-shared-films.csv");
    const text = await (await import("node:fs/promises")).readFile((await download.path())!, "utf8");
    const lines = text.trim().split("\n");
    expect(lines).toHaveLength(13);
    expect(lines[1]).toContain("Bar Film 12");
    await expect(settingsSheet(page).getByRole("status").last()).toContainText("Downloaded pedro-almodovar-penelope-cruz-shared-films.csv with 12 films");
  });
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("the gear's sheet holds the views, the settings, Share, Export and the way home, on the flat page too", async ({ page }) => {
    await openView(page, "timeline");
    await settingsGear(page).tap();
    const sheet = settingsSheet(page);
    const views = sheet.getByRole("navigation", { name: "Views", exact: true });
    await expect(views.getByRole("link")).toHaveText(["Timeline", "Table", "Clippings"]);
    await expect(views.getByRole("link", { name: "Timeline", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(sheet.getByRole("checkbox", { name: "Show all films", exact: true })).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Share", exact: true })).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Export List as CSV", exact: true })).toBeVisible();
    await expect(sheet.getByRole("link", { name: "Parallel home", exact: true })).toHaveAttribute("href", "/");
    // The flat timeline keeps the layout control inside its panel: it is not in the sheet (that is the Focus view's).
    await expect(sheet.getByRole("button", { name: "Combined timeline", exact: true })).toHaveCount(0);

    // The sheet fits the screen.
    const box = (await sheet.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);

    // A tap on Table shows the table in place, and puts the sheet away.
    await views.getByRole("link", { name: "Table", exact: true }).tap();
    await expect(page.locator('[role="tab"][id$="-tab-table"]')).toHaveAttribute("aria-selected", "true");
    await expect(sheet).toBeHidden();
    expect(new URL(page.url()).searchParams.get("view")).toBe("table");
  });
});
