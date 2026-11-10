import type { Locator, Page } from "next/experimental/testmode/playwright";
import { HEADLINE, PAIR, expect, test } from "./almodovar";
import { bar, collapseHero, heroState, scene, viewLink } from "./fixtures";

/**
 * The page bar of a `/p/` page is the same on every view: the flat Timeline, Table and Quotes, and the Films view (the Depth view). These tests measure it in its
 * compact state, the one the pair hero collapses into (see pair-hero.spec.ts for the hero itself): the home arrow (from `sm` up: a phone's bar has none, its sheet has the
 * way home), the people pill, the view control (Films | Timeline | Table | Quotes) and the gear. The home arrow and the people pill are in the same place and size on all
 * four views, and as tall as the control and the gear (one height, the people pill's); at the right, the control and the gear are where their view puts them (at the right
 * edge on the flat views, left of the year rail on Films), and are on every view, the Quotes too; between a flat view and Films they glide (a view transition), and the tests
 * watch that happen. They check what goes with the bar too: the h1 (visually hidden, on every view) and what is no longer on the page (the site's header, the title row's
 * Add a person field, the row of Export and Share: Export and Share are in the gear).
 *
 * The pair is Almodóvar and Cruz, who have Quotes, with a dozen films in common so that the pages are long enough to scroll.
 */

// Activate the server-side fetch fixtures before any test navigates to a people page.
test.beforeEach(async ({ next }) => {
  void next;
});

type ViewName = "timeline" | "table" | "clippings" | "focus";
const VIEWS: Record<ViewName, string> = { timeline: "?view=timeline", table: "?view=table", clippings: "?view=clippings", focus: "?view=depth" };
const ALL_VIEWS = Object.keys(VIEWS) as ViewName[];

/** The page bar's one corner radius (`--bar-radius`, globals.css), in px: a rounded rectangle. */
const BAR_RADIUS = 6;

const settingsGear = (page: Page) => page.getByRole("button", { name: "Settings", exact: true });
const settingsSheet = (page: Page) => page.getByRole("dialog", { name: "Settings", exact: true });
const headline = (page: Page) => page.getByRole("heading", { level: 1 });

/**
 * The bar's link to a view, found by its word in the view control rather than by its role, so that it is found where it is not shown (a phone's bar hides the control: the
 * gear's sheet has the same links).
 */
const WORD: Record<ViewName, string> = { timeline: "Timeline", focus: "Films", table: "Table", clippings: "Quotes" };
const link = (page: Page, view: ViewName) => bar(page).locator('nav[aria-label="Views"] a').filter({ hasText: new RegExp(`^${WORD[view]}$`) });

/** Opens a view of the pair and waits until it is live (the flat page reads its view from the address bar once hydrated). */
async function openView(page: Page, view: ViewName) {
  await page.goto(`${PAIR}${VIEWS[view]}`);
  if (view === "focus") {
    await expect(scene(page)).toBeVisible();
  } else {
    await expect(link(page, view)).toHaveAttribute("aria-current", "page");
  }
  // A state transition of the live page, not a sleep: the gear's sheet opens and closes.
  await settingsGear(page).click();
  await expect(settingsSheet(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(settingsSheet(page)).toBeHidden();
}

type Box = { x: number; y: number; width: number; height: number };
const round = (box: Box | null): Box | null =>
  box && Object.fromEntries(Object.entries(box).map(([key, value]) => [key, Math.round(value * 100) / 100])) as Box;

/**
 * Where each of the bar's items is on the screen, with the pair hero collapsed into the compact bar (null for one that is not shown: the home arrow and the control are not
 * on a phone). Collapsing is a scroll of the view's main scroller, which moves nothing of the fixed bar.
 */
async function measureBar(page: Page) {
  if ((await heroState(page)) !== "collapsed") await collapseHero(page);
  const root = bar(page);
  // The hero's body eases away over 300ms, and the Films view's rail with it: wait until the bar is its compact self and the rail is at the top of the screen.
  const compact = (page.viewportSize()?.width ?? 1440) < 640 ? 58 : 62;
  await expect.poll(async () => (await root.boundingBox())!.height).toBe(compact);
  if ((await page.locator("[data-depth-rail]").count()) > 0) await expect.poll(async () => (await page.locator("[data-depth-rail] > div").first().boundingBox())!.y).toBe(0);
  const box = async (locator: Locator) => ((await locator.count()) > 0 && (await locator.first().isVisible()) ? round(await locator.first().boundingBox()) : null);
  const items = (nav: string) => root.locator(`nav[aria-label="${nav}"] a`);
  return {
    bar: await box(root),
    home: await box(root.getByRole("link", { name: "Back to Parallel home", exact: true })),
    // The people pill: its capsule, which is as tall as the rest of the bar (its button is inside it).
    people: await box(root.locator("[data-pill-capsule]")),
    // The view control and the gear: where their view puts them.
    switcher: await box(root.locator('nav[aria-label="Views"]')),
    switcherItems: await Promise.all([0, 1, 2, 3].map((index) => box(items("Views").nth(index)))),
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

    test("the home arrow and the people pill are in the same place and size on the Timeline, the Table, the Quotes and Films; the control and the gear are at the right edge on the flat views and left of the rail on Films", async ({ page }) => {
      const measured = {} as Record<ViewName, BarBoxes>;
      let rail: Box | null = null;
      for (const view of ALL_VIEWS) {
        await openView(page, view);
        measured[view] = await measureBar(page);
        if (view === "focus") rail = round(await page.locator("[data-depth-rail]").boundingBox());
      }

      const timeline = measured.timeline;
      // It is the bar: the people and the gear are there on every view and on a phone, the home arrow and the control only from the small breakpoint up (a phone's gear holds
      // them, and the way home).
      expect(timeline.home === null).toBe(label === "phone");
      expect(timeline.people).not.toBeNull();
      expect(timeline.gear).not.toBeNull();
      expect(timeline.switcher === null).toBe(label === "phone");
      // The bar is the same box on all four views, 12px of padding over the controls.
      for (const view of ALL_VIEWS) expect(measured[view].bar!.height, `the bar's height on ${view}`).toBe(label === "phone" ? 58 : 62);
      // Every item but the gear and the control is identical on all four views.
      for (const view of ["table", "clippings", "focus"] as const) expect(fixedItems(measured[view]), `the bar on ${view}`).toEqual(fixedItems(timeline));
      // The bar spans the screen and its items are over the top of the page, clear of the edges.
      expect(timeline.bar!.x).toBe(0);
      expect(timeline.bar!.width).toBe(viewport.width);
      expect(timeline.people!.x).toBeGreaterThanOrEqual(8);
      // The home arrow comes first, then the people; on a phone the people are first, at the bar's own left gutter.
      if (label === "phone") {
        expect(timeline.people!.x).toBe(12);
      } else {
        expect(timeline.home!.x).toBe(12);
        expect(timeline.home!.width).toBe(timeline.home!.height);
        expect(timeline.people!.x).toBeGreaterThan(timeline.home!.x + timeline.home!.width);
      }

      // One height: the home arrow, the people pill, the control and the gear are as tall as each other (the people pill's own: 50px, 46px on a phone), on every view.
      for (const view of ALL_VIEWS) {
        const { home, people, switcher: views, gear } = measured[view];
        const row = [...(label === "desktop" ? [home, views] : []), people, gear];
        for (const box of row) {
          expect(box!.height, `the height on ${view}`).toBe(label === "phone" ? 46 : 50);
          expect(box!.y, `the top on ${view}`).toBe(people!.y);
        }
      }

      // The flat views share their boxes, the gear's and the control's too: at the right edge, with the gutter the home arrow has at the left.
      for (const view of ["table", "clippings"] as const) {
        expect(measured[view].gear, `the gear on ${view}`).toEqual(timeline.gear);
        expect(measured[view].switcher, `the control on ${view}`).toEqual(timeline.switcher);
        expect(measured[view].switcherItems, `the control's segments on ${view}`).toEqual(timeline.switcherItems);
      }
      const leftGutter = (timeline.home ?? timeline.people)!.x;
      expect(leftGutter).toBe(12);
      for (const view of ["timeline", "table", "clippings"] as const) {
        const gear = measured[view].gear!;
        expect(viewport.width - (gear.x + gear.width), `the gear's right gutter on ${view}`).toBe(leftGutter);
      }

      // On Films it is left of the year rail, with room to spare, and the same size and height as on the flat views; and the rail runs to the top of the screen now that the hero
      // has collapsed (the bar's controls are left of it).
      const focusGear = measured.focus.gear!;
      expect(rail).not.toBeNull();
      expect(rail!.x - (focusGear.x + focusGear.width)).toBeGreaterThanOrEqual(8);
      expect(focusGear.x).toBeLessThan(timeline.gear!.x);
      expect({ y: focusGear.y, width: focusGear.width, height: focusGear.height }).toEqual({ y: timeline.gear!.y, width: timeline.gear!.width, height: timeline.gear!.height });
      expect(rail!.y).toBe(0);

      // The control: on every view of a desktop (the Quotes too, where its Quotes segment is the current one), four segments, before the gear with the gap the bar's controls have,
      // the same size and height on all four, and moved by the rail's room just as the gear is. Not on a phone's bar at all.
      if (label === "phone") {
        for (const view of ALL_VIEWS) expect(measured[view].switcher, `the control on ${view}`).toBeNull();
      } else {
        for (const view of ALL_VIEWS) {
          const { switcher: box, switcherItems, gear } = measured[view];
          expect(box, `the control on ${view}`).not.toBeNull();
          expect(switcherItems.every((item) => item !== null), `its four segments on ${view}`).toBe(true);
          expect(gear!.x - (box!.x + box!.width), `the gap between the control and the gear on ${view}`).toBe(8);
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

    test("the home button is a rounded square holding a plain back arrow in the icon colour, named Back to Parallel home, on every view; a phone's bar has none", async ({ page }) => {
      for (const view of ALL_VIEWS) {
        await openView(page, view);
        const home = bar(page).getByRole("link", { name: "Back to Parallel home", exact: true });
        if (label === "phone") {
          // Not on the screen (the bar's room is the people pill's); the gear's sheet has the way home, with the name.
          await expect(home, view).toBeHidden();
          continue;
        }
        await expect(home, view).toBeVisible();
        // (The pointer is off the controls: a hovered gear is brighter.)
        await page.mouse.move(700, 450);
        // It goes to the landing page (a link, not history.back), and says so in its name and its tooltip.
        await expect(home, view).toHaveAttribute("href", "/");
        await expect(home, view).toHaveAttribute("title", "Back to Parallel home");
        // An icon alone: no text, and no green "ll" any more.
        expect((await home.evaluate((element) => (element as HTMLElement).innerText)).trim(), view).toBe("");
        await expect(home.locator("svg.lucide-arrow-left"), view).toHaveCount(1);
        await expect(home.locator(".text-accent-green"), view).toHaveCount(0);
        const look = await home.evaluate((element) => {
          const box = element.getBoundingClientRect();
          const probe = (color: string) => {
            const span = document.createElement("span");
            span.style.color = color;
            document.body.append(span);
            const computed = getComputedStyle(span).color;
            span.remove();
            return computed;
          };
          return {
            width: box.width,
            height: box.height,
            radius: Number.parseFloat(getComputedStyle(element).borderTopLeftRadius),
            icon: getComputedStyle(element.querySelector("svg")!).color,
            muted: probe("var(--text-muted)"),
            green: probe("var(--green)"),
          };
        });
        // A rounded square (the bar's one corner radius: not a circle), the page bar's own height, and the arrow the icon colour the gear has, not green.
        expect(look.width, view).toBe(look.height);
        expect(look.height, view).toBe(50);
        expect(look.radius, view).toBe(BAR_RADIUS);
        expect(look.icon, view).toBe(look.muted);
        expect(look.icon, view).not.toBe(look.green);
        const gear = await settingsGear(page).evaluate((element) => getComputedStyle(element.querySelector("svg")!).color);
        expect(look.icon, view).toBe(gear);
      }
    });

    test("the home arrow goes to the landing page", async ({ page }) => {
      test.skip(label === "phone", "a phone's bar has no home arrow: the gear's sheet has the way home");
      await openView(page, "table");
      await bar(page).getByRole("link", { name: "Back to Parallel home", exact: true }).click();
      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByRole("banner")).toBeVisible();
    });

    test("every control of the bar has the bar's one corner radius, a rounded rectangle and not a pill, and what is inside the control and the people pill is concentric with it", async ({ page }) => {
      for (const view of ALL_VIEWS) {
        await openView(page, view);
        await collapseHero(page);
        const look = await bar(page).evaluate((root) => {
          const radius = (element: Element | null) => (element ? Number.parseFloat(getComputedStyle(element).borderTopLeftRadius) : null);
          const probe = document.createElement("span");
          probe.style.borderTopLeftRadius = "var(--bar-radius)";
          document.body.append(probe);
          const token = Number.parseFloat(getComputedStyle(probe).borderTopLeftRadius);
          probe.remove();
          // (A phone's bar has the switcher in the page, hidden: the gear's sheet has the views.)
          const found = root.querySelector('nav[aria-label="Views"]');
          const switcher = found && found.getClientRects().length > 0 ? found : null;
          const padding = (element: Element | null) => (element ? Number.parseFloat(getComputedStyle(element).paddingTop) : null);
          return {
            token,
            home: radius(root.querySelector('a[title="Back to Parallel home"]')),
            people: radius(root.querySelector("[data-pill-capsule]")),
            peopleButton: radius(root.querySelector("[data-pill-capsule] button")),
            capsulePadding: padding(root.querySelector("[data-pill-capsule]")),
            gear: radius(root.querySelector('button[aria-label="Settings"]')),
            switcher: radius(switcher),
            segment: radius(switcher?.querySelector("a") ?? null),
            switcherPadding: padding(switcher),
          };
        });
        // One token, and it is a rounded rectangle: well under half the bar's height.
        expect(look.token, view).toBe(BAR_RADIUS);
        // (The home square is not on a phone's bar.)
        for (const control of ["people", "gear", ...(label === "desktop" ? (["home"] as const) : [])] as const) expect(look[control], `${view}: ${control}`).toBe(look.token);
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
        await collapseHero(page);
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

    test("one segment of the control is current, the view the page is on, the Quotes' on the Quotes", async ({ page }) => {
      for (const view of ALL_VIEWS) {
        await openView(page, view);
        for (const name of ALL_VIEWS) {
          if (view === name) await expect(link(page, name), `${name} on ${view}`).toHaveAttribute("aria-current", "page");
          else await expect(link(page, name), `${name} on ${view}`).not.toHaveAttribute("aria-current", /.+/);
        }
        await expect(link(page, "clippings")).toHaveCount(1);
      }
    });

    test("switching views moves nothing in the bar: the gear and the control stay, whichever way the visitor goes between the flat views", async ({ page }) => {
      await openView(page, "timeline");
      const before = await measureBar(page);
      // Table, the Quotes, the Timeline: all by the control (a phone's sheet has it).
      const steps: { go: () => Promise<void>; panel: ViewName }[] = [
        { go: () => choose(page, "table"), panel: "table" },
        { go: () => choose(page, "clippings"), panel: "clippings" },
        { go: () => choose(page, "timeline"), panel: "timeline" },
      ];
      for (const { go, panel } of steps) {
        await go();
        await expect(page.locator(`[id$="-panel-${panel}"]`)).toBeVisible();
        const now = await measureBar(page);
        expect(now.gear, `the gear on ${panel}`).toEqual(before.gear);
        expect(now.switcher, `the control on ${panel}`).toEqual(before.switcher);
        expect(fixedItems(now), `the bar on ${panel}`).toEqual(fixedItems(before));
      }
    });

    test("one gear and one view control, in the bar: the flat Timeline has none of its own inside the timeline, and no layout control", async ({ page }) => {
      for (const view of ALL_VIEWS) {
        await openView(page, view);
        // One gear on the page, and it is the bar's; the timeline panel's own (the "Film settings" one, in a group over its corner) is gone.
        await expect(page.getByRole("button", { name: "Settings", exact: true })).toHaveCount(1);
        await expect(bar(page).getByRole("button", { name: "Settings", exact: true })).toHaveCount(1);
        await expect(page.getByRole("button", { name: "Film settings" })).toHaveCount(0);
        await expect(page.getByRole("group", { name: "Timeline settings", exact: true })).toHaveCount(0);
        // The one view control, in the bar (shown from `sm`: on a phone its sheet has the same links), and no layout control.
        await expect(page.getByRole("group", { name: "Timeline layout", exact: true })).toHaveCount(0);
        await expect(page.locator('nav[aria-label="Views"]')).toHaveCount(1);
        await expect(bar(page).locator('nav[aria-label="Views"]')).toHaveCount(1);
        await expect(bar(page).locator('nav[aria-label="Views"]')).toBeVisible({ visible: label === "desktop" });

        if (label === "phone") {
          // The sheet has the same four, with their words, in the same order: on every view, the Quotes too. No Sections nav: Quotes is the control's fourth segment.
          await settingsGear(page).tap();
          const sheet = settingsSheet(page);
          await expect(sheet.getByRole("navigation", { name: "Views", exact: true })).toHaveCount(1);
          await expect(sheet.getByRole("navigation", { name: "Views", exact: true }).getByRole("link")).toHaveText(["Films", "Timeline", "Table", "Quotes"]);
          await expect(sheet.getByRole("navigation", { name: "Sections", exact: true })).toHaveCount(0);
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
        // sr-only: a one-pixel box, clipped (the pair hero's title says it for the eye, with × between the names).
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
          const barBox = (await bar(page).boundingBox())!;
          const panel = (await page.locator(`[id$="-panel-${view}"]`).boundingBox())!;
          expect(panel.y, view).toBeGreaterThanOrEqual(barBox.y + barBox.height);
        }
      }
    });
  });
}

/** Goes to `view` by the bar's control (a phone has it in the gear's sheet: the sheet closes). */
async function choose(page: Page, view: "timeline" | "table" | "clippings" | "focus") {
  const phone = (page.viewportSize()?.width ?? 1440) < 640;
  const root = phone ? settingsSheet(page) : bar(page);
  if (phone) await settingsGear(page).tap();
  const target = root.getByRole("navigation", { name: "Views", exact: true }).getByRole("link", { name: WORD[view], exact: true });
  if (phone) await target.tap();
  else await target.click();
  if (phone) await expect(settingsSheet(page)).toBeHidden();
}

test.describe("what is no longer on the page", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("the site's header, the Add a person field and the row of Export and Share are gone from the flat views: the bar has them", async ({ page }) => {
    for (const view of ["timeline", "table", "clippings", "focus"] as const) {
      await openView(page, view);
      // No site header (the bar's back arrow is the only way home on the page) and no header search.
      await expect(page.getByRole("banner")).toHaveCount(0);
      await expect(page.getByRole("link", { name: "Back to Parallel home", exact: true })).toHaveCount(1);
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
    // The pill takes the names' place once the pair hero has collapsed.
    await collapseHero(page);
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
      await collapseHero(page);
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
    await collapseHero(page);
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

test.describe("the home arrow is the bar's from `sm` (640px) up, and not on a phone's", () => {
  for (const [width, shown] of [
    [639, false],
    [640, true],
  ] as const) {
    test(`at ${width}px the home arrow is ${shown ? "in the bar, before the people pill" : "not in the bar: the people pill starts at its left edge"}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      for (const view of ["timeline", "focus"] as const) {
        await openView(page, view);
        const home = bar(page).getByRole("link", { name: "Back to Parallel home", exact: true });
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

// On a phone the bar's row is the people pill and the gear (left of the rail on Films); there is no home arrow and no control (the gear's sheet has them).
for (const [width, height] of [
  [390, 844],
  [360, 780],
] as const) {
  test.describe(`a phone's bar at ${width}px`, () => {
    test.use({ viewport: { width, height }, hasTouch: true, isMobile: true });

    test("holds the people pill at its natural width and the gear without overlap, on every view", async ({ page }) => {
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
        const { home, people, gear } = measured[view];
        // No home arrow, so the people pill is the bar's first, at its gutter; and it is not squeezed: its width is the one it has on the Timeline, where there is room.
        expect(home, `the home arrow on ${view}`).toBeNull();
        expect(people!.x, `the people pill's left on ${view}`).toBe(12);
        expect(people!.width, `the people pill's width on ${view}`).toBe(timeline.people!.width);
        expect(holds[view], `the heads are inside the people pill on ${view}`).toBe(true);
        expect(intersects(people!, gear!), `the people pill and the gear on ${view}`).toBe(false);
        expect(gear!.x - (people!.x + people!.width), `the room between the people pill and the gear on ${view}`).toBeGreaterThanOrEqual(8);
      }
      // On Films the gear is left of the year rail.
      const focus = measured.focus;
      expect(intersects(focus.gear!, rail!), "the gear and the rail").toBe(false);
      expect(intersects(focus.people!, rail!), "the people pill and the rail").toBe(false);
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
    // The control as the bar has it, with its words, in the same order: Films, Timeline, Table and (this pair has Quotes) Quotes. Timeline is the current one, here.
    const views = sheet.getByRole("navigation", { name: "Views", exact: true });
    await expect(views.getByRole("link")).toHaveText(["Films", "Timeline", "Table", "Quotes"]);
    await expect(views.getByRole("link", { name: "Timeline", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(views.getByRole("link", { name: "Films", exact: true })).not.toHaveAttribute("aria-current", /.+/);
    await expect(sheet.getByRole("navigation", { name: "Sections", exact: true })).toHaveCount(0);
    await expect(sheet.getByRole("checkbox", { name: "Show all films", exact: true })).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Share", exact: true })).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Export List as CSV", exact: true })).toBeVisible();
    // The sheet keeps its "Parallel home" row (the bar's arrow, which is not on a phone, is "Back to Parallel home").
    await expect(sheet.getByRole("link", { name: "Parallel home", exact: true })).toHaveAttribute("href", "/");
    // No layout control: Films and the flat Timeline are two of the views.
    await expect(sheet.getByRole("group", { name: "Timeline layout", exact: true })).toHaveCount(0);

    // The sheet fits the screen.
    const box = (await sheet.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);

    // A tap on Table shows the table in place, and puts the sheet away.
    await views.getByRole("link", { name: "Table", exact: true }).tap();
    await expect(link(page, "table")).toHaveAttribute("aria-current", "page");
    await expect(sheet).toBeHidden();
    expect(new URL(page.url()).searchParams.get("view")).toBe("table");

    // The Quotes, from the same control, are the current one there and no other is.
    await settingsGear(page).tap();
    await views.getByRole("link", { name: "Quotes", exact: true }).tap();
    await expect(link(page, "clippings")).toHaveAttribute("aria-current", "page");
    await expect(sheet).toBeHidden();
    await settingsGear(page).tap();
    await expect(views.locator('[aria-current="page"]')).toHaveText("Quotes");
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
  // The view control of the bar: Films is the one to press to leave for the scene, and Timeline the way back.
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
      else await link(page, "clippings").click();
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
    await settingsSheet(page).getByRole("link", { name: "Films", exact: true }).tap();
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
    await settingsSheet(page).getByRole("link", { name: "Timeline", exact: true }).tap();
    await expect(scene(page)).toHaveCount(0);
    await expect(link(page, "timeline")).toHaveAttribute("aria-current", "page");
    await transitionsDone(page);
    const back = await stopSampling(page);
    expect(wasBetween(back.map((sample) => sample.gearX), focus.gear!.x, flat.gear!.x)).toBe(true);
    expect(await measureBar(page)).toEqual(flat);
  });
});
