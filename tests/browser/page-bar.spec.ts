import { test as base, expect } from "next/experimental/testmode/playwright";
import type { Locator, Page } from "next/experimental/testmode/playwright";

/**
 * The page bar of a `/p/` page is the same on every view: the flat Timeline, Table and Clippings, and the Depth view (Focus). These tests measure
 * it. The home pill, the people pill and the views are in the same place on all four; the gear is where its view puts it (at the right edge on
 * the flat views, left of the year rail on Focus) with the layout control before it on the Timeline and Focus; between a flat view and Focus they
 * glide (a view transition), and the tests watch that happen. They check what goes with the bar too: the headline under it (the page's `h1`, on every view)
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
const depthViews = (page: Page) => page.getByRole("navigation", { name: "Views", exact: true });

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
    // The layout control (Focus, Combined): on the Timeline and Focus, not on the Table and Clippings, and not on a phone (its sheet has it).
    layout: await box(root.getByRole("group", { name: "Timeline layout", exact: true })),
  };
}

type BarBoxes = Awaited<ReturnType<typeof measureBar>>;
/** The bar's items that are in the same place on every view: all but the gear and the layout control, which are where their view puts them. */
const fixedItems = ({ gear, layout, ...rest }: BarBoxes) => {
  void gear;
  void layout;
  return rest;
};

for (const [label, viewport] of [
  ["desktop", { width: 1440, height: 900 }],
  ["phone", { width: 390, height: 844 }],
] as const) {
  test.describe(`at ${viewport.width}px`, () => {
    test.use({ viewport, hasTouch: label === "phone", isMobile: label === "phone" });

    test("the home pill, the people and the views are in the same place and size on the Timeline, the Table, the Clippings and Focus; the gear is at the right edge on the flat views and left of the rail on Focus", async ({ page }) => {
      const measured = {} as Record<ViewName, BarBoxes>;
      let rail: Box | null = null;
      for (const view of Object.keys(VIEWS) as ViewName[]) {
        await openView(page, view);
        // The Table and Clippings have no layout control (a flat page shows it out of sight, faded, until the page has settled).
        if (view === "table" || view === "clippings") await expect(bar(page).getByRole("group", { name: "Timeline layout", exact: true })).toBeHidden();
        measured[view] = await measureBar(page);
        if (view === "focus") rail = round(await page.locator("[data-depth-rail]").boundingBox());
      }

      const timeline = measured.timeline;
      // It is the bar: the people and the gear are there on every view, the home pill and the views only from the small breakpoint up (a phone's gear holds them).
      expect(timeline.people).not.toBeNull();
      expect(timeline.gear).not.toBeNull();
      expect(timeline.home === null).toBe(label === "phone");
      expect(timeline.tabs === null).toBe(label === "phone");
      // Every item but the gear and the layout control is identical on all four views.
      for (const view of ["table", "clippings", "focus"] as const) expect(fixedItems(measured[view]), `the bar on ${view}`).toEqual(fixedItems(timeline));
      // The bar spans the screen and its items are over the top of the page, clear of the edges.
      expect(timeline.bar!.x).toBe(0);
      expect(timeline.bar!.width).toBe(viewport.width);
      expect(timeline.people!.x).toBeGreaterThanOrEqual(8);

      // The flat views share their boxes, the gear's too: at the right edge, with the gutter the home pill has at the left. (A phone has no home pill: its first item
      // is the people pill, whose outline starts at the same 12px, with its button inside that, so the gutter is the bar's own.)
      for (const view of ["table", "clippings"] as const) expect(measured[view].gear, `the gear on ${view}`).toEqual(timeline.gear);
      const leftGutter = label === "phone" ? 12 : timeline.home!.x;
      expect(leftGutter).toBe(12);
      for (const view of ["timeline", "table", "clippings"] as const) {
        const gear = measured[view].gear!;
        expect(viewport.width - (gear.x + gear.width), `the gear's right gutter on ${view}`).toBe(leftGutter);
      }

      // On Focus it is left of the year rail, with room to spare, and the same size and height as on the flat views.
      const focusGear = measured.focus.gear!;
      expect(rail).not.toBeNull();
      expect(rail!.x - (focusGear.x + focusGear.width)).toBeGreaterThanOrEqual(8);
      expect(focusGear.x).toBeLessThan(timeline.gear!.x);
      expect({ y: focusGear.y, width: focusGear.width, height: focusGear.height }).toEqual({ y: timeline.gear!.y, width: timeline.gear!.width, height: timeline.gear!.height });

      // The layout control: before the gear on the Timeline and on Focus, the same size and height, and not on the Table and Clippings. Not on a phone's bar at all.
      if (label === "phone") {
        for (const view of Object.keys(VIEWS) as ViewName[]) expect(measured[view].layout, `the layout control on ${view}`).toBeNull();
      } else {
        expect(measured.table.layout).toBeNull();
        expect(measured.clippings.layout).toBeNull();
        for (const view of ["timeline", "focus"] as const) {
          const toggle = measured[view].layout!;
          expect(toggle, `the layout control on ${view}`).not.toBeNull();
          expect(measured[view].gear!.x - (toggle.x + toggle.width), `the gap between the layout control and the gear on ${view}`).toBe(8);
        }
        expect({ y: measured.focus.layout!.y, width: measured.focus.layout!.width, height: measured.focus.layout!.height }).toEqual({
          y: timeline.layout!.y,
          width: timeline.layout!.width,
          height: timeline.layout!.height,
        });
      }
    });

    test("switching the flat page's views moves nothing in the bar: the gear stays, and the layout control fades in and out", async ({ page }) => {
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
        // The layout control is the Timeline's: it fades out for the Table and Clippings and back in for the Timeline (and is out of the way and inert while it is out).
        if (label === "desktop") {
          const layout = bar(page).getByRole("group", { name: "Timeline layout", exact: true });
          if (view === "timeline") await expect(layout).toBeVisible();
          else await expect(layout).toBeHidden();
        }
        const now = await measureBar(page);
        expect(now.gear, `the gear on ${view}`).toEqual(before.gear);
        expect(fixedItems(now), `the bar on ${view}`).toEqual(fixedItems(before));
        if (view === "timeline") expect(now.layout).toEqual(before.layout);
      }
    });

    test("one gear and one layout control, in the bar: the flat Timeline has none of its own inside the timeline", async ({ page }) => {
      for (const view of ["timeline", "table", "clippings", "focus"] as const) {
        await openView(page, view);
        // One gear on the page, and it is the bar's; the timeline panel's own (the "Film settings" one, in a group over its corner) is gone.
        await expect(page.getByRole("button", { name: "Settings", exact: true })).toHaveCount(1);
        await expect(bar(page).getByRole("button", { name: "Settings", exact: true })).toHaveCount(1);
        await expect(page.getByRole("button", { name: "Film settings" })).toHaveCount(0);
        await expect(page.getByRole("group", { name: "Timeline settings", exact: true })).toHaveCount(0);

        // The layout control is the Timeline's and Focus's, once, in the bar; the Table and Clippings have only the gear. (On a phone the bar has not room: see the sheet below.)
        const onPage = page.getByRole("group", { name: "Timeline layout", exact: true });
        const inBar = bar(page).getByRole("group", { name: "Timeline layout", exact: true });
        const expected = label === "desktop" && (view === "timeline" || view === "focus") ? 1 : 0;
        await expect(onPage, `the layout control on ${view}`).toHaveCount(expected);
        await expect(inBar, `the layout control in the bar on ${view}`).toHaveCount(expected);

        if (label === "phone") {
          // The sheet has it on the Timeline and Focus, and not on the Table and Clippings, which are not about the layout.
          await settingsGear(page).tap();
          await expect(settingsSheet(page).getByRole("group", { name: "Timeline layout", exact: true })).toHaveCount(view === "timeline" || view === "focus" ? 1 : 0);
          await page.keyboard.press("Escape");
          await expect(settingsSheet(page)).toBeHidden();
        }
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

  test("the gear's sheet holds the views, the layout, the settings, Share, Export and the way home, on the flat page too", async ({ page }) => {
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
    // The Timeline's layout control is in the sheet, as Focus's is (the bar has no room for it on a phone): Combined is the one pressed, here.
    await expect(sheet.getByRole("button", { name: "Combined timeline", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(sheet.getByRole("button", { name: "Focus view", exact: true })).toHaveAttribute("aria-pressed", "false");

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

// ---- moving between a flat view and Focus: the gear and the layout control glide -------------------------------------------------

/** What a frame of a view transition looked like: the animations the browser was running on its pseudo-elements, and where the two named groups were. */
type VtSample = { running: { pseudo: string; duration: number }[]; gearX: number | null; layoutX: number | null };

/**
 * Runs in the page (it is serialized: nothing outside it is in reach): from now on, every frame, notes the animations running on the view transition's
 * pseudo-elements (`document.getAnimations()` includes them) and the x of the gear's and the layout control's groups, which is where the browser draws
 * them for as long as the transition runs (the real elements are held back, so their own boxes say nothing: they are at their new place from the start).
 */
function sampleViewTransitions() {
  const w = window as unknown as { __vt?: { samples: VtSample[]; stop: boolean } };
  // A page that is sampling already (this is a second go, after a navigation within it): that one stops, and this starts afresh.
  if (w.__vt) w.__vt.stop = true;
  const state = { samples: [] as VtSample[], stop: false };
  w.__vt = state;
  const groupX = (name: string) => {
    const transform = getComputedStyle(document.documentElement, `::view-transition-group(${name})`).transform;
    return transform && transform !== "none" ? new DOMMatrix(transform).m41 : null;
  };
  const frame = () => {
    const running = document.getAnimations().flatMap((animation) => {
      const effect = animation.effect as KeyframeEffect | null;
      const pseudo = effect?.pseudoElement;
      if (!effect || !pseudo || !pseudo.startsWith("::view-transition") || animation.playState === "finished") return [];
      return [{ pseudo, duration: Number(effect.getComputedTiming().duration) }];
    });
    state.samples.push({ running, gearX: groupX("people-bar-gear"), layoutX: groupX("people-bar-layout") });
    if (!state.stop) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

const startSampling = (page: Page) => page.evaluate(sampleViewTransitions);
/** Waits until the glide has been seen (the sampler saw a lasting animation) and is over (none is running now). */
const transitionsDone = (page: Page) =>
  expect
    .poll(() =>
      page.evaluate(() => {
        const w = window as unknown as { __vt: { samples: VtSample[] } };
        const seen = w.__vt.samples.some((sample) => sample.running.some((animation) => animation.duration > 0));
        const now = document.getAnimations().some(
          (animation) => (animation.effect as KeyframeEffect | null)?.pseudoElement?.startsWith("::view-transition") && animation.playState !== "finished",
        );
        return seen && !now;
      }),
    )
    .toBe(true);
async function stopSampling(page: Page): Promise<VtSample[]> {
  return page.evaluate(() => {
    const w = window as unknown as { __vt: { samples: VtSample[]; stop: boolean } };
    w.__vt.stop = true;
    return w.__vt.samples;
  });
}
/** The animations that moved or faded something: a real duration, not the zero-length ones the root's group has, or reduced motion leaves. */
const lasting = (samples: VtSample[]) => samples.flatMap((sample) => sample.running).filter((animation) => animation.duration > 0);
/** Whether the x ever was strictly between the two ends (the glide is on its way), by more than a pixel at each end. */
const wasBetween = (xs: (number | null)[], from: number, to: number) =>
  xs.some((x) => x !== null && x > Math.min(from, to) + 1 && x < Math.max(from, to) - 1);

/** The pseudo-element names (`people-bar-gear`...) of the animations that lasted. */
const animatedNames = (samples: VtSample[]) =>
  [...new Set(lasting(samples).map((animation) => /\(([^)]*)\)/.exec(animation.pseudo)?.[1] ?? animation.pseudo))].sort();

test.describe("moving between a flat view and Focus", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  // The layout control of the bar (Focus is the one to press to leave for the scene) and the way back (Combined).
  const toFocus = (page: Page) => bar(page).getByRole("button", { name: "Focus view", exact: true });
  const toCombined = (page: Page) => bar(page).getByRole("button", { name: "Combined timeline", exact: true });

  test("the gear and the layout control glide from the flat Timeline to Focus and back, and nothing else in the bar animates", async ({ page }) => {
    await openView(page, "timeline");
    const flat = await measureBar(page);

    await startSampling(page);
    await toFocus(page).click();
    await expect(scene(page)).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-view", "depth");
    // Past the whole glide (360ms), as long as the browser runs it.
    await transitionsDone(page);
    const forth = await stopSampling(page);
    const focus = await measureBar(page);

    // The gear and the layout control were drawn on the way: between where they were and where they are (the flat Timeline's, Focus's).
    expect(focus.gear!.x).toBeLessThan(flat.gear!.x);
    expect(wasBetween(forth.map((sample) => sample.gearX), flat.gear!.x, focus.gear!.x)).toBe(true);
    expect(wasBetween(forth.map((sample) => sample.layoutX), flat.layout!.x, focus.layout!.x)).toBe(true);
    // For 360ms, as the people pill's heads move; and they are all that moved: the home pill, the people pill and the views are not named, so they are the new page's at once.
    expect(lasting(forth).some((animation) => animation.pseudo === "::view-transition-group(people-bar-gear)" && animation.duration === 360)).toBe(true);
    expect(animatedNames(forth)).toEqual(["people-bar-gear", "people-bar-layout"]);
    // And no cross-fade of the page: the root has no image pair (the scene is not captured, so it is never in the middle of a fade).
    expect(forth.flatMap((sample) => sample.running).filter((animation) => /\(root\)/.test(animation.pseudo) && animation.duration > 0)).toEqual([]);
    expect(fixedItems(focus)).toEqual(fixedItems(flat));

    // And back: Combined leaves for the flat Timeline, and they glide right.
    await startSampling(page);
    await toCombined(page).click();
    await expect(scene(page)).toHaveCount(0);
    await expect(bar(page).getByRole("tab", { name: "Timeline", exact: true })).toHaveAttribute("aria-selected", "true");
    await transitionsDone(page);
    const back = await stopSampling(page);
    expect(wasBetween(back.map((sample) => sample.gearX), focus.gear!.x, flat.gear!.x)).toBe(true);
    expect(wasBetween(back.map((sample) => sample.layoutX), focus.layout!.x, flat.layout!.x)).toBe(true);
    expect(animatedNames(back)).toEqual(["people-bar-gear", "people-bar-layout"]);
    expect(await measureBar(page)).toEqual(flat);
  });

  test("from Focus to the Table the gear glides right and the layout control, which the Table has not, fades out", async ({ page }) => {
    await openView(page, "focus");
    const focus = await measureBar(page);

    await startSampling(page);
    await depthViews(page).getByRole("link", { name: "Table", exact: true }).click();
    await expect(page.locator('[role="tab"][id$="-tab-table"]')).toHaveAttribute("aria-selected", "true");
    await transitionsDone(page);
    const samples = await stopSampling(page);
    const table = await measureBar(page);

    expect(table.gear!.x).toBeGreaterThan(focus.gear!.x);
    expect(wasBetween(samples.map((sample) => sample.gearX), focus.gear!.x, table.gear!.x)).toBe(true);
    // The control has no place on the Table to glide to: the old one fades out where it was.
    expect(table.layout).toBeNull();
    expect(lasting(samples).some((animation) => animation.pseudo === "::view-transition-old(people-bar-layout)")).toBe(true);
    expect(fixedItems(table)).toEqual(fixedItems(focus));
  });

  test("with reduced motion the gear is at its new place at once: nothing runs for any time", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openView(page, "timeline");
    const flat = await measureBar(page);

    await startSampling(page);
    await toFocus(page).click();
    await expect(scene(page)).toBeVisible();
    await page.waitForTimeout(700);
    const samples = await stopSampling(page);
    const focus = await measureBar(page);

    expect(focus.gear!.x).toBeLessThan(flat.gear!.x);
    expect(lasting(samples)).toEqual([]);
    // Never drawn anywhere but where it ended up (a group at the old place, or on its way, would show here).
    for (const sample of samples) {
      if (sample.gearX !== null) expect(sample.gearX).toBeCloseTo(focus.gear!.x, 0);
      if (sample.layoutX !== null) expect(sample.layoutX).toBeCloseTo(focus.layout!.x, 0);
    }
  });

  for (const view of ["timeline", "focus"] as const) {
    test(`the first load of the ${view} page animates nothing`, async ({ page }) => {
      await page.addInitScript(sampleViewTransitions);
      await openView(page, view);
      await page.waitForTimeout(900);
      const samples = await stopSampling(page);
      expect(samples.length).toBeGreaterThan(10);
      expect(lasting(samples)).toEqual([]);
      for (const sample of samples) expect([sample.gearX, sample.layoutX]).toEqual([null, null]);
    });
  }
});

test.describe("on a phone: from the flat Timeline to Focus through the sheet", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("the gear glides there and back, 24px each way", async ({ page }) => {
    await openView(page, "timeline");
    const flat = await measureBar(page);

    await startSampling(page);
    await settingsGear(page).tap();
    await settingsSheet(page).getByRole("button", { name: "Focus view", exact: true }).tap();
    await expect(scene(page)).toBeVisible();
    await transitionsDone(page);
    const forth = await stopSampling(page);
    const focus = await measureBar(page);
    expect(flat.gear!.x - focus.gear!.x).toBe(24);
    expect(wasBetween(forth.map((sample) => sample.gearX), flat.gear!.x, focus.gear!.x)).toBe(true);
    expect(animatedNames(forth)).toEqual(["people-bar-gear"]);
    expect(fixedItems(focus)).toEqual(fixedItems(flat));

    await startSampling(page);
    await settingsGear(page).tap();
    await settingsSheet(page).getByRole("button", { name: "Combined timeline", exact: true }).tap();
    await expect(scene(page)).toHaveCount(0);
    await expect(page.locator('[role="tab"][id$="-tab-timeline"]')).toHaveAttribute("aria-selected", "true");
    await transitionsDone(page);
    const back = await stopSampling(page);
    expect(wasBetween(back.map((sample) => sample.gearX), focus.gear!.x, flat.gear!.x)).toBe(true);
    expect(await measureBar(page)).toEqual(flat);
  });
});
