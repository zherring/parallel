import type { Page } from "next/experimental/testmode/playwright";
import { PAIR, expect, test } from "./almodovar";
import { FILMS_VIEW_KEY, bar, clippingsTab, filmsTab, scene, storedFilmsView, viewLink, type FilmsViewName } from "./fixtures";

/**
 * The page's top level is Films and Clippings; Films has three views (the Timeline, Focus and the Table), chosen with the bar's switcher, and its tab
 * goes to the one last used. These specs are about that: the memory (in `localStorage`, `parallel:films-view`), and the switcher from every view.
 * The pair is Almodóvar and Cruz, who have Clippings; every test gets a fresh browser context, so a view recorded in one is never there in the next:
 * a new visitor.
 */

// Activate the server-side fetch fixtures before any test navigates to a people page.
test.beforeEach(async ({ next }) => {
  void next;
});

const QUERY: Record<FilmsViewName | "clippings", string> = { timeline: "", table: "?view=table", depth: "?view=depth", clippings: "?view=clippings" };
const PERIOD = "from=2001&to=2005";
/** The address of a view of the pair with the period, as the bar writes it (the Timeline has no `view`). */
const withPeriod = (view: FilmsViewName | "clippings") => `${PAIR}?${PERIOD}${view === "timeline" ? "" : `&view=${view}`}`;
const params = (page: Page) => Object.fromEntries(new URL(page.url()).searchParams);

/** Opens a view and waits until it is live: the flat page reads its view from the address bar once hydrated; Focus is its scene. */
async function open(page: Page, view: FilmsViewName | "clippings", search = QUERY[view]) {
  await page.goto(`${PAIR}${search}`);
  if (view === "clippings") {
    await expect(clippingsTab(page)).toHaveAttribute("aria-current", "page");
    return;
  }
  if (view === "depth") await expect(scene(page)).toBeVisible();
  else await expect(viewLink(page, view)).toHaveAttribute("aria-current", "page");
  // Recording a view is an effect of the live page.
  await expect.poll(() => storedFilmsView(page)).toBe(view);
}

for (const start of ["timeline", "depth", "table"] as const) {
  test(`the Films tab remembers the ${start} view across the Clippings and back, with the period`, async ({ page }) => {
    await open(page, start, `?${PERIOD}${start === "timeline" ? "" : `&view=${start}`}`);

    await clippingsTab(page).click();
    await expect(clippingsTab(page)).toHaveAttribute("aria-current", "page");
    await expect(filmsTab(page)).not.toHaveAttribute("aria-current", /.+/);
    await expect(scene(page)).toHaveCount(0);
    expect(params(page)).toEqual({ from: "2001", to: "2005", view: "clippings" });
    // The Clippings are not a films view: nothing was recorded by being there, and the Films tab points back at the one that was.
    expect(await storedFilmsView(page)).toBe(start);
    await expect(filmsTab(page)).toHaveAttribute("href", withPeriod(start).replace(`${PAIR}`, new URL(page.url()).pathname));

    await filmsTab(page).click();
    await expect(filmsTab(page)).toHaveAttribute("aria-current", "page");
    if (start === "depth") {
      await expect(scene(page)).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("data-view", "depth");
    } else {
      await expect(scene(page)).toHaveCount(0);
      await expect(viewLink(page, start)).toHaveAttribute("aria-current", "page");
      await expect(page.locator(`[id$="-panel-${start}"]`)).toBeVisible();
    }
    expect(params(page)).toEqual({ from: "2001", to: "2005", ...(start === "timeline" ? {} : { view: start }) });
    expect(await storedFilmsView(page)).toBe(start);
  });
}

test("the Films tab goes to the view last used, and it is read from storage after the page loads (a plain, fresh visitor gets the Timeline)", async ({ page }) => {
  // A new visitor: the Films tab is the page's own address, the Timeline, and visiting the Clippings records nothing.
  await open(page, "clippings");
  await expect(filmsTab(page)).toHaveAttribute("href", PAIR);
  expect(await storedFilmsView(page)).toBeNull();

  // Each films view, visited by its address (not by any control of the bar), is what the tab goes to next, after a reload too.
  for (const view of ["table", "depth", "timeline", "table"] as const) {
    await open(page, view);
    await page.goto(`${PAIR}?view=clippings`);
    await expect(clippingsTab(page)).toHaveAttribute("aria-current", "page");
    await expect(filmsTab(page)).toHaveAttribute("href", `${PAIR}${QUERY[view]}`);
    expect(await storedFilmsView(page)).toBe(view);
  }
});

test("visiting a films view records it, by any means: the address, the switcher and the Films tab; the Clippings and an unknown value do not", async ({ page }) => {
  // By a typed address.
  await open(page, "table");
  expect(await storedFilmsView(page)).toBe("table");
  // By the switcher, in place on the flat page and as a navigation to Focus.
  await viewLink(page, "depth").click();
  await expect(scene(page)).toBeVisible();
  await expect.poll(() => storedFilmsView(page)).toBe("depth");
  await viewLink(page, "timeline").click();
  await expect(viewLink(page, "timeline")).toHaveAttribute("aria-current", "page");
  await expect.poll(() => storedFilmsView(page)).toBe("timeline");
  await viewLink(page, "table").click();
  await expect.poll(() => storedFilmsView(page)).toBe("table");
  // By the browser's Back, which the flat page's views are in the history of (a navigation to Focus is one): Table, Focus, then Back.
  await viewLink(page, "depth").click();
  await expect(scene(page)).toBeVisible();
  await page.goBack();
  await expect(viewLink(page, "table")).toHaveAttribute("aria-current", "page");
  await expect.poll(() => storedFilmsView(page)).toBe("table");

  // The Clippings are no films view.
  await clippingsTab(page).click();
  await expect(clippingsTab(page)).toHaveAttribute("aria-current", "page");
  expect(await storedFilmsView(page)).toBe("table");

  // A value the store does not know (another version's, say) is the Timeline, and the Films tab says so.
  await page.evaluate((key) => window.localStorage.setItem(key, "separate"), FILMS_VIEW_KEY);
  await page.goto(`${PAIR}?view=clippings`);
  await expect(clippingsTab(page)).toHaveAttribute("aria-current", "page");
  await expect(filmsTab(page)).toHaveAttribute("href", PAIR);
});

test("a plain address is never redirected to the remembered view: the page's own default is the flat Timeline", async ({ page }) => {
  await open(page, "depth");
  await page.goto(PAIR);
  await expect(viewLink(page, "timeline")).toHaveAttribute("aria-current", "page");
  await expect(scene(page)).toHaveCount(0);
  expect(new URL(page.url()).search).toBe("");
  // Being on the Timeline is a visit to it: it is what the Films tab goes to now.
  await expect.poll(() => storedFilmsView(page)).toBe("timeline");
});

test("the first client render matches the server's, whatever view is remembered: no hydration warning, and the tab goes there afterwards", async ({ page }) => {
  const problems: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") problems.push(message.text());
  });
  page.on("pageerror", (error) => problems.push(error.message));
  await page.addInitScript((key) => {
    if (window.location.search.includes("clippings")) window.localStorage.setItem(key, "depth");
  }, FILMS_VIEW_KEY);
  await page.goto(`${PAIR}?view=clippings`);
  await expect(clippingsTab(page)).toHaveAttribute("aria-current", "page");
  await expect(filmsTab(page)).toHaveAttribute("href", `${PAIR}?view=depth`);
  expect(problems.filter((text) => /hydrat|did not match|mismatch/i.test(text))).toEqual([]);
});

test("without browser storage the Films tab still remembers the view for the session", async ({ page }) => {
  // localStorage that throws on every access, as in a window with site data blocked.
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("blocked", "SecurityError");
      },
    });
  });
  await page.goto(PAIR);
  await expect(viewLink(page, "timeline")).toHaveAttribute("aria-current", "page");
  await viewLink(page, "depth").click();
  await expect(scene(page)).toBeVisible();
  await clippingsTab(page).click();
  await expect(clippingsTab(page)).toHaveAttribute("aria-current", "page");
  await expect(filmsTab(page)).toHaveAttribute("href", `${PAIR}?view=depth`);
  await filmsTab(page).click();
  await expect(scene(page)).toBeVisible();
});

// ---- the switcher, from every view ---------------------------------------------------------------------------------

const STARTS = ["timeline", "table", "clippings", "depth"] as const;
const TARGETS = ["timeline", "depth", "table"] as const;

for (const start of STARTS) {
  for (const target of TARGETS) {
    test(`the switcher goes from the ${start === "depth" ? "Focus" : start} view to ${target === "depth" ? "Focus" : target}, and keeps the period`, async ({ page }) => {
      await open(page, start, `?${PERIOD}${start === "timeline" ? "" : `&view=${start}`}`);
      // The three views are there on every view, the Clippings too, where none is current (the bar is the same size on all four).
      await expect(bar(page).getByRole("navigation", { name: "Films view", exact: true }).getByRole("link")).toHaveCount(3);

      await viewLink(page, target).click();
      await expect(viewLink(page, target)).toHaveAttribute("aria-current", "page");
      for (const other of TARGETS.filter((view) => view !== target)) await expect(viewLink(page, other)).not.toHaveAttribute("aria-current", /.+/);
      await expect(filmsTab(page)).toHaveAttribute("aria-current", "page");
      await expect(clippingsTab(page)).not.toHaveAttribute("aria-current", /.+/);

      if (target === "depth") await expect(scene(page)).toBeVisible();
      else await expect(scene(page)).toHaveCount(0);
      // The period goes along; the view is the address's (the Timeline has none), and nothing of the one that was left (a sort, a quote, the Clippings) stays.
      expect(params(page)).toEqual({ from: "2001", to: "2005", ...(target === "timeline" ? {} : { view: target }) });
      expect(new URL(page.url()).pathname).toBe(PAIR);
      // It is the view the Films tab goes to from now on.
      await expect.poll(() => storedFilmsView(page)).toBe(target);
    });
  }
}

test("a click with a modifier on a switcher link is the browser's, not the page's: the link opens elsewhere and the page stays", async ({ page }) => {
  await open(page, "timeline", `?${PERIOD}`);
  const [popup] = await Promise.all([page.context().waitForEvent("page"), viewLink(page, "table").click({ modifiers: ["ControlOrMeta"] })]);
  await popup.waitForLoadState("domcontentloaded");
  expect(Object.fromEntries(new URL(popup.url()).searchParams)).toEqual({ from: "2001", to: "2005", view: "table" });
  await expect(viewLink(page, "timeline")).toHaveAttribute("aria-current", "page");
  expect(params(page)).toEqual({ from: "2001", to: "2005" });
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("the gear's sheet is the switcher and the Films | Clippings choice: the same round trip, with the period", async ({ page }) => {
    await page.goto(`${PAIR}?view=depth&${PERIOD}`);
    await expect(scene(page)).toBeVisible();
    await expect.poll(() => storedFilmsView(page)).toBe("depth");
    const gear = page.getByRole("button", { name: "Settings", exact: true });
    const sheet = page.getByRole("dialog", { name: "Settings", exact: true });

    // Focus → Table (the sheet's three-way choice) → Clippings (its Films | Clippings row) → Films, which is the Table.
    await gear.tap();
    await sheet.getByRole("navigation", { name: "Films view", exact: true }).getByRole("link", { name: "Table view", exact: true }).tap();
    await expect(scene(page)).toHaveCount(0);
    await expect.poll(() => storedFilmsView(page)).toBe("table");
    expect(params(page)).toEqual({ from: "2001", to: "2005", view: "table" });

    await gear.tap();
    await sheet.getByRole("navigation", { name: "Sections", exact: true }).getByRole("link", { name: "Clippings", exact: true }).tap();
    await expect(sheet).toBeHidden();
    await expect(page.locator('nav[aria-label="Sections"] a[href*="view=clippings"]')).toHaveAttribute("aria-current", "page");
    expect(params(page)).toEqual({ from: "2001", to: "2005", view: "clippings" });

    await gear.tap();
    await sheet.getByRole("navigation", { name: "Sections", exact: true }).getByRole("link", { name: "Films", exact: true }).tap();
    await expect(sheet).toBeHidden();
    await expect(page.locator('nav[aria-label="Films view"] a[aria-label="Table view"]')).toHaveAttribute("aria-current", "page");
    expect(params(page)).toEqual({ from: "2001", to: "2005", view: "table" });
  });
});
