import type { Locator, Page } from "next/experimental/testmode/playwright";
import { FILM_COUNT, HEADLINE, PAIR, expect, test } from "./almodovar";
import { bar, scene, storedFilmsView, viewLink } from "./fixtures";

/**
 * The page bar of a `/p/` page is the same on every view: the flat Timeline, Table and Quotes, and the Depth view (Focus). These tests measure
 * it. The home square (from `sm` up: a phone's bar has none, its sheet has the way home), the people pill and the pill of films together are in
 * the same place on all four, and as tall as the switcher and the gear (one height, the people pill's); at the right, the view switcher (Timeline, Focus, Table) and the gear are where their view puts them (at the
 * right edge on the flat views, left of the year rail on Focus), and are on every view, the Quotes too; between a flat view and Focus they glide (a
 * view transition), and the tests watch that happen. The Films | Quotes nav is not in the bar's row but down the left edge under the home square
 * (see section-nav.spec.ts), the same on every view. They check what goes with the bar too: the h1 (visually hidden, on every view) and what is no
 * longer on the page (the site's header, the title row's Add a person field, the row of Export and Share: Export and Share are in the gear).
 *
 * The pair is Almodóvar and Cruz, who have Quotes (a pair without any has no section nav), with a dozen films in common so that the pages are long
 * enough to scroll.
 */

// Activate the server-side fetch fixtures before any test navigates to a people page.
test.beforeEach(async ({ next }) => {
  void next;
});

type ViewName = "timeline" | "table" | "clippings" | "focus";
const VIEWS: Record<ViewName, string> = { timeline: "", table: "?view=table", clippings: "?view=clippings", focus: "?view=depth" };
const ALL_VIEWS = Object.keys(VIEWS) as ViewName[];

/** The page bar's one corner radius (`--bar-radius`, globals.css), in px: a rounded rectangle. */
const BAR_RADIUS = 6;

const settingsGear = (page: Page) => page.getByRole("button", { name: "Settings", exact: true });
const settingsSheet = (page: Page) => page.getByRole("dialog", { name: "Settings", exact: true });
const headline = (page: Page) => page.getByRole("heading", { level: 1 });
const together = (page: Page) => bar(page).locator("[data-together-pill]");

/**
 * The bar's link to a view, found by what it is rather than by its role, so that it is found where it is not shown (a phone's bar hides the tabs
 * and the switcher: the gear's sheet has the same links). The Quotes are a section's tab, the others the switcher's.
 */
const link = (page: Page, view: ViewName) =>
  view === "clippings"
    ? bar(page).locator('nav[aria-label="Sections"] a[href*="view=clippings"]')
    : bar(page).locator(`nav[aria-label="Films view"] a[aria-label="${{ timeline: "Timeline", focus: "Focus", table: "Table" }[view]} view"]`);
const filmsLink = (page: Page) => bar(page).locator('nav[aria-label="Sections"] a:not([href*="view=clippings"])');

/** Opens a view of the pair and waits until it is live (the flat page reads its view from the address bar once hydrated, and records it). */
async function openView(page: Page, view: ViewName) {
  await page.goto(`${PAIR}${VIEWS[view]}`);
  if (view === "focus") {
    await expect(scene(page)).toBeVisible();
    await expect.poll(() => storedFilmsView(page)).toBe("depth");
  } else if (view === "clippings") {
    await expect(link(page, "clippings")).toHaveAttribute("aria-current", "page");
  } else {
    await expect(link(page, view)).toHaveAttribute("aria-current", "page");
    // The effect that records the view runs once the page is live.
    await expect.poll(() => storedFilmsView(page)).toBe(view);
  }
}

type Box = { x: number; y: number; width: number; height: number };
const round = (box: Box | null): Box | null =>
  box && Object.fromEntries(Object.entries(box).map(([key, value]) => [key, Math.round(value * 100) / 100])) as Box;

/** Where each of the bar's items is on the screen (null for one that is not shown: the section nav and the switcher are not on a phone). */
async function measureBar(page: Page) {
  const root = bar(page);
  const box = async (locator: Locator) => ((await locator.count()) > 0 && (await locator.first().isVisible()) ? round(await locator.first().boundingBox()) : null);
  const items = (nav: string) => root.locator(`nav[aria-label="${nav}"] a`);
  return {
    bar: await box(root),
    home: await box(root.getByRole("link", { name: "Parallel home", exact: true })),
    // The people pill: its capsule, which is as tall as the rest of the bar (its button is inside it).
    people: await box(root.locator("[data-pill-capsule]")),
    // The pill of films made together, after the people.
    together: await box(together(page)),
    // The sections: Films and Quotes, down the left edge under the home square (not in the bar's row), in the same box on every view.
    sections: await box(root.locator('nav[aria-label="Sections"]')),
    sectionItems: await Promise.all([0, 1].map((index) => box(items("Sections").nth(index)))),
    // The view switcher and the gear: where their view puts them.
    switcher: await box(root.locator('nav[aria-label="Films view"]')),
    switcherItems: await Promise.all([0, 1, 2].map((index) => box(items("Films view").nth(index)))),
    gear: await box(root.getByRole("button", { name: "Settings", exact: true })),
  };
}

type BarBoxes = Awaited<ReturnType<typeof measureBar>>;
/** The bar's items that are in the same place on every view: all but the gear and the switcher, which are where their view puts them. */
const fixedItems = ({ gear, switcher: _switcher, switcherItems, ...rest }: BarBoxes) => {
  void gear;
  void _switcher;
  void switcherItems;
  return rest;
};

for (const [label, viewport] of [
  ["desktop", { width: 1440, height: 900 }],
  ["phone", { width: 390, height: 844 }],
] as const) {
  test.describe(`at ${viewport.width}px`, () => {
    test.use({ viewport, hasTouch: label === "phone", isMobile: label === "phone" });

    test("the home square, the people, the count and the sections are in the same place and size on the Timeline, the Table, the Quotes and Focus; the switcher and the gear are at the right edge on the flat views and left of the rail on Focus", async ({ page }) => {
      const measured = {} as Record<ViewName, BarBoxes>;
      let rail: Box | null = null;
      for (const view of ALL_VIEWS) {
        await openView(page, view);
        measured[view] = await measureBar(page);
        if (view === "focus") rail = round(await page.locator("[data-depth-rail]").boundingBox());
      }

      const timeline = measured.timeline;
      // It is the bar: the people, the count and the gear are there on every view and on a phone, the home square, the section nav and the switcher only from the
      // small breakpoint up (a phone's gear holds them, and the way home).
      expect(timeline.home === null).toBe(label === "phone");
      expect(timeline.people).not.toBeNull();
      expect(timeline.together).not.toBeNull();
      expect(timeline.gear).not.toBeNull();
      expect(timeline.sections === null).toBe(label === "phone");
      expect(timeline.switcher === null).toBe(label === "phone");
      // Every item but the gear and the switcher is identical on all four views.
      for (const view of ["table", "clippings", "focus"] as const) expect(fixedItems(measured[view]), `the bar on ${view}`).toEqual(fixedItems(timeline));
      // The bar spans the screen and its items are over the top of the page, clear of the edges.
      expect(timeline.bar!.x).toBe(0);
      expect(timeline.bar!.width).toBe(viewport.width);
      expect(timeline.people!.x).toBeGreaterThanOrEqual(8);
      // The count comes right after the people, on their level.
      expect(timeline.together!.x).toBeGreaterThan(timeline.people!.x + timeline.people!.width);
      expect(Math.abs(timeline.together!.y + timeline.together!.height / 2 - (timeline.people!.y + timeline.people!.height / 2))).toBeLessThan(2);
      // The home square comes first, then the people; on a phone the people are first, at the bar's own left gutter.
      if (label === "phone") {
        expect(timeline.people!.x).toBe(12);
      } else {
        expect(timeline.home!.x).toBe(12);
        expect(timeline.home!.width).toBe(timeline.home!.height);
        expect(timeline.people!.x).toBeGreaterThan(timeline.home!.x + timeline.home!.width);
      }

      // One height: the home square, the people pill, the count pill, the switcher and the gear are as tall as each other (the people pill's own: 50px, 46px on a phone),
      // on every view, and on one line.
      for (const view of ALL_VIEWS) {
        const { home, people, together: count, switcher: views, gear } = measured[view];
        const row = [...(label === "desktop" ? [home, views] : []), people, count, gear];
        for (const box of row) {
          expect(box!.height, `the height on ${view}`).toBe(label === "phone" ? 46 : 50);
          expect(box!.y, `the top on ${view}`).toBe(people!.y);
        }
      }

      // The flat views share their boxes, the gear's and the switcher's too: at the right edge, with the gutter the home square has at the left.
      for (const view of ["table", "clippings"] as const) {
        expect(measured[view].gear, `the gear on ${view}`).toEqual(timeline.gear);
        expect(measured[view].switcher, `the switcher on ${view}`).toEqual(timeline.switcher);
        expect(measured[view].switcherItems, `the switcher's items on ${view}`).toEqual(timeline.switcherItems);
      }
      const leftGutter = (timeline.home ?? timeline.people)!.x;
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

      // The switcher: on every view of a desktop (the Quotes too, where none of its views is current), before the gear with the gap the bar's controls have,
      // the same size and height on all four, and moved by the rail's room just as the gear is. Not on a phone's bar at all.
      if (label === "phone") {
        for (const view of ALL_VIEWS) expect(measured[view].switcher, `the switcher on ${view}`).toBeNull();
      } else {
        for (const view of ALL_VIEWS) {
          const { switcher: box, gear } = measured[view];
          expect(box, `the switcher on ${view}`).not.toBeNull();
          expect(gear!.x - (box!.x + box!.width), `the gap between the switcher and the gear on ${view}`).toBe(8);
        }
        const focusSwitcher = measured.focus.switcher!;
        expect({ y: focusSwitcher.y, width: focusSwitcher.width, height: focusSwitcher.height }).toEqual({
          y: timeline.switcher!.y,
          width: timeline.switcher!.width,
          height: timeline.switcher!.height,
        });
        expect(timeline.switcher!.x - focusSwitcher.x).toBe(timeline.gear!.x - focusGear.x);
        // The same height as the gear: one row of controls.
        expect(timeline.switcher!.height).toBe(timeline.gear!.height);
      }
    });

    test("the home button is a rounded square holding only the wordmark's green ll, named Parallel home, on every view; a phone's bar has none", async ({ page }) => {
      for (const view of ALL_VIEWS) {
        await openView(page, view);
        const home = bar(page).getByRole("link", { name: "Parallel home", exact: true });
        if (label === "phone") {
          // Not on the screen (the bar's room is the people pill's and the count's); the gear's sheet has the way home.
          await expect(home, view).toBeHidden();
          continue;
        }
        await expect(home, view).toBeVisible();
        await expect(home, view).toHaveAttribute("href", "/");
        await expect(home, view).toHaveAttribute("title", "Parallel home");
        // Nothing but the two strokes: no wordmark, no other text.
        expect((await home.evaluate((element) => (element as HTMLElement).innerText)).trim(), view).toBe("ll");
        const look = await home.evaluate((element) => {
          const box = element.getBoundingClientRect();
          const mark = element.querySelector(".text-accent-green")!;
          const probe = document.createElement("span");
          probe.style.color = "var(--green)";
          document.body.append(probe);
          const green = getComputedStyle(probe).color;
          probe.remove();
          return { width: box.width, height: box.height, radius: parseFloat(getComputedStyle(element).borderTopLeftRadius), mark: getComputedStyle(mark).color, green, size: parseFloat(getComputedStyle(mark).fontSize) };
        });
        // A rounded square (the bar's one corner radius: not a circle), the page bar's own height, and the mark the green of the wordmark, large enough to read as a mark.
        expect(look.width, view).toBe(look.height);
        expect(look.height, view).toBe(50);
        expect(look.radius, view).toBe(BAR_RADIUS);
        expect(look.radius, view).toBeLessThan(look.height / 4);
        expect(look.mark, view).toBe(look.green);
        expect(look.size, view).toBeGreaterThanOrEqual(20);
      }
    });

    test("every control of the bar has the bar's one corner radius, a rounded rectangle and not a pill, and what is inside the switcher and the people pill is concentric with it", async ({ page }) => {
      for (const view of ALL_VIEWS) {
        await openView(page, view);
        const look = await bar(page).evaluate((root) => {
          const radius = (element: Element | null) => (element ? Number.parseFloat(getComputedStyle(element).borderTopLeftRadius) : null);
          const probe = document.createElement("span");
          probe.style.borderTopLeftRadius = "var(--bar-radius)";
          document.body.append(probe);
          const token = Number.parseFloat(getComputedStyle(probe).borderTopLeftRadius);
          probe.remove();
          // (A phone's bar has the switcher in the page, hidden: the gear's sheet has the views.)
          const found = root.querySelector('nav[aria-label="Films view"]');
          const switcher = found && found.getClientRects().length > 0 ? found : null;
          const padding = (element: Element | null) => (element ? Number.parseFloat(getComputedStyle(element).paddingTop) : null);
          return {
            token,
            home: radius(root.querySelector('a[title="Parallel home"]')),
            people: radius(root.querySelector("[data-pill-capsule]")),
            peopleButton: radius(root.querySelector("[data-pill-capsule] button")),
            capsulePadding: padding(root.querySelector("[data-pill-capsule]")),
            together: radius(root.querySelector("[data-together-pill]")),
            gear: radius(root.querySelector('button[aria-label="Settings"]')),
            switcher: radius(switcher),
            segment: radius(switcher?.querySelector("a") ?? null),
            switcherPadding: padding(switcher),
          };
        });
        // One token, and it is a rounded rectangle: well under half the bar's height.
        expect(look.token, view).toBe(BAR_RADIUS);
        // (The home square is not on a phone's bar.)
        for (const control of ["people", "together", "gear", ...(label === "desktop" ? (["home"] as const) : [])] as const) expect(look[control], `${view}: ${control}`).toBe(look.token);
        // The switcher is not on a phone's bar (the gear's sheet has the views); where it is, its box has the radius and its segments are concentric with it.
        expect(look.switcher === null, view).toBe(label === "phone");
        if (look.switcher !== null) {
          expect(look.switcher, view).toBe(look.token);
          expect(look.segment, view).toBe(Math.max(0, look.token - look.switcherPadding!));
        }
        // The people pill's button is concentric with its capsule too.
        expect(look.peopleButton, view).toBe(Math.max(0, look.token - look.capsulePadding!));
      }
    });

    test("the open people pill keeps the bar's radius: its field, its close button and its card are the same rounded rectangle as the pill they grew from", async ({ page }) => {
      for (const view of ["timeline", "focus"] as const) {
        await openView(page, view);
        await bar(page).getByRole("button", { name: /^People on this page/ }).click();
        await expect(page.getByRole("dialog", { name: "People", exact: true })).toBeVisible();
        const open = await bar(page).evaluate((root) => {
          const radius = (element: Element | null) => (element ? Number.parseFloat(getComputedStyle(element).borderTopLeftRadius) : null);
          return {
            capsule: radius(root.querySelector("[data-pill-capsule]")),
            field: radius(root.querySelector("[data-pill-open] [data-search-box]")),
            close: radius(root.querySelector('button[aria-label="Close people"]')),
            card: radius(root.querySelector("[data-panel-bg]")),
          };
        });
        expect(open, view).toEqual({ capsule: BAR_RADIUS, field: BAR_RADIUS, close: BAR_RADIUS, card: BAR_RADIUS });
        await page.keyboard.press("Escape");
        await expect(page.getByRole("dialog", { name: "People", exact: true })).toBeHidden();
      }
    });

    test("Films is current on the Timeline, Focus and Table, and the Quotes on the Quotes; the switcher has the view that is on, and none on the Quotes", async ({ page }) => {
      for (const view of ALL_VIEWS) {
        await openView(page, view);
        if (view === "clippings") await expect(filmsLink(page)).not.toHaveAttribute("aria-current", /.+/);
        else await expect(filmsLink(page)).toHaveAttribute("aria-current", "page");
        await expect(link(page, "clippings")).toHaveCount(1);
        if (view === "clippings") await expect(link(page, "clippings")).toHaveAttribute("aria-current", "page");
        else await expect(link(page, "clippings")).not.toHaveAttribute("aria-current", /.+/);
        // Of the switcher's three, the view that is on is current, and on the Quotes none is.
        for (const name of ["timeline", "table", "focus"] as const) {
          if (view === name) await expect(link(page, name)).toHaveAttribute("aria-current", "page");
          else await expect(link(page, name)).not.toHaveAttribute("aria-current", /.+/);
        }
      }
    });

    test("switching views moves nothing in the bar: the gear and the switcher stay, whichever way the visitor goes between the flat views", async ({ page }) => {
      await openView(page, "timeline");
      const before = await measureBar(page);
      // Table (the switcher), the Quotes (a tab), Films again (a tab, which goes back to the Table, the view that was last used), the Timeline (the switcher).
      const steps: { go: () => Promise<void>; panel: ViewName }[] = [
        { go: () => choose(page, "table"), panel: "table" },
        { go: () => choose(page, "clippings"), panel: "clippings" },
        { go: () => choose(page, "films"), panel: "table" },
        { go: () => choose(page, "timeline"), panel: "timeline" },
      ];
      for (const { go, panel } of steps) {
        await go();
        await expect(page.locator(`[id$="-panel-${panel}"]`)).toBeVisible();
        const now = await measureBar(page);
        expect(now.gear, `the gear on ${panel}`).toEqual(before.gear);
        expect(now.switcher, `the switcher on ${panel}`).toEqual(before.switcher);
        expect(fixedItems(now), `the bar on ${panel}`).toEqual(fixedItems(before));
      }
    });

    test("one gear and one view switcher, in the bar: the flat Timeline has none of its own inside the timeline, and no layout control", async ({ page }) => {
      for (const view of ALL_VIEWS) {
        await openView(page, view);
        // One gear on the page, and it is the bar's; the timeline panel's own (the "Film settings" one, in a group over its corner) is gone.
        await expect(page.getByRole("button", { name: "Settings", exact: true })).toHaveCount(1);
        await expect(bar(page).getByRole("button", { name: "Settings", exact: true })).toHaveCount(1);
        await expect(page.getByRole("button", { name: "Film settings" })).toHaveCount(0);
        await expect(page.getByRole("group", { name: "Timeline settings", exact: true })).toHaveCount(0);
        // The layout control (Focus, Combined) is the switcher now, everywhere: one, in the bar (shown from `sm`: on a phone its sheet has the same links).
        await expect(page.getByRole("group", { name: "Timeline layout", exact: true })).toHaveCount(0);
        await expect(page.locator('nav[aria-label="Films view"]')).toHaveCount(1);
        await expect(bar(page).locator('nav[aria-label="Films view"]')).toHaveCount(1);
        await expect(bar(page).locator('nav[aria-label="Films view"]')).toBeVisible({ visible: label === "desktop" });

        if (label === "phone") {
          // The sheet has the same three, with their words, and Films | Quotes above them: on every view, the Quotes too.
          await settingsGear(page).tap();
          const sheet = settingsSheet(page);
          await expect(sheet.getByRole("navigation", { name: "Films view", exact: true })).toHaveCount(1);
          await expect(sheet.getByRole("navigation", { name: "Films view", exact: true }).getByRole("link")).toHaveText(["Timeline", "Focus", "Table"]);
          await expect(sheet.getByRole("navigation", { name: "Sections", exact: true }).getByRole("link")).toHaveText(["Films", "Quotes"]);
          await page.keyboard.press("Escape");
          await expect(sheet).toBeHidden();
        }
      }
    });

    test("the page's h1 is on every view, visually hidden: the names and the count, and nothing of it is on the screen", async ({ page }) => {
      for (const view of ALL_VIEWS) {
        await openView(page, view);
        await expect(headline(page), view).toHaveCount(1);
        await expect(headline(page), view).toHaveText(HEADLINE);
        // sr-only: a one-pixel box, clipped (the bar's pills say it for the eye: the names in the people pill, "12 films together" after it).
        const look = await headline(page).evaluate((element) => {
          const css = getComputedStyle(element);
          return { position: css.position, width: css.width, height: css.height, overflow: css.overflow };
        });
        expect(look, view).toEqual({ position: "absolute", width: "1px", height: "1px", overflow: "hidden" });
        // No second, visible copy of it: the only text on the page that reads as the whole headline is the h1's.
        await expect(page.locator("h1")).toHaveCount(1);
        await expect(page.getByText(HEADLINE, { exact: true }), view).toHaveCount(1);
        // The page's content is clear of the bar (the headline used to be what stood between them). The Timeline is the whole screen: its track has a top padding for that.
        if (view !== "focus" && view !== "timeline") {
          const people = (await bar(page).getByRole("button", { name: /^People on this page/ }).boundingBox())!;
          const panel = (await page.locator(`[id$="-panel-${view}"]`).boundingBox())!;
          expect(panel.y, view).toBeGreaterThanOrEqual(people.y + people.height);
        }
      }
    });

    test("the pill after the people says how many films, the same on every view, with the full words for its name", async ({ page }) => {
      for (const view of ALL_VIEWS) {
        await openView(page, view);
        await expect(together(page), view).toHaveCount(1);
        await expect(together(page), view).toHaveAccessibleName(`${FILM_COUNT} films together`);
        // The same words on a phone as on a desktop.
        const shown = await together(page).evaluate((element) => (element as HTMLElement).innerText.trim());
        expect(shown, view).toBe(`${FILM_COUNT} films together`);
        // The green of the films made together (`lit`), as a dot.
        const dot = await together(page).locator("span").first().evaluate((element) => getComputedStyle(element).backgroundColor);
        expect(dot, view).toBe("rgb(0, 224, 84)");
        // Not interactive: no link or button in it, and it takes no pointer events (the bar's other controls do).
        await expect(together(page).locator("a, button")).toHaveCount(0);
        await expect(together(page)).toHaveCSS("pointer-events", "none");
      }
    });
  });
}

/** Goes to `view` by the bar: the switcher's link, the Quotes' tab, or the Films tab (a phone has them in the gear's sheet: the sheet closes). */
async function choose(page: Page, view: "timeline" | "table" | "clippings" | "films") {
  const phone = (page.viewportSize()?.width ?? 1440) < 640;
  const root = phone ? settingsSheet(page) : bar(page);
  if (phone) await settingsGear(page).tap();
  const target =
    view === "films"
      ? root.getByRole("navigation", { name: "Sections", exact: true }).getByRole("link", { name: "Films", exact: true })
      : view === "clippings"
        ? root.getByRole("navigation", { name: "Sections", exact: true }).getByRole("link", { name: "Quotes", exact: true })
        : root.getByRole("navigation", { name: "Films view", exact: true }).getByRole("link", { name: view === "timeline" ? "Timeline view" : "Table view", exact: true });
  if (phone) await target.tap();
  else await target.click();
  if (phone) await expect(settingsSheet(page)).toBeHidden();
}

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

      // A click on the name: the biography the people column's names and the Quotes' open, the same dialog (the TMDB link on the name, the text).
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
    // Tab goes on to the row's eye (on the flat Timeline of several people: it shows or hides their films), then its Remove link, and then the next row's name.
    await page.keyboard.press("Tab");
    await expect(card.getByRole("button", { name: "Show Pedro Almodóvar's films on the timeline", exact: true })).toBeFocused();
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
      // The film settings, and Export for the views that list films (it is the table's films: not the Quotes).
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

/** Whether two boxes share any area (touching edges is not overlap). */
const intersects = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

test.describe("the home square is the bar's from `sm` (640px) up, and not on a phone's", () => {
  for (const [width, shown] of [
    [639, false],
    [640, true],
  ] as const) {
    test(`at ${width}px the home square is ${shown ? "in the bar, before the people pill" : "not in the bar: the people pill starts at its left edge"}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      for (const view of ["timeline", "focus"] as const) {
        await openView(page, view);
        const home = bar(page).getByRole("link", { name: "Parallel home", exact: true });
        const { people } = await measureBar(page);
        if (shown) {
          await expect(home, view).toBeVisible();
          const homeBox = (await home.boundingBox())!;
          expect(homeBox.x, view).toBe(12);
          expect(people!.x, view).toBeGreaterThan(homeBox.x + homeBox.width);
        } else {
          await expect(home, view).toBeHidden();
          expect(people!.x, view).toBe(12);
        }
      }
    });
  }
});

// With the full words ("12 films together") on a phone and no home square, the bar's row is the people pill, the count and the gear (left of the rail on Focus).
for (const [width, height] of [
  [390, 844],
  [360, 780],
] as const) {
  test.describe(`a phone's bar at ${width}px`, () => {
    test.use({ viewport: { width, height }, hasTouch: true, isMobile: true });

    test("holds the people pill at its natural width, the count and the gear without overlap, and the count is at the same x on every view", async ({ page }) => {
      const measured = {} as Record<ViewName, BarBoxes>;
      const holds = {} as Record<ViewName, boolean>;
      let rail: Box | null = null;
      for (const view of ALL_VIEWS) {
        await openView(page, view);
        measured[view] = await measureBar(page);
        // Every head is inside the capsule: a pill that is squeezed lets its heads run out of it.
        holds[view] = await bar(page).evaluate((root) => {
          const capsule = root.querySelector("[data-pill-capsule]")!.getBoundingClientRect();
          const heads = [...root.querySelectorAll("[data-pill-head]")].map((head) => head.getBoundingClientRect());
          return heads.length > 0 && heads.every((head) => head.left >= capsule.left && head.right <= capsule.right);
        });
        if (view === "focus") rail = round(await page.locator("[data-depth-rail]").boundingBox());
      }
      expect(rail).not.toBeNull();

      const timeline = measured.timeline;
      for (const view of ALL_VIEWS) {
        const { home, people, together: count, gear } = measured[view];
        // No home square, so the people pill is the bar's first, at its gutter; and it is not squeezed: its width is the one it has on the Timeline, where there is room.
        expect(home, `the home square on ${view}`).toBeNull();
        expect(people!.x, `the people pill's left on ${view}`).toBe(12);
        expect(people!.width, `the people pill's width on ${view}`).toBe(timeline.people!.width);
        expect(holds[view], `the heads are inside the people pill on ${view}`).toBe(true);
        // The count is at the same x on every view, whole (its words are not wrapped: one line, the bar's height), and clear of the pill and the gear.
        expect(count!.x, `the count's left on ${view}`).toBe(timeline.together!.x);
        expect(count!.width, `the count's width on ${view}`).toBe(timeline.together!.width);
        expect(count!.height, `the count's height on ${view}`).toBe(46);
        expect(count!.x - (people!.x + people!.width), `the gap between the people pill and the count on ${view}`).toBe(12);
        expect(intersects(count!, gear!), `the count and the gear on ${view}`).toBe(false);
        expect(gear!.x - (count!.x + count!.width), `the room between the count and the gear on ${view}`).toBeGreaterThanOrEqual(8);
      }
      // On Focus the gear is left of the year rail, and the count is not over it either.
      const focus = measured.focus;
      expect(intersects(focus.gear!, rail!), "the gear and the rail").toBe(false);
      expect(intersects(focus.together!, rail!), "the count and the rail").toBe(false);
      expect(rail!.x - (focus.gear!.x + focus.gear!.width)).toBeGreaterThanOrEqual(8);
      // The page does not scroll sideways.
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    });
  });
}

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("the gear's sheet holds the views, the settings, Share, Export and the way home, on the flat page too", async ({ page }) => {
    await openView(page, "timeline");
    await settingsGear(page).tap();
    const sheet = settingsSheet(page);
    // Films | Quotes (this pair has Quotes), then the same three-way choice as the bar's switcher, with its words: Timeline is the current one, here.
    const sections = sheet.getByRole("navigation", { name: "Sections", exact: true });
    await expect(sections.getByRole("link")).toHaveText(["Films", "Quotes"]);
    await expect(sections.getByRole("link", { name: "Films", exact: true })).toHaveAttribute("aria-current", "page");
    const views = sheet.getByRole("navigation", { name: "Films view", exact: true });
    await expect(views.getByRole("link")).toHaveText(["Timeline", "Focus", "Table"]);
    await expect(views.getByRole("link", { name: "Timeline view", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(views.getByRole("link", { name: "Focus view", exact: true })).not.toHaveAttribute("aria-current", /.+/);
    await expect(sheet.getByRole("checkbox", { name: "Show all films", exact: true })).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Share", exact: true })).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Export List as CSV", exact: true })).toBeVisible();
    await expect(sheet.getByRole("link", { name: "Parallel home", exact: true })).toHaveAttribute("href", "/");
    // No layout control: Focus and the flat Timeline are two of the three views.
    await expect(sheet.getByRole("group", { name: "Timeline layout", exact: true })).toHaveCount(0);

    // The sheet fits the screen.
    const box = (await sheet.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);

    // A tap on Table shows the table in place, and puts the sheet away.
    await views.getByRole("link", { name: "Table view", exact: true }).tap();
    await expect(link(page, "table")).toHaveAttribute("aria-current", "page");
    await expect(sheet).toBeHidden();
    expect(new URL(page.url()).searchParams.get("view")).toBe("table");

    // The Quotes, from the sheet's other row, and no view of the three is current there.
    await settingsGear(page).tap();
    await sections.getByRole("link", { name: "Quotes", exact: true }).tap();
    await expect(link(page, "clippings")).toHaveAttribute("aria-current", "page");
    await expect(sheet).toBeHidden();
    await settingsGear(page).tap();
    await expect(views.getByRole("link", { name: /view$/ }).and(page.locator("[aria-current]"))).toHaveCount(0);
  });
});

// ---- moving between a flat view and Focus: the gear and the view switcher glide -------------------------------------------------

/** What a frame of a view transition looked like: the animations the browser was running on its pseudo-elements, and where the two named groups were. */
type VtSample = { running: { pseudo: string; duration: number }[]; gearX: number | null; viewsX: number | null };

/**
 * Runs in the page (it is serialized: nothing outside it is in reach): from now on, every frame, notes the animations running on the view transition's
 * pseudo-elements (`document.getAnimations()` includes them) and the x of the gear's and the view switcher's groups, which is where the browser draws
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
    state.samples.push({ running, gearX: groupX("people-bar-gear"), viewsX: groupX("people-bar-views") });
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
  // The view switcher of the bar: Focus is the one to press to leave for the scene, and Timeline the way back.
  const toFocus = (page: Page) => viewLink(page, "depth");
  const toTimeline = (page: Page) => viewLink(page, "timeline");

  test("the gear and the switcher glide from the flat Timeline to Focus and back, and nothing else in the bar animates", async ({ page }) => {
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

    // The gear and the switcher were drawn on the way: between where they were and where they are (the flat Timeline's, Focus's).
    expect(focus.gear!.x).toBeLessThan(flat.gear!.x);
    expect(wasBetween(forth.map((sample) => sample.gearX), flat.gear!.x, focus.gear!.x)).toBe(true);
    expect(wasBetween(forth.map((sample) => sample.viewsX), flat.switcher!.x, focus.switcher!.x)).toBe(true);
    // For 360ms, as the people pill's heads move; and they are all that moved: the home pill, the people pill, the count and the tabs are not named, so they are the new page's at once.
    expect(lasting(forth).some((animation) => animation.pseudo === "::view-transition-group(people-bar-gear)" && animation.duration === 360)).toBe(true);
    expect(animatedNames(forth)).toEqual(["people-bar-gear", "people-bar-views"]);
    // And no cross-fade of the page: the root has no image pair (the scene is not captured, so it is never in the middle of a fade).
    expect(forth.flatMap((sample) => sample.running).filter((animation) => /\(root\)/.test(animation.pseudo) && animation.duration > 0)).toEqual([]);
    expect(fixedItems(focus)).toEqual(fixedItems(flat));

    // And back: Timeline leaves for the flat Timeline, and they glide right.
    await startSampling(page);
    await toTimeline(page).click();
    await expect(scene(page)).toHaveCount(0);
    await expect(link(page, "timeline")).toHaveAttribute("aria-current", "page");
    await transitionsDone(page);
    const back = await stopSampling(page);
    expect(wasBetween(back.map((sample) => sample.gearX), focus.gear!.x, flat.gear!.x)).toBe(true);
    expect(wasBetween(back.map((sample) => sample.viewsX), focus.switcher!.x, flat.switcher!.x)).toBe(true);
    expect(animatedNames(back)).toEqual(["people-bar-gear", "people-bar-views"]);
    expect(await measureBar(page)).toEqual(flat);
  });

  for (const target of ["table", "clippings"] as const) {
    test(`from Focus to the ${target === "table" ? "Table" : "Quotes"} the gear and the switcher glide right: the switcher is on both sides, so nothing fades`, async ({ page }) => {
      await openView(page, "focus");
      const focus = await measureBar(page);

      await startSampling(page);
      if (target === "table") await viewLink(page, "table").click();
      else await bar(page).getByRole("navigation", { name: "Sections", exact: true }).getByRole("link", { name: "Quotes", exact: true }).click();
      await expect(link(page, target)).toHaveAttribute("aria-current", "page");
      await transitionsDone(page);
      const samples = await stopSampling(page);
      const flat = await measureBar(page);

      expect(flat.gear!.x).toBeGreaterThan(focus.gear!.x);
      expect(wasBetween(samples.map((sample) => sample.gearX), focus.gear!.x, flat.gear!.x)).toBe(true);
      expect(wasBetween(samples.map((sample) => sample.viewsX), focus.switcher!.x, flat.switcher!.x)).toBe(true);
      // Both are paired (the switcher is on the Quotes too), so they move; nothing else is named.
      expect(animatedNames(samples)).toEqual(["people-bar-gear", "people-bar-views"]);
      expect(fixedItems(flat)).toEqual(fixedItems(focus));
    });
  }

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
      if (sample.viewsX !== null) expect(sample.viewsX).toBeCloseTo(focus.switcher!.x, 0);
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
      for (const sample of samples) expect([sample.gearX, sample.viewsX]).toEqual([null, null]);
    });
  }

  test("between the flat views, in place, nothing glides: the bar is the same one", async ({ page }) => {
    await openView(page, "timeline");
    await startSampling(page);
    await viewLink(page, "table").click();
    await expect(link(page, "table")).toHaveAttribute("aria-current", "page");
    await page.waitForTimeout(600);
    const samples = await stopSampling(page);
    expect(lasting(samples)).toEqual([]);
    for (const sample of samples) expect([sample.gearX, sample.viewsX]).toEqual([null, null]);
  });
});

test.describe("on a phone: from the flat Timeline to Focus through the sheet", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("the gear glides there and back, 24px each way", async ({ page }) => {
    await openView(page, "timeline");
    const flat = await measureBar(page);

    await startSampling(page);
    await settingsGear(page).tap();
    await settingsSheet(page).getByRole("link", { name: "Focus view", exact: true }).tap();
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
    await settingsSheet(page).getByRole("link", { name: "Timeline view", exact: true }).tap();
    await expect(scene(page)).toHaveCount(0);
    await expect(link(page, "timeline")).toHaveAttribute("aria-current", "page");
    await transitionsDone(page);
    const back = await stopSampling(page);
    expect(wasBetween(back.map((sample) => sample.gearX), focus.gear!.x, flat.gear!.x)).toBe(true);
    expect(await measureBar(page)).toEqual(flat);
  });
});
