import { test, expect, MINOR_FILM_COUNT, PEOPLE_PATH, PIXEL } from "./fixtures";
import type { Page } from "next/experimental/testmode/playwright";

// Activate the server-side fetch fixtures before any test navigates to a people page.
test.beforeEach(async ({ next }) => { void next; });

const scene = (page: Page) => page.getByRole("region", { name: "Film timeline. Scroll down for later years.", exact: true });
const rail = (page: Page) => page.getByRole("scrollbar", { name: "Timeline position", exact: true });
const pill = (page: Page) => page.getByRole("button", { name: /^People on this page/ });
const peopleCard = (page: Page) => page.getByRole("dialog", { name: "People", exact: true });

/** The first of the fixture's shared films (2000-01-01): the scene opens with it in the middle of the screen. */
const FIRST_SHARED = /^Scroll Film 100, 2000\./;

/** The page background (`--bg`, #14181c) as 0 to 255 channels: what every poster's shadow is made of. */
const BG_RGB = [20, 24, 28];
/**
 * The colour (0 to 255 channels) and alpha of each layer of a computed `box-shadow`. Chromium writes a `color-mix` as `color(srgb r g b / a)`
 * (channels 0 to 1) and a plain colour as `rgba(r, g, b, a)`; both are read.
 */
function shadowColours(value: string): { rgb: number[]; alpha: number }[] {
  return Array.from(value.matchAll(/color\(srgb ([\d.]+) ([\d.]+) ([\d.]+) \/ ([\d.]+)\)|rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/g), (match) =>
    match[1] !== undefined
      ? { rgb: [match[1], match[2], match[3]].map((channel) => Math.round(Number(channel) * 255)), alpha: Number(match[4]) }
      : { rgb: [match[5], match[6], match[7]].map(Number), alpha: Number(match[8] ?? 1) },
  );
}

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

/**
 * "Show all films" on, in the gear, as a visitor turns it on. The scene is otherwise only the films the flat timeline gives a poster card
 * (see `postersLeftOut`), which, on the fixture's pile of own films around the collaborations of 2000 to 2002, leaves some of them out: the
 * tests of how a poster looks or is laid out, which look at the fixture's own films by id, want them all.
 */
async function showAllFilms(page: Page) {
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Settings", exact: true });
  await sheet.getByRole("checkbox", { name: "Show all films", exact: true }).check();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
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

test("the headline is at the top of where the scene lands, under the bar, mid-career, and scrolls away either way", async ({ page }) => {
  await openDepth(page);
  const region = scene(page);
  const h1 = page.getByRole("heading", { level: 1 });

  // The scene opened scrolled well past the top of the track (the first collaboration, 2000, is ten years in): the headline is not up there out of sight.
  const landed = await region.evaluate((element) => element.scrollTop);
  expect(landed).toBeGreaterThan(300);
  await expect(h1).toHaveText(/^Scroll Alpha & Scroll Beta, \d+ films$/);
  // Placed and shown (it is hidden until the scene has chosen where it lands), with nothing of it flashed at the top of the track.
  await expect(h1.locator("..").locator("..")).toHaveCSS("opacity", "1");
  const bar = (await page.locator("[data-people-bar]").getByRole("button", { name: /^People on this page/ }).boundingBox())!;
  const rest = (await h1.boundingBox())!;
  expect(rest.y).toBeGreaterThanOrEqual(bar.y + bar.height);
  expect(rest.y).toBeLessThan(bar.y + bar.height + 24);
  expect(rest.x).toBeLessThan(16);
  expect(rest.y + rest.height).toBeLessThan(150);

  // Scrolling later or earlier moves it with the content, out of sight either way.
  await region.evaluate((element, value) => {
    element.scrollTop = value;
  }, landed + 300);
  await expect.poll(async () => (await h1.boundingBox())!.y).toBeCloseTo(rest.y - 300, 1);
  expect((await h1.boundingBox())!.y + (await h1.boundingBox())!.height).toBeLessThan(0);
  await region.evaluate((element, value) => {
    element.scrollTop = value;
  }, landed - 300);
  await expect.poll(async () => (await h1.boundingBox())!.y).toBeCloseTo(rest.y + 300, 1);
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
  // Every layer's list is `preserve-3d`: a background poster's own translateZ (its obscurity's push) only takes inside one.
  expect(await region.locator("ol").evaluateAll((lists) => lists.map((list) => getComputedStyle(list).transformStyle))).toEqual([
    "preserve-3d",
    "preserve-3d",
    "preserve-3d",
  ]);
  // The shadows hang from the card's ::before: no green glow, but an outline outside the ring and layers of the page's background colour
  // (contact, tight, mid, a deep one thrown down, a wide pool all round), the heaviest in the scene. Green is only the crisp 2px ring on the poster.
  const shadow = (selector: string, pseudo = "::before") =>
    region.locator(selector).first().evaluate((card, which) => getComputedStyle(card, which).boxShadow, pseudo);
  const collabShadow = await shadow("[data-poster-card][data-collab]");
  expect(collabShadow).not.toContain("224, 84");
  const collabLayers = shadowColours(collabShadow);
  expect(collabLayers).toHaveLength(5);
  for (const layer of collabLayers) {
    expect(layer.rgb).toEqual(BG_RGB);
    expect(layer.alpha).toBeLessThanOrEqual(0.65);
  }
  // The ring's outline is the first layer: 3px, in the background colour.
  expect(collabShadow).toContain("0px 0px 0px 3px");
  expect(collabShadow).toContain("0px 29px 58px -6px");
  // Hovered, a heavier and larger one fades in over it: the same colour.
  const liftLayers = shadowColours(await shadow("[data-poster-card][data-collab]", "::after"));
  expect(liftLayers).toHaveLength(5);
  for (const layer of liftLayers) expect(layer.rgb).toEqual(BG_RGB);
  const strength = (layers: { alpha: number }[]) => layers.reduce((sum, layer) => sum + layer.alpha, 0);
  expect(strength(liftLayers)).toBeGreaterThan(strength(collabLayers));
  await expect(poster.locator("[data-poster-card] > span").first()).toHaveCSS("box-shadow", "rgb(0, 224, 84) 0px 0px 0px 2px");
  // Every poster behind has the layered drop shadow too: a tight contact shadow and a soft ambient one, fainter than a collaboration's.
  const behindShadow = await shadow("[data-poster-card]:not([data-collab])");
  expect(behindShadow).toContain("0px 1px 2px");
  expect(behindShadow).toContain("0px 6px 18px");
  const behindLayers = shadowColours(behindShadow);
  expect(behindLayers).toHaveLength(2);
  for (const layer of behindLayers) expect(layer.rgb).toEqual(BG_RGB);
  expect(strength(behindLayers)).toBeLessThan(strength(collabLayers));
  // And a light edge inside, so a dark poster has an outline against a dark one.
  const edge = await region.locator('button[data-layer="1"]').first().locator("[aria-hidden]").last().evaluate((overlay) => getComputedStyle(overlay).boxShadow);
  expect(edge).toContain("inset");

  // A background poster dragged under it does not show through: what is on top at a point of overlap is the film made together.
  const covered = await region.evaluate((scroller) => {
    const front = scroller.querySelector<HTMLElement>('button[data-layer="0"]')!;
    const behind = scroller.querySelector<HTMLElement>('button[data-layer="1"]')!;
    const a = front.getBoundingClientRect();
    const b = behind.getBoundingClientRect();
    const li = behind.closest<HTMLElement>("[data-poster]")!;
    // Slide the poster behind (in its own pixels, scaled by its own factor) until its centre is on the front one's.
    const f = Number.parseFloat(li.style.getPropertyValue("--f"));
    li.style.transform = `translate(${(a.left + a.width / 2 - (b.left + b.width / 2)) / f}px, ${(a.top + a.height / 2 - (b.top + b.height / 2)) / f}px) ${li.style.transform}`;
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

test("a page of one person has its posters at the front, big and sharp", async ({ page }) => {
  await page.goto("/p/90000001-scroll-alpha?view=depth");
  const region = scene(page);
  await expect(region).toBeVisible();
  await showAllFilms(page);

  // One layer, at the screen plane, with no soft copy of any poster and nothing blurred.
  await expect(region.locator("ol")).toHaveCount(1);
  expect(await region.locator("ol").evaluate((list) => list.style.transform)).toBe("translateZ(0px)");
  const posters = region.locator("[data-poster]");
  await expect.poll(() => posters.count()).toBeGreaterThan(20);
  const count = await posters.count();
  await expect(region.locator("[data-poster] img")).toHaveCount(count);
  const images = await region.locator("[data-poster] img").evaluateAll((all) =>
    all.map((image) => ({ source: image.getAttribute("data-src"), filter: getComputedStyle(image).filter, opacity: getComputedStyle(image).opacity })),
  );
  expect(images.every((image) => image.source?.includes("/w342/") && image.filter === "none" && image.opacity === "1")).toBe(true);
  // No obscurity cue either: every poster is opaque and level on the layer's plane, whatever the votes of its film.
  const cues = await posters.evaluateAll((all) =>
    all.map((poster) => ({ opacity: getComputedStyle(poster).opacity, transform: (poster as HTMLElement).style.transform, rest: (poster as HTMLElement).style.getPropertyValue("--rest-opacity"), f: (poster as HTMLElement).style.getPropertyValue("--f") })),
  );
  expect(cues.every((cue) => cue.opacity === "1" && !cue.transform.includes("translateZ") && cue.rest === "" && cue.f === "1")).toBe(true);

  // Big: 120 x 180 on a desktop, and, being at the screen plane, exactly where the layout puts it (level with the rail).
  const first = posters.first();
  const box = (await first.locator("button").boundingBox())!;
  expect([Math.round(box.width), Math.round(box.height)]).toEqual([120, 180]);
  const docY = await first.evaluate((poster) => parseFloat((poster as HTMLElement).style.top) + (poster as HTMLElement).offsetHeight / 2);
  const scrollTop = await region.evaluate((scroller) => scroller.scrollTop);
  expect(Math.abs(box.y + box.height / 2 - (docY - scrollTop))).toBeLessThan(1);
});

test("a linked period dims the posters outside it", async ({ page }) => {
  await openDepth(page, "&from=2000&to=2001");
  await showAllFilms(page);
  const region = scene(page);

  // 1990 is outside 2000-2001 (opacity fades in over a moment); 2000 is inside. The dimming is the whole opacity: it wins over the
  // obscurity's (1000 is the best-known background film, which at rest would be 0.8, and 1014 the most obscure, 0.45), and it does not stack under it.
  await expect(region.locator('[data-poster="1000"]')).toHaveCSS("opacity", "0.25");
  await expect(region.locator('[data-poster="1014"]')).toHaveCSS("opacity", "0.25");
  await expect(region.locator('[data-poster="1000"]')).toHaveCSS("filter", /grayscale/);
  // A film made together, inside it: 1. A film of one person's inside it: its own resting opacity, which is not 0.25 and not 1 (1010 has 9 votes).
  await expect(region.locator('[data-poster="100"]')).toHaveCSS("opacity", "1");
  await expect.poll(async () => Number(await region.locator('[data-poster="1010"]').evaluate((poster) => getComputedStyle(poster).opacity))).toBeCloseTo(0.53, 1);
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

test("a mouse drag scrolls the scene, posters included, and the click that ends it does not open the film", async ({ page }) => {
  await openDepth(page);
  const region = scene(page);
  const poster = region.getByRole("button", { name: FIRST_SHARED });
  const box = (await poster.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const state = () => region.evaluate((element) => ({ top: element.scrollTop, left: element.scrollLeft }));
  const before = await state();

  // Press on a poster and drag up 220px, drifting 80px sideways: the scene follows the pointer (grab semantics), downward only.
  await page.mouse.move(x, y);
  await expect(page.getByRole("tooltip")).toBeVisible();
  await page.mouse.down();
  await page.mouse.move(x + 80, y - 220, { steps: 12 });
  await expect(region).toHaveAttribute("data-panning", "");
  // The hover card is gone for as long as it lasts, and none opens under the pointer.
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await expect(poster).toHaveCSS("cursor", "grabbing");
  await page.mouse.up();
  await expect(region).not.toHaveAttribute("data-panning", /.*/);

  const after = await state();
  expect(after.top - before.top).toBeGreaterThan(210);
  expect(after.top - before.top).toBeLessThan(230);
  expect(after.left).toBe(before.left);
  // Released over a poster or not, a drag is not a click: no dialog.
  await page.waitForTimeout(250);
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // A drag that ends over a poster does not open it either (up 220 more, so one of the posters is under the pointer at the end).
  const target = region.locator("button[data-film]").first();
  const targetBox = (await target.boundingBox())!;
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height + 40);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(250);
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // A plain click still opens it.
  const first = region.locator("button[data-film]").first();
  await first.scrollIntoViewIfNeeded();
  await first.click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

/**
 * The fixture's last film made together (200, 2020) has no neighbour: scrolled to (the end of the axis), a poster of
 * `layer` (the first one, wherever it is) is slid under it so that half of it, the right half, is covered by a poster of a
 * nearer layer. Returns the id of the poster that was slid.
 */
async function slideBackgroundPosterUnderCollab(page: Page, layer: number) {
  await page.locator('[data-rail-dot][data-film="200"]').dispatchEvent("click");
  // The last film is too near the end of the axis to be centred: the scene scrolls to its end, and the film is on screen.
  await expect.poll(() => scene(page).evaluate((scroller) => scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop)).toBeLessThan(2);
  return scene(page).evaluate((scroller, layerNumber) => {
    const frontButton = scroller.querySelector<HTMLElement>('button[data-film="200"]')!;
    const behind = scroller.querySelector<HTMLElement>(`button[data-layer="${layerNumber}"]`)!;
    const li = behind.closest<HTMLElement>("[data-poster]")!;
    // The poster's own factor (it is pushed back within its layer by its obscurity), and its own depth is kept.
    const f = Number.parseFloat(li.style.getPropertyValue("--f"));
    const a = frontButton.getBoundingClientRect();
    const b = behind.getBoundingClientRect();
    // Its centre on the front poster's right edge: the left half is under it, the right half is exposed.
    li.style.transform =
      `translate(${(a.left + a.width * 0.9 - (b.left + b.width / 2)) / f}px, ${(a.top + a.height / 2 - (b.top + b.height / 2)) / f}px) ${li.style.transform}`;
    return behind.dataset.film!;
  }, layer);
}

/** The poster's box on screen, and where it can be hovered without a nearer poster in the way (its right edge). */
const posterBox = (page: Page, id: string) =>
  scene(page).evaluate((scroller, filmId) => {
    const box = scroller.querySelector(`button[data-film="${filmId}"]`)!.getBoundingClientRect();
    return { x: box.left + box.width / 2, y: box.top + box.height / 2, width: box.width, right: box.right };
  }, id);

/** The film of the button `elementFromPoint` finds there (null if none). */
const hitAt = (page: Page, x: number, y: number) =>
  page.evaluate(([px, py]) => document.elementFromPoint(px, py)?.closest<HTMLElement>("button")?.dataset.film ?? null, [x, y]);

/** How a poster is drawn: its `li`'s computed `--focus` and opacity, the sharp image's opacity, the card's transform and the poster's box on screen. */
const drawnAs = (page: Page, id: string) =>
  scene(page).evaluate((scroller, filmId) => {
    const li = scroller.querySelector<HTMLElement>(`[data-poster="${filmId}"]`)!;
    const sharp = li.querySelector<HTMLElement>('img[data-window="sharp"]')!;
    const card = li.querySelector<HTMLElement>("[data-poster-card]")!;
    const box = li.querySelector("button")!.getBoundingClientRect();
    return {
      pinned: li.hasAttribute("data-pinned"),
      focus: Number(getComputedStyle(li).getPropertyValue("--focus")),
      opacity: Number(getComputedStyle(li).opacity),
      sharp: Number(getComputedStyle(sharp).opacity),
      cardTransform: getComputedStyle(card).transform,
      liTransform: li.style.transform,
      box: [box.left, box.top, box.width, box.height].map((value) => Math.round(value * 100) / 100),
    };
  }, id);

test("hovering a background poster brings it to full opacity and sharpness where it is: no growth, no lift, no copy, and its card opens", async ({ page }) => {
  await openDepth(page);
  // The most obscure film of the page: 0.45 at rest and soft, on its layer's plane 320px further back.
  const centre = await scrollToCentre(page, 1014);
  const rest = await drawnAs(page, "1014");
  expect(rest).toMatchObject({ pinned: false, focus: 0 });
  expect(rest.opacity).toBeCloseTo(0.45, 2);
  expect(rest.liTransform).toBe("translateZ(-320px)");

  await page.mouse.move(centre.x, centre.y);
  await expect.poll(async () => (await drawnAs(page, "1014")).opacity).toBeCloseTo(1, 2);
  // (The sharp image fades in over 100ms.)
  await expect.poll(async () => (await drawnAs(page, "1014")).sharp).toBeCloseTo(1, 2);
  const hovered = await drawnAs(page, "1014");
  expect(hovered).toMatchObject({ pinned: true, focus: 1 });
  // Where it is: the same box, depth and card transform (none: it is not scaled or lifted), and there is no copy of it over the scene.
  expect(hovered.box).toEqual(rest.box);
  expect(hovered.liTransform).toBe(rest.liTransform);
  expect(hovered.cardTransform).toBe("none");
  await expect(page.locator("[data-pop-layer]")).toHaveCount(0);

  // The hover card still opens after its own short wait, next to the poster.
  const card = page.getByRole("tooltip");
  await expect(card).toBeVisible();
  const cardBox = (await card.boundingBox())!;
  expect(Math.abs(cardBox.x + cardBox.width / 2 - (rest.box[0] + rest.box[2] / 2))).toBeLessThan(2);

  // Leaving it lets it fall back to rest, and the card goes.
  await page.mouse.move(20, 80);
  await expect.poll(async () => (await drawnAs(page, "1014")).opacity).toBeCloseTo(0.45, 2);
  expect((await drawnAs(page, "1014")).pinned).toBe(false);
  await expect(card).toHaveCount(0);
});

test("a film made together that covers a hovered background poster still wins the overlap: the poster stays behind it", async ({ page }) => {
  await openDepth(page);
  const id = await slideBackgroundPosterUnderCollab(page, 2);
  await page.waitForTimeout(200);
  const box = await posterBox(page, id);
  // Under the film made together (200): its centre is covered, whatever is hovered.
  expect(await hitAt(page, box.x, box.y)).toBe("200");
  const rest = await drawnAs(page, id);

  // Hovered where it shows (its right edge): bright and sharp, but not forward and not bigger.
  await page.mouse.move(box.right - 4, box.y);
  await expect.poll(async () => (await drawnAs(page, id)).opacity).toBeCloseTo(1, 2);
  const hovered = await drawnAs(page, id);
  expect(hovered).toMatchObject({ pinned: true, focus: 1, cardTransform: "none", liTransform: rest.liTransform });
  expect(hovered.box).toEqual(rest.box);
  await expect(page.locator("[data-pop-layer]")).toHaveCount(0);
  // The film made together still wins `elementFromPoint` in the overlap area, hovered or not.
  expect(await hitAt(page, box.x, box.y)).toBe("200");
  expect(await hitAt(page, box.right - 4, box.y)).toBe(id);
  await expect(page.getByRole("tooltip")).toBeVisible();
});

test("a background poster opens its film on a click, and a drag that starts on it pans", async ({ page }) => {
  await openDepth(page);
  const id = await slideBackgroundPosterUnderCollab(page, 1);
  await page.waitForTimeout(200);
  const box = await posterBox(page, id);
  await page.mouse.move(box.right - 4, box.y);
  await expect.poll(async () => (await drawnAs(page, id)).pinned).toBe(true);

  // A drag that starts on it scrolls the scene and opens nothing; the poster is not left bright after the drag started.
  const before = await scene(page).evaluate((scroller) => scroller.scrollTop);
  await page.mouse.down();
  // (Down: the scene is at the end of the axis, so it can only scroll back.)
  await page.mouse.move(box.right - 4, box.y + 120, { steps: 8 });
  await page.mouse.up();
  expect(await scene(page).evaluate((scroller) => scroller.scrollTop)).toBeLessThan(before - 100);
  await page.waitForTimeout(250);
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // A click on its visible part opens the film.
  const again = await posterBox(page, id);
  await page.mouse.click(again.right - 4, again.y);
  await expect(page.getByRole("dialog")).toBeVisible();
});

/**
 * How a background poster looks, by film id: its opacity, depth (its own `translateZ` and `--f`), the blur of its soft image and
 * how far the focus field has brought it into focus. The fixture's own films have votes by index (`OWN_FILM_VOTES`): 1000 has 12,000
 * (the best-known of the page: obscurity 0), 1005 has 300, 1010 has 9 and 1014 has none (the most obscure: 1).
 */
const lookOf = (page: Page, id: number) =>
  scene(page).evaluate((scroller, filmId) => {
    const li = scroller.querySelector<HTMLElement>(`[data-poster="${filmId}"]`)!;
    // The soft image is the first one in a background poster (the sharp one is over it).
    const soft = li.querySelector<HTMLElement>("img")!;
    return {
      opacity: Number(getComputedStyle(li).opacity),
      restOpacity: Number(li.style.getPropertyValue("--rest-opacity")),
      f: Number(li.style.getPropertyValue("--f")),
      transform: li.style.transform,
      blur: Number.parseFloat(getComputedStyle(soft).filter.replace(/^blur\(/, "")),
      focus: Number(li.style.getPropertyValue("--focus")),
    };
  }, id);

/** Scrolls so that poster `id` is level with the middle of the screen (where the pointer or a phone's focus band is) and returns its centre on screen. */
const scrollToCentre = async (page: Page, id: number) => {
  await scene(page).evaluate((scroller, filmId) => {
    const li = scroller.querySelector<HTMLElement>(`[data-poster="${filmId}"]`)!;
    scroller.scrollTop = Number.parseFloat(li.style.top) + li.offsetHeight / 2 - scroller.clientHeight / 2;
  }, id);
  // The poster is at the scene's middle line, whatever its depth, and the focus loop has had a frame.
  await page.waitForTimeout(100);
  return posterBox(page, String(id));
};

test("background posters rest at 0.8 for the best-known film and fade, blur and recede as the film gets more obscure", async ({ page }) => {
  await openDepth(page);
  await showAllFilms(page);
  const [famous, middling, obscure, nothing] = await Promise.all([1000, 1005, 1010, 1014].map((id) => lookOf(page, id)));

  // The best-known background film of the page: 0.8 at rest, about 1px of blur, on its layer's plane (320px back, factor 1000/1320).
  expect(famous.opacity).toBeCloseTo(0.8, 2);
  expect(famous.blur).toBeCloseTo(1, 2);
  expect(famous.transform).toBe("translateZ(0px)");
  expect(famous.f).toBeCloseTo(1000 / 1320, 4);
  // The film with no votes: faintest (0.45), softest (3px) and furthest back (the layer's plane plus the whole spread, 320px).
  expect(nothing.opacity).toBeCloseTo(0.45, 2);
  expect(nothing.blur).toBeCloseTo(3, 2);
  expect(nothing.transform).toBe("translateZ(-320px)");
  expect(nothing.f).toBeCloseTo(1000 / 1640, 4);
  // And monotonic in between, on every cue.
  for (const [nearer, further] of [[famous, middling], [middling, obscure], [obscure, nothing]]) {
    expect(further.opacity).toBeLessThan(nearer.opacity);
    expect(further.blur).toBeGreaterThan(nearer.blur);
    expect(further.f).toBeLessThan(nearer.f);
  }
  // Out of focus: nothing has been sharpened.
  expect([famous, nothing].map((look) => look.focus)).toEqual([0, 0]);
  // The films made together are not touched: opaque, sharp (no soft image), in front.
  await expect(scene(page).locator('[data-poster="100"]')).toHaveCSS("opacity", "1");
});

test("a poster is drawn where its own depth puts it: its size and place follow its own factor, not its layer's", async ({ page }) => {
  await openDepth(page);
  const geometry = (id: number) =>
    scene(page).evaluate((scroller, filmId) => {
      const li = scroller.querySelector<HTMLElement>(`[data-poster="${filmId}"]`)!;
      const box = li.querySelector("button")!.getBoundingClientRect();
      const f = Number.parseFloat(li.style.getPropertyValue("--f"));
      const docY = Number.parseFloat(li.style.top) + li.offsetHeight / 2;
      const H = scroller.clientHeight;
      return { width: box.width, height: box.height, centreY: box.top + box.height / 2, expectedWidth: li.offsetWidth * f, expectedHeight: li.offsetHeight * f, expectedY: (docY - scroller.scrollTop) * f + (H / 2) * (1 - f) };
    }, id);
  // At the opening position and scrolled elsewhere: the parallax (the screen y as the scroll changes) is each poster's own.
  for (const scrollTop of [null, 1500, 2600]) {
    if (scrollTop !== null) await scene(page).evaluate((scroller, top) => { scroller.scrollTop = top; }, scrollTop);
    const [near, far] = await Promise.all([geometry(1000), geometry(1014)]);
    // Not the layer's factor for both: the obscure one is drawn smaller than the best-known of the same layer, as `--f` says.
    expect(far.width).toBeLessThan(near.width - 5);
    for (const g of [near, far]) {
      expect(g.width).toBeCloseTo(g.expectedWidth, 0);
      expect(g.height).toBeCloseTo(g.expectedHeight, 0);
      expect(Math.abs(g.centreY - g.expectedY)).toBeLessThan(1.5);
    }
  }
  // They drift apart as the scene scrolls (a poster further back moves slower): the two posters' screen gap is not the same at two scroll positions.
  const gap = async (top: number) => {
    await scene(page).evaluate((scroller, y) => { scroller.scrollTop = y; }, top);
    const [near, far] = await Promise.all([geometry(1000), geometry(1014)]);
    return far.centreY - near.centreY;
  };
  const [a, b] = [await gap(1200), await gap(2400)];
  expect(Math.abs(a - b)).toBeGreaterThan(20);
});

/** A point `distance` px from (x, y) with no poster under it (so hovering there brightens nothing), on the screen: the first of the directions that is free. */
const freeSpot = (page: Page, x: number, y: number, distance: number) =>
  page.evaluate(
    ([cx, cy, d]) => {
      for (const angle of [0, 180, 90, 270, 45, 135, 225, 315]) {
        const px = cx + d * Math.cos((angle * Math.PI) / 180);
        const py = cy + d * Math.sin((angle * Math.PI) / 180);
        if (px < 20 || py < 20 || px > innerWidth - 80 || py > innerHeight - 20) continue;
        if (!document.elementFromPoint(px, py)?.closest("button")) return { x: px, y: py };
      }
      return null;
    },
    [x, y, distance],
  );

test("the pointer near a poster brings it to full opacity and sharpness, whatever its obscurity, and it falls back when the pointer leaves", async ({ page }) => {
  await openDepth(page);
  const region = scene(page);
  const center = await scrollToCentre(page, 1014);
  expect((await lookOf(page, 1014)).opacity).toBeCloseTo(0.45, 2);

  // Beside it (within the field's sharp inner radius, 77px, but not on it: it is not hovered): the most obscure film is at full opacity and sharp.
  const beside = (await freeSpot(page, center.x, center.y, center.width / 2 + 24))!;
  expect(beside).not.toBeNull();
  await page.mouse.move(beside.x, beside.y);
  await expect.poll(async () => (await lookOf(page, 1014)).focus).toBeGreaterThan(0.99);
  await expect.poll(async () => (await lookOf(page, 1014)).opacity).toBeCloseTo(1, 2);
  // (The sharp image fades in over 100ms.)
  await expect.poll(() => region.locator('[data-poster="1014"] img[data-window="sharp"]').evaluate((image) => Number(getComputedStyle(image).opacity))).toBeCloseTo(1, 2);
  await expect(scene(page).locator("[data-pinned]")).toHaveCount(0);

  // Far from every poster: back to rest, 0.45.
  await page.mouse.move(20, 80);
  await expect.poll(async () => (await lookOf(page, 1014)).focus).toBe(0);
  await expect.poll(async () => (await lookOf(page, 1014)).opacity).toBeCloseTo(0.45, 2);

  // Partway (within the radius, 220px, but outside the inner one): between rest and 1, in step with the focus.
  const best = await scrollToCentre(page, 1000);
  const away = (await freeSpot(page, best.x, best.y, 150))!;
  expect(away).not.toBeNull();
  await page.mouse.move(away.x, away.y);
  await expect.poll(async () => (await lookOf(page, 1000)).focus).toBeGreaterThan(0.2);
  // (Opacity follows the focus over a moment, so it is polled until they agree: rest + (1 - rest) focus.)
  await expect
    .poll(async () => {
      const look = await lookOf(page, 1000);
      return Math.abs(look.opacity - (look.restOpacity + (1 - look.restOpacity) * look.focus));
    })
    .toBeLessThan(0.01);
  const partway = await lookOf(page, 1000);
  expect(partway.focus).toBeLessThan(0.9);
  expect(partway.opacity).toBeGreaterThan(0.8);
  expect(partway.opacity).toBeLessThan(1);
  await page.mouse.move(20, 80);
  await expect.poll(async () => (await lookOf(page, 1000)).opacity).toBeCloseTo(0.8, 2);

  // On it: the poster is pinned bright (the field's own writes do not undo it), and a move on it keeps it so.
  const on = await scrollToCentre(page, 1014);
  await page.mouse.move(on.x, on.y);
  await expect.poll(async () => (await drawnAs(page, "1014")).focus).toBe(1);
  await page.mouse.move(on.x + 1, on.y + 1);
  await expect.poll(async () => (await lookOf(page, 1014)).focus).toBeGreaterThan(0.99);
  expect((await drawnAs(page, "1014")).pinned).toBe(true);
});

test("keyboard focus brightens a background poster too, and reduced motion applies it at once and keeps it where it is", async ({ page, browserName }) => {
  // Safari's Tab key skips buttons unless the visitor has turned that on (Option+Tab otherwise): there is no keyboard focus to show.
  test.skip(browserName === "webkit", "Tab does not focus buttons in Safari by default");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openDepth(page);
  const poster = scene(page).locator('button[data-layer="1"]').first();
  await poster.focus();
  // Only keyboard focus shows (a script's focus counts as one when nothing was clicked before it).
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  const li = poster.locator("xpath=ancestor::li");
  await expect(li).toHaveAttribute("data-pinned", "");
  // Keyboard focus takes the poster to full opacity and fully sharp, whatever its resting one (the first of layer 1 is the best-known: 0.8).
  await expect(li).toHaveCSS("opacity", "1");
  const id = (await poster.getAttribute("data-film"))!;
  expect(await drawnAs(page, id)).toMatchObject({ pinned: true, focus: 1, opacity: 1, sharp: 1, cardTransform: "none" });
  // No copy of it, and nothing eased: the opacity and the sharp image change at once.
  await expect(page.locator("[data-pop-layer]")).toHaveCount(0);
  await expect(li).toHaveCSS("transition-duration", "0s");
  await expect(li.locator('img[data-window="sharp"]')).toHaveCSS("transition-property", "none");
});

/**
 * Scrolls so that the centre of film `id`'s poster is `distance` px (on screen, down is positive) from the middle line of the screen,
 * and waits a frame for the focus loop.
 */
const scrollToOffset = async (page: Page, id: number, distance: number) => {
  await scene(page).evaluate(
    (scroller, [filmId, d]) => {
      const li = scroller.querySelector<HTMLElement>(`[data-poster="${filmId}"]`)!;
      const f = Number.parseFloat(li.style.getPropertyValue("--f"));
      scroller.scrollTop = Number.parseFloat(li.style.top) + li.offsetHeight / 2 - scroller.clientHeight / 2 - d / f;
    },
    [id, distance],
  );
  await page.waitForTimeout(100);
};

/**
 * The label of a film made together (`Title, Year`, one run of text under its poster, highlighted), or null: the opacity of its block, the title's
 * and the year's colour alpha (the comma has the title's), its travel and text.
 */
const captionOf = (page: Page, id: string) =>
  scene(page).evaluate((scroller, filmId) => {
    const li = scroller.querySelector<HTMLElement>(`[data-poster="${filmId}"]`)!;
    const labels = Array.from(li.querySelectorAll<HTMLElement>("[data-poster-caption]"));
    // Exactly one: a film made together has one label, any other none.
    if (labels.length !== 1) return null;
    const label = labels[0]!;
    const line = getComputedStyle(label.querySelector<HTMLElement>("[data-caption-line]")!);
    const chip = getComputedStyle(label.querySelector<HTMLElement>("[data-caption-chip]")!);
    const year = getComputedStyle(label.querySelector<HTMLElement>("[data-caption-year]")!);
    return {
      labels: 1,
      opacity: Number(line.opacity),
      // The alpha of the title's colour: 0.9 at rest, 1 while the poster is hovered or has keyboard focus.
      titleAlpha: Number(/\/ ([\d.]+)\)$/.exec(chip.color)?.[1] ?? 1),
      yearAlpha: Number(/\/ ([\d.]+)\)$/.exec(year.color)?.[1] ?? 1),
      transform: line.transform,
      transition: line.transitionProperty,
      ariaHidden: label.getAttribute("aria-hidden"),
      text: label.textContent,
      // The highlighted text's box: the union of its lines' bands.
      box: (({ left, top, width, height }) => [left, top, width, height])(label.querySelector("[data-caption-chip]")!.getBoundingClientRect()),
      marked: li.hasAttribute("data-caption"),
    };
  }, id);

/** Every label in the scene is there in full: opaque, not nudged, with no scrim behind it, and never marked or hidden by anything the focus loop does. */
const allCaptionsShown = (page: Page) =>
  scene(page).evaluate((scroller) =>
    Array.from(scroller.querySelectorAll<HTMLElement>("[data-poster]"), (li) => {
      const labels = Array.from(li.querySelectorAll<HTMLElement>("[data-poster-caption]"));
      const lines = labels.map((label) => getComputedStyle(label.querySelector<HTMLElement>("[data-caption-line]")!));
      return {
        labels: labels.length,
        opacities: lines.map((line) => Number(line.opacity)),
        transforms: lines.map((line) => line.transform),
        // The radial scrim is gone: the highlight on the text is the background now.
        scrim: labels.map((label) => getComputedStyle(label, "::before").content),
        marked: li.hasAttribute("data-caption"),
      };
    }).filter((one) => one.labels > 0),
  );

/** What `allCaptionsShown` finds for a label that is all there: one, opaque, in place, with no scrim, unmarked. */
const SHOWN = { labels: 1, opacities: [1], transforms: ["none"], scrim: ["none"], marked: false };

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * For every film made together: its poster's box, the bands of its label's highlight (screen px: one per line of the label), the year's box, how
 * the highlight is painted (an inline box that repeats its background, padding and corners per line) and the colours of the title, the comma and the year.
 */
const labelGeometry = (page: Page) =>
  scene(page).evaluate((scroller) => {
    const rect = (element: Element): Rect => {
      const { left, top, right, bottom } = element.getBoundingClientRect();
      return { left, top, right, bottom };
    };
    return Array.from(scroller.querySelectorAll<HTMLElement>("[data-poster]"), (li) => {
      const label = li.querySelector<HTMLElement>("[data-poster-caption]");
      const chip = label?.querySelector<HTMLElement>("[data-caption-chip]");
      const year = label?.querySelector<HTMLElement>("[data-caption-year]");
      const tail = label?.querySelector<HTMLElement>("[data-caption-tail]");
      if (!label || !chip || !year || !tail) return null;
      const style = getComputedStyle(chip);
      return {
        id: li.dataset.poster!,
        // The poster's column in the layout (steps from the centre line, `--col`): films in one column are `h + collabGap` apart.
        column: li.style.getPropertyValue("--col"),
        poster: rect(li.querySelector("[data-poster-card]")!),
        label: rect(label),
        // The highlight's box: the union of its bands, and each band on its own (a wrapped label has a band per line, each as wide as its words).
        chip: rect(chip),
        bands: Array.from(chip.getClientRects(), ({ left, top, right, bottom }): Rect => ({ left, top, right, bottom })),
        year: rect(year),
        // The lines the comma-and-year is on: one, so it never splits (it is two boxes on that line, the comma's text and the year's span).
        tailLines: new Set(Array.from(tail.getClientRects(), (box) => Math.round(box.top))).size,
        background: style.backgroundColor,
        titleColour: style.color,
        commaColour: getComputedStyle(tail).color,
        yearColour: getComputedStyle(year).color,
        paint: {
          display: style.display,
          // `box-decoration-break` (the prefixed one too: a browser that has only that one answers on it).
          decorationBreak: style.getPropertyValue("box-decoration-break") || style.getPropertyValue("-webkit-box-decoration-break"),
          paddingX: [style.paddingLeft, style.paddingRight],
          paddingY: [style.paddingTop, style.paddingBottom],
          radius: style.borderTopLeftRadius,
        },
        pointerEvents: getComputedStyle(label).pointerEvents,
        position: getComputedStyle(label).position,
      };
    }).filter((one) => one !== null);
  });

const overlap = (a: Rect, b: Rect, tolerance = 0.5) =>
  a.left < b.right - tolerance && b.left < a.right - tolerance && a.top < b.bottom - tolerance && b.top < a.bottom - tolerance;

/** The channels and alpha of a computed `rgb(a)` colour. */
const channelsOf = (colour: string) => {
  const match = /rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/.exec(colour);
  return match ? { rgb: [match[1], match[2], match[3]].map(Number), alpha: Number(match[4] ?? 1) } : null;
};

/**
 * The label is `Title, Year` under the poster, centred, on a highlight that is on the text itself (an inline box, near-black and nearly opaque, that
 * repeats its background per line): the title in the strong colour (and the comma with it) and the year in the muted one. It is no wider than its cap (the
 * poster's width, a tenth more on a desktop), inside the left edge and left of the rail, and no label of a film made together lies on another's label or poster.
 */
async function expectLabelsClear(page: Page) {
  const films = await labelGeometry(page);
  expect(films.length).toBeGreaterThan(1);
  const { width, rail } = await scene(page).evaluate((scroller) => ({ width: window.innerWidth, rail: Number.parseFloat(getComputedStyle(scroller).getPropertyValue("--rail")) }));
  const cap = width >= 1024 ? 1.1 : 1;
  for (const film of films) {
    // Below the bottom edge, a few px of air (6px laid out, scaled by the layer and the screen), and centred on the poster; nothing above it.
    expect(film.bands.length).toBeGreaterThanOrEqual(1);
    expect(film.bands.length).toBeLessThanOrEqual(3);
    expect(film.bands[0]!.top).toBeGreaterThan(film.poster.bottom + 3);
    expect(film.bands[0]!.top - film.poster.bottom).toBeLessThan(10);
    expect(film.label.top).toBeGreaterThan(film.poster.bottom);
    // (The bands of a wrapped label are centred as the lines of text are, but each line's band also holds the 6px of padding that a line break does not reserve
    // room for on the inner side, so the union can sit a few px off centre and a few px wider than the cap.)
    expect(Math.abs((film.chip.left + film.chip.right) / 2 - (film.poster.left + film.poster.right) / 2)).toBeLessThanOrEqual(4);
    // Wider than the poster by no more than the cap, and on the screen: inside the left edge, left of the rail.
    expect(film.chip.right - film.chip.left).toBeLessThanOrEqual((film.poster.right - film.poster.left) * cap + 6.5);
    expect(film.chip.left).toBeGreaterThanOrEqual(0);
    expect(film.chip.right).toBeLessThanOrEqual(width - rail);
    // Near-black and nearly opaque.
    const colour = channelsOf(film.background)!;
    expect(colour.alpha).toBeGreaterThanOrEqual(0.85);
    for (const channel of colour.rgb) expect(channel).toBeLessThanOrEqual(24);
    // The title and the year differ in colour, and the comma has the title's.
    expect(film.titleColour).not.toBe(film.yearColour);
    expect(film.commaColour).toBe(film.titleColour);
    // The background is on the inline text (not a block around the label), cloned onto every line: each line has its own band, with its own padding and corners.
    expect(film.paint.display).toBe("inline");
    expect(film.paint.decorationBreak).toBe("clone");
    expect(film.paint.paddingX).toEqual(["6px", "6px"]);
    expect(film.paint.paddingY).toEqual(["2px", "2px"]);
    expect(film.paint.radius).toBe("4px");
    // The comma and the year are one piece: never split over two lines, and the year is in the last band.
    expect(film.tailLines).toBe(1);
    const last = film.bands.at(-1)!;
    expect(film.year.left).toBeGreaterThanOrEqual(last.left - 0.5);
    expect(film.year.right).toBeLessThanOrEqual(last.right + 0.5);
    // Out of the layout: positioned absolutely, and the pointer goes through it.
    expect(film.position).toBe("absolute");
    expect(film.pointerEvents).toBe("none");
  }
  // No label lies on another film's label or poster. Films in one column of the layout are held apart by `DEPTH.collabGap`, which is what has room for
  // the labels; films in different columns are apart across the page, except where the stage is too narrow for the columns and the scene clamps them
  // together (the fixture packs eight films into under two years, so on a phone a few columns collapse into one): that is the stage's, not the labels'.
  // So the films are checked where they share a column or where their posters are apart across the page.
  let checked = 0;
  for (const a of films) {
    for (const b of films) {
      if (a.id >= b.id) continue;
      const acrossApart = a.poster.right <= b.poster.left + 0.5 || b.poster.right <= a.poster.left + 0.5;
      if (a.column !== b.column && !acrossApart) continue;
      if (a.column === b.column) checked += 1;
      const boxesA = [...a.bands.map((band, index) => [`label ${index}`, band] as const), ["poster", a.poster] as const];
      const boxesB = [...b.bands.map((band, index) => [`label ${index}`, band] as const), ["poster", b.poster] as const];
      for (const [nameA, boxA] of boxesA) {
        for (const [nameB, boxB] of boxesB) {
          expect(overlap(boxA, boxB), `${a.id} ${nameA} on ${b.id} ${nameB}`).toBe(false);
        }
      }
    }
  }
  expect(checked).toBeGreaterThan(0);
}

test("only the films made together have a label, `Title, Year` under the poster, always showing, and it does not touch the poster's box", async ({ page }) => {
  await openDepth(page);
  const region = scene(page);

  // The films made together have one, under the poster and nowhere else; the posters behind have none, ever.
  await expect(region.locator("[data-poster-caption]")).toHaveCount(9);
  await expect(region.locator('li:has(button:not([data-layer="0"])) [data-poster-caption]')).toHaveCount(0);
  await expect(region.locator('li:has(button[data-layer="0"]) [data-poster-caption]')).toHaveCount(9);
  // Shown at rest, with no pointer on anything: opaque, in its place (no travel), and for the screen readers the poster's label already says it all.
  const rest = await Promise.all([100, 101, 107, 200].map((id) => captionOf(page, String(id))));
  for (const caption of rest) {
    expect(caption).toMatchObject({ labels: 1, opacity: 1, transform: "none", ariaHidden: "true", marked: false });
    // The title is a little under full strength until its poster is hovered.
    expect(caption!.titleAlpha).toBeCloseTo(0.9, 2);
  }
  expect(rest[0]!.text).toBe("Scroll Film 100, 2000");
  // All nine, wherever their posters are (the scene is scrolled to the first collaboration, so most are off screen).
  const everyone = await allCaptionsShown(page);
  expect(everyone).toHaveLength(9);
  for (const caption of everyone) expect(caption).toEqual(SHOWN);
  await expect(region.locator("[data-caption]")).toHaveCount(0);

  // Out of the poster's box: the poster is the same size with its label as it would be without (136 x 204, drawn a ninth larger).
  const geometry = await region.evaluate((scroller) => {
    const li = scroller.querySelector<HTMLElement>('[data-poster="100"]')!;
    const box = li.querySelector("button")!.getBoundingClientRect();
    return { liW: li.offsetWidth, liH: li.offsetHeight, boxH: box.height };
  });
  expect([geometry.liW, geometry.liH]).toEqual([136, 204]);
  expect(Math.round(geometry.boxH)).toBe(227);
  // Under the bottom edge, centred, no wider than its cap, on a near-black highlight, the title and the year in two colours, and none on another film's poster or label.
  await expectLabelsClear(page);
});

/**
 * Puts `title` in the label of film 100 (a leaf of the page's own markup, which nothing re-renders; the fixture's titles are short) and measures it:
 * the bands of the highlight, the year's box, the lines the comma-and-year is on, and whether the text is cut short anywhere.
 */
const wrapOf = (page: Page, title: string) =>
  scene(page).evaluate((scroller, text) => {
    const li = scroller.querySelector<HTMLElement>('[data-poster="100"]')!;
    const chip = li.querySelector<HTMLElement>("[data-caption-chip]")!;
    chip.firstChild!.textContent = text;
    const line = li.querySelector<HTMLElement>("[data-caption-line]")!;
    const lineStyle = getComputedStyle(line);
    const chipStyle = getComputedStyle(chip);
    const rect = ({ left, top, right, bottom, width, height }: DOMRect) => ({ left, top, right, bottom, width, height });
    const bands = Array.from(chip.getClientRects(), rect);
    return {
      bands,
      poster: rect(li.querySelector("[data-poster-card]")!.getBoundingClientRect()),
      year: rect(li.querySelector("[data-caption-year]")!.getBoundingClientRect()),
      tailLines: new Set(Array.from(li.querySelector("[data-caption-tail]")!.getClientRects(), (box) => Math.round(box.top))).size,
      centre: rect(chip.getBoundingClientRect()),
      // Cut short by nothing: no ellipsis, no line clamp, no clipping, and the block is as tall as its lines.
      textOverflow: [lineStyle.textOverflow, chipStyle.textOverflow],
      lineClamp: [lineStyle.getPropertyValue("-webkit-line-clamp"), lineStyle.getPropertyValue("line-clamp")],
      overflow: [lineStyle.overflowX, lineStyle.overflowY],
      clipped: line.scrollHeight > line.clientHeight + 1 || line.scrollWidth > line.clientWidth + 1,
      lineHeight: Number.parseFloat(lineStyle.lineHeight),
      scale: li.querySelector("[data-poster-card]")!.getBoundingClientRect().height / li.offsetHeight,
    };
  }, title);

test("a label too long for one line wraps, highlighted line by line, with nothing cut short, and the year stays with its comma on the last line", async ({ page }) => {
  await openDepth(page);
  // One line: a short title is one band, one line tall.
  const one = await wrapOf(page, "Kundun");
  expect(one.bands).toHaveLength(1);
  expect(one.bands[0]!.height).toBeGreaterThan(15 * one.scale);
  expect(one.bands[0]!.height).toBeLessThan(24 * one.scale);
  expect(one.clipped).toBe(false);

  // Two lines: a title that does not fit with its year has a band per line, each as wide as its own words (not one rectangle round the label), centred on the poster,
  // a hairline apart, and the comma and the year (one piece) in the last, with nothing cut short.
  const two = await wrapOf(page, "Who's That Knocking at My Door");
  expect(two.bands).toHaveLength(2);
  expect(two.tailLines).toBe(1);
  expect(new Set(two.bands.map((band) => Math.round(band.width))).size).toBeGreaterThan(1);
  for (const [index, band] of two.bands.entries()) {
    expect(band.width).toBeGreaterThan(0);
    expect(band.height).toBeGreaterThan(0);
    // Centred on the poster (give or take the padding a break does not reserve room for), and no wider than the cap (the poster's width, a tenth more on a desktop, and that padding).
    expect(Math.abs(band.left + band.width / 2 - (two.poster.left + two.poster.right) / 2)).toBeLessThanOrEqual(4);
    expect(band.width).toBeLessThanOrEqual(two.poster.width * 1.1 + 6.5);
    if (index === 0) continue;
    // The band below starts under the band above, a hairline off it (never over it: the line-height is more than the band's height).
    const gap = band.top - two.bands[index - 1]!.bottom;
    expect(gap).toBeGreaterThan(0);
    expect(gap).toBeLessThan(3);
  }
  const last = two.bands.at(-1)!;
  expect(two.year.left).toBeGreaterThanOrEqual(last.left - 0.5);
  expect(two.year.right).toBeLessThanOrEqual(last.right + 0.5);
  expect(two.year.top).toBeGreaterThanOrEqual(last.top - 0.5);
  expect(two.year.bottom).toBeLessThanOrEqual(last.bottom + 0.5);
  // Nothing is cut short: no ellipsis, no line clamp, no clipping.
  expect(two.textOverflow).toEqual(["clip", "clip"]);
  expect(two.lineClamp.every((value) => value === "none" || value === "")).toBe(true);
  expect(two.overflow).toEqual(["visible", "visible"]);
  expect(two.clipped).toBe(false);

  // A title far too long for two lines goes on to a third and further, whole, the year still in the last band and the bands never over each other.
  const many = await wrapOf(page, "An Extraordinarily Long Title That Would Surely Take Far More Than Two Lines To Set At This Width, Truly");
  expect(many.bands.length).toBeGreaterThan(2);
  expect(many.tailLines).toBe(1);
  expect(many.clipped).toBe(false);
  expect(many.textOverflow).toEqual(["clip", "clip"]);
  for (const [index, band] of many.bands.entries()) {
    if (index > 0) expect(band.top).toBeGreaterThanOrEqual(many.bands[index - 1]!.bottom);
  }
  const lastMany = many.bands.at(-1)!;
  expect(many.year.left).toBeGreaterThanOrEqual(lastMany.left - 0.5);
  expect(many.year.right).toBeLessThanOrEqual(lastMany.right + 0.5);
});

test("a caption is showing wherever its poster is on the screen: scrolled to the middle, the end, or back", async ({ page }) => {
  await openDepth(page);
  for (const [id, distance] of [[100, 0], [100, 120], [100, -250], [200, 0], [107, 0], [100, 0]] as const) {
    await scrollToOffset(page, id, distance);
    // On screen (the poster is within the viewport's height of the middle line) and fully there, with no hover and nothing marked.
    const caption = (await captionOf(page, String(id)))!;
    expect(caption).toMatchObject({ opacity: 1, transform: "none", marked: false });
    const { top, bottom } = await scene(page).evaluate((scroller, filmId) => {
      const boxes = Array.from(scroller.querySelectorAll(`[data-poster="${filmId}"] [data-poster-caption]`), (label) => label.getBoundingClientRect());
      return { top: Math.min(...boxes.map((box) => box.top)), bottom: Math.max(...boxes.map((box) => box.bottom)) };
    }, id);
    expect(bottom).toBeGreaterThan(0);
    expect(top).toBeLessThan(page.viewportSize()!.height);
    for (const one of await allCaptionsShown(page)) expect(one).toEqual(SHOWN);
  }
});

test("hovering a film made together brightens its title a little and moves nothing, and leaving puts it back", async ({ page }) => {
  await openDepth(page);
  const poster = scene(page).getByRole("button", { name: FIRST_SHARED });
  const before = (await captionOf(page, "100"))!;
  expect(before).toMatchObject({ opacity: 1 });
  expect(before.titleAlpha).toBeCloseTo(0.9, 2);

  await poster.hover();
  await expect.poll(async () => (await captionOf(page, "100"))!.titleAlpha).toBeCloseTo(1, 2);
  // Only the title's colour: both lines stay opaque, in place, and the year is as it was.
  const hovered = (await captionOf(page, "100"))!;
  expect(hovered).toMatchObject({ opacity: 1, transform: "none", yearAlpha: before.yearAlpha });
  expect(hovered.box).toEqual(before.box);
  // The labels are over and under the poster but the pointer is only ever on the poster (they take no pointer events).
  expect(await scene(page).evaluate((scroller) => Array.from(scroller.querySelectorAll("[data-poster-caption]"), (label) => getComputedStyle(label).pointerEvents))).toEqual(
    Array(9).fill("none"),
  );

  // Back to what it was when the pointer leaves.
  await page.mouse.move(20, 300);
  await expect.poll(async () => (await captionOf(page, "100"))!.titleAlpha).toBeCloseTo(0.9, 2);
  expect(await captionOf(page, "100")).toMatchObject({ opacity: 1 });
});

test("the hover card of a film made together opens below its label and covers neither it nor the poster", async ({ page }) => {
  // Tall enough for the card (about 240px) to fit under the label of the poster in the middle of the screen.
  await page.setViewportSize({ width: 1440, height: 900 });
  await openDepth(page);
  await scene(page).getByRole("button", { name: FIRST_SHARED }).hover();
  const card = page.getByRole("tooltip");
  await expect(card).toBeVisible();
  // The card slides up into place as it opens (translateY of 10px to none, 160ms): wait for it to settle.
  await page.waitForTimeout(300);
  const cardBox = (await card.boundingBox())!;
  const film = (await labelGeometry(page)).find((one) => one.id === "100")!;
  // Below the label (with the card's usual 10px of air under the anchor), and centred on the poster.
  expect(cardBox.y).toBeGreaterThanOrEqual(film.label.bottom + 8);
  expect(cardBox.y).toBeLessThanOrEqual(film.label.bottom + 14);
  expect(cardBox.x + cardBox.width / 2).toBeCloseTo((film.poster.left + film.poster.right) / 2, 0);
  const cardRect = { left: cardBox.x, top: cardBox.y, right: cardBox.x + cardBox.width, bottom: cardBox.y + cardBox.height };
  for (const band of film.bands) expect(overlap(cardRect, band)).toBe(false);
  expect(overlap(cardRect, film.poster)).toBe(false);
});

test("keyboard focus brightens the title of a film made together too", async ({ page, browserName }) => {
  // Safari's Tab key skips buttons unless the visitor has turned that on (Option+Tab otherwise): there is no keyboard focus to show.
  test.skip(browserName === "webkit", "Tab does not focus buttons in Safari by default");
  await openDepth(page);
  const poster = scene(page).getByRole("button", { name: FIRST_SHARED });
  expect((await captionOf(page, "100"))!.titleAlpha).toBeCloseTo(0.9, 2);
  await poster.focus();
  // Only keyboard focus counts (a script's focus counts as one when nothing was clicked before it).
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(poster).toBeFocused();
  await expect.poll(async () => (await captionOf(page, "100"))!.titleAlpha).toBeCloseTo(1, 2);
  expect(await captionOf(page, "100")).toMatchObject({ opacity: 1 });
});

test("with reduced motion the caption is showing at rest and the title brightens at once: no transition", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openDepth(page);
  const poster = scene(page).getByRole("button", { name: FIRST_SHARED });
  expect(await captionOf(page, "100")).toMatchObject({ opacity: 1, transform: "none", transition: "none" });
  await poster.hover();
  await expect.poll(async () => (await captionOf(page, "100"))!.titleAlpha).toBeCloseTo(1, 2);
  expect(await captionOf(page, "100")).toMatchObject({ opacity: 1, transform: "none", transition: "none" });
  await page.mouse.move(20, 300);
  await expect.poll(async () => (await captionOf(page, "100"))!.titleAlpha).toBeCloseTo(0.9, 2);
});

/** The closed pill's outline (the capsule): it is there closed, and faded away while the card is open. */
const capsule = (page: Page) => page.locator("[data-pill-capsule]");
/** What the open pill puts over the capsule: the field to add a person, and the close button to its right. */
const openBar = (page: Page) => page.locator("[data-pill-open]");
const pillSearch = (page: Page) => openBar(page).getByRole("combobox", { name: "Add a person", exact: true });
const pillClose = (page: Page) => openBar(page).getByRole("button", { name: "Close people", exact: true });

/** Answers the page's search requests: Scroll Beta is already on the page, Scroll Gamma is not. */
async function mockSearch(page: Page, results = [
  { id: 90000002, name: "Scroll Beta", profilePath: null, knownFor: "Acting", knownForTitles: ["Scroll Film 100"] },
  { id: 90000003, name: "Scroll Gamma", profilePath: null, knownFor: "Acting", knownForTitles: ["Scroll Film 1000"] },
]) {
  await page.route("**/api/search?*", (route) => route.fulfill({ json: { results } }));
}

test("the people pill opens on a press and closes when the scene scrolls", async ({ page }) => {
  await openDepth(page);
  const button = pill(page);
  const region = scene(page);

  await expect(button).toHaveAttribute("aria-expanded", "false");
  await expect(peopleCard(page)).toHaveCount(0);
  await expect(page.locator("[data-pill-open]")).toHaveCount(0);
  // The pill carries no logo or home link, closed or open.
  const bubble = page.locator("[data-people-pill]");
  await expect(bubble).not.toContainText("Parallel");
  await expect(bubble.locator('a[href="/"]')).toHaveCount(0);

  await button.click();
  await expect(button).toHaveAttribute("aria-expanded", "true");
  const card = peopleCard(page);
  await expect(card).toBeVisible();
  // The heads have flown into the card's rows; over the pill are the field to add a person and the close button.
  await expect(pillSearch(page)).toBeVisible();
  await expect(openBar(page)).toHaveCount(1);
  await expect(pillClose(page)).toBeVisible();
  await expect(bubble).not.toContainText("Parallel");
  await expect(bubble.locator('a[href="/"]')).toHaveCount(0);
  await expect(card.getByRole("link", { name: "Remove Scroll Alpha", exact: true })).toHaveAttribute("href", /view=depth/);
  // The way back to the flat page is the layout control and the views, in the bar: not in the card.
  await expect(card.getByRole("link", { name: "Flat timeline", exact: true })).toHaveCount(0);

  const top = await region.evaluate((element) => element.scrollTop);
  await region.evaluate((element, to) => { element.scrollTop = to; }, top + 200);
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await expect(card).toBeHidden();
  await expect(page.locator("[data-pill-open]")).toHaveCount(0);
});

test("the open pill is the app's usual search field, boxed, with the close button outside it and no capsule around them, and no search is left in the card", async ({ page }) => {
  await openDepth(page);
  await expect(capsule(page)).toHaveCSS("opacity", "1");
  await pill(page).click();
  const card = peopleCard(page);
  await expect(card).toBeVisible();
  const search = pillSearch(page);
  await expect(search).toBeVisible();

  // The card is the people and the key to the green: no field.
  await expect(card.getByRole("combobox")).toHaveCount(0);
  await expect(card.locator("input")).toHaveCount(0);
  await expect(page.getByRole("combobox")).toHaveCount(1);
  await expect(card.getByText("Green: made together", { exact: true })).toBeVisible();

  // The field is the flat page's own: a box with a border, a surface fill, `rounded-md`, the search icon and the placeholder.
  const box = search.locator("xpath=ancestor::div[contains(@class, 'rounded-md')][1]");
  const style = await box.evaluate((element) => {
    const css = getComputedStyle(element);
    return { border: css.borderTopWidth, radius: css.borderTopLeftRadius, background: css.backgroundColor, icon: element.querySelectorAll("svg").length, rounded: css.borderTopLeftRadius };
  });
  expect(style.border).toBe("1px");
  expect(style.radius).toBe("6px");
  expect(channelsOf(style.background)!.alpha).toBe(1);
  expect(style.icon).toBeGreaterThan(0);
  await expect(search).toHaveAttribute("placeholder", /^Add a person/);

  // It spans the card's width with the close button, a square of its own, just to its right: outside the field, level with its middle, and 8px off it.
  await expect.poll(async () => (await openBar(page).boundingBox())!.width).toBeCloseTo((await card.boundingBox())!.width, 0);
  const field = (await box.boundingBox())!;
  const close = (await pillClose(page).boundingBox())!;
  const below = (await card.boundingBox())!;
  expect(Math.abs(field.x - below.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(close.x + close.width - (below.x + below.width))).toBeLessThanOrEqual(1);
  expect(close.x).toBeGreaterThanOrEqual(field.x + field.width + 6);
  expect(close.x).toBeLessThanOrEqual(field.x + field.width + 10);
  expect(Math.abs(close.width - close.height)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(close.y + close.height / 2 - (field.y + field.height / 2))).toBeLessThanOrEqual(1);
  expect(close.height).toBeGreaterThanOrEqual(field.height - 1);
  expect(await box.evaluate((element, button) => element.contains(button), await pillClose(page).elementHandle())).toBe(false);
  // The close button is a box of its own too.
  expect(await pillClose(page).evaluate((element) => ({ radius: getComputedStyle(element).borderTopLeftRadius, border: getComputedStyle(element).borderTopWidth }))).toEqual({ radius: "6px", border: "1px" });
  // Above the card, and the card is where it was.
  expect(field.y + field.height).toBeLessThanOrEqual(below.y);

  // No capsule behind them: the pill's outline is faded away (nothing is left of its border), and the row the field and the button stand in has no box of its own.
  await expect(capsule(page)).toHaveCSS("opacity", "0");
  const row = await openBar(page).evaluate((element) => {
    const css = getComputedStyle(element);
    return { border: css.borderTopWidth, background: css.backgroundColor, radius: css.borderTopLeftRadius, shadow: css.boxShadow, filter: css.backdropFilter };
  });
  expect(row).toEqual({ border: "0px", background: "rgba(0, 0, 0, 0)", radius: "0px", shadow: "none", filter: "none" });
  // Nothing rounded-full is painted behind the field or the button but the faded pill: the elements at their middles are the field's and the button's own.
  const behind = await page.evaluate(
    ([a, b]) => [document.elementFromPoint(a!.x, a!.y)?.closest("[data-pill-capsule]") !== null, document.elementFromPoint(b!.x, b!.y)?.closest("[data-pill-capsule]") !== null],
    [
      { x: field.x + field.width / 2, y: field.y + field.height / 2 },
      { x: close.x + close.width / 2, y: close.y + close.height / 2 },
    ],
  );
  expect(behind).toEqual([false, false]);
});

test("the pill's outline and the field are never on screen together: the outline is gone before the field fades in, and comes back after it has faded out", async ({ page }) => {
  await openDepth(page);
  // The timings of the fades (a frame after the press, once the animations have been made): when each starts and ends, in ms from the press.
  const fades = (action: string) =>
    page.evaluate(async (selector) => {
      document.querySelector<HTMLElement>(selector)!.click();
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const of = (target: Element | null) => {
        const own = document.getAnimations().filter((animation) => (animation.effect as KeyframeEffect).target === target);
        const timings = own.map((animation) => animation.effect!.getComputedTiming());
        return { start: Math.min(...timings.map((timing) => Number(timing.delay))), end: Math.max(...timings.map((timing) => Number(timing.endTime))), count: own.length };
      };
      return { capsule: of(document.querySelector("[data-pill-capsule]")), bar: of(document.querySelector("[data-pill-open]")) };
    }, action);

  const opening = await fades('[aria-label^="People on this page"]');
  expect(opening.capsule.count).toBe(1);
  expect(opening.bar.count).toBe(1);
  expect(opening.capsule.end).toBeLessThanOrEqual(opening.bar.start);
  await expect(peopleCard(page)).toBeVisible();
  await page.waitForTimeout(500);

  const closing = await fades('[aria-label="Close people"]');
  expect(closing.capsule.count).toBe(1);
  expect(closing.bar.count).toBe(1);
  expect(closing.bar.end).toBeLessThanOrEqual(closing.capsule.start);
  await expect(peopleCard(page)).toBeHidden();
  await expect(capsule(page)).toHaveCSS("opacity", "1");
});

test("opening the pill focuses the search, and typing in it does not close the pill", async ({ page }) => {
  await mockSearch(page);
  await openDepth(page);
  const button = pill(page);
  await button.click();
  const search = pillSearch(page);
  await expect(search).toBeFocused();

  await search.pressSequentially("scroll", { delay: 30 });
  await expect(page.getByRole("option")).toHaveCount(2);
  await expect(search).toHaveValue("scroll");
  await expect(search).toBeFocused();
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await expect(peopleCard(page)).toBeVisible();

  // The dropdown hangs below the field and draws over the card, not under it.
  const gamma = page.getByRole("option", { name: /Scroll Gamma/ });
  const hit = await gamma.evaluate((element) => {
    const { x, y, width, height } = element.getBoundingClientRect();
    return document.elementFromPoint(x + width / 2, y + height / 2)?.closest('[role="option"]')?.textContent ?? null;
  });
  expect(hit).toContain("Scroll Gamma");
  const field = (await search.locator("xpath=ancestor::div[contains(@class, 'rounded-md')][1]").boundingBox())!;
  const firstOption = (await page.getByRole("option").first().boundingBox())!;
  expect(firstOption.y).toBeGreaterThanOrEqual(field.y + field.height);
  // As wide as the field, which is as wide as the card less the close button.
  expect(Math.abs(firstOption.x - field.x)).toBeLessThanOrEqual(1);
  await expect(button).toHaveAttribute("aria-expanded", "true");
});

test("Escape dismisses what the search holds first, and on an empty field closes the pill", async ({ page }) => {
  await mockSearch(page);
  await openDepth(page);
  const button = pill(page);
  await button.click();
  const search = pillSearch(page);
  await expect(search).toBeFocused();

  await search.pressSequentially("scroll", { delay: 30 });
  await expect(page.getByRole("option")).toHaveCount(2);
  // The dropdown first, then the text; the pill stays open and the field keeps focus.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("option")).toHaveCount(0);
  await expect(search).toHaveValue("scroll");
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(search).toHaveValue("");
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await expect(search).toBeFocused();

  // Nothing left to dismiss: it closes, and focus goes back to the pill's button.
  await page.keyboard.press("Escape");
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await expect(peopleCard(page)).toBeHidden();
  await expect(button).toBeFocused();
});

test("Escape on the empty field closes the pill at once", async ({ page }) => {
  await openDepth(page);
  const button = pill(page);
  await button.click();
  await expect(pillSearch(page)).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await expect(peopleCard(page)).toBeHidden();
  await expect(button).toBeFocused();
  await expect(page.locator("[data-pill-open]")).toHaveCount(0);

  // And it opens again, with the field focused again.
  await button.click();
  await expect(pillSearch(page)).toBeFocused();
});

test("a press on the dropdown is not an outside press, and the close button and an outside press still close the pill", async ({ page }) => {
  await mockSearch(page, []);
  await openDepth(page);
  const button = pill(page);
  await button.click();
  const search = pillSearch(page);
  await search.pressSequentially("zzz", { delay: 30 });
  const none = page.getByText("No one found for", { exact: false });
  await expect(none).toBeVisible();

  await none.click();
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await expect(search).toBeFocused();

  // The close button, to the right of the field, closes it and puts focus back on the pill.
  await pillClose(page).click();
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await expect(peopleCard(page)).toBeHidden();
  await expect(button).toBeFocused();
  await expect(capsule(page)).toHaveCSS("opacity", "1");

  // A press on the scene outside the pill closes it too.
  await button.click();
  await expect(search).toBeVisible();
  await page.mouse.click(1000, 30);
  await expect(button).toHaveAttribute("aria-expanded", "false");
});

test("picking a person from the pill's search adds them and stays in the Depth view", async ({ page }) => {
  await mockSearch(page);
  await openDepth(page);
  await pill(page).click();
  const search = pillSearch(page);
  await search.fill("scroll");
  await page.getByRole("option", { name: /Scroll Gamma/ }).click();

  await expect(page).toHaveURL(/\/p\/90000001-scroll-alpha\+90000002-scroll-beta\+90000003-scroll-gamma\?view=depth/);
  await expect(scene(page)).toBeVisible();
});

test("a viewport resize (a phone's keyboard opening) does not close the pill, even if the browser moves the scene with it", async ({ page }) => {
  await openDepth(page);
  const button = pill(page);
  const region = scene(page);
  await button.click();
  await expect(pillSearch(page)).toBeFocused();

  await page.setViewportSize({ width: 1440, height: 300 });
  // Browsers re-fit and may scroll the scene while the viewport changes; that is not the visitor scrolling.
  await region.evaluate((element) => { element.scrollTop += 200; });
  await page.waitForTimeout(150);
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await page.waitForTimeout(700);
  await page.setViewportSize({ width: 1440, height: 600 });
  await region.evaluate((element) => { element.scrollTop -= 120; });
  await page.waitForTimeout(700);
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await expect(pillSearch(page)).toBeFocused();

  // A real scroll afterwards still closes it.
  await region.evaluate((element) => { element.scrollTop += 200; });
  await expect(button).toHaveAttribute("aria-expanded", "false");
});

// ---- the way to the rest of the interface: views, layout, settings and share -------------------------------------

const layoutGroup = (page: Page) => page.getByRole("group", { name: "Timeline layout", exact: true });
const settingsGear = (page: Page) => page.getByRole("button", { name: "Settings", exact: true });
const settingsSheet = (page: Page) => page.getByRole("dialog", { name: "Settings", exact: true });
const minorToggle = (page: Page) => settingsSheet(page).getByRole("checkbox", { name: /Show shorts, music videos, cameos and uncredited/ });
const depthViews = (page: Page) => page.getByRole("navigation", { name: "Views", exact: true });

test("the bar has the views beside the pill, with Timeline current, and the layout control and the gear at the right, clear of the rail", async ({ page }) => {
  await openDepth(page);
  const views = depthViews(page);
  // Timeline | Table, in the flat page's order and words (the fixture pair has no quotes, so no Clippings, as on the flat page).
  await expect(views.getByRole("link")).toHaveText(["Timeline", "Table"]);
  await expect(views.getByRole("link", { name: "Timeline", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(views.getByRole("link", { name: "Clippings", exact: true })).toHaveCount(0);

  // To the right of the pill, on its level; and the controls are left of the rail with room to spare, the layout control then the gear.
  const pillBox = (await pill(page).boundingBox())!;
  const viewsBox = (await views.boundingBox())!;
  expect(viewsBox.x).toBeGreaterThan(pillBox.x + pillBox.width);
  expect(Math.abs(viewsBox.y + viewsBox.height / 2 - (pillBox.y + pillBox.height / 2))).toBeLessThan(4);
  const railBox = (await page.locator("[data-depth-rail]").boundingBox())!;
  const toggleBox = (await layoutGroup(page).boundingBox())!;
  const gearBox = (await settingsGear(page).boundingBox())!;
  expect(toggleBox.x + toggleBox.width).toBeLessThan(gearBox.x);
  expect(gearBox.x + gearBox.width).toBeLessThanOrEqual(railBox.x - 8);

  // Focus is the layout this page is in; Combined leaves for the flat timeline. (Lanes are parked: see `LANES_ENABLED`.)
  await expect(layoutGroup(page).getByRole("button")).toHaveCount(2);
  await expect(layoutGroup(page).getByRole("button", { name: "Focus view", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(layoutGroup(page).getByRole("button", { name: "Combined timeline", exact: true })).toHaveAttribute("aria-pressed", "false");
  await expect(layoutGroup(page).getByRole("button", { name: "Separate lanes", exact: true })).toHaveCount(0);
});

test("the Table link lands on the table, with the people and the period", async ({ page }) => {
  await openDepth(page, "&from=2000&to=2001");
  await depthViews(page).getByRole("link", { name: "Table", exact: true }).click();

  await expect(page.getByRole("tab", { name: "Table", exact: true })).toHaveAttribute("aria-selected", "true");
  // The flat page's own address for the table (`view=table`), the period kept.
  expect(Object.fromEntries(new URL(page.url()).searchParams)).toEqual({ view: "table", from: "2000", to: "2001" });
  expect(new URL(page.url()).pathname).toBe("/p/90000001-scroll-alpha+90000002-scroll-beta");
  await expect(scene(page)).toHaveCount(0);
  await expect(page.locator("html")).not.toHaveAttribute("data-view", /.+/);
  await expect(page.getByRole("table")).toBeVisible();
});

test("the layout control round-trips Focus, Combined, Focus, and the period goes along each way", async ({ page }) => {
  await openDepth(page, "&from=2000&to=2001");
  await layoutGroup(page).getByRole("button", { name: "Combined timeline", exact: true }).click();

  // The flat Timeline, in the combined layout, with the same control: Combined is the one pressed there.
  await expect(page.getByRole("tab", { name: "Timeline", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(layoutGroup(page).getByRole("button", { name: "Combined timeline", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(layoutGroup(page).getByRole("button", { name: "Focus view", exact: true })).toHaveAttribute("aria-pressed", "false");
  await expect(page).toHaveURL(/\?from=2000&to=2001$/);
  await expect(scene(page)).toHaveCount(0);

  await layoutGroup(page).getByRole("button", { name: "Focus view", exact: true }).click();
  await expect(scene(page)).toBeVisible();
  await expect(page).toHaveURL(/\?from=2000&to=2001&view=depth$/);
  await expect(layoutGroup(page).getByRole("button", { name: "Focus view", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("html")).toHaveAttribute("data-view", "depth");
});

// Lanes are parked (`LANES_ENABLED` in `src/lib/film-prefs.ts` is false): the layout control offers Focus and Combined only, and the flat
// timeline is always the one combined track. The test below is the lanes round trip for when the flag is turned on; it is skipped, not
// deleted, because the browser cannot flip a build-time constant. (The unit tests turn the option on with `LayoutToggle`'s `lanes` prop.)
test.skip("Lanes opens the flat timeline in separate lanes, and leaving it for Focus and coming back to Combined puts the lanes away (parked with the lanes: LANES_ENABLED)", async ({ page }) => {
  await openDepth(page);
  await layoutGroup(page).getByRole("button", { name: "Separate lanes", exact: true }).click();
  await expect(layoutGroup(page).getByRole("button", { name: "Separate lanes", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(layoutGroup(page).getByRole("button", { name: "Combined timeline", exact: true })).toHaveAttribute("aria-pressed", "false");

  // The layout is held, as the settings are: Focus and back to the flat page is Lanes still.
  await layoutGroup(page).getByRole("button", { name: "Focus view", exact: true }).click();
  await expect(scene(page)).toBeVisible();
  await layoutGroup(page).getByRole("button", { name: "Combined timeline", exact: true }).click();
  await expect(layoutGroup(page).getByRole("button", { name: "Combined timeline", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("there is no Lanes option, in the Focus bar or on the flat timeline, and Combined is what the flat timeline opens in", async ({ page }) => {
  await openDepth(page);
  await expect(layoutGroup(page).getByRole("button", { name: "Separate lanes", exact: true })).toHaveCount(0);
  await layoutGroup(page).getByRole("button", { name: "Combined timeline", exact: true }).click();
  await expect(layoutGroup(page).getByRole("button", { name: "Combined timeline", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(layoutGroup(page).getByRole("button")).toHaveCount(2);
  await expect(layoutGroup(page).getByRole("button", { name: "Separate lanes", exact: true })).toHaveCount(0);
});

test("the flat Timeline's layout control reaches Focus, with the period", async ({ page }) => {
  await page.goto(`${PEOPLE_PATH}?from=2000&to=2001`);
  await expect(layoutGroup(page).getByRole("button", { name: "Combined timeline", exact: true })).toHaveAttribute("aria-pressed", "true");
  await layoutGroup(page).getByRole("button", { name: "Focus view", exact: true }).click();
  await expect(scene(page)).toBeVisible();
  await expect(page).toHaveURL(/\?from=2000&to=2001&view=depth$/);
});

test("the gear opens the flat page's settings and Share: Show all films is off, as on the flat page, and the period is in Share", async ({ page }) => {
  await openDepth(page);
  await settingsGear(page).click();
  const sheet = settingsSheet(page);
  await expect(sheet).toBeVisible();

  // "Show all films" is the flat page's checkbox, with its words and its hint, off to begin with and free to change: both settings are off.
  const showAll = sheet.getByRole("checkbox", { name: "Show all films", exact: true });
  await expect(showAll).not.toBeChecked();
  await expect(showAll).toBeEnabled();
  await expect(showAll).toHaveAccessibleDescription("Give every film a poster, adding rows as needed.");
  await expect(minorToggle(page)).not.toBeChecked();
  // The views and the layout control are on the bar from `sm`: the sheet has them for a phone only.
  await expect(sheet.getByRole("navigation", { name: "Views", exact: true })).toBeHidden();

  // Share is the flat page's own menu, with its Period years.
  await sheet.getByRole("button", { name: "Share", exact: true }).click();
  await expect(sheet.getByRole("menuitem", { name: "Copy link", exact: true })).toBeVisible();
  await expect(sheet.getByRole("menuitem", { name: /^Post on X/ })).toBeVisible();
  await expect(sheet.getByRole("combobox", { name: "From year", exact: true })).toBeVisible();
  // The card's years are the shared films' (2000 to 2020), so the whole span is no period: 2001 is one.
  await sheet.getByRole("combobox", { name: "From year", exact: true }).selectOption("2001");
  await expect(page).toHaveURL(/from=2001&to=2020/);
  // Escape closes the menu first, then the sheet.
  await page.keyboard.press("Escape");
  await expect(sheet.getByRole("menuitem", { name: "Copy link", exact: true })).toBeHidden();
  await expect(sheet).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(settingsGear(page)).toBeFocused();
});

test("turning on minor credits in the gear adds them as background posters, faint and far back, and turning it off takes them away", async ({ page }) => {
  await openDepth(page);
  // Every film, so that the count of what the minor toggle adds is the minor films alone (the cap's own effect is the tests' below).
  await showAllFilms(page);
  const posters = scene(page).locator("button[data-film]");
  const before = await posters.count();
  const centreBefore = await scene(page).evaluate((scroller) => scroller.scrollTop + scroller.clientHeight / 2);

  await settingsGear(page).click();
  await minorToggle(page).check();
  await expect.poll(() => posters.count()).toBe(before + MINOR_FILM_COUNT);
  await expect(scene(page).locator('[data-poster="1100"]')).toHaveCount(1);

  // Each is a background poster at least as faint as the 0.5 that "minor" asks, whatever its 9,000 votes, and further back than the film of
  // the same person that is as well known (1001, 5,200 votes). The one both people have is not a film made together: it is on its first person's layer.
  for (const id of [1100, 1102, 2100, 300]) {
    const look = await lookOf(page, id);
    expect(look.opacity).toBeLessThan(0.55);
    expect(look.opacity).toBeGreaterThanOrEqual(0.45);
    expect(look.blur).toBeGreaterThan(2);
  }
  expect((await lookOf(page, 1100)).f).toBeLessThan((await lookOf(page, 1001)).f);
  await expect(scene(page).locator('[data-poster="300"] button')).not.toHaveAttribute("data-layer", "0");
  await expect(scene(page).locator('[data-poster="300"] [data-poster-caption]')).toHaveCount(0);

  // The sheet stays open while the setting changes, and the year in the middle of the screen stays there.
  await expect(settingsSheet(page)).toBeVisible();
  const centreAfter = await scene(page).evaluate((scroller) => scroller.scrollTop + scroller.clientHeight / 2);
  expect(Math.abs(centreAfter - centreBefore)).toBeLessThan(2);

  await minorToggle(page).uncheck();
  await expect.poll(() => posters.count()).toBe(before);
  await expect(scene(page).locator('[data-poster="1100"]')).toHaveCount(0);
});

/** The ids of the posters in the scene. */
const posterIds = async (page: Page) =>
  (await scene(page).locator("[data-poster]").evaluateAll((all) => all.map((poster) => Number((poster as HTMLElement).dataset.poster)))).sort((a, b) => a - b);

/** On the flat timeline: every film's id, and those it leaves as a bare node (no poster card) while "Show all films" is off. */
async function flatFilms(page: Page) {
  const track = page.getByRole("region", { name: "Film timeline. Scroll sideways to see more years.", exact: true });
  const ids = (selector: string) =>
    track.locator(selector).evaluateAll((all) => [...new Set(all.map((element) => Number(element.getAttribute("data-film"))))].sort((a, b) => a - b));
  return { all: await ids("[data-film]"), nodes: await ids("[data-film-node]") };
}

test("with Show all films off, Focus has a poster for the films the flat timeline gives a card and none for the ones it leaves as nodes, with minor credits off or on", async ({ page }) => {
  // The flat page first: its films, and the ones it leaves as nodes, with the minor credits off and on.
  await page.goto(PEOPLE_PATH);
  await expect(page.getByRole("button", { name: "Combined timeline", exact: true })).toHaveAttribute("aria-pressed", "true");
  const flatOff = await flatFilms(page);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const flatDialog = page.getByRole("dialog", { name: "Settings", exact: true });
  await expect(flatDialog.getByRole("checkbox", { name: "Show all films", exact: true })).not.toBeChecked();
  await flatDialog.getByRole("checkbox", { name: /Show shorts, music videos, cameos and uncredited/ }).check();
  await page.keyboard.press("Escape");
  await expect.poll(async () => (await flatFilms(page)).all.length).toBe(flatOff.all.length + MINOR_FILM_COUNT);
  const flatOn = await flatFilms(page);
  // The fixture is built to have some of each: films that fit the two rows and films that do not.
  expect(flatOff.nodes.length).toBeGreaterThan(0);
  expect(flatOff.nodes.length).toBeLessThan(flatOff.all.length);
  expect(flatOn.nodes.length).toBeGreaterThan(flatOff.nodes.length);

  // Focus, with both settings carried over (the minor credits on, Show all films off): a poster for every film that has a card there.
  await layoutGroup(page).getByRole("button", { name: "Focus view", exact: true }).click();
  await expect(scene(page)).toBeVisible();
  const withCard = (flat: { all: number[]; nodes: number[] }) => flat.all.filter((id) => !flat.nodes.includes(id));
  await expect.poll(() => posterIds(page)).toEqual(withCard(flatOn));

  // Minor credits off: the same, against the flat page's own set with them off.
  await settingsGear(page).click();
  await minorToggle(page).uncheck();
  await expect.poll(() => posterIds(page)).toEqual(withCard(flatOff));

  // Show all films on: every film of the page. On with the minor credits on, too.
  await settingsSheetShowAll(page).check();
  await expect.poll(() => posterIds(page)).toEqual(flatOff.all);
  await minorToggle(page).check();
  await expect.poll(() => posterIds(page)).toEqual(flatOn.all);

  // And off again, back to the films that have a card.
  await settingsSheetShowAll(page).uncheck();
  await expect.poll(() => posterIds(page)).toEqual(withCard(flatOn));
});

const settingsSheetShowAll = (page: Page) => settingsSheet(page).getByRole("checkbox", { name: "Show all films", exact: true });

test("Show all films in Focus changes the number of posters, never the films made together, and keeps the year at the middle of the screen", async ({ page }) => {
  await openDepth(page);
  const posters = scene(page).locator("[data-poster]");
  const togetherIds = async () =>
    (await scene(page).locator("ol").first().locator("[data-poster]").evaluateAll((all) => all.map((poster) => (poster as HTMLElement).dataset.poster))).sort();
  const fewer = await posters.count();
  const together = await togetherIds();
  const centreBefore = await scene(page).evaluate((scroller) => scroller.scrollTop + scroller.clientHeight / 2);

  await settingsGear(page).click();
  await expect(settingsSheetShowAll(page)).not.toBeChecked();
  await settingsSheetShowAll(page).check();
  await expect.poll(() => posters.count()).toBeGreaterThan(fewer);
  // The films made together keep their posters either way: they are placed first, ahead of the cap.
  expect(await togetherIds()).toEqual(together);
  // The sheet stays open, and the year in the middle of the screen stays there.
  await expect(settingsSheet(page)).toBeVisible();
  const centreAfter = await scene(page).evaluate((scroller) => scroller.scrollTop + scroller.clientHeight / 2);
  expect(Math.abs(centreAfter - centreBefore)).toBeLessThan(2);

  await settingsSheetShowAll(page).uncheck();
  await expect.poll(() => posters.count()).toBe(fewer);
});

test("Show all films is shared with the flat page, as the minor credits are", async ({ page }) => {
  await openDepth(page);
  await settingsGear(page).click();
  await settingsSheetShowAll(page).check();
  await page.keyboard.press("Escape");
  await layoutGroup(page).getByRole("button", { name: "Combined timeline", exact: true }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const flatDialog = page.getByRole("dialog", { name: "Settings", exact: true });
  await expect(flatDialog.getByRole("checkbox", { name: "Show all films", exact: true })).toBeChecked();
  // Off here: Focus has it off too.
  await flatDialog.getByRole("checkbox", { name: "Show all films", exact: true }).uncheck();
  await page.keyboard.press("Escape");
  await layoutGroup(page).getByRole("button", { name: "Focus view", exact: true }).click();
  await expect(scene(page)).toBeVisible();
  await settingsGear(page).click();
  await expect(settingsSheetShowAll(page)).not.toBeChecked();
});

test("a setting made in the gear is there on the flat page, and the other way round", async ({ page }) => {
  await openDepth(page);
  await settingsGear(page).click();
  await minorToggle(page).check();
  await page.keyboard.press("Escape");
  await layoutGroup(page).getByRole("button", { name: "Combined timeline", exact: true }).click();

  const flatSettings = page.getByRole("button", { name: "Settings", exact: true });
  await flatSettings.click();
  const flatDialog = page.getByRole("dialog", { name: "Settings", exact: true });
  await expect(flatDialog.getByRole("checkbox", { name: /Show shorts, music videos, cameos and uncredited/ })).toBeChecked();
  // Turn it off here; Focus has it off too.
  await flatDialog.getByRole("checkbox", { name: /Show shorts, music videos, cameos and uncredited/ }).uncheck();
  await page.keyboard.press("Escape");
  await layoutGroup(page).getByRole("button", { name: "Focus view", exact: true }).click();
  await expect(scene(page)).toBeVisible();
  await settingsGear(page).click();
  await expect(minorToggle(page)).not.toBeChecked();
});

test("a different set of people starts over with the settings off", async ({ page }) => {
  await mockSearch(page);
  await openDepth(page);
  await settingsGear(page).click();
  await minorToggle(page).check();
  await page.keyboard.press("Escape");

  await pill(page).click();
  await pillSearch(page).fill("scroll");
  await page.getByRole("option", { name: /Scroll Gamma/ }).click();
  await expect(page).toHaveURL(/scroll-gamma\?view=depth/);
  await expect(scene(page)).toBeVisible();
  await settingsGear(page).click();
  await expect(minorToggle(page)).not.toBeChecked();
});

test("a page of one person offers Focus and the flat Timeline, and nothing about lanes", async ({ page }) => {
  await page.goto("/p/90000001-scroll-alpha?view=depth");
  await expect(scene(page)).toBeVisible();
  await expect(layoutGroup(page).getByRole("button")).toHaveCount(2);
  await expect(layoutGroup(page).getByRole("button", { name: "Separate lanes", exact: true })).toHaveCount(0);
  await layoutGroup(page).getByRole("button", { name: "Timeline", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Timeline", exact: true })).toHaveAttribute("aria-selected", "true");
  // The flat page of one person has the same control, to come back.
  await expect(layoutGroup(page).getByRole("button", { name: "Focus view", exact: true })).toBeVisible();
  await expect(scene(page)).toHaveCount(0);
});

const homeLink = (page: Page) => page.getByRole("link", { name: "Parallel home", exact: true });

test("the home pill is the first thing in the bar: a small link to the landing page, before the people pill, on its level, and it stays when the pill opens", async ({ page }) => {
  await openDepth(page);
  const home = homeLink(page);
  await expect(home).toBeVisible();
  await expect(home).toHaveAttribute("href", "/");
  // The app's wordmark, in a pill of its own: "Parallel" with the two green l's.
  await expect(home).toHaveText("Parallel");
  await expect(home.locator(".text-accent-green")).toHaveText("ll");
  const homeBox = (await home.boundingBox())!;
  // Pill-shaped: the corners are rounded past half the height.
  expect(await home.evaluate((el) => parseFloat(getComputedStyle(el).borderTopLeftRadius))).toBeGreaterThanOrEqual(homeBox.height / 2);
  const pillBox = (await pill(page).boundingBox())!;
  // At the far left of the bar, then the people pill (the open card hangs from the pill's own left edge), nothing between or over.
  expect(homeBox.x).toBeLessThanOrEqual(16);
  expect(homeBox.x + homeBox.width).toBeLessThan(pillBox.x);
  expect(Math.abs(homeBox.y + homeBox.height / 2 - (pillBox.y + pillBox.height / 2))).toBeLessThan(4);
  expect(homeBox.height).toBeLessThan(pillBox.height);

  // It does not sit under the open pill's field and card, so it has no need to step aside.
  await pill(page).click();
  await expect(pillSearch(page)).toBeVisible();
  await expect(home).toBeVisible();
  const field = (await pillSearch(page).boundingBox())!;
  expect(field.x).toBeGreaterThan(homeBox.x + homeBox.width);
  const card = (await peopleCard(page).boundingBox())!;
  expect(card.x).toBeGreaterThan(homeBox.x + homeBox.width);
});

for (const width of [640, 768, 1024, 1440]) {
  test(`the bar's controls never overlap, home pill included, at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await openDepth(page);
    const boxes = new Map<string, { x: number; y: number; width: number; height: number }>();
    for (const [name, locator] of [
      ["home", homeLink(page)],
      ["pill", pill(page)],
      ["views", depthViews(page)],
      ["layout", layoutGroup(page)],
      ["gear", settingsGear(page)],
      ["rail", page.locator("[data-depth-rail]")],
    ] as const) {
      await expect(locator).toBeVisible();
      boxes.set(name, (await locator.boundingBox())!);
    }
    const names = [...boxes.keys()];
    for (const [i, a] of names.entries()) {
      for (const b of names.slice(i + 1)) {
        const [boxA, boxB] = [boxes.get(a)!, boxes.get(b)!];
        const apart = boxA.x + boxA.width <= boxB.x || boxB.x + boxB.width <= boxA.x || boxA.y + boxA.height <= boxB.y || boxB.y + boxB.height <= boxA.y;
        expect(apart, `${a} and ${b} overlap`).toBe(true);
      }
    }
    // Left to right: home, people, views, then the layout control and the gear, clear of the rail; and the page does not scroll sideways.
    const order = ["home", "pill", "views", "layout", "gear", "rail"].map((name) => boxes.get(name)!.x);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  });
}

test("while the pill is open the bar's other controls step aside: nothing is under its field", async ({ page }) => {
  await openDepth(page);
  await expect(depthViews(page)).toBeVisible();
  await pill(page).click();
  await expect(pillSearch(page)).toBeVisible();
  await expect(depthViews(page)).toBeHidden();
  await expect(settingsGear(page)).toBeHidden();
  await page.keyboard.press("Escape");
  await expect(pill(page)).toHaveAttribute("aria-expanded", "false");
  await expect(depthViews(page)).toBeVisible();
  await expect(settingsGear(page)).toBeVisible();
});

test("until its image arrives a poster is the dark surface tinted with its person's colour (green for a film made together), and the image arrives without moving anything", async ({ page }) => {
  // Every poster image is held back until the test lets go: the connection is as slow as it gets.
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("https://image.tmdb.org/**", async (route) => {
    await gate;
    await route.fulfill({ contentType: "image/png", body: PIXEL }).catch(() => {});
  });
  try {
    // The page's load waits for images that are in the markup, so it is the scene that is waited for.
    await page.goto(`${PEOPLE_PATH}?view=depth`, { waitUntil: "domcontentloaded" });
    await expect(scene(page)).toBeVisible();
    await expect.poll(async () => Number(await rail(page).getAttribute("aria-valuenow"))).toBeGreaterThan(0);
    await showAllFilms(page);
    // A jump (as along the rail) to posters whose images were not asked for before it.
    await scrollToCentre(page, 1011);

    const onScreen = () =>
      scene(page).evaluate((scroller) =>
        [...scroller.querySelectorAll<HTMLElement>("[data-poster]")]
          .map((li) => {
            const box = li.getBoundingClientRect();
            const face = li.querySelector<HTMLElement>("[data-poster-face]")!;
            // A `color-mix` computes to `color(srgb r g b)` with channels 0 to 1, a plain colour to `rgb(r, g, b)`.
            const colour = getComputedStyle(face).backgroundColor;
            const [r, g, b] = colour.match(/[\d.]+/g)!.slice(0, 3).map((channel) => Math.round(Number(channel) * (colour.startsWith("color(") ? 255 : 1)));
            return {
              id: li.dataset.poster!,
              layer: Number(li.querySelector("button")!.dataset.layer),
              box: [box.left, box.top, box.width, box.height].map((value) => Math.round(value * 2) / 2),
              loaded: [...li.querySelectorAll("img")].some((img) => img.complete && img.naturalWidth > 0),
              visible: box.bottom > 0 && box.top < innerHeight && box.right > 0 && box.left < innerWidth,
              fill: { r, g, b },
            };
          })
          .filter((poster) => poster.visible),
      );
    const waiting = await onScreen();
    expect(waiting.length).toBeGreaterThan(4);
    expect(waiting.some((poster) => poster.loaded)).toBe(false);

    // The surface is #202830 (32, 40, 48); each kind of poster is tinted a little towards its colour and no more.
    const fillOf = (layer: number) => waiting.find((poster) => poster.layer === layer)!.fill;
    const collab = fillOf(0);
    expect(collab.g).toBeGreaterThan(collab.r + 25);
    expect(collab.g).toBeGreaterThan(collab.b + 8);
    const first = fillOf(1);
    expect(first.b).toBeGreaterThan(first.r + 15);
    const second = fillOf(2);
    expect(second.r).toBeGreaterThan(second.b + 3);
    for (const { r, g, b } of [collab, first, second]) {
      expect(Math.max(Math.abs(r - 32), Math.abs(g - 40), Math.abs(b - 48))).toBeLessThan(45);
      expect([r, g, b]).not.toEqual([32, 40, 48]);
    }

    // The images arrive: no poster has moved or changed size.
    release();
    await expect.poll(async () => (await onScreen()).filter((poster) => !poster.loaded).length).toBe(0);
    const arrived = await onScreen();
    for (const poster of waiting) expect(arrived.find((other) => other.id === poster.id)?.box).toEqual(poster.box);
  } finally {
    release();
  }
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

    // A tap on a poster opens its film and makes no hover (a finger has none).
    const poster = scene(page).locator("button[data-film]").first();
    await poster.scrollIntoViewIfNeeded();
    await poster.tap();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(scene(page).locator("[data-pinned]")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();

    // A tap opens the card, and it and the bar over the pill (the field, and the close button to its right) fit the screen.
    await pill(page).tap();
    const card = peopleCard(page);
    await expect(card).toBeVisible();
    const cardBox = (await card.boundingBox())!;
    expect(cardBox.x).toBeGreaterThanOrEqual(0);
    expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(390);
    await expect(pillSearch(page)).toBeFocused();
    // The bar spans the card's width, with the field boxed (`rounded-md`, a border) and the close button, a square of its own, outside it.
    await expect.poll(async () => (await openBar(page).boundingBox())!.width).toBeCloseTo(cardBox.width, 0);
    const barBox = (await openBar(page).boundingBox())!;
    expect(barBox.x).toBeGreaterThanOrEqual(0);
    expect(barBox.x + barBox.width).toBeLessThanOrEqual(390);
    const box = pillSearch(page).locator("xpath=ancestor::div[contains(@class, 'rounded-md')][1]");
    const field = (await box.boundingBox())!;
    const close = (await pillClose(page).boundingBox())!;
    expect(field.x).toBeGreaterThanOrEqual(barBox.x);
    expect(close.x).toBeGreaterThanOrEqual(field.x + field.width + 6);
    expect(close.x + close.width).toBeLessThanOrEqual(barBox.x + barBox.width + 0.5);
    expect(Math.abs(close.width - close.height)).toBeLessThanOrEqual(0.5);
    expect(await box.evaluate((element) => ({ border: getComputedStyle(element).borderTopWidth, radius: getComputedStyle(element).borderTopLeftRadius }))).toEqual({ border: "1px", radius: "6px" });
    await expect(capsule(page)).toHaveCSS("opacity", "0");
  });

  test("the bar is the heads and the gear alone, and the gear's sheet holds the views, the layout, the settings and Share", async ({ page }) => {
    await openDepth(page);

    // No tabs and no layout control on the bar: the heads at the left and the gear at the right, clear of the pill, the rail and the edges.
    await expect(depthViews(page)).toBeHidden();
    await expect(layoutGroup(page)).toBeHidden();
    const pillBox = (await pill(page).boundingBox())!;
    const gearBox = (await settingsGear(page).boundingBox())!;
    const railBox = (await page.locator("[data-depth-rail]").boundingBox())!;
    expect(gearBox.x).toBeGreaterThan(pillBox.x + pillBox.width + 8);
    expect(gearBox.x + gearBox.width).toBeLessThanOrEqual(railBox.x - 4);
    expect(gearBox.y).toBeGreaterThanOrEqual(0);

    await settingsGear(page).tap();
    const sheet = settingsSheet(page);
    await expect(sheet).toBeVisible();
    // The view links, as on the flat page (the fixture pair has no Clippings), with Timeline the current one.
    const views = sheet.getByRole("navigation", { name: "Views", exact: true });
    await expect(views.getByRole("link")).toHaveText(["Timeline", "Table"]);
    await expect(views.getByRole("link", { name: "Timeline", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(views.getByRole("link", { name: "Table", exact: true })).toHaveAttribute("href", /view=table/);
    // The layout control, with its words, then the settings and Share.
    await expect(sheet.getByRole("button", { name: "Focus view", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(sheet.getByRole("button", { name: "Combined timeline", exact: true })).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Separate lanes", exact: true })).toHaveCount(0);
    await expect(minorToggle(page)).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Share", exact: true })).toBeVisible();

    // The sheet fits the screen, over neither the rail nor an edge, and nothing scrolls sideways.
    const sheetBox = (await sheet.boundingBox())!;
    expect(sheetBox.x).toBeGreaterThanOrEqual(0);
    expect(sheetBox.x + sheetBox.width).toBeLessThanOrEqual(railBox.x);
    expect(sheetBox.y + sheetBox.height).toBeLessThanOrEqual(844);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);

    // A tap on Table goes to the table (the flat page's tabs are in its sheet on a phone too: there are none on the bar to look for).
    await views.getByRole("link", { name: "Table", exact: true }).tap();
    await expect(page).toHaveURL(/view=table/);
    // (A phone's table is a list of cards, not a `table`: the tab, which is not shown there, says which view is on.)
    await expect(page.locator('[role="tab"][id$="-tab-table"]')).toHaveAttribute("aria-selected", "true");
    await expect(scene(page)).toHaveCount(0);
  });

  test("the bar has no home pill, to leave the heads their room: the way home is a link in the gear's sheet", async ({ page }) => {
    await openDepth(page);
    // Not on the bar: the home pill would push the open card off the right edge, and crowd the heads.
    await expect(homeLink(page)).toBeHidden();
    await expect(page.locator("[data-people-bar]").getByRole("link", { name: "Parallel home", exact: true })).toBeHidden();

    await settingsGear(page).tap();
    const sheet = settingsSheet(page);
    const home = sheet.getByRole("link", { name: "Parallel home", exact: true });
    await expect(home).toBeVisible();
    await expect(home).toHaveAttribute("href", "/");
    const box = (await home.boundingBox())!;
    const sheetBox = (await sheet.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(sheetBox.x);
    expect(box.x + box.width).toBeLessThanOrEqual(sheetBox.x + sheetBox.width);
    expect(sheetBox.y + sheetBox.height).toBeLessThanOrEqual(844);
  });

  test("the layout control in the sheet leaves for the flat timeline, and Share's menu opens in full inside it", async ({ page }) => {
    await openDepth(page);
    await settingsGear(page).tap();
    const sheet = settingsSheet(page);
    await sheet.getByRole("button", { name: "Share", exact: true }).tap();
    const copy = sheet.getByRole("menuitem", { name: "Copy link", exact: true });
    await expect(copy).toBeVisible();
    // The whole menu is on screen (the sheet does not clip it).
    const last = (await sheet.getByRole("menuitem").last().boundingBox())!;
    expect(last.y + last.height).toBeLessThanOrEqual(844);
    await expect(sheet.getByRole("combobox", { name: "From year", exact: true })).toBeVisible();

    await sheet.getByRole("button", { name: "Combined timeline", exact: true }).tap();
    await expect(scene(page)).toHaveCount(0);
    // The flat Timeline's bar has no room for the control on a phone either: it is in the sheet, with Combined pressed.
    await expect(layoutGroup(page)).toBeHidden();
    await settingsGear(page).tap();
    await expect(layoutGroup(page).getByRole("button", { name: "Combined timeline", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(scene(page)).toHaveCount(0);
  });

  test("posters are as faint and soft as their film is obscure, gently, and the middle of the screen brings one to full opacity", async ({ page }) => {
    await openDepth(page);
    const [famous, nothing] = await Promise.all([1000, 1014].map((id) => lookOf(page, id)));
    // The same opacities as on a desktop, a gentler blur (0.5px to 1.5px: it is what costs on a phone).
    expect([famous.opacity, nothing.opacity].map((value) => Math.round(value * 100) / 100)).toEqual([0.8, 0.45]);
    expect(famous.blur).toBeCloseTo(0.5, 2);
    expect(nothing.blur).toBeCloseTo(1.5, 2);
    expect(nothing.f).toBeLessThan(famous.f);

    // A finger has no hover: the band through the middle of the screen is the focus. Scrolled to the middle, a poster is fully opaque and sharp;
    // one that has left the band is at rest again.
    await scrollToCentre(page, 1014);
    await expect.poll(async () => (await lookOf(page, 1014)).opacity).toBeCloseTo(1, 2);
    expect((await lookOf(page, 1014)).focus).toBeGreaterThan(0.99);
    await scene(page).evaluate((scroller) => { scroller.scrollTop += 700; });
    await expect.poll(async () => (await lookOf(page, 1014)).opacity).toBeCloseTo(0.45, 2);
  });
  test("a film made together's caption is there at rest wherever its poster is on the screen, and nothing about it follows the middle band", async ({ page }) => {
    await openDepth(page);
    // The scene opens with the first collaboration in the middle, and a film made together at the end is far off screen: both are showing in full.
    expect(await captionOf(page, "100")).toMatchObject({ opacity: 1, transform: "none", marked: false });
    expect(await captionOf(page, "200")).toMatchObject({ opacity: 1, transform: "none", marked: false });
    // Nothing has a caption that is not a film made together, and nothing marks a poster any more (the loop no longer touches them).
    await expect(scene(page).locator('li:has(button:not([data-layer="0"])) [data-poster-caption]')).toHaveCount(0);
    await expect(scene(page).locator("[data-caption]")).toHaveCount(0);

    // In the middle, at the band's edge (105px from the middle line), past it and far from it: the same every time, with no flicker as it crosses.
    for (const distance of [0, 105, 130, 400, 0]) {
      await scrollToOffset(page, 100, distance);
      expect(await captionOf(page, "100")).toMatchObject({ opacity: 1, transform: "none", marked: false });
    }
    for (const one of await allCaptionsShown(page)) expect(one).toEqual(SHOWN);
    await expect(scene(page).locator("[data-caption]")).toHaveCount(0);

    // Scrolled so that the poster is off the screen, it is still there (and back in view, still there).
    await scene(page).evaluate((scroller) => { scroller.scrollTop += 700; });
    await page.waitForTimeout(150);
    expect(await captionOf(page, "100")).toMatchObject({ opacity: 1, marked: false });
    await scrollToOffset(page, 100, 0);
    // A tap on the poster still opens the film (the caption is not in the way, and it stays while the panel is open).
    await scene(page).getByRole("button", { name: FIRST_SHARED }).tap();
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(await captionOf(page, "100")).toMatchObject({ opacity: 1 });
  });

  test("a phone's shadows are the background colour too, and shorter than a desktop's", async ({ page }) => {
    await openDepth(page);
    const shadow = (selector: string, pseudo = "::before") =>
      scene(page).locator(selector).first().evaluate((card, which) => getComputedStyle(card, which).boxShadow, pseudo);
    const collab = await shadow("[data-poster-card][data-collab]");
    const lift = await shadow("[data-poster-card][data-collab]", "::after");
    const behind = await shadow("[data-poster-card]:not([data-collab])");
    for (const value of [collab, lift, behind]) for (const layer of shadowColours(value)) expect(layer.rgb).toEqual(BG_RGB);
    expect(shadowColours(collab)).toHaveLength(5);
    expect(shadowColours(lift)).toHaveLength(5);
    expect(shadowColours(behind)).toHaveLength(2);
    expect(collab).toContain("0px 0px 0px 3px");
    expect(collab).toContain("0px 19px 38px -4px");
    expect(lift).toContain("0px 24px 47px -3px");
    expect(behind).toContain("0px 4px 11px");
  });

  test("the labels stay in the area left of the rail, the page does not scroll sideways, and no label lies on another film's poster or label", async ({ page }) => {
    await openDepth(page);
    await expect(scene(page).locator('[data-poster="100"] [data-poster-caption]')).toBeVisible();
    const fits = await scene(page).evaluate((scroller) => {
      const rail = document.querySelector("[data-depth-rail]")!.getBoundingClientRect();
      return Array.from(scroller.querySelectorAll("[data-caption-chip]"), (chip) => {
        const box = chip.getBoundingClientRect();
        return { left: box.left, right: box.right, rail: rail.left };
      }).filter((box) => box.right > 0 && box.left < innerWidth);
    });
    expect(fits.length).toBeGreaterThan(0);
    for (const box of fits) {
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(box.rail + 0.5);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    // `Title, Year` under the poster, near-black highlights, clear of every other film's poster and labels, on a phone too.
    await expectLabelsClear(page);
  });
});
