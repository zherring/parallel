import type { Page } from "@playwright/test";
import clippings from "../../src/lib/clippings.json";
import essays from "../../src/lib/essays.json";
import { QUOTE_FOOTER_BOTTOM_PX } from "../../src/lib/embed-insets";
import { CHAR_WIDTH } from "../../src/lib/og-quote";
import { QUOTE_BAND, QUOTE_FLOOR_PX, QUOTE_MAX_PX, QUOTE_MIN_LINE_CHARS, embedPath } from "../../src/lib/quote-embed";
import { pairQuotes } from "../../src/lib/quote-embed-data";
import type { PersonTimeline } from "../../src/lib/types";
import {
  EMBED_COUNT as COUNT,
  EMBED_FIT_FRAMES as FIT_FRAMES,
  EMBED_PAIR as PAIR,
  EMBED_QUOTES as QUOTES,
  EMBED_START as START,
  EMBED_TALL_FRAMES as TALL_FRAMES,
  averageLine,
  boxOf,
  embedTest as test,
  expect,
  expectQuoteAt as expectAt,
  intersects,
  isOnTopAtCentre,
  isPhoneWidth,
  touchTarget,
  verticalScrollers,
} from "./fixtures";

// The quote's embed (`/embed/q/<people>/<id>`, src/components/embed/quote-embed.tsx) in the frames X gives it: every quote is set to the room it has (its band, its characters to a
// line, its footer's row) and never scrolls, and the arrows and the link out are touch targets. Stepping through the quotes and the address are in `embeds.spec.ts`; the TMDB stub
// and the helpers are in `fixtures.ts`.

// The server's TMDB stub (`next`, in `embedTest`) must be in place before the first page: the fixture is only set up for a test that asks for it.
test.beforeEach(async ({ next }) => {
  void next;
});

// ---- The quote embed: the quote is set to fit, never scrolls ------------------------------------------------------------------------------------------------------

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

async function expectQuoteFits(page: Page, label: string) {
  const fit = await quoteFit(page);
  expect(fit, `${label}: the quote is on the page`).not.toBeNull();
  if (!fit) return;
  expect(fit.fontSize, `${label}: the type is not under the floor`).toBeGreaterThanOrEqual(QUOTE_FLOOR_PX);

  // The footer is whole in the frame, with its bottom inset: every part of it (the picture, the attribution, the link out) and the footer itself, cut quote or not.
  expect(fit.open, `${label}: Open in Parallel is there`).not.toBeNull();
  expect(fit.footerBottom, `${label}: the footer ends inside the frame`).toBeLessThanOrEqual(fit.frame.height + 0.5);
  expect(fit.partsBottom, `${label}: every part of the footer ends at least ${QUOTE_FOOTER_BOTTOM_PX}px inside the frame`).toBeLessThanOrEqual(fit.frame.height - QUOTE_FOOTER_BOTTOM_PX + 0.5);
  expect(fit.open?.bottom ?? 0, `${label}: Open in Parallel ends at least ${QUOTE_FOOTER_BOTTOM_PX}px inside the frame`).toBeLessThanOrEqual(fit.frame.height - QUOTE_FOOTER_BOTTOM_PX + 0.5);
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

  // And in a phone's width its lines are about 30 to 45 characters, never fewer than two under `QUOTE_MIN_LINE_CHARS` on average (a quote cut at the floor has a longer line still).
  if (fit.frame.width <= 480 && !fit.clamped && fit.lines.length >= 3) {
    expect(averageLine(fit.lines), `${label}: a line of the quote holds ${averageLine(fit.lines).toFixed(1)} characters on average (${fit.lines.join(", ")})`).toBeGreaterThanOrEqual(QUOTE_MIN_LINE_CHARS - 2);
  }

  const scrollers = await verticalScrollers(page);
  for (const scroller of scrollers) {
    expect(scroller.scrollHeight, `${label}: ${scroller.what} does not scroll`).toBeLessThanOrEqual(scroller.clientHeight);
  }
  // No scroll container at all in the quote's area: nothing is `auto` or `scroll`.
  expect(scrollers.filter((scroller) => scroller.overflowY !== "document"), `${label}: no vertical scroller`).toEqual([]);
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
      // An average character of the face is at most `CHAR_WIDTH` of its size wide: a line of `width` px holds at least `QUOTE_MIN_LINE_CHARS` of them at this size or smaller.
      expect(layout.fontSize, `${frame.width} x ${frame.height}: a line holds at least about ${QUOTE_MIN_LINE_CHARS} characters`).toBeLessThanOrEqual(Math.max(QUOTE_FLOOR_PX, layout.width / (QUOTE_MIN_LINE_CHARS * CHAR_WIDTH)) + 0.3);
      await expectQuoteFits(page, `the shortest quote (${shortest.length} characters) at ${frame.width} x ${frame.height}`);
    }
  });
});

// ---- The quote embed: the bar's arrows and the footer's link are touch targets -----------------------------------------------------------------------------------

/** The pill reads "Open" in a frame narrower than 26rem (416px): `@max-[26rem]` in `OpenInParallel`, a Tailwind class, which is a literal and so not a number this spec can import. */
const SHORT_PILL_BELOW = 416;

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
        expect(boxes[index].y + boxes[index].height, `${name} ends inside the frame`).toBeLessThanOrEqual(frame.height - (name === "Open in Parallel" ? QUOTE_FOOTER_BOTTOM_PX : 0) + 0.5);
        expect(await isOnTopAtCentre(page, locator), `${name} is on top at its middle`).toBe(true);
      }
      for (let a = 0; a < controls.length; a++) {
        for (let b = a + 1; b < controls.length; b++) expect(intersects(boxes[a], boxes[b]), `${controls[a].name} and ${controls[b].name} do not overlap`).toBe(false);
      }

      // The label is the whole of the name in a wide frame and "Open" in a narrow one (under 26rem), and the name is the same.
      await expect(open).toHaveAttribute("aria-label", /^Open in Parallel \(opens in a new tab\)$/);
      expect(await open.evaluate((node) => (node as HTMLElement).innerText.trim()), `${frame.width}px wide: the pill's label`).toBe(frame.width < SHORT_PILL_BELOW ? "Open" : "Open in Parallel");

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
