import type { Locator, Page } from "next/experimental/testmode/playwright";
import { PEOPLE_PATH, expect, test } from "./fixtures";

// The touch gestures of a phone: swiping the landing page's collage between pairings (src/components/landing/use-hero-swipe.ts) and
// pulling a details sheet down to dismiss it (src/components/side-panel/use-swipe-dismiss.ts). Both follow the finger 1:1 and then
// either snap to their action or spring back (the rules are in src/lib/swipe.ts). Real touch input, through the browser's own
// gesture handling (CDP), so what the page's scroll takes and what the swipe takes are the engine's decisions, not the test's.

test.use({ viewport: { width: 390, height: 740 }, hasTouch: true, isMobile: true });

// Activate the server-side fetch fixtures before any test navigates to a people page.
test.beforeEach(async ({ next }) => {
  void next;
});

/** One finger, driven through the browser's input pipeline. Moves are split into steps a real finger would make. */
async function finger(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  let at = { x: 0, y: 0 };
  const send = (type: "touchStart" | "touchMove" | "touchEnd", points: { x: number; y: number }[], timestamp?: number) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points, timestamp });
  return {
    async down(x: number, y: number) {
      at = { x, y };
      await send("touchStart", [at]);
    },
    /** To a point, in `steps` moves `ms` apart. */
    async move(x: number, y: number, { steps = 8, ms = 12 } = {}) {
      const from = at;
      for (let step = 1; step <= steps; step++) {
        at = { x: from.x + ((x - from.x) * step) / steps, y: from.y + ((y - from.y) * step) / steps };
        await send("touchMove", [at]);
        await page.waitForTimeout(ms);
      }
    },
    /**
     * A whole flick from a point by (dx, dy): down, three moves and up, 10ms apart by the events' own clock, so its speed is what
     * is written here however busy the machine is.
     */
    async flick(x: number, y: number, dx: number, dy: number) {
      const began = Date.now() / 1000;
      const stamp = (step: number) => began + step * 0.01;
      await send("touchStart", [{ x, y }], stamp(0));
      for (let step = 1; step <= 3; step++) await send("touchMove", [{ x: x + (dx * step) / 3, y: y + (dy * step) / 3 }], stamp(step));
      await send("touchEnd", [], stamp(4));
    },
    /** Lifts, after resting `rest` ms (a finger that rests was not flung). */
    async up(rest = 0) {
      if (rest) await page.waitForTimeout(rest);
      await send("touchEnd", []);
    },
  };
}

const boxOf = async (locator: Locator) => (await locator.boundingBox())!;

test.describe("the landing collage", () => {
  const link = (page: Page) => page.locator("[data-hero-collage] > a");
  /** The left portrait's card as it is on screen: the one that is not on its way out. */
  const card = (page: Page) => page.locator("[data-hero-collage] > a figure").first();
  const status = (page: Page) => page.locator("[data-hero-collage] [role='status']");

  async function openLanding(page: Page) {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/");
    await expect(link(page)).toHaveAttribute("aria-label", / together$/);
    // The scene has faded in, so the rotation (and a swipe's step) has images to show.
    await expect(page.locator("[data-hero-collage] > a > div").first()).toHaveClass(/opacity-100/);
    const box = await boxOf(link(page));
    return { box, mid: { x: box.x + box.width / 2, y: box.y + box.height / 3 }, label: (await link(page).getAttribute("aria-label"))! };
  }

  test("the cards follow the finger, and a short swipe let go springs back without opening the link", async ({ page }) => {
    const { mid, label } = await openLanding(page);
    const touch = await finger(page);
    const before = await boxOf(card(page));
    await touch.down(mid.x, mid.y);
    await touch.move(mid.x - 40, mid.y);
    // 1:1 with the finger, less the 8px of slop it took to know it was a swipe.
    const dragged = await boxOf(card(page));
    expect(before.x - dragged.x).toBeCloseTo(32, 0);
    expect(Math.abs(dragged.y - before.y)).toBeLessThan(4);

    await touch.up(160);
    await expect.poll(async () => Math.abs((await boxOf(card(page))).x - before.x)).toBeLessThan(1);
    await expect(link(page)).toHaveAttribute("aria-label", label);
    await expect(status(page)).toHaveText("");
    expect(new URL(page.url()).pathname).toBe("/");
  });

  test("past the point of no return the keycap is down, and letting go shows the next pairing", async ({ page }) => {
    const { mid, label, box } = await openLanding(page);
    const touch = await finger(page);
    await touch.down(mid.x, mid.y);
    await touch.move(mid.x - box.width * 0.5, mid.y, { steps: 14 });
    await expect(page.locator('[data-keycap="next"]')).toHaveAttribute("data-pressed", "true");
    await expect(page.locator('[data-keycap="prev"]')).toHaveAttribute("data-pressed", "false");
    await touch.up(160);

    await expect(link(page)).not.toHaveAttribute("aria-label", label);
    await expect(status(page)).toHaveText(/^Showing /);
    await expect(page.locator('[data-keycap="next"]')).toHaveAttribute("data-pressed", "false");
    // The new scene's cards are at rest in their places, and the finger did not open the link.
    await expect.poll(() => page.locator("[data-hero-collage] > a > div").first().evaluate((stage) => stage.style.getPropertyValue("--swipe"))).toBe("0.00px");
    await expect.poll(() => page.locator("[data-hero-collage] > a figure").count()).toBe(2);
    expect(new URL(page.url()).pathname).toBe("/");
  });

  test("a flick is enough, and a swipe to the right goes back to the pairing before", async ({ page }) => {
    const { mid, label } = await openLanding(page);
    const touch = await finger(page);
    // 45px in 30ms: short of the distance that steps by itself, fast enough to step.
    await touch.flick(mid.x, mid.y, -45, 0);
    await expect(link(page)).not.toHaveAttribute("aria-label", label);
    await expect.poll(() => page.locator("[data-hero-collage] > a figure").count()).toBe(2);

    await touch.flick(mid.x, mid.y, 45, 0);
    await expect(link(page)).toHaveAttribute("aria-label", label);
    expect(new URL(page.url()).pathname).toBe("/");
  });

  test("a touch that moves up scrolls the page and changes nothing", async ({ page }) => {
    const { mid, label } = await openLanding(page);
    const touch = await finger(page);
    await touch.down(mid.x, mid.y + 60);
    await touch.move(mid.x - 10, mid.y - 120, { steps: 12 });
    await touch.up(160);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(40);
    await expect(link(page)).toHaveAttribute("aria-label", label);
    await expect(status(page)).toHaveText("");
  });

  test("a tap still opens the pairing", async ({ page }) => {
    const { mid } = await openLanding(page);
    const href = await link(page).getAttribute("href");
    await page.touchscreen.tap(mid.x, mid.y);
    await expect.poll(() => new URL(page.url()).pathname).toBe(href);
  });
});

test.describe("a details sheet", () => {
  const dialog = (page: Page) => page.getByRole("dialog", { name: "Scroll Alpha", exact: true });
  const trigger = (page: Page) => page.locator("[data-pair-title]").getByTitle("Details for Scroll Alpha", { exact: true });

  async function openSheet(page: Page) {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(`${PEOPLE_PATH}?view=timeline`);
    // A state transition of the live page, not a sleep: the gear's sheet opens and closes.
    const settings = page.getByRole("dialog", { name: "Settings", exact: true });
    await page.getByRole("button", { name: "Settings", exact: true }).tap();
    await expect(settings).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(settings).toBeHidden();
    await trigger(page).tap();
    await expect(dialog(page)).toBeVisible();
    // The slide-in is over: from here the sheet moves only with the finger.
    await expect.poll(() => dialog(page).evaluate((element) => element.getAnimations().length)).toBe(0);
    return boxOf(dialog(page));
  }

  test("has a grabber and follows the finger down; let go short, it settles back", async ({ page }) => {
    const rest = await openSheet(page);
    await expect(page.locator("[data-side-panel-grabber]")).toBeVisible();
    const touch = await finger(page);
    // From the content, which is at its top: the whole sheet is the handle.
    const x = rest.x + rest.width / 2;
    const y = rest.y + rest.height / 2;
    await touch.down(x, y);
    await touch.move(x, y + 60);
    expect((await boxOf(dialog(page))).y - rest.y).toBeCloseTo(60, 0);
    // The backdrop lightens as the sheet goes.
    expect(Number(await page.locator("[data-side-panel] > div").first().evaluate((element) => getComputedStyle(element).opacity))).toBeLessThan(1);

    await touch.up(160);
    await expect.poll(async () => (await boxOf(dialog(page))).y).toBe(rest.y);
    await expect(dialog(page)).toBeVisible();
    expect(await dialog(page).evaluate((element) => element.style.transform)).toBe("");
  });

  test("pulled far enough and let go, it closes from where the finger left it and hands focus back", async ({ page }) => {
    const rest = await openSheet(page);
    const touch = await finger(page);
    const x = rest.x + rest.width / 2;
    await touch.down(x, rest.y + 20);
    await touch.move(x, rest.y + 20 + 180, { steps: 14 });
    await touch.up(160);
    await expect(dialog(page)).toBeHidden();
    await expect(trigger(page)).toBeFocused();
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("");
  });

  test("a flick down closes it from a short pull", async ({ page }) => {
    const rest = await openSheet(page);
    const touch = await finger(page);
    const x = rest.x + rest.width / 2;
    // 60px in 30ms: short of the distance that closes by itself.
    await touch.flick(x, rest.y + 20, 0, 60);
    await expect(dialog(page)).toBeHidden();
  });

  test("content that has scrolled takes the pull itself: the sheet stays", async ({ page }) => {
    await openSheet(page);
    const scroller = dialog(page).locator("[data-side-panel-scroll]");
    // This person's details are short: make them long enough to scroll, and scroll them.
    await scroller.evaluate((element) => {
      const more = document.createElement("div");
      more.style.height = "1200px";
      element.append(more);
      element.scrollTo({ top: 60 });
    });
    expect(await scroller.evaluate((element) => element.scrollTop)).toBe(60);
    const rest = await boxOf(dialog(page));
    const touch = await finger(page);
    const x = rest.x + rest.width / 2;
    const y = rest.y + rest.height / 2;
    await touch.down(x, y);
    await touch.move(x, y + 40);
    expect((await boxOf(dialog(page))).y).toBe(rest.y);
    expect(await scroller.evaluate((element) => element.scrollTop)).toBeLessThan(60);
    await touch.up(160);
    await expect(dialog(page)).toBeVisible();
  });

  test("a pull upwards moves nothing", async ({ page }) => {
    const rest = await openSheet(page);
    const touch = await finger(page);
    const x = rest.x + rest.width / 2;
    await touch.down(x, rest.y + 20);
    await touch.move(x, rest.y - 60);
    expect((await boxOf(dialog(page))).y).toBe(rest.y);
    await touch.up(160);
    await expect(dialog(page)).toBeVisible();
  });
});
