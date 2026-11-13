import type { Locator, Page } from "@playwright/test";
import { test as base, expect } from "next/experimental/testmode/playwright";
import clippings from "../../src/lib/clippings.json";
import essays from "../../src/lib/essays.json";
import { QUOTE_BAND, QUOTE_FLOOR_PX, QUOTE_MAX_PX, QUOTE_MIN_LINE_CHARS, embedPath, quotePath } from "../../src/lib/quote-embed";
import { pairQuotes } from "../../src/lib/quote-embed-data";
import type { PersonTimeline } from "../../src/lib/types";
import { PIXEL } from "./fixtures";

// The pages X frames in a post (src/components/embed): a quote's share page and embed, which step through the pair's quotes and keep the address on the one shown, and a
// pair's embed, whose bar holds the people, Replay and the way to the page in a frame as small as the panel X opens over a phone.

const PEOPLE = [
  { id: 488, name: "Steven Spielberg", slug: "488-steven-spielberg" },
  { id: 491, name: "John Williams", slug: "491-john-williams" },
  { id: 287, name: "Brad Pitt", slug: "287-brad-pitt" },
  { id: 7467, name: "David Fincher", slug: "7467-david-fincher" },
] as const;
/** Spielberg and Williams: a pair with quotes (the Clippings and the critics' are real data; only TMDB is stubbed). */
const PAIR = `${PEOPLE[0].slug}+${PEOPLE[1].slug}`;
/** The quote the link opens on, and the one after it in the list, as in the report this spec came from. */
const START_ID = "john-is-much-more-of-a";

/** Six films all four made together, and two each of their own. */
const film = (id: number, year: number) => ({ id, title: `Embed Film ${id}`, release_date: `${year}-03-17`, poster_path: `/poster-${id}.png`, vote_count: 500, character: "Lead", order: 0 });
const SHARED = Array.from({ length: 6 }, (_, index) => film(100 + index, 2001 + index));

const test = base.extend({
  page: async ({ page }, provide) => {
    await page.route("https://image.tmdb.org/**", (route) => route.fulfill({ contentType: "image/png", body: PIXEL }));
    // The universal search's results (the header of the share page has the Search button).
    await page.route("**/api/search?*", (route) =>
      route.fulfill({ json: { results: PEOPLE.map((person) => ({ id: person.id, name: person.name, profilePath: null, knownFor: "Acting", knownForTitles: ["Embed Film"] })) } }),
    );
    await provide(page);
  },
  next: async ({ next }, provide) => {
    next.onFetch((request) => {
      const url = new URL(request.url);
      if (url.hostname !== "api.themoviedb.org") return "abort";
      const match = url.pathname.match(/^\/3\/person\/(\d+)(\/movie_credits)?$/);
      // Any person: the four above by name, and every other id (the pairs of the Clippings, for the longest quote) as "Person <id>".
      const person = match && (PEOPLE.find((p) => p.id === Number(match[1])) ?? { id: Number(match[1]), name: `Person ${match[1]}` });
      if (match && person) {
        if (!match[2]) return Response.json({ id: person.id, name: person.name, profile_path: null, biography: "A biography." });
        return Response.json({ cast: [...SHARED, film(person.id * 10, 1990), film(person.id * 10 + 1, 1995)], crew: [] });
      }
      if (url.pathname === "/3/discover/movie") return Response.json({ total_pages: 1, results: [] });
      return "abort";
    });
    await provide(next);
  },
});

// The server's TMDB stub (`next`, above) must be in place before the first page: the fixture is only set up for a test that asks for it.
test.beforeEach(async ({ next }) => {
  void next;
});

/** The pair's quotes in the order the embed steps through them: the page's own list, read from the same data. */
const QUOTES = pairQuotes(PEOPLE.slice(0, 2).map((person) => ({ person: { id: person.id, name: person.name, profilePath: null }, films: [] })) as unknown as PersonTimeline[]);
const START = QUOTES.findIndex((quote) => quote.id === START_ID);
const COUNT = QUOTES.length;

const pathname = (page: Page) => page.evaluate(() => window.location.pathname);

/** The quote at `index` is what the page shows, in its counter, its text and its address; and what a reload of the address shows, too. */
async function expectAt(page: Page, path: (id: string) => string, index: number) {
  const quote = QUOTES[index];
  await expect(page.getByRole("navigation", { name: "Browse quotes", exact: true })).toContainText(`${index + 1} / ${COUNT}`);
  await expect(page.locator("blockquote")).toContainText(quote.quote);
  await expect.poll(() => pathname(page)).toBe(path(quote.id));
}

async function expectReloadStays(page: Page, path: (id: string) => string, index: number) {
  await page.reload();
  await expectAt(page, path, index);
}

test("the quotes are real: the one the link opens on is in the list, with others to step through", () => {
  expect(START).toBeGreaterThanOrEqual(0);
  expect(COUNT).toBeGreaterThan(2);
});

const VARIANTS = [
  { name: "share page", path: (id: string) => quotePath(PAIR, id) },
  { name: "embed", path: (id: string) => embedPath(PAIR, id) },
] as const;

for (const { name, path } of VARIANTS) {
  test.describe(`${name}: the address follows the quote`, () => {
    test("Next and then Previous is back on the quote the link opened on, in its address, and a reload stays on it", async ({ page }) => {
      await page.goto(path(START_ID));
      await expectAt(page, path, START);

      // No reload in between: a reload would make the quote it lands on the one the page "opened on".
      await page.getByRole("button", { name: "Next quote", exact: true }).click();
      await expectAt(page, path, (START + 1) % COUNT);
      await page.getByRole("button", { name: "Previous quote", exact: true }).click();
      await expectAt(page, path, START);
      await expect.poll(() => pathname(page)).toBe(path(START_ID));
      await expectReloadStays(page, path, START);

      // And the other way: Previous and then Next.
      await page.getByRole("button", { name: "Previous quote", exact: true }).click();
      await expectAt(page, path, (START - 1 + COUNT) % COUNT);
      await page.getByRole("button", { name: "Next quote", exact: true }).click();
      await expectAt(page, path, START);
      await expectReloadStays(page, path, START);
    });

    test("stepping all the way round, either way, wraps back to the quote it opened on, and the address, the quote and a reload agree at every step", async ({ page }) => {
      await page.goto(path(START_ID));
      await expectAt(page, path, START);
      const next = page.getByRole("button", { name: "Next quote", exact: true });
      const previous = page.getByRole("button", { name: "Previous quote", exact: true });

      for (let step = 1; step <= COUNT; step++) {
        await next.click();
        await expectAt(page, path, (START + step) % COUNT);
      }
      await expectReloadStays(page, path, START);

      for (let step = 1; step <= COUNT; step++) {
        await previous.click();
        await expectAt(page, path, (START - step + COUNT * 2) % COUNT);
      }
      await expectReloadStays(page, path, START);
    });

    test("the first quote's Previous is the last, and the last quote's Next is the first, in the address and after a reload", async ({ page }) => {
      const first = 0;
      const last = COUNT - 1;

      await page.goto(path(QUOTES[first].id));
      await expectAt(page, path, first);
      await page.getByRole("button", { name: "Previous quote", exact: true }).click();
      await expectAt(page, path, last);
      await expectReloadStays(page, path, last);
      await page.getByRole("button", { name: "Next quote", exact: true }).click();
      await expectAt(page, path, first);
      await expectReloadStays(page, path, first);

      // Opened on the last, stepped on to the first and back: the address is the last's again.
      await page.goto(path(QUOTES[last].id));
      await expectAt(page, path, last);
      await page.getByRole("button", { name: "Next quote", exact: true }).click();
      await expectAt(page, path, first);
      await page.getByRole("button", { name: "Previous quote", exact: true }).click();
      await expectAt(page, path, last);
      await expectReloadStays(page, path, last);
    });

    test("the arrow keys step it from the page, and the address follows", async ({ page }) => {
      await page.goto(path(START_ID));
      await expectAt(page, path, START);
      await page.locator("blockquote").click();
      await page.keyboard.press("ArrowRight");
      await expectAt(page, path, (START + 1) % COUNT);
      await page.keyboard.press("ArrowLeft");
      await expectAt(page, path, START);
      await page.keyboard.press("ArrowLeft");
      await expectAt(page, path, (START - 1 + COUNT) % COUNT);
      await page.keyboard.press("ArrowRight");
      await expectAt(page, path, START);
      // A modifier is the browser's (Alt+Left is back), not the quotes'.
      await page.keyboard.press("Shift+ArrowRight");
      await expectAt(page, path, START);
    });
  });
}

test.describe("share page: the quotes' arrow keys are not taken from the search", () => {
  const path = VARIANTS[0].path;

  test("typing in the Search field, or any key in its dialog, leaves the quote and the address where they were; the page has them back once it is closed", async ({ page }) => {
    await page.goto(path(START_ID));
    await expectAt(page, path, START);

    await page.getByRole("banner").getByRole("button", { name: "Search", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Search people", exact: true });
    await expect(dialog).toBeVisible();
    const field = dialog.getByRole("combobox");
    await expect(field).toBeFocused();

    await field.fill("Steven");
    await expect(dialog.getByRole("option").first()).toBeVisible();
    for (const key of ["ArrowRight", "ArrowLeft", "ArrowRight", "ArrowRight"]) await page.keyboard.press(key);
    await expect(field).toHaveValue("Steven");
    await expectAt(page, path, START);

    // From the dialog's close button, too: it is the dialog's, not the page's.
    await dialog.getByRole("button", { name: "Close search", exact: true }).focus();
    await page.keyboard.press("ArrowRight");
    await expectAt(page, path, START);
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expectAt(page, path, START);

    // Closed, the focus is on the Search button, which is not a field: the arrows are the quotes' again.
    await page.keyboard.press("ArrowRight");
    await expectAt(page, path, (START + 1) % COUNT);
    await page.locator("blockquote").click();
    await page.keyboard.press("ArrowLeft");
    await expectAt(page, path, START);
  });

  test("a key the search handled itself (prevented) is not a step either", async ({ page }) => {
    await page.goto(path(START_ID));
    await expectAt(page, path, START);
    await page.evaluate(() => {
      // Something earlier in the page took the key, as a field's own handler does.
      document.addEventListener("keydown", (event) => event.key === "ArrowRight" && event.preventDefault());
    });
    await page.keyboard.press("ArrowRight");
    await expectAt(page, path, START);
    await page.keyboard.press("ArrowLeft");
    await expectAt(page, path, (START - 1 + COUNT) % COUNT);
  });
});

/** Where a control is, in the frame's pixels. */
async function boxOf(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("the control has no box");
  return box;
}

/** What is on top at the middle of the control is the control (or something inside it). */
async function isOnTopAtCentre(page: Page, locator: Locator) {
  const box = await boxOf(locator);
  return locator.evaluate((node, [x, y]) => {
    const hit = document.elementFromPoint(x, y);
    return Boolean(hit) && node.contains(hit);
  }, [box.x + box.width / 2, box.y + box.height / 2]);
}

const intersects = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** The size of a control's invisible hit area (its `::before`, which extends past its box), and of its box: what a finger has to hit, and what is drawn. */
async function touchTarget(locator: Locator) {
  return locator.evaluate((node) => {
    const area = getComputedStyle(node, "::before");
    const box = node.getBoundingClientRect();
    return { width: box.width, height: box.height, areaWidth: Number.parseFloat(area.width), areaHeight: Number.parseFloat(area.height) };
  });
}

/** A frame of a phone's width (the controls are touch targets in it): at most 30rem. */
const isPhoneWidth = (frame: { width: number }) => frame.width <= 480;

const FRAMES = [
  { width: 390, height: 253, what: "the panel X opens over a phone" },
  { width: 600, height: 315, what: "an inline card on a desktop timeline" },
  { width: 320, height: 253, what: "the smallest phone" },
] as const;

test.describe("pair embed: the bar's controls are separate targets", () => {
  test.use({ reducedMotion: "reduce" });

  for (const count of [2, 3, 4]) {
    for (const frame of FRAMES) {
      test(`${count} people in ${frame.width} x ${frame.height} (${frame.what}): the people, Replay and Open in Parallel are each on top at their own middle, and apart`, async ({ page }) => {
        await page.setViewportSize({ width: frame.width, height: frame.height });
        const slug = PEOPLE.slice(0, count).map((person) => person.slug).join("+");
        await page.goto(`/embed/p/${slug}`);

        // Under reduced motion the timeline is up at once, and with it the bar's controls.
        const replay = page.getByRole("button", { name: "Replay", exact: true });
        await expect(replay).toBeVisible();
        const people = page.getByRole("list", { name: "The people", exact: true }).getByRole("link");
        await expect(people).toHaveCount(count);
        const open = page.getByRole("link", { name: /^Open in Parallel/ });
        await expect(open).toBeVisible();
        const wordmark = page.getByRole("link", { name: "Parallel: home", exact: true });

        const personLinks = await people.all();
        const controls: { name: string; locator: Locator }[] = [
          ...personLinks.map((locator, index) => ({ name: PEOPLE[index].name, locator })),
          { name: "Replay", locator: replay },
          { name: "Open in Parallel", locator: open },
          // The wordmark gives way to the people in a narrow frame with 3 or 4 of them: it is a control only while it is shown.
          ...((await wordmark.isVisible()) ? [{ name: "Parallel: home", locator: wordmark }] : []),
        ];

        const boxes = await Promise.all(controls.map(({ locator }) => boxOf(locator)));
        for (const [index, { name, locator }] of controls.entries()) {
          // In the frame, and what is on top at its middle is itself.
          const box = boxes[index];
          expect(box.x, `${name} starts inside the frame`).toBeGreaterThanOrEqual(0);
          expect(box.x + box.width, `${name} ends inside the frame`).toBeLessThanOrEqual(frame.width);
          expect(await isOnTopAtCentre(page, locator), `${name} is on top at its middle`).toBe(true);
        }

        // Every control is apart from every other; but in the smallest frame the people are tucked under each other a little (the one on the right is on top, the
        // same as on the site's lane avatars), and each is a target of at least 22px.
        const peopleCount = personLinks.length;
        const tucked = frame.width < 352;
        for (let a = 0; a < controls.length; a++) {
          for (let b = a + 1; b < controls.length; b++) {
            if (tucked && b < peopleCount) continue; // both are people
            expect(intersects(boxes[a], boxes[b]), `${controls[a].name} and ${controls[b].name} do not overlap`).toBe(false);
          }
        }
        for (let i = 0; i + 1 < peopleCount; i++) {
          expect(boxes[i + 1].x - boxes[i].x, `${controls[i].name} is a target of at least 22px`).toBeGreaterThanOrEqual(22);
        }

        // In a phone's width the buttons are at least 32px tall (Replay 32 wide too), with an invisible hit area round each that takes it to about 44px by 40px.
        if (isPhoneWidth(frame)) {
          for (const [name, locator, round] of [["Replay", replay, true], ["Open in Parallel", open, false]] as const) {
            const target = await touchTarget(locator);
            expect(target.height, `${name} is at least 32px tall`).toBeGreaterThanOrEqual(32 - 0.5);
            if (round) expect(target.width, `${name} is at least 32px wide`).toBeGreaterThanOrEqual(32 - 0.5);
            expect(target.areaHeight, `${name}'s hit area is about 44px tall`).toBeGreaterThanOrEqual(43);
            expect(target.areaWidth, `${name}'s hit area is wider than the button`).toBeGreaterThan(target.width);
          }
        }
      });
    }
  }
});

// ---- Nothing in either embed scrolls up or down, or draws a scrollbar --------------------------------------------------------------------------------------------

/** Every element of the page that is a vertical scroller (`overflow-y` auto or scroll) or has a vertical overflow that is not clipped, and the document itself. */
async function verticalScrollers(page: Page) {
  return page.evaluate(() => {
    const found: { what: string; overflowY: string; scrollHeight: number; clientHeight: number }[] = [];
    for (const el of document.querySelectorAll("*")) {
      const { overflowY } = getComputedStyle(el);
      if (overflowY === "auto" || overflowY === "scroll") found.push({ what: `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)}`, overflowY, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight });
    }
    const root = document.scrollingElement ?? document.documentElement;
    found.push({ what: "document", overflowY: "document", scrollHeight: root.scrollHeight, clientHeight: root.clientHeight });
    return found;
  });
}

/** The room the track leaves under the year axis, at the frames below: the bar's side inset (14px, the least it is at any frame), so that the axis's labels are clear of the frame's bottom edge and its rounded corners. */
const BOTTOM_INSET = 14;

const FIT_FRAMES = [
  { width: 600, height: 315, what: "an inline card on a desktop timeline" },
  { width: 516, height: 271, what: "a narrow desktop column" },
  { width: 390, height: 253, what: "the panel X opens over a phone" },
] as const;

/** Frames taller than they are wide: the panel X opens over a phone when it is tall (70% of the screen), and the X preview page's mobile panel. */
const TALL_FRAMES = [
  { width: 383, height: 555, what: "a phone's panel (the report of the clipped footer)" },
  { width: 390, height: 591, what: "a phone's 70% panel" },
  { width: 435, height: 600, what: "the X preview page's mobile panel" },
] as const;

test.describe("pair embed: the end state fits the frame", () => {
  test.use({ reducedMotion: "reduce" });

  for (const frame of FIT_FRAMES) {
    test(`${frame.width} x ${frame.height} (${frame.what}): the bar is inset, the axis is whole and clear of the bottom edge, there is no minimap, and nothing scrolls up or down`, async ({ page }) => {
      await page.setViewportSize({ width: frame.width, height: frame.height });
      await page.goto(`/embed/p/${PAIR}`);
      const replay = page.getByRole("button", { name: "Replay", exact: true });
      await expect(replay).toBeVisible();

      // The bar: every control is inset from the top and the sides by at least the bar's padding (10px at the top, 14px at the sides).
      const controls = [
        ...(await page.getByRole("list", { name: "The people", exact: true }).getByRole("link").all()),
        replay,
        page.getByRole("link", { name: /^Open in Parallel/ }),
      ];
      const boxes = await Promise.all(controls.map(boxOf));
      expect(Math.min(...boxes.map((box) => box.y)), "the bar's controls start at least 10px under the frame's top edge").toBeGreaterThanOrEqual(10 - 0.5);
      expect(Math.min(...boxes.map((box) => box.x)), "the bar's controls start at least 14px in from the left edge").toBeGreaterThanOrEqual(14 - 0.5);
      expect(frame.width - Math.max(...boxes.map((box) => box.x + box.width)), "and end at least 14px in from the right edge").toBeGreaterThanOrEqual(14 - 0.5);

      // No minimap in the frame: it is the site's, and a frame only has the track (dragged, swiped or sent sideways by a sideways wheel).
      await expect(page.locator("[data-minimap-bar]"), "the embed has no minimap bar").toHaveCount(0);
      await expect(page.getByRole("scrollbar", { name: "Timeline position", exact: true }), "and no minimap's scrubber").toHaveCount(0);

      // The axis: the track reaches down to the bottom inset, so that the axis ends at least that far above the frame's bottom edge, and every label is inside the axis (and so inside the frame, clear of its edge and its corners).
      const axis = await boxOf(page.locator("[data-axis]"));
      expect(axis.y + axis.height, `the year axis ends at least ${BOTTOM_INSET}px inside the frame's bottom edge`).toBeLessThanOrEqual(frame.height - BOTTOM_INSET + 0.5);
      expect(axis.y + axis.height, "and the track fills the room down to it (no strip of the frame left empty under the axis)").toBeGreaterThanOrEqual(frame.height - BOTTOM_INSET - 2);
      const labels = await page.locator("[data-axis] span.tabular-nums").evaluateAll((nodes) =>
        nodes.map((node) => {
          const rect = node.getBoundingClientRect();
          return { text: node.textContent, top: rect.top, bottom: rect.bottom };
        }),
      );
      expect(labels.length, "the axis has year labels").toBeGreaterThan(0);
      for (const label of labels) {
        expect(label.top, `${label.text} is not above the axis`).toBeGreaterThanOrEqual(axis.y - 0.5);
        expect(label.bottom, `${label.text} is not cut off by the axis's bottom`).toBeLessThanOrEqual(axis.y + axis.height + 0.5);
        expect(label.bottom, `${label.text} is at least ${BOTTOM_INSET}px inside the frame's bottom edge`).toBeLessThanOrEqual(frame.height - BOTTOM_INSET + 0.5);
      }

      // Nothing scrolls up or down: no scroller of that axis has more to show, the track's own is clipped, and the track fits it.
      for (const scroller of await verticalScrollers(page)) {
        expect(scroller.scrollHeight, `${scroller.what} has no vertical overflow`).toBeLessThanOrEqual(scroller.clientHeight);
      }
      const track = page.getByRole("region", { name: /^Film timeline/ });
      expect(await track.evaluate((node) => getComputedStyle(node).overflowY)).toBe("hidden");
      expect(await track.evaluate((node) => ({ fits: node.scrollHeight <= node.clientHeight, scrollbar: (node as HTMLElement).offsetWidth - node.clientWidth }))).toEqual({ fits: true, scrollbar: 0 });
      // A swipe starting on it is the page's up and down: the touch action allows that pan (never `pan-x` alone, which would refuse it).
      expect(await track.evaluate((node) => getComputedStyle(node).touchAction)).toContain("pan-y");
    });
  }

  test("a tall frame (the 1200 x 630 player, a phone's 70% panel) has the room for a second row of cards and still does not scroll", async ({ page }) => {
    for (const frame of [{ width: 1200, height: 630 }, { width: 390, height: 591 }]) {
      await page.setViewportSize(frame);
      await page.goto(`/embed/p/${PAIR}`);
      await expect(page.getByRole("button", { name: "Replay", exact: true })).toBeVisible();
      const tops = await page.locator("[data-film]:not([data-film-node])").evaluateAll((nodes) => [...new Set(nodes.map((node) => Math.round(node.getBoundingClientRect().top)))]);
      // Two rows are a card and a gap apart (150px at full size); a quiet card's top is a little lower in its row, so the rows are told apart by the spread, not the count.
      expect(Math.max(...tops) - Math.min(...tops), `${frame.width} x ${frame.height} draws two rows of cards`).toBeGreaterThanOrEqual(140);
      const axis = await boxOf(page.locator("[data-axis]"));
      expect(axis.y + axis.height).toBeLessThanOrEqual(frame.height - BOTTOM_INSET + 0.5);
      for (const scroller of await verticalScrollers(page)) expect(scroller.scrollHeight).toBeLessThanOrEqual(scroller.clientHeight);
    }
  });

  test("a very short frame (360 x 200) draws the track smaller, and its axis still fits above the bottom inset", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 200 });
    await page.goto(`/embed/p/${PAIR}`);
    await expect(page.getByRole("button", { name: "Replay", exact: true })).toBeVisible();
    await expect(page.locator("[data-minimap-bar]")).toHaveCount(0);
    const axis = await boxOf(page.locator("[data-axis]"));
    expect(axis.y + axis.height).toBeLessThanOrEqual(200 - BOTTOM_INSET + 0.5);
    for (const scroller of await verticalScrollers(page)) expect(scroller.scrollHeight).toBeLessThanOrEqual(scroller.clientHeight);
  });

  test("an up or down wheel over the timeline is left for the page (not prevented, no sideways move); a sideways wheel pans it", async ({ page }) => {
    await page.setViewportSize({ width: 600, height: 315 });
    await page.goto(`/embed/p/${PAIR}`);
    await expect(page.getByRole("button", { name: "Replay", exact: true })).toBeVisible();
    const track = page.getByRole("region", { name: /^Film timeline/ });
    await page.evaluate(() => {
      const seen: boolean[] = [];
      (window as unknown as { __wheelPrevented: boolean[] }).__wheelPrevented = seen;
      // Last to run (the window's, in the bubble phase): whether anything on the way took the wheel.
      window.addEventListener("wheel", (event) => seen.push(event.defaultPrevented));
    });
    const box = await boxOf(track);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 3);
    const left = () => track.evaluate((node) => node.scrollLeft);
    const before = await left();

    await page.mouse.wheel(0, 240);
    await page.mouse.wheel(0, -240);
    // Past the browser's wheel latching (about half a second): the sideways wheel below is a gesture of its own, not a continuation of the vertical one.
    await page.waitForTimeout(1200);
    expect(await left(), "a vertical wheel does not pan the track sideways").toBe(before);
    expect(await page.evaluate(() => (window as unknown as { __wheelPrevented: boolean[] }).__wheelPrevented)).toEqual([false, false]);

    // The stubbed pair's track is no wider than its films, which it opens scrolled to the end of: the sideways wheel goes back.
    expect(before).toBeGreaterThan(100);
    await page.mouse.wheel(-300, 0);
    await expect.poll(left).toBeLessThan(before - 50);
  });
});

test.describe("pair embed: the sequence", () => {
  test.use({ reducedMotion: "no-preference" });

  test("the headshots do not move or change at any point of it (no nod, no ring, nothing behind them), and the posters still lift", async ({ page }) => {
    await page.setViewportSize({ width: 600, height: 315 });
    await page.goto(`/embed/p/${PAIR}`);
    const samples = await page.evaluate(async () => {
      const out: { people: string[]; posters: string; rings: number; rects: string[] }[] = [];
      const start = performance.now();
      while (performance.now() - start < 4800) {
        const people = [...document.querySelectorAll<HTMLElement>('[data-part="person"]')];
        out.push({
          people: people.map((el) => `${getComputedStyle(el).transform}|${getComputedStyle(el).opacity}|${getComputedStyle(el).boxShadow}`),
          posters: [...document.querySelectorAll<HTMLElement>('[data-part="poster"]')].map((el) => getComputedStyle(el).transform).join(" "),
          rings: document.querySelectorAll('[data-part="ring"]').length,
          // Relative to the stage, so that the poster's own fade and lift at the end (the whole card, one thing) is not counted.
          rects: people.map((el) => {
            const stage = el.closest<HTMLElement>('[data-part="stage"]')?.getBoundingClientRect();
            const rect = el.getBoundingClientRect();
            return stage ? `${(rect.left - stage.left).toFixed(1)},${(rect.top - stage.top).toFixed(1)},${(rect.width / stage.width).toFixed(4)}` : "";
          }),
        });
        await new Promise((resolve) => setTimeout(resolve, 40));
      }
      return out;
    });
    expect(samples.length).toBeGreaterThan(20);
    expect(samples[0].people.length).toBe(2);
    for (const sample of samples) {
      expect(sample.people).toEqual(samples[0].people);
      expect(sample.rings).toBe(0);
    }
    // The posters' lift is kept: they are at a different transform at some point of the sequence.
    expect(new Set(samples.map((sample) => sample.posters)).size).toBeGreaterThan(2);
    await expect(page.getByRole("button", { name: "Replay", exact: true })).toBeVisible();
  });
});

// ---- The quote embed: the quote is set to fit, never scrolls ------------------------------------------------------------------------------------------------------

/** The room the footer leaves under its last part (the avatar, the attribution, the pill): the footer's bottom padding, 12px at every frame size. */
const QUOTE_BOTTOM_INSET = 12;

/**
 * Where the quote's last character, the frame's edges, the bar, the footer and each part of it, and the lines the quote is set in are, in the frame's pixels. `lines` is the
 * number of characters on each rendered line of the quote (read from the rect of every character).
 */
async function quoteFit(page: Page) {
  return page.evaluate(() => {
    const block = document.querySelector("blockquote");
    const paragraph = block?.querySelector("p");
    const text = [...(paragraph?.childNodes ?? [])].find((node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").trim().length > 0);
    if (!block || !paragraph || !text) return null;
    const last = document.createRange();
    last.setStart(text, (text.textContent ?? "").length - 1);
    last.setEnd(text, (text.textContent ?? "").length);
    const rect = last.getBoundingClientRect();
    const header = document.querySelector("header")?.getBoundingClientRect();
    const footerElement = document.querySelector("footer");
    const footer = footerElement?.getBoundingClientRect();
    const attribution = footerElement?.firstElementChild?.getBoundingClientRect();
    // Every part of the footer that takes room (not the screen-reader text, which is placed out of the way).
    const partsBottom = footerElement
      ? Math.max(...[...footerElement.querySelectorAll<HTMLElement>("*")].filter((el) => getComputedStyle(el).position !== "absolute").map((el) => el.getBoundingClientRect().bottom))
      : Number.NEGATIVE_INFINITY;
    const open = document.querySelector('a[aria-label^="Open in Parallel"]')?.getBoundingClientRect();
    // The characters on each line: every character of the quote is a rect, and a new line is a rect a half line lower than the one before.
    const lines: number[] = [];
    let lineTop: number | null = null;
    const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const content = node.textContent ?? "";
      for (let index = 0; index < content.length; index++) {
        const range = document.createRange();
        range.setStart(node, index);
        range.setEnd(node, index + 1);
        const rects = range.getClientRects();
        if (rects.length === 0) continue;
        if (lineTop === null || Math.abs(rects[0].top - lineTop) > 4) {
          lines.push(0);
          lineTop = rects[0].top;
        }
        lines[lines.length - 1] += 1;
      }
    }
    return {
      fontSize: Number.parseFloat(getComputedStyle(block).fontSize),
      clamped: getComputedStyle(paragraph).webkitLineClamp !== "none",
      last: { top: rect.top, bottom: rect.bottom, right: rect.right },
      blockHeight: block.getBoundingClientRect().height,
      headerBottom: header?.bottom ?? 0,
      footerTop: footer?.top ?? Number.POSITIVE_INFINITY,
      footerBottom: footer?.bottom ?? Number.POSITIVE_INFINITY,
      partsBottom,
      attribution: attribution ? { top: attribution.top, bottom: attribution.bottom } : null,
      open: open ? { top: open.top, bottom: open.bottom, left: open.left, right: open.right } : null,
      lines,
      frame: { width: window.innerWidth, height: window.innerHeight },
    };
  });
}

/** An average line of the quote, the last (which is a rest of it, as long as it is) left out: the characters a reader's eye takes in along a line. */
const averageLine = (lines: readonly number[]) => {
  const body = lines.slice(0, -1);
  return body.reduce((sum, n) => sum + n, 0) / body.length;
};

async function expectQuoteFits(page: Page, label: string) {
  const fit = await quoteFit(page);
  expect(fit, `${label}: the quote is on the page`).not.toBeNull();
  if (!fit) return;
  expect(fit.fontSize, `${label}: the type is not under the floor`).toBeGreaterThanOrEqual(QUOTE_FLOOR_PX);

  // The footer is whole in the frame, with its bottom inset: every part of it (the picture, the attribution, the link out) and the footer itself, cut quote or not.
  expect(fit.open, `${label}: Open in Parallel is there`).not.toBeNull();
  expect(fit.footerBottom, `${label}: the footer ends inside the frame`).toBeLessThanOrEqual(fit.frame.height + 0.5);
  expect(fit.partsBottom, `${label}: every part of the footer ends at least ${QUOTE_BOTTOM_INSET}px inside the frame`).toBeLessThanOrEqual(fit.frame.height - QUOTE_BOTTOM_INSET + 0.5);
  expect(fit.open?.bottom ?? 0, `${label}: Open in Parallel ends at least ${QUOTE_BOTTOM_INSET}px inside the frame`).toBeLessThanOrEqual(fit.frame.height - QUOTE_BOTTOM_INSET + 0.5);
  expect(fit.open?.right ?? 0, `${label}: and inside it at the side`).toBeLessThanOrEqual(fit.frame.width + 0.5);
  expect(fit.open?.left ?? 0).toBeGreaterThanOrEqual(0);
  // On the one row with the attribution (it never wraps under it): its middle is in the attribution's height.
  const middle = ((fit.open?.top ?? 0) + (fit.open?.bottom ?? 0)) / 2;
  expect(middle, `${label}: Open in Parallel is on the attribution's row`).toBeGreaterThanOrEqual((fit.attribution?.top ?? 0) - 0.5);
  expect(middle, `${label}: Open in Parallel is on the attribution's row`).toBeLessThanOrEqual((fit.attribution?.bottom ?? 0) + 0.5);

  if (fit.clamped) {
    // Only a quote that is too long at the floor is cut (with an ellipsis).
    expect(fit.fontSize, `${label}: a cut quote is at the floor`).toBeCloseTo(QUOTE_FLOOR_PX, 0);
  } else {
    expect(fit.last.bottom, `${label}: the last character is inside the frame`).toBeLessThanOrEqual(fit.frame.height + 0.5);
    expect(fit.last.right).toBeLessThanOrEqual(fit.frame.width + 0.5);
    expect(fit.last.bottom, `${label}: and above the footer`).toBeLessThanOrEqual(fit.footerTop + 0.5);
  }

  // The quote is a band, not a wall: no more than about 60% of the room between the bar and the footer (62% with the rounding of the lines), cut or not.
  const room = fit.footerTop - fit.headerBottom;
  expect(fit.blockHeight / room, `${label}: the quote takes ${Math.round((fit.blockHeight / room) * 100)}% of the room between the bar and the footer`).toBeLessThanOrEqual(QUOTE_BAND + 0.02);

  // And in a phone's width its lines are about 30 to 45 characters, never fewer than 28 on average (a quote cut at the floor has a longer line still).
  if (fit.frame.width <= 480 && !fit.clamped && fit.lines.length >= 3) {
    expect(averageLine(fit.lines), `${label}: a line of the quote holds ${averageLine(fit.lines).toFixed(1)} characters on average (${fit.lines.join(", ")})`).toBeGreaterThanOrEqual(28);
  }

  for (const scroller of await verticalScrollers(page)) {
    expect(scroller.scrollHeight, `${label}: ${scroller.what} does not scroll`).toBeLessThanOrEqual(scroller.clientHeight);
  }
  // No scroll container at all in the quote's area: nothing is `auto` or `scroll`.
  expect((await verticalScrollers(page)).filter((scroller) => scroller.overflowY !== "document"), `${label}: no vertical scroller`).toEqual([]);
}

test.describe("quote embed: every quote fits its frame without scrolling", () => {
  test.use({ reducedMotion: "reduce" });

  for (const frame of [...FIT_FRAMES, ...TALL_FRAMES]) {
    test(`all ${COUNT} quotes of Spielberg and Williams at ${frame.width} x ${frame.height}`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: frame.width, height: frame.height });
      await page.goto(embedPath(PAIR, QUOTES[0].id));
      for (let index = 0; index < COUNT; index++) {
        await expectAt(page, (id) => embedPath(PAIR, id), index);
        await expectQuoteFits(page, `quote ${index + 1} (${QUOTES[index].id})`);
        await page.getByRole("button", { name: "Next quote", exact: true }).click();
      }
    });
  }

  test("a frame that is resized fits the quote again", async ({ page }) => {
    await page.setViewportSize({ width: 600, height: 315 });
    await page.goto(embedPath(PAIR, QUOTES[0].id));
    const wide = (await quoteFit(page))?.fontSize ?? 0;
    await page.setViewportSize({ width: 390, height: 253 });
    await expect.poll(async () => (await quoteFit(page))?.fontSize ?? 0).toBeLessThan(wide);
    await expectQuoteFits(page, "after the resize");
  });

  test("the longest real quote (of the Clippings and the critics, over every pair) fits at each frame, or ends in an ellipsis at the floor, with its link in view", async ({ page }) => {
    test.setTimeout(90_000);
    const keys = [...new Set([...Object.keys(clippings), ...Object.keys(essays)])];
    let longest: { key: string; id: string; length: number } | null = null;
    for (const key of keys) {
      const ids = key.split("+").map(Number);
      const quotes = pairQuotes(ids.map((id) => ({ person: { id, name: `Person ${id}`, profilePath: null }, films: [] })) as unknown as PersonTimeline[]);
      for (const quote of quotes) if (!longest || quote.quote.length > longest.length) longest = { key, id: quote.id, length: quote.quote.length };
    }
    expect(longest, "there are quotes").not.toBeNull();
    if (!longest) return;
    expect(longest.length).toBeGreaterThan(300);
    for (const frame of [...FIT_FRAMES, ...TALL_FRAMES]) {
      await page.setViewportSize({ width: frame.width, height: frame.height });
      await page.goto(`/embed/q/${longest.key}/${longest.id}`);
      await expect(page.locator("blockquote")).toBeVisible();
      await expectQuoteFits(page, `the longest quote (${longest.length} characters) at ${frame.width} x ${frame.height}`);
    }
  });
});

// ---- The quote embed: the quote takes the room it has --------------------------------------------------------------------------------------------------------------

/** What the quote, the bar and the footer take of the frame, in the frame's pixels. */
async function quoteLayout(page: Page) {
  const layout = await page.evaluate(() => {
    const block = document.querySelector("blockquote");
    const header = document.querySelector("header")?.getBoundingClientRect();
    const footer = document.querySelector("footer")?.getBoundingClientRect();
    if (!block || !header || !footer) return null;
    const rect = block.getBoundingClientRect();
    return {
      fontSize: Number.parseFloat(getComputedStyle(block).fontSize),
      width: block.clientWidth,
      top: rect.top,
      bottom: rect.bottom,
      headerBottom: header.bottom,
      footerTop: footer.top,
      footerHeight: footer.height,
      frameHeight: window.innerHeight,
    };
  });
  if (!layout) throw new Error("the quote, the bar or the footer is not on the page");
  return layout;
}

/** The quote's layout once the page has hydrated and its fonts are in (that is when it is fitted), not the server's first paint. */
async function settledQuote(page: Page) {
  await page.waitForFunction(() => {
    const block = document.querySelector("blockquote");
    return Boolean(block) && Object.keys(block as object).some((key) => key.startsWith("__reactFiber"));
  });
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  return quoteLayout(page);
}

/** The quote of the Clippings and the critics, over every pair, that has the fewest characters (and the pair it is of). */
function shortestQuote() {
  let shortest: { key: string; id: string; length: number } | null = null;
  for (const key of new Set([...Object.keys(clippings), ...Object.keys(essays)])) {
    const ids = key.split("+").map(Number);
    const quotes = pairQuotes(ids.map((id) => ({ person: { id, name: `Person ${id}`, profilePath: null }, films: [] })) as unknown as PersonTimeline[]);
    for (const quote of quotes) if (!shortest || quote.quote.length < shortest.length) shortest = { key, id: quote.id, length: quote.quote.length };
  }
  return shortest;
}

test.describe("quote embed: the quote is set to the room it has, whatever the frame's shape", () => {
  test.use({ reducedMotion: "reduce" });
  /** Quote 11 of Spielberg and Williams, a mid-length one (248 characters). */
  const MID = 10;

  test("a tall panel sets a mid-length quote at least 1.4 times as large as the short panel does, and it sits in its band: 35% to 62% of the room between the bar and the footer, with air above and under", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 253 });
    await page.goto(embedPath(PAIR, QUOTES[MID].id));
    const short = await settledQuote(page);
    for (const frame of TALL_FRAMES) {
      await page.setViewportSize({ width: frame.width, height: frame.height });
      await page.goto(embedPath(PAIR, QUOTES[MID].id));
      const tall = await settledQuote(page);
      expect(tall.fontSize / short.fontSize, `${frame.width} x ${frame.height} (${frame.what}): ${tall.fontSize}px against ${short.fontSize}px at 390 x 253`).toBeGreaterThanOrEqual(1.4);
      // A mid-length quote sits in the band (it was at least half of the room under the bar, with the footer, when it filled the whole room): over a third of the room, and no more than the band.
      const room = tall.footerTop - tall.headerBottom;
      const fill = (tall.bottom - tall.top) / room;
      expect(fill, `${frame.width} x ${frame.height}: the quote takes at least 35% of the room between the bar and the footer`).toBeGreaterThanOrEqual(0.35);
      expect(fill, `${frame.width} x ${frame.height}: and no more than 62% of it`).toBeLessThanOrEqual(QUOTE_BAND + 0.02);
      expect(tall.top - tall.headerBottom, "there is at least 15% of the room empty above the quote").toBeGreaterThanOrEqual(room * 0.15);
      expect(tall.footerTop - tall.bottom, "and at least 15% under it").toBeGreaterThanOrEqual(room * 0.15);
    }
  });

  test("a frame that is resized taller sets the quote larger again, and shorter, smaller", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 253 });
    await page.goto(embedPath(PAIR, QUOTES[MID].id));
    const short = (await settledQuote(page)).fontSize;
    await page.setViewportSize({ width: 435, height: 600 });
    await expect.poll(async () => (await quoteLayout(page)).fontSize).toBeGreaterThanOrEqual(short * 1.4);
    await page.setViewportSize({ width: 390, height: 253 });
    await expect.poll(async () => (await quoteLayout(page)).fontSize).toBeCloseTo(short, 1);
    await expectQuoteFits(page, "after the resize back");
  });

  test("a quote that has room to spare in a tall panel is a little above the middle of it; in the wide card it is centred, as it was", async ({ page }) => {
    // Quote 1 (170 characters) is one of the pair's shortest: it leaves room over in a tall frame, and in the wide card.
    await page.setViewportSize({ width: 435, height: 600 });
    await page.goto(embedPath(PAIR, QUOTES[0].id));
    const tall = await settledQuote(page);
    const above = tall.top - tall.headerBottom;
    const below = tall.footerTop - tall.bottom;
    expect(Math.min(above, below), "there is room over, above and under the quote (at least 15% of the room between the bar and the footer)").toBeGreaterThan((above + below + tall.bottom - tall.top) * 0.15);
    expect(below, "more of it is under the quote than above it").toBeGreaterThan(above + 8);

    await page.setViewportSize({ width: 600, height: 315 });
    await page.goto(embedPath(PAIR, QUOTES[0].id));
    const wide = await settledQuote(page);
    expect(Math.abs(wide.top - wide.headerBottom - (wide.footerTop - wide.bottom)), "centred in the wide card").toBeLessThanOrEqual(1);
  });

  test("a short quote is not blown up: no larger than the cap, and never so large that a line holds under about 30 characters", async ({ page }) => {
    const shortest = shortestQuote();
    expect(shortest, "there are quotes").not.toBeNull();
    if (!shortest) return;
    expect(shortest.length, "the shortest quote of all is short").toBeLessThan(60);
    for (const frame of [...TALL_FRAMES, { width: 1200, height: 630, what: "the player at its own size" }]) {
      await page.setViewportSize({ width: frame.width, height: frame.height });
      await page.goto(`/embed/q/${shortest.key}/${shortest.id}`);
      const layout = await settledQuote(page);
      expect(layout.fontSize, `${frame.width} x ${frame.height}: not over the cap`).toBeLessThanOrEqual(QUOTE_MAX_PX + 0.01);
      // An average character of the face is at most half its size wide: a line of `width` px holds at least `QUOTE_MIN_LINE_CHARS` of them at this size or smaller.
      expect(layout.fontSize, `${frame.width} x ${frame.height}: a line holds at least about ${QUOTE_MIN_LINE_CHARS} characters`).toBeLessThanOrEqual(Math.max(QUOTE_FLOOR_PX, layout.width / (QUOTE_MIN_LINE_CHARS * 0.5)) + 0.3);
      await expectQuoteFits(page, `the shortest quote (${shortest.length} characters) at ${frame.width} x ${frame.height}`);
    }
  });
});

// ---- The quote embed: the bar's arrows and the footer's link are touch targets -----------------------------------------------------------------------------------

test.describe("quote embed: the arrows and Open in Parallel are separate targets, 32px tall in a phone's width, and the footer is on one row", () => {
  test.use({ reducedMotion: "reduce" });

  for (const frame of [...TALL_FRAMES, ...FIT_FRAMES, { width: 320, height: 253, what: "the smallest phone" }, { width: 360, height: 640, what: "a small phone's tall panel" }]) {
    test(`${frame.width} x ${frame.height} (${frame.what})`, async ({ page }) => {
      await page.setViewportSize({ width: frame.width, height: frame.height });
      await page.goto(embedPath(PAIR, QUOTES[START].id));
      const previous = page.getByRole("button", { name: "Previous quote", exact: true });
      const next = page.getByRole("button", { name: "Next quote", exact: true });
      const open = page.getByRole("link", { name: /^Open in Parallel/ });
      await expect(open).toBeVisible();
      const wordmark = page.getByRole("link", { name: "Parallel: more pairs", exact: true });
      const controls = [
        { name: "Previous quote", locator: previous },
        { name: "Next quote", locator: next },
        { name: "Open in Parallel", locator: open },
        { name: "the wordmark", locator: wordmark },
      ];
      const boxes = await Promise.all(controls.map(({ locator }) => boxOf(locator)));
      for (const [index, { name, locator }] of controls.entries()) {
        expect(boxes[index].x, `${name} starts inside the frame`).toBeGreaterThanOrEqual(0);
        expect(boxes[index].x + boxes[index].width, `${name} ends inside the frame`).toBeLessThanOrEqual(frame.width);
        expect(boxes[index].y + boxes[index].height, `${name} ends inside the frame`).toBeLessThanOrEqual(frame.height - (name === "Open in Parallel" ? QUOTE_BOTTOM_INSET : 0) + 0.5);
        expect(await isOnTopAtCentre(page, locator), `${name} is on top at its middle`).toBe(true);
      }
      for (let a = 0; a < controls.length; a++) {
        for (let b = a + 1; b < controls.length; b++) expect(intersects(boxes[a], boxes[b]), `${controls[a].name} and ${controls[b].name} do not overlap`).toBe(false);
      }

      // The label is the whole of the name in a wide frame and "Open" in a narrow one (under 26rem), and the name is the same.
      await expect(open).toHaveAttribute("aria-label", /^Open in Parallel \(opens in a new tab\)$/);
      expect(await open.evaluate((node) => (node as HTMLElement).innerText.trim()), `${frame.width}px wide: the pill's label`).toBe(frame.width < 416 ? "Open" : "Open in Parallel");

      if (isPhoneWidth(frame)) {
        for (const [name, locator, round] of [["Previous quote", previous, true], ["Next quote", next, true], ["Open in Parallel", open, false]] as const) {
          const target = await touchTarget(locator);
          expect(target.height, `${name} is at least 32px tall`).toBeGreaterThanOrEqual(32 - 0.5);
          if (round) expect(target.width, `${name} is at least 32px wide`).toBeGreaterThanOrEqual(32 - 0.5);
          expect(target.areaHeight, `${name}'s hit area is about 44px tall`).toBeGreaterThanOrEqual(43);
          expect(target.areaWidth, `${name}'s hit area is wider than the button`).toBeGreaterThan(target.width);
        }
      }
    });
  }

  test("the footer is on one row and whole at every width from the smallest phone up, for every quote, however long its attribution", async ({ page }) => {
    test.setTimeout(120_000);
    for (const frame of [{ width: 320, height: 568 }, { width: 360, height: 640 }, { width: 414, height: 400 }]) {
      await page.setViewportSize(frame);
      await page.goto(embedPath(PAIR, QUOTES[0].id));
      for (let index = 0; index < COUNT; index++) {
        await expectAt(page, (id) => embedPath(PAIR, id), index);
        await expectQuoteFits(page, `quote ${index + 1} at ${frame.width} x ${frame.height}`);
        await page.getByRole("button", { name: "Next quote", exact: true }).click();
      }
    }
  });
});
