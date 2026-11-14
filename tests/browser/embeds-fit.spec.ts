import type { Locator } from "@playwright/test";
import {
  EMBED_FIT_FRAMES as FIT_FRAMES,
  EMBED_PAIR as PAIR,
  EMBED_PEOPLE as PEOPLE,
  boxOf,
  embedTest as test,
  expect,
  intersects,
  isOnTopAtCentre,
  isPhoneWidth,
  touchTarget,
  verticalScrollers,
} from "./fixtures";

// The pair's embed (`/embed/p/<people>`, src/components/embed/pair-embed.tsx) in the frames X gives it: the bar's controls are separate targets, the track and its year axis fit the
// frame with their insets, nothing scrolls up or down, and a sideways wheel is the track's only. The TMDB stub and the helpers are in `fixtures.ts`.

// The server's TMDB stub (`next`, in `embedTest`) must be in place before the first page: the fixture is only set up for a test that asks for it.
test.beforeEach(async ({ next }) => {
  void next;
});

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

/** The room the track leaves under the year axis, at the frames below: the bar's side inset (14px, the least it is at any frame), so that the axis's labels are clear of the frame's bottom edge and its rounded corners. */
const BOTTOM_INSET = 14;

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
