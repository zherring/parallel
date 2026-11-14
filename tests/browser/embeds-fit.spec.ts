import type { Locator } from "@playwright/test";
import { EMBED_AVATAR_PX, EMBED_INSET_PX } from "../../src/lib/embed-insets";
import { CARD_HEIGHT, DOT_HIT_MIN, DOT_HIT_SIZE, NODE_HIT_HEIGHT } from "../../src/lib/timeline-layout";
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
        // Tucked under each other below 22rem (352px): `@max-[22rem]:-ml-2` in the pair embed's bar.
        const tucked = frame.width < 352;
        for (let a = 0; a < controls.length; a++) {
          for (let b = a + 1; b < controls.length; b++) {
            if (tucked && b < peopleCount) continue; // both are people
            expect(intersects(boxes[a], boxes[b]), `${controls[a].name} and ${controls[b].name} do not overlap`).toBe(false);
          }
        }
        for (let i = 0; i + 1 < peopleCount; i++) {
          expect(boxes[i + 1].x - boxes[i].x, `${controls[i].name} is a target of at least ${EMBED_AVATAR_PX}px`).toBeGreaterThanOrEqual(EMBED_AVATAR_PX);
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

/** The room the track leaves under the year axis, at the frames below: the bar's side inset (the least it is at any frame), so that the axis's labels are clear of the frame's bottom edge and its rounded corners. */
const BOTTOM_INSET = EMBED_INSET_PX.x;

test.describe("pair embed: the end state fits the frame", () => {
  test.use({ reducedMotion: "reduce" });

  for (const frame of FIT_FRAMES) {
    test(`${frame.width} x ${frame.height} (${frame.what}): the bar is inset, the axis is whole and clear of the bottom edge, there is no minimap, and nothing scrolls up or down`, async ({ page }) => {
      await page.setViewportSize({ width: frame.width, height: frame.height });
      await page.goto(`/embed/p/${PAIR}`);
      const replay = page.getByRole("button", { name: "Replay", exact: true });
      await expect(replay).toBeVisible();

      // The bar: every control is inset from the top and the sides by at least the bar's padding (`EMBED_INSET_PX`, the floors the component sizes it by).
      const controls = [
        ...(await page.getByRole("list", { name: "The people", exact: true }).getByRole("link").all()),
        replay,
        page.getByRole("link", { name: /^Open in Parallel/ }),
      ];
      const boxes = await Promise.all(controls.map(boxOf));
      expect(Math.min(...boxes.map((box) => box.y)), `the bar's controls start at least ${EMBED_INSET_PX.top}px under the frame's top edge`).toBeGreaterThanOrEqual(EMBED_INSET_PX.top - 0.5);
      expect(Math.min(...boxes.map((box) => box.x)), `the bar's controls start at least ${EMBED_INSET_PX.x}px in from the left edge`).toBeGreaterThanOrEqual(EMBED_INSET_PX.x - 0.5);
      expect(frame.width - Math.max(...boxes.map((box) => box.x + box.width)), `and end at least ${EMBED_INSET_PX.x}px in from the right edge`).toBeGreaterThanOrEqual(EMBED_INSET_PX.x - 0.5);

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
      // A swipe starting on it is the page's up and down, and a pinch on it zooms the page: the touch action allows both. `manipulation` is the two (and no double-tap zoom); a list
      // has to name `pan-y` and `pinch-zoom` (it is exclusive of whatever it leaves out, so `pan-x pan-y` alone takes the pinch), and `pan-x` alone would refuse the vertical pan.
      const touchAction = await track.evaluate((node) => getComputedStyle(node).touchAction);
      expect(touchAction === "manipulation" || (touchAction.includes("pan-y") && touchAction.includes("pinch-zoom")), `touch-action is "${touchAction}": it lets a vertical pan and a pinch through`).toBe(true);
    });
  }

  // The track is drawn smaller than its layout in a short frame (its `fit`), and so is everything on it: a node's hit area is made `1 / fit` as large (see `hitScale`) so that
  // it is as wide on the screen as it is on the site.
  for (const frame of [{ width: 390, height: 253, what: "the panel X opens over a phone" }, { width: 360, height: 200, what: "a very short frame" }]) {
    test(`${frame.width} x ${frame.height} (${frame.what}): the track is drawn smaller, and a node's hit area is still about ${DOT_HIT_SIZE}px wide on the screen, with the node on top at its middle`, async ({ page }) => {
      await page.setViewportSize({ width: frame.width, height: frame.height });
      await page.goto(`/embed/p/${PAIR}`);
      await expect(page.getByRole("button", { name: "Replay", exact: true })).toBeVisible();

      const { fit, nodes } = await page.evaluate((maxHeight) => {
        const layer = document.querySelector<HTMLElement>('[data-part="fit"]');
        const drawn = layer && layer.offsetWidth > 0 ? layer.getBoundingClientRect().width / layer.offsetWidth : 1;
        // A node's button is one `NODE_HIT_HEIGHT` of layout tall (a card's is a poster and its caption): drawn, no taller than that.
        const buttons = [...document.querySelectorAll<HTMLElement>("button[data-film]")].filter((button) => button.getBoundingClientRect().height <= maxHeight);
        return {
          fit: drawn,
          nodes: buttons.map((button) => {
            const rect = button.getBoundingClientRect();
            const x = rect.left + rect.width / 2;
            const y = rect.top + rect.height / 2;
            const onScreen = x >= 0 && x <= window.innerWidth && y >= 0 && y <= window.innerHeight;
            const top = onScreen ? document.elementFromPoint(x, y) : null;
            return { film: button.dataset.film ?? "", left: rect.left, right: rect.right, width: rect.width, onScreen, onTop: top !== null && button.contains(top) };
          }),
        };
      }, NODE_HIT_HEIGHT + 0.5);

      expect(fit, `the track is drawn at ${fit.toFixed(2)} of its layout`).toBeLessThan(1);
      expect(nodes.length, "there are nodes on the track").toBeGreaterThan(0);

      // The widest node's hit area is a finger's (the page's `DOT_HIT_SIZE`, less a pixel of rounding) and the node is what is on top at its middle.
      const widest = nodes.filter((node) => node.onScreen).sort((a, b) => b.width - a.width)[0];
      expect(widest, "a node is in the frame").toBeDefined();
      expect(widest.width, `the widest node's hit area is ${widest.width.toFixed(1)}px wide on the screen`).toBeGreaterThanOrEqual(DOT_HIT_SIZE - 1);
      expect(widest.onTop, `film ${widest.film} is on top at the middle of its hit area`).toBe(true);

      // The wider hit areas do not take the neighbours' taps beyond what the site allows: two nodes at least `DOT_HIT_MIN` apart on the screen do not overlap.
      const byX = [...nodes].sort((a, b) => a.left + a.right - (b.left + b.right));
      for (let i = 0; i + 1 < byX.length; i++) {
        const [a, b] = [byX[i], byX[i + 1]];
        const apart = (b.left + b.right) / 2 - (a.left + a.right) / 2;
        if (apart >= DOT_HIT_MIN) expect(a.right, `films ${a.film} and ${b.film}, ${apart.toFixed(1)}px apart, do not overlap`).toBeLessThanOrEqual(b.left + 0.5);
      }
    });
  }

  test("a tall frame (the 1200 x 630 player, a phone's 70% panel) has the room for a second row of cards and still does not scroll", async ({ page }) => {
    for (const frame of [{ width: 1200, height: 630 }, { width: 390, height: 591 }]) {
      await page.setViewportSize(frame);
      await page.goto(`/embed/p/${PAIR}`);
      await expect(page.getByRole("button", { name: "Replay", exact: true })).toBeVisible();
      const tops = await page.locator("[data-film]:not([data-film-node])").evaluateAll((nodes) => [...new Set(nodes.map((node) => Math.round(node.getBoundingClientRect().top)))]);
      // Two rows are a card and a gap apart (`CARD_HEIGHT` and `ROW_GAP`, at full size); a quiet card's top is a little lower in its row, so the rows are told apart by the spread (at least a card), not the count.
      expect(Math.max(...tops) - Math.min(...tops), `${frame.width} x ${frame.height} draws two rows of cards`).toBeGreaterThanOrEqual(CARD_HEIGHT);
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
