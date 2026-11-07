import { test, expect, PEOPLE_PATH } from "./fixtures";
import type { Page } from "next/experimental/testmode/playwright";

// Activate the server-side fetch fixtures before any test navigates to a people page.
test.beforeEach(async ({ next }) => { void next; });

const scene = (page: Page) => page.getByRole("region", { name: "Film timeline. Scroll down for later years.", exact: true });
const rail = (page: Page) => page.getByRole("scrollbar", { name: "Timeline position", exact: true });
const pill = (page: Page) => page.getByRole("button", { name: /^People on this page/ });
const peopleCard = (page: Page) => page.getByRole("dialog", { name: "People", exact: true });

/** The first of the fixture's shared films (2000-01-01): the scene opens with it in the middle of the screen. */
const FIRST_SHARED = /^Scroll Film 100, 2000\./;

/**
 * Opens the Depth view and waits for it to settle: the rail's handle reports where the scene is, and the scene
 * opens on the first collaboration (2000), not at the top of the axis (1990), so a position past 0 means the
 * initial scroll has happened.
 */
async function openDepth(page: Page, search = "") {
  await page.goto(`${PEOPLE_PATH}?view=depth${search}`);
  await expect(scene(page)).toBeVisible();
  await expect.poll(async () => Number(await rail(page).getAttribute("aria-valuenow"))).toBeGreaterThan(0);
}

test("the scene opens scrolled to the first collaboration", async ({ page }) => {
  await openDepth(page);
  const region = scene(page);

  await expect.poll(() => region.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  // Collaborations are the layer at the screen plane, so the first one is level with the middle of the screen.
  const poster = region.getByRole("button", { name: FIRST_SHARED });
  await expect(poster).toBeVisible();
  const box = (await poster.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(Math.abs(box.y + box.height / 2 - viewport.height / 2)).toBeLessThan(24);

  // The depth: collaborations in front, then one layer behind per person.
  await expect(region.locator("ol")).toHaveCount(3);
  // The scene covers the site's header and footer rather than sitting between them.
  await expect(page.locator("html")).toHaveAttribute("data-view", "depth");
});

test("the films made together float in front: larger, with their own shadow, and above every layer behind", async ({ page }) => {
  await openDepth(page);
  const region = scene(page);
  const poster = region.getByRole("button", { name: FIRST_SHARED });

  // About 150 x 225 on a desktop (laid out 136 x 204 and drawn a ninth larger by being 100px forward).
  const box = (await poster.boundingBox())!;
  expect(box.width).toBeGreaterThan(145);
  expect(box.width).toBeLessThan(160);
  expect(box.height).toBeGreaterThan(218);
  await expect(region.locator("ol").first()).toHaveCSS("transform", /matrix3d/);
  expect(await region.locator("ol").first().evaluate((list) => list.style.transform)).toBe("translateZ(100px)");
  await expect(poster.locator("span").nth(1)).toHaveCSS("box-shadow", /rgba?\(0, 0, 0/);

  // A background poster dragged under it does not show through: what is on top at a point of overlap is the film made together.
  const covered = await region.evaluate((scroller) => {
    const front = scroller.querySelector<HTMLElement>('button[data-layer="0"]')!;
    const behind = scroller.querySelector<HTMLElement>('button[data-layer="1"]')!;
    const a = front.getBoundingClientRect();
    const b = behind.getBoundingClientRect();
    const li = behind.closest<HTMLElement>("[data-poster]")!;
    // Slide the poster behind (in its own layer's pixels) until its centre is on the front one's.
    const f = 1000 / 1320;
    li.style.transform = `translate(${(a.left + a.width / 2 - (b.left + b.width / 2)) / f}px, ${(a.top + a.height / 2 - (b.top + b.height / 2)) / f}px)`;
    const x = a.left + a.width / 2;
    const y = a.top + a.height / 2;
    return document.elementFromPoint(x, y)?.closest("button")?.getAttribute("data-layer") ?? null;
  });
  expect(covered).toBe("0");
});

test("the posters near the screen have their images, whichever layer they are on, and the far ones wait", async ({ page }) => {
  await openDepth(page);
  const region = scene(page);

  // Posters whose images are not loaded yet, split by where they are on screen (a screen and more either side is "near").
  const unloaded = () =>
    region.evaluate((scroller) => {
      const height = scroller.clientHeight;
      const result = { near: 0, nearBackground: 0, far: 0, farWithoutSource: 0 };
      scroller.querySelectorAll<HTMLElement>("[data-poster]").forEach((poster) => {
        const box = poster.getBoundingClientRect();
        const images = Array.from(poster.querySelectorAll("img"));
        const near = box.bottom > -height && box.top < height * 2;
        const background = poster.querySelector("button")?.getAttribute("data-layer") !== "0";
        // The first image is the one that shows (the soft one on the layers behind).
        if (near && !(images[0].complete && images[0].naturalWidth > 0)) {
          result.near++;
          if (background) result.nearBackground++;
        }
        if (!near) {
          result.far++;
          if (images.every((image) => !image.hasAttribute("src"))) result.farWithoutSource++;
        }
      });
      return result;
    });

  await expect.poll(async () => (await unloaded()).near).toBe(0);
  // Not everything is fetched at once: posters well away from the screen have no `src` yet.
  expect((await unloaded()).farWithoutSource).toBeGreaterThan(0);

  // Scrolling to the far end (in one jump, as the rail would) brings those in, background layers included.
  await region.evaluate((scroller) => { scroller.scrollTop = scroller.scrollHeight; });
  await expect.poll(async () => (await unloaded()).near).toBe(0);
  await region.evaluate((scroller) => { scroller.scrollTop = 0; });
  await expect.poll(async () => (await unloaded()).nearBackground).toBe(0);
  // Every poster there is a poster with an image to show.
  expect(await region.locator("[data-poster] img").count()).toBeGreaterThan(20);
});

test("the rail is the bottom minimap turned on its side: nodes and ticks all centred on one line, and a node jumps to its film", async ({ page }) => {
  await openDepth(page);
  const track = page.locator("[data-depth-rail] > div");

  // The green nodes and the coloured ticks share one centre line, a hair under 11px from the track's right edge.
  const centres = await track.evaluate((element) => {
    const edge = element.getBoundingClientRect().right;
    const centre = (node: Element) => {
      const box = node.getBoundingClientRect();
      return Math.round((edge - (box.left + box.width / 2)) * 10) / 10;
    };
    return {
      nodes: [...new Set(Array.from(element.querySelectorAll("[data-rail-dot] > span"), centre))],
      ticks: [...new Set(Array.from(element.querySelectorAll("[data-rail-line] > span"), centre))],
    };
  });
  expect(centres.nodes).toHaveLength(1);
  expect(centres.ticks).toHaveLength(1);
  expect(centres.nodes[0]).toBe(centres.ticks[0]);

  // The same sizes as the bar: a node is 4 x 14, a tick 2 x 8.
  const node = (await page.locator("[data-rail-dot] > span").first().boundingBox())!;
  expect([Math.round(node.width), Math.round(node.height)]).toEqual([14, 4]);
  const tick = (await page.locator("[data-rail-line] > span").first().boundingBox())!;
  expect([Math.round(tick.width), Math.round(tick.height)]).toEqual([8, 2]);

  // Pressing a node centres its film in the middle of the screen (the layer being in front of the screen plane changes nothing).
  const dot = page.locator("[data-rail-dot]").nth(4);
  const filmId = await dot.getAttribute("data-film");
  // (The fixture's films are three months apart, closer than the nodes are tall on a short screen, so one is pressed by event.)
  await dot.dispatchEvent("click");
  const poster = scene(page).locator(`button[data-film="${filmId}"]`);
  const viewport = page.viewportSize()!;
  await expect.poll(async () => {
    const box = (await poster.boundingBox())!;
    return Math.abs(box.y + box.height / 2 - viewport.height / 2);
  }).toBeLessThan(2);
});

test("a linked period dims the posters outside it", async ({ page }) => {
  await openDepth(page, "&from=2000&to=2001");
  const region = scene(page);

  // 1990 is outside 2000-2001 (opacity fades in over a moment); 2000 is inside.
  await expect(region.locator('[data-poster="1000"]')).toHaveCSS("opacity", "0.25");
  await expect(region.locator('[data-poster="100"]')).toHaveCSS("opacity", "1");
  await expect(region.locator('[data-poster="1010"]')).toHaveCSS("opacity", "1");
});

test("a poster opens the film dialog, and Escape closes it and returns focus", async ({ page }) => {
  await openDepth(page);
  const poster = scene(page).getByRole("button", { name: FIRST_SHARED });

  await poster.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("aria-modal", "true");

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(poster).toBeFocused();
});

/** Records what the film dialog is animated with, so a test can tell a slide-out from a disappearance. */
async function recordDialogAnimations(page: Page) {
  await page.evaluate(() => {
    const seen: { role: string | null; transforms: string[] }[] = [];
    (window as unknown as { __dialogAnimations: typeof seen }).__dialogAnimations = seen;
    const animate = HTMLElement.prototype.animate;
    HTMLElement.prototype.animate = function (this: HTMLElement, keyframes, options) {
      if (this.getAttribute("role") === "dialog") {
        const frames = (keyframes ?? []) as Keyframe[];
        seen.push({ role: this.getAttribute("role"), transforms: frames.map((frame) => String(frame.transform ?? "")) });
      }
      return animate.call(this, keyframes, options);
    };
  });
  return () =>
    page.evaluate(
      () => (window as unknown as { __dialogAnimations: { role: string | null; transforms: string[] }[] }).__dialogAnimations,
    );
}

test.describe("closing the film panel slides it out", () => {
  for (const how of ["the close button", "Escape", "a press outside it"] as const) {
    test(`${how} plays the exit animation, then removes the panel and returns focus`, async ({ page }) => {
      await openDepth(page);
      const poster = scene(page).getByRole("button", { name: FIRST_SHARED });
      await poster.click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      // The slide-in has finished: whatever is recorded from here on is the exit.
      await expect.poll(() => dialog.evaluate((element) => element.getAnimations().length)).toBe(0);
      const animations = await recordDialogAnimations(page);

      if (how === "the close button") await page.getByRole("button", { name: "Close film details" }).click();
      else if (how === "Escape") await page.keyboard.press("Escape");
      else await page.mouse.click(120, 300);

      // It slides toward the edge it came from (right on a desktop) rather than just vanishing.
      await expect.poll(async () => (await animations()).flatMap((entry) => entry.transforms)).toContain("translateX(100%)");
      await expect(dialog).toBeHidden();
      await expect(poster).toBeFocused();
    });
  }
});

test("the people pill opens on a press and closes when the scene scrolls", async ({ page }) => {
  await openDepth(page);
  const button = pill(page);
  const region = scene(page);

  await expect(button).toHaveAttribute("aria-expanded", "false");
  await expect(peopleCard(page)).toHaveCount(0);
  await expect(button.locator("[data-pill-open]")).toHaveCount(0);
  // The pill carries no logo or home link, closed or open.
  const bubble = page.locator("[data-people-pill]");
  await expect(bubble).not.toContainText("Parallel");
  await expect(bubble.locator('a[href="/"]')).toHaveCount(0);

  await button.click();
  await expect(button).toHaveAttribute("aria-expanded", "true");
  const card = peopleCard(page);
  await expect(card).toBeVisible();
  // The capsule says what the card is where the heads were (they have flown into its rows).
  await expect(button.locator("[data-pill-open]")).toContainText("People");
  await expect(bubble).not.toContainText("Parallel");
  await expect(bubble.locator('a[href="/"]')).toHaveCount(0);
  await expect(card.getByRole("link", { name: "Remove Scroll Alpha", exact: true })).toHaveAttribute("href", /view=depth/);
  await expect(card.getByRole("link", { name: "Flat timeline", exact: true })).not.toHaveAttribute("href", /view=/);

  const top = await region.evaluate((element) => element.scrollTop);
  await region.evaluate((element, to) => { element.scrollTop = to; }, top + 200);
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await expect(card).toBeHidden();
  await expect(button.locator("[data-pill-open]")).toHaveCount(0);
});

test("the Flat timeline link leaves the Depth view and keeps the period", async ({ page }) => {
  await openDepth(page, "&from=2000&to=2001");
  await pill(page).click();
  await peopleCard(page).getByRole("link", { name: "Flat timeline", exact: true }).click();

  await expect(page.getByRole("tab", { name: "Timeline", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page).toHaveURL(/from=2000&to=2001/);
  expect(new URL(page.url()).searchParams.has("view")).toBe(false);
  await expect(scene(page)).toHaveCount(0);
});

test("the plain address still renders the Timeline and Table tabs", async ({ page }) => {
  await page.goto(PEOPLE_PATH);
  await expect(page.getByRole("tab", { name: "Timeline", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: "Table", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Film timeline. Scroll sideways to see more years.", exact: true })).toBeVisible();
  await expect(scene(page)).toHaveCount(0);
  await expect(page.locator("html")).not.toHaveAttribute("data-view", /.+/);
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("the rail is thin, the pill is collapsed and nothing scrolls sideways", async ({ page }) => {
    await openDepth(page);

    const railBox = (await page.locator("[data-depth-rail]").boundingBox())!;
    expect(railBox.width).toBeLessThanOrEqual(28);
    expect(railBox.x + railBox.width).toBeLessThanOrEqual(390);

    await expect(pill(page)).toHaveAttribute("aria-expanded", "false");
    await expect(peopleCard(page)).toHaveCount(0);

    const overflow = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      x: window.scrollX,
    }));
    expect(overflow).toEqual({ page: 0, x: 0 });

    // A tap opens the card, and it fits the screen.
    await pill(page).tap();
    const card = peopleCard(page);
    await expect(card).toBeVisible();
    const cardBox = (await card.boundingBox())!;
    expect(cardBox.x).toBeGreaterThanOrEqual(0);
    expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(390);
  });
});
