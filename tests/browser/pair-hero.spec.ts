import type { Locator, Page } from "next/experimental/testmode/playwright";
import { FILM_COUNT, HEADLINE, NAMES, PAIR, expect, test } from "./almodovar";
import { bar, collapseHero, heroBody, heroState, quotesLink, scene, scrollView, switcher } from "./fixtures";
import { getHeroNote } from "../../src/lib/pair-hero-note";

/**
 * The pair hero at the top of every view of a `/p/` page: the names joined with ×, a line of roles and the film count, a portrait each, a note (the pair's first
 * quote here), and a chip for each film. It is open on arrival and collapses into the compact bar once the view's main scroller has moved 48px from where it landed.
 * The pair is Almodóvar and Cruz, who have Quotes, with a dozen films together (`almodovar.ts`).
 */

// Activate the server-side fetch fixtures before any test navigates to a people page.
test.beforeEach(async ({ next }) => {
  void next;
});

type ViewName = "timeline" | "table" | "clippings" | "focus";
const VIEWS: Record<ViewName, string> = { timeline: "?view=timeline", table: "?view=table", clippings: "?view=clippings", focus: "?view=depth" };
const ALL_VIEWS = Object.keys(VIEWS) as ViewName[];

/** The pair's first quote, as the page works it out on the server: what the hero shows. */
const NOTE = getHeroNote([309, 955]);
if (NOTE?.kind !== "quote") throw new Error("the pair of these specs has quotes of its own");

const settingsGear = (page: Page) => page.getByRole("button", { name: "Settings", exact: true });

/** Waits until the page is live: a state transition (the gear's sheet opening and closing), not a sleep. */
async function hydrated(page: Page) {
  await settingsGear(page).click();
  await expect(page.getByRole("dialog", { name: "Settings", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Settings", exact: true })).toBeHidden();
}

const WORD: Record<ViewName, string> = { timeline: "Timeline", table: "Table", clippings: "Quotes", focus: "Films" };
/** The control's current segment, found without looking at whether it is shown (a phone's bar hides the control: its sheet has it). */
const currentSegment = (page: Page) => bar(page).locator('nav[aria-label="Views"] a[aria-current="page"]');

/** Opens a view of the pair, live, with its hero open and every view at its start. */
async function openView(page: Page, view: ViewName) {
  await page.goto(`${PAIR}${VIEWS[view]}`);
  if (view === "focus") await expect(scene(page)).toBeVisible();
  else await expect(currentSegment(page)).toHaveText(WORD[view]);
  await hydrated(page);
  await expect(bar(page)).toHaveAttribute("data-hero", "expanded");
  // One frame for the landing to be read.
  await frames(page, 3);
}

/** Lets `count` animation frames pass: what the hero's scroll check runs on. */
const frames = (page: Page, count = 2) =>
  page.evaluate(
    (n) =>
      new Promise<void>((resolve) => {
        const step = (left: number) => (left <= 0 ? resolve() : requestAnimationFrame(() => step(left - 1)));
        step(n);
      }),
    count,
  );

/** The view's main scroller and how to put it at an offset from where it landed (an absolute scrollTop/scrollLeft/scrollY). */
async function landing(page: Page, view: ViewName): Promise<number> {
  return page.evaluate((name) => {
    if (name === "focus") return document.querySelector<HTMLElement>("[data-depth-scene]")!.scrollTop;
    if (name === "timeline") return [...document.querySelectorAll<HTMLElement>('[aria-label^="Film timeline. Scroll sideways"]')].find((e) => e.getClientRects().length > 0)!.scrollLeft;
    return 0;
  }, view);
}
async function scrollTo(page: Page, view: ViewName, offset: number) {
  await page.evaluate(
    ([name, to]) => {
      if (name === "focus") document.querySelector<HTMLElement>("[data-depth-scene]")!.scrollTop = to as number;
      else if (name === "timeline") [...document.querySelectorAll<HTMLElement>('[aria-label^="Film timeline. Scroll sideways"]')].find((e) => e.getClientRects().length > 0)!.scrollLeft = to as number;
      else window.scrollTo(0, to as number);
    },
    [view, offset] as const,
  );
  await frames(page, 3);
}

const chips = (page: Page) => heroBody(page).locator("[data-hero-chip]");
/** The chip of "Bar Film n" (the page's films are 100 + n - 1): found by its film, not by its words, which run into the year's. */
const chipOf = (page: Page, n: number) => heroBody(page).locator(`[data-hero-chip="${99 + n}"]`);
const moreChip = (page: Page) => heroBody(page).locator("[data-hero-more]");
/** The first three films' chips and the "+N more" chip: where each one's top is (all the same on a single line), how many there are, and whether the row or the page scrolls. */
const chipLine = (page: Page) =>
  heroBody(page).evaluate((body) => {
    const items = [...body.querySelectorAll<HTMLElement>("[data-hero-chip], [data-hero-more]")];
    const group = body.querySelector<HTMLElement>('[role="group"]')!;
    return {
      chips: body.querySelectorAll("[data-hero-chip]").length,
      more: body.querySelectorAll("[data-hero-more]").length,
      tops: [...new Set(items.map((item) => item.offsetTop))],
      scrolls: group.scrollWidth > group.clientWidth,
      pageScrolls: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
/** How far down the screen the hero reaches before any scroll: the bottom of the bar's band (Timeline and Films), or of the body in the page under the bar (Table and Quotes). */
const heroBottom = async (page: Page) => Math.max((await box(bar(page))).y + (await box(bar(page))).height, (await box(heroBody(page))).y + (await box(heroBody(page))).height);
const title = (page: Page) => bar(page).locator("[data-pair-title]");
const pill = (page: Page) => bar(page).getByRole("button", { name: /^People on this page/ });

type Box = { x: number; y: number; width: number; height: number };
const box = async (locator: Locator): Promise<Box> => (await locator.boundingBox())!;
const intersects = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

test.describe("at 1440px wide", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const view of ALL_VIEWS) {
    test(`the hero is open on arrival on the ${view} view: the names, the roles line, a portrait each, the quote and the chips`, async ({ page }) => {
      await openView(page, view);
      expect(await heroState(page)).toBe("expanded");

      // The names joined with ×, each a button that opens the biography; the pill is not shown (it is inert) until the hero collapses.
      await expect(title(page)).toBeVisible();
      await expect(title(page).locator("p").first()).toHaveText(`${NAMES[0]} × ${NAMES[1]}`);
      await expect(title(page).getByRole("button")).toHaveText(NAMES);
      await expect(pill(page)).toBeHidden();
      // The line under them: each person's main role in the films together (both are actors here), then the count the pill used to say; set in capitals.
      await expect(title(page).locator("[data-pair-subtitle]")).toHaveText(new RegExp(`^actor × actor · ${FILM_COUNT} films$`, "i"));
      expect(await title(page).locator("[data-pair-subtitle]").evaluate((element) => getComputedStyle(element).textTransform)).toBe("uppercase");

      // One portrait each, 100 to 120px tall, rounded with the bar's radius, with the person's colour ring.
      const portraits = heroBody(page).locator("[data-hero-portrait]");
      await expect(portraits).toHaveCount(2);
      const look = await portraits.evaluateAll((items) =>
        items.map((item) => {
          const face = item.querySelector("span")!;
          return { height: item.getBoundingClientRect().height, radius: getComputedStyle(face).borderTopLeftRadius, ring: getComputedStyle(face).boxShadow };
        }),
      );
      for (const entry of look) {
        expect(entry.height).toBeGreaterThanOrEqual(100);
        expect(entry.height).toBeLessThanOrEqual(120);
        expect(entry.radius).toBe("6px");
      }
      // The first person's blue, the second's amber (the colour key of the pill, the timeline and the Quotes).
      expect(look[0].ring).toContain("rgb(111, 155, 209)");
      expect(look[1].ring).toContain("rgb(208, 168, 69)");

      // The note: the pair's first quote, in italics, and who said it about whom, a link to that quote in the Quotes.
      const note = heroBody(page).locator('[data-hero-note="quote"]');
      await expect(note.locator("blockquote")).toContainText(NOTE.quote.slice(0, 30));
      expect(await note.locator("blockquote").evaluate((element) => getComputedStyle(element).fontStyle)).toBe("italic");
      const attribution = note.getByRole("link", { name: `${NOTE.speaker} on ${NOTE.about}`, exact: true });
      await expect(attribution).toHaveAttribute("href", new RegExp(`view=clippings&quote=${NOTE.id}$`));

      // The films: the first three chips in release order, then "+9 more", all on one line.
      await expect(chips(page)).toHaveCount(3);
      await expect(chips(page)).toContainText(Array.from({ length: 3 }, (_, index) => `Bar Film ${index + 1}`));
      await expect(moreChip(page)).toContainText(`+${FILM_COUNT - 3} more`);
      expect(await chipLine(page)).toMatchObject({ chips: 3, more: 1, tops: [expect.any(Number)] });
      // The page's one h1 is still the visually hidden headline.
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator("h1")).toHaveText(HEADLINE);
    });
  }

  test("the hero is in the same place on every view: the home arrow, the names, the portraits and the chips", async ({ page }) => {
    const measured = {} as Record<ViewName, { home: Box; title: Box; portraits: Box; chips: Box; gear: Box }>;
    for (const view of ALL_VIEWS) {
      await openView(page, view);
      measured[view] = {
        home: await box(bar(page).getByRole("link", { name: "Back to Parallel home", exact: true })),
        title: await box(title(page)),
        portraits: await box(heroBody(page).locator("[data-hero-portrait]").first()),
        chips: await box(chips(page).first()),
        gear: await box(settingsGear(page)),
      };
    }
    for (const view of ["table", "clippings", "focus"] as const) {
      expect(measured[view].home, `home on ${view}`).toEqual(measured.timeline.home);
      expect(measured[view].title, `title on ${view}`).toEqual(measured.timeline.title);
      expect(measured[view].portraits, `portraits on ${view}`).toEqual(measured.timeline.portraits);
      expect(measured[view].chips, `chips on ${view}`).toEqual(measured.timeline.chips);
    }
    // The gear is at the right edge on the flat views and left of the rail on Films, as on the compact bar.
    expect(measured.table.gear).toEqual(measured.timeline.gear);
    expect(measured.clippings.gear).toEqual(measured.timeline.gear);
    expect(measured.focus.gear.x).toBeLessThan(measured.timeline.gear.x);
  });

  test("every view opens at its start: Films at the top of the scene, the Timeline at its left end (and at its bottom where it scrolls down), the Table and the Quotes at the top of the page", async ({ page }) => {
    // (The Timeline of this pair is no wider than a wide screen: on a narrower one it has room to scroll sideways, so that its left end is a position and not the only one.)
    await page.setViewportSize({ width: 900, height: 600 });
    for (const view of ALL_VIEWS) {
      await openView(page, view);
      const start = await page.evaluate((name) => {
        if (name === "focus") {
          const scroller = document.querySelector<HTMLElement>("[data-depth-scene]")!;
          return { left: 0, top: scroller.scrollTop, bottomGap: 0 };
        }
        if (name === "timeline") {
          const scroller = [...document.querySelectorAll<HTMLElement>('[aria-label^="Film timeline. Scroll sideways"]')].find((e) => e.getClientRects().length > 0)!;
          return { left: scroller.scrollLeft, top: scroller.scrollTop, bottomGap: scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop };
        }
        return { left: window.scrollX, top: window.scrollY, bottomGap: 0 };
      }, view);
      expect(start.left, `${view}: scrollLeft`).toBe(0);
      // The Timeline sits at the bottom of its track (all of it, within a pixel), wherever that is; the others at the top.
      if (view === "timeline") expect(start.bottomGap, `${view}: distance from the bottom`).toBeLessThanOrEqual(1);
      else expect(start.top, `${view}: scrollTop`).toBe(0);
    }
  });

  // ---- collapsing ----------------------------------------------------------------------------------------------------

  for (const view of ALL_VIEWS) {
    test(`on the ${view} view the hero collapses once the scroller has moved 48px from where it landed, and expands again within 48px of it`, async ({ page }) => {
      // (The Timeline of this pair is no wider than a wide screen, so it is shown on a narrower one, where it has room to scroll sideways.)
      await page.setViewportSize({ width: view === "timeline" ? 900 : 1440, height: 600 });
      await openView(page, view);
      const landed = await landing(page, view);
      // Every view starts at its start: Films at the top of the scene, the Timeline at its left end, the Table and the Quotes at the top of the page.
      expect(landed).toBe(0);

      await scrollTo(page, view, landed + 47);
      expect(await heroState(page)).toBe("expanded");
      await scrollTo(page, view, landed + 48);
      await expect(bar(page)).toHaveAttribute("data-hero", "collapsed");
      // Collapsed: the people pill is where the title was, and the title is no longer there to be pressed.
      await expect(pill(page)).toBeVisible();
      await expect(title(page)).toBeHidden();

      // Back within 48px of where it landed: expanded again, and the pill gives way to the title.
      await scrollTo(page, view, landed + 20);
      await expect(bar(page)).toHaveAttribute("data-hero", "expanded");
      await expect(title(page)).toBeVisible();
      await expect(pill(page)).toBeHidden();
    });
  }

  test("a Timeline with nothing to scroll collapses the hero on a press on it, or a wheel over the band, since no scroll can", async ({ page }) => {
    // At 1440px the pair's whole career is on the screen: the track has no room to scroll in either direction.
    await openView(page, "timeline");
    const room = await page.evaluate(() => {
      const track = [...document.querySelectorAll<HTMLElement>('[aria-label^="Film timeline. Scroll sideways"]')].find((element) => element.getClientRects().length > 0)!;
      return { x: track.scrollWidth - track.clientWidth, y: track.scrollHeight - track.clientHeight };
    });
    expect(room).toEqual({ x: 0, y: 0 });
    // Scrolling it does nothing, and the hero stays open...
    await page.evaluate(() => {
      const track = [...document.querySelectorAll<HTMLElement>('[aria-label^="Film timeline. Scroll sideways"]')].find((element) => element.getClientRects().length > 0)!;
      track.scrollLeft += 200;
      track.scrollTop += 200;
    });
    await frames(page, 3);
    expect(await heroState(page)).toBe("expanded");
    // ...a press on the track collapses it.
    await page.mouse.click(720, 700);
    await expect(bar(page)).toHaveAttribute("data-hero", "collapsed");

    await openView(page, "timeline");
    await page.mouse.move(700, 150);
    await page.mouse.wheel(0, 200);
    await expect(bar(page)).toHaveAttribute("data-hero", "collapsed");
  });

  test("the compact bar is the home arrow, the people pill, the control and the gear; collapsing it takes the names' place with the pill", async ({ page }) => {
    await openView(page, "timeline");
    await collapseHero(page);
    await expect(bar(page).getByRole("link", { name: "Back to Parallel home", exact: true })).toBeVisible();
    await expect(pill(page)).toBeVisible();
    await expect(switcher(page).getByRole("link")).toHaveText(["Films", "Timeline", "Table", "Quotes"]);
    await expect(settingsGear(page)).toBeVisible();
    // One height for every control, and the bar the height of the compact bar (12px of padding above the 50px controls).
    await expect.poll(async () => (await box(bar(page))).height).toBe(62);
    for (const control of [bar(page).getByRole("link", { name: "Back to Parallel home", exact: true }), bar(page).locator("[data-pill-capsule]"), switcher(page), settingsGear(page)]) {
      expect((await box(control)).height).toBe(50);
    }
  });

  test("the body of the hero eases away on the Timeline and Films, and its chips and portraits can no longer be reached; on the Table it scrolls with the page", async ({ page }) => {
    for (const view of ["timeline", "focus"] as const) {
      await openView(page, view);
      await collapseHero(page);
      // Shut: not shown, and out of the Tab order (inert).
      await expect(chips(page).first()).toBeHidden();
      expect(await heroBody(page).evaluate((element) => element.closest("[inert]") !== null)).toBe(true);
    }
    await openView(page, "table");
    const before = await box(chips(page).first());
    await collapseHero(page);
    // Still there, still its own size, only moved up with the page.
    const after = await box(chips(page).first());
    expect(after.width).toBe(before.width);
    expect(after.y).toBeLessThan(before.y);
    expect(await heroBody(page).evaluate((element) => element.closest("[inert]") !== null)).toBe(false);
  });

  // ---- the chips --------------------------------------------------------------------------------------------------------

  test("+N more opens the rest of the chips inline, in release order, and focus goes to the first one it added", async ({ page }) => {
    await openView(page, "table");
    await moreChip(page).click();
    await expect(chips(page)).toHaveCount(FILM_COUNT);
    await expect(moreChip(page)).toHaveCount(0);
    await expect(chips(page)).toContainText(Array.from({ length: FILM_COUNT }, (_, index) => `Bar Film ${index + 1}`));
    await expect(chips(page).nth(3)).toBeFocused();
  });

  test("a chip on Films scrolls the scene so that the film's poster is in the middle of the screen, focuses it and collapses the hero", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openView(page, "focus");
    await moreChip(page).click();
    await chipOf(page, 6).click();
    const poster = scene(page).locator('[data-film="105"]');
    await expect(bar(page)).toHaveAttribute("data-hero", "collapsed");
    await expect(poster).toBeFocused();
    await expect
      .poll(async () => {
        const rect = await box(poster);
        return Math.abs(rect.y + rect.height / 2 - 450);
      })
      .toBeLessThan(40);
  });

  test("a chip on Films scrolls smoothly: the scene is on its way, not there, a frame after the press", async ({ page }) => {
    await openView(page, "focus");
    const before = await scene(page).evaluate((element) => element.scrollTop);
    await moreChip(page).click();
    await chipOf(page, 8).click();
    const behavior = await scene(page).evaluate(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    expect(behavior).toBe(false);
    await expect.poll(() => scene(page).evaluate((element) => element.scrollTop)).not.toBe(before);
  });

  test("a chip on the Timeline centres the film's card in the track and focuses it", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    // On a screen narrower than the pair's career, so that the track has room to scroll and can put a film in the middle.
    await page.setViewportSize({ width: 900, height: 600 });
    await openView(page, "timeline");
    await moreChip(page).click();
    await chipOf(page, 7).click();
    const card = page.locator('[aria-label^="Film timeline. Scroll sideways"] [data-film="106"]').first();
    await expect(bar(page)).toHaveAttribute("data-hero", "collapsed");
    await expect(card).toBeFocused();
    await expect
      .poll(async () => {
        const rect = await box(card);
        return Math.abs(rect.x + rect.width / 2 - 450);
      })
      .toBeLessThan(60);
  });

  test("a chip on the Table scrolls the film's row into view and lights it for a moment", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 600 });
    await openView(page, "table");
    await moreChip(page).click();
    await chipOf(page, 8).click();
    const row = page.locator('tr[data-film-row="107"]');
    await expect(row).toHaveAttribute("data-flash", "");
    await expect.poll(async () => {
      const rect = await box(row);
      return rect.y >= 62 && rect.y + rect.height <= 600;
    }).toBe(true);
    await expect(bar(page)).toHaveAttribute("data-hero", "collapsed");
    // The light goes out by itself.
    await expect(row).not.toHaveAttribute("data-flash", "", { timeout: 5000 });
  });

  test("a chip on the Quotes opens the film's panel, and focus goes back to the chip when it closes", async ({ page }) => {
    await openView(page, "clippings");
    const chip = chipOf(page, 3);
    await chip.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(chip).toBeFocused();
  });

  test("a chip is a button like the Quotes' filter chips: the same height, shape and border", async ({ page }) => {
    await openView(page, "clippings");
    const look = await page.evaluate(() => {
      const read = (element: Element) => {
        const css = getComputedStyle(element);
        return { height: css.height, radius: css.borderTopLeftRadius, border: css.borderTopWidth, font: css.fontSize };
      };
      const filter = document.querySelector('[aria-label="Show quotes by speaker"] button:not([aria-pressed="true"])');
      const chip = document.querySelector("[data-hero-chip]");
      return { filter: filter ? read(filter) : null, chip: chip ? read(chip) : null };
    });
    expect(look.chip).not.toBeNull();
    expect(look.chip).toEqual(look.filter);
  });

  // ---- the names and the portraits ---------------------------------------------------------------------------------------

  for (const view of ALL_VIEWS) {
    test(`on the ${view} view a name and a portrait open the biography, as they do everywhere else`, async ({ page }) => {
      await openView(page, view);
      const bio = page.getByRole("dialog", { name: NAMES[0], exact: true });
      await title(page).getByRole("button", { name: NAMES[0], exact: true }).click();
      await expect(bio).toBeVisible();
      await expect(bio.getByText("A biography.")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(bio).toBeHidden();
      await expect(title(page).getByRole("button", { name: NAMES[0], exact: true })).toBeFocused();

      // The portrait is the same opener, for the mouse and the touch (the name is the keyboard's way in).
      const cruz = page.getByRole("dialog", { name: NAMES[1], exact: true });
      await heroBody(page).getByRole("button", { name: `Biography of ${NAMES[1]}`, exact: true }).click();
      await expect(cruz).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(cruz).toBeHidden();
      await expect(heroBody(page).getByRole("button", { name: `Biography of ${NAMES[1]}`, exact: true })).toBeFocused();
    });
  }

  test("the featured quote's attribution opens that quote in the Quotes, from the Timeline and from Films", async ({ page }) => {
    await openView(page, "timeline");
    await heroBody(page).getByRole("link", { name: `${NOTE.speaker} on ${NOTE.about}`, exact: true }).click();
    await expect(quotesLink(page)).toHaveAttribute("aria-current", "page");
    expect(new URL(page.url()).searchParams.get("quote")).toBe(NOTE.id);
    await expect(page.locator(`[id$="${NOTE.id}"]`).first()).toBeVisible();

    await openView(page, "focus");
    await heroBody(page).getByRole("link", { name: `${NOTE.speaker} on ${NOTE.about}`, exact: true }).click();
    await expect(quotesLink(page)).toHaveAttribute("aria-current", "page");
    await expect(scene(page)).toHaveCount(0);
    expect(new URL(page.url()).searchParams.get("quote")).toBe(NOTE.id);
  });

  test("Tab reaches the names while the hero is open and the pill once it has collapsed, never both", async ({ page }) => {
    await openView(page, "table");
    await expect(title(page).getByRole("button", { name: NAMES[0], exact: true })).toBeVisible();
    expect(await bar(page).locator("[data-people-pill]").evaluate((element) => element.closest("[inert]") !== null)).toBe(true);
    await collapseHero(page);
    expect(await title(page).evaluate((element) => element.closest("[inert]") !== null)).toBe(true);
    expect(await bar(page).locator("[data-people-pill]").evaluate((element) => element.closest("[inert]") !== null)).toBe(false);
  });

  // ---- the people pill belongs to the collapsed bar ------------------------------------------------------------------------

  for (const view of ALL_VIEWS) {
    test(`on the ${view} view the people pill is not on the screen while the hero is open, and is in the bar and opens once it has collapsed`, async ({ page }) => {
      await openView(page, view);
      expect(await heroState(page)).toBe("expanded");
      // Open hero: no pill (nor its heads), out of the Tab order, and the names are where it will be.
      await expect(pill(page)).toBeHidden();
      await expect(bar(page).locator("[data-pill-head]").first()).toBeHidden();
      expect(await bar(page).locator("[data-people-pill]").evaluate((element) => element.closest("[inert]") !== null)).toBe(true);
      await expect(title(page)).toBeVisible();

      // Collapsed: it is in the bar, and a press opens it on its field to add a person and a row for each of the two.
      await collapseHero(page);
      await expect(pill(page)).toBeVisible();
      await expect(title(page)).toBeHidden();
      await pill(page).click();
      await expect(pill(page)).toHaveAttribute("aria-expanded", "true");
      await expect(page.getByRole("combobox", { name: "Add a person", exact: true })).toBeVisible();
      const people = page.getByRole("dialog", { name: "People", exact: true });
      await expect(people).toBeVisible();
      for (const name of NAMES) await expect(people.getByRole("button", { name, exact: true }).first()).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(people).toBeHidden();
      await expect(pill(page)).toBeFocused();
    });
  }

  // ---- Films: the landing poster and the year rail -----------------------------------------------------------------------

  test("the hero does not cover the first collaboration's poster on Films when it opens", async ({ page }) => {
    await openView(page, "focus");
    const band = (await box(bar(page))).y + (await box(bar(page))).height;
    const poster = await box(scene(page).locator('[data-film="100"]'));
    expect(poster.y).toBeGreaterThanOrEqual(band);
  });

  test("the year rail starts at the hero's bottom edge while it is open, runs to the top of the screen once it has collapsed, and comes back", async ({ page }) => {
    await openView(page, "focus");
    const track = page.locator("[data-depth-rail] > div").first();
    const bandBottom = async () => (await box(bar(page))).y + (await box(bar(page))).height;
    await expect.poll(async () => Math.abs((await box(track)).y - (await bandBottom()))).toBeLessThanOrEqual(1);

    await collapseHero(page);
    await expect.poll(async () => (await box(track)).y).toBe(0);
    const landed = await landing(page, "focus");
    void landed;
    // Back near where it landed: the rail starts under the band again.
    const mid = await scene(page).evaluate((element) => element.scrollTop);
    await scrollTo(page, "focus", mid - 120);
    await expect(bar(page)).toHaveAttribute("data-hero", "expanded");
    await expect.poll(async () => Math.abs((await box(track)).y - (await bandBottom()))).toBeLessThanOrEqual(1);
  });

  test("the rail's top edge eases with the hero: it is between the two places on the way, and a visitor who asked for less motion gets it at once", async ({ page }) => {
    const sample = async () =>
      page.evaluate(
        () =>
          new Promise<number[]>((resolve) => {
            const track = document.querySelector("[data-depth-rail] > div")!;
            const tops: number[] = [];
            const start = performance.now();
            const step = () => {
              tops.push(Math.round(track.getBoundingClientRect().top));
              if (performance.now() - start < 700) requestAnimationFrame(step);
              else resolve(tops);
            };
            requestAnimationFrame(step);
          }),
      );

    await openView(page, "focus");
    const open = Math.round((await box(bar(page))).height);
    const running = sample();
    await scrollView(page, 120);
    const tops = await running;
    expect(tops.at(-1)).toBe(0);
    expect(tops.some((top) => top > 0 && top < open - 1), `on the way: ${tops.join(",")}`).toBe(true);

    await page.emulateMedia({ reducedMotion: "reduce" });
    await openView(page, "focus");
    const instant = sample();
    await scrollView(page, 120);
    const jumped = await instant;
    expect(jumped.every((top) => top === 0 || Math.abs(top - open) <= 1), `reduced: ${jumped.join(",")}`).toBe(true);
    expect(jumped.at(-1)).toBe(0);
  });

  test("the year readout is clear of the bar's controls, with the hero open and collapsed, wherever the scene is scrolled", async ({ page }) => {
    await openView(page, "focus");
    const readout = page.locator("[data-rail-readout-box]");
    const controls = () => bar(page).locator('a[href], button, [data-pill-capsule], nav[aria-label="Views"]');
    const clear = async (state: string) => {
      const rect = await box(readout);
      for (const control of await controls().all()) {
        if (!(await control.isVisible())) continue;
        const other = await box(control);
        expect(intersects(rect, other), `${state}: the readout ${JSON.stringify(rect)} meets ${JSON.stringify(other)}`).toBe(false);
      }
    };
    await clear("open");
    // Collapsed, from the top of the scene to the bottom: the window's middle is nearest the bar at the top.
    await scrollTo(page, "focus", 60);
    await expect(bar(page)).toHaveAttribute("data-hero", "collapsed");
    await expect.poll(async () => (await box(page.locator("[data-depth-rail] > div").first())).y).toBe(0);
    await clear("collapsed, at the top of the scene");
    for (const fraction of [0.1, 0.5, 1]) {
      await scene(page).evaluate((element, share) => (element.scrollTop = (element.scrollHeight - element.clientHeight) * share), fraction);
      await frames(page, 3);
      await clear(`collapsed, ${fraction} down`);
    }
  });

  // ---- the hero is not in the way -------------------------------------------------------------------------------------------

  test("a wheel over the hero's band on Films moves the scene under it, and collapses the hero", async ({ page }) => {
    await openView(page, "focus");
    const before = await scene(page).evaluate((element) => element.scrollTop);
    await page.mouse.move(700, 150);
    await page.mouse.wheel(0, 200);
    await expect(bar(page)).toHaveAttribute("data-hero", "collapsed");
    expect(await scene(page).evaluate((element) => element.scrollTop)).toBeGreaterThan(before);
  });
});

test.describe("at 390px wide", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  for (const view of ALL_VIEWS) {
    test(`on the ${view} view the hero is short: small portraits beside the quote, the first three films on one line, and no more than 220px before any scroll`, async ({ page }) => {
      await openView(page, view);
      await expect(title(page)).toBeVisible();
      const portraits = heroBody(page).locator("[data-hero-portrait]");
      const first = await box(portraits.first());
      expect(first.height).toBeGreaterThanOrEqual(40);
      expect(first.height).toBeLessThanOrEqual(48);
      // The quote starts beside the portraits (they float at its left), not under them.
      const note = await box(heroBody(page).locator("[data-hero-note]"));
      expect(note.y).toBeLessThan(first.y + first.height);
      // The first three films and "+9 more": one line, which does not scroll, nor does the page.
      expect(await chipLine(page)).toEqual({ chips: 3, more: 1, tops: [expect.any(Number)], scrolls: false, pageScrolls: false });
      // The whole hero, bar and body, reaches no further down than 220px.
      expect(await heroBottom(page)).toBeLessThanOrEqual(220);
    });
  }

  test("the hero does not cover the first collaboration's poster on Films, and the year rail starts under the hero, then runs to the top once it has collapsed", async ({ page }) => {
    await openView(page, "focus");
    const band = (await box(bar(page))).y + (await box(bar(page))).height;
    expect((await box(scene(page).locator('[data-film="100"]'))).y).toBeGreaterThanOrEqual(band);
    const track = page.locator("[data-depth-rail] > div").first();
    await expect.poll(async () => Math.abs((await box(track)).y - band)).toBeLessThanOrEqual(1);
    await collapseHero(page);
    await expect.poll(async () => (await box(track)).y).toBe(0);
  });

  test("the year readout and the rail's labels are clear of the bar's controls, with the hero open and collapsed", async ({ page }) => {
    await openView(page, "focus");
    const readout = page.locator("[data-rail-readout-box]");
    const controls = () => bar(page).locator('button, [data-pill-capsule]');
    const clear = async (state: string) => {
      const rect = await box(readout);
      for (const control of await controls().all()) {
        if (!(await control.isVisible())) continue;
        expect(intersects(rect, await box(control)), state).toBe(false);
      }
    };
    await clear("open");
    await scrollTo(page, "focus", 60);
    await expect(bar(page)).toHaveAttribute("data-hero", "collapsed");
    await expect.poll(async () => (await box(page.locator("[data-depth-rail] > div").first())).y).toBe(0);
    await clear("collapsed");
  });

  for (const view of ALL_VIEWS) {
    test(`on the ${view} view the people pill is not on the screen while the hero is open, and is in the bar and opens once it has collapsed`, async ({ page }) => {
      await openView(page, view);
      expect(await heroState(page)).toBe("expanded");
      // Open hero: no pill (nor its heads), out of the Tab order, and the names are where it will be.
      await expect(pill(page)).toBeHidden();
      await expect(bar(page).locator("[data-pill-head]").first()).toBeHidden();
      expect(await bar(page).locator("[data-people-pill]").evaluate((element) => element.closest("[inert]") !== null)).toBe(true);
      await expect(title(page)).toBeVisible();

      // Collapsed: it is in the bar, and a press opens it on its field to add a person and a row for each of the two.
      await collapseHero(page);
      await expect(pill(page)).toBeVisible();
      await expect(title(page)).toBeHidden();
      await pill(page).tap();
      await expect(pill(page)).toHaveAttribute("aria-expanded", "true");
      await expect(page.getByRole("combobox", { name: "Add a person", exact: true })).toBeVisible();
      const people = page.getByRole("dialog", { name: "People", exact: true });
      await expect(people).toBeVisible();
      for (const name of NAMES) await expect(people.getByRole("button", { name, exact: true }).first()).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(people).toBeHidden();
      await expect(pill(page)).toBeFocused();
    });
  }

  test("tapping a chip on Films takes the scene to the film, and the people pill is where the names were", async ({ page }) => {
    await openView(page, "focus");
    await chips(page).first().tap();
    await expect(bar(page)).toHaveAttribute("data-hero", "collapsed");
    await expect(pill(page)).toBeVisible();
  });
});
