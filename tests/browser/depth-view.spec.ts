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
  // Every layer's list is `preserve-3d`: a background poster's own translateZ (its obscurity's push) only takes inside one.
  expect(await region.locator("ol").evaluateAll((lists) => lists.map((list) => getComputedStyle(list).transformStyle))).toEqual([
    "preserve-3d",
    "preserve-3d",
    "preserve-3d",
  ]);
  // The shadows hang from the card's ::before: no green glow, but a dark outline outside the ring and layers of near-black
  // (contact, mid, a large ambient one thrown down, a soft halo all round), the heaviest in the scene. Green is only the crisp 2px ring on the poster.
  const shadow = (selector: string) =>
    region.locator(selector).first().evaluate((card) => getComputedStyle(card, "::before").boxShadow);
  const collabShadow = await shadow("[data-poster-card][data-collab]");
  expect(collabShadow).not.toContain("224, 84");
  expect(collabShadow.match(/rgba\(0, 0, 0/g)).toHaveLength(5);
  expect(collabShadow).toContain("0px 30px 60px -10px");
  await expect(poster.locator("[data-poster-card] > span").first()).toHaveCSS("box-shadow", "rgb(0, 224, 84) 0px 0px 0px 2px");
  // Every poster behind has the layered drop shadow too: a tight contact shadow and a soft ambient one.
  const behindShadow = await shadow("[data-poster-card]:not([data-collab])");
  expect(behindShadow).toContain("0px 1px 2px");
  expect(behindShadow).toMatch(/0px 8px 24px|0px 5px 14px/);
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

  // One layer, at the screen plane, with no soft copy of any poster and nothing blurred.
  await expect(region.locator("ol")).toHaveCount(1);
  expect(await region.locator("ol").evaluate((list) => list.style.transform)).toBe("translateZ(0px)");
  const posters = region.locator("[data-poster]");
  const count = await posters.count();
  expect(count).toBeGreaterThan(20);
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

/** What `elementFromPoint` finds there: its film, and whether it is the hover copy. */
const hitAt = (page: Page, x: number, y: number) =>
  page.evaluate(([px, py]) => {
    const button = document.elementFromPoint(px, py)?.closest<HTMLElement>("button");
    return { film: button?.dataset.film ?? null, inCopy: !!button?.closest("[data-pop-layer]") };
  }, [x, y]);

/** How the hover copy looks: its opacity, its `--focus` and the opacity of its sharp image over the soft one. */
const copyLook = (page: Page) =>
  page.evaluate(() => {
    const copy = document.querySelector<HTMLElement>("[data-pop-layer] [data-pop]")!;
    const sharp = copy.querySelector<HTMLElement>('img[data-window="sharp"]')!;
    return { opacity: getComputedStyle(copy).opacity, focus: copy.style.getPropertyValue("--focus"), sharp: getComputedStyle(sharp).opacity };
  });

/** The copy's scale on screen (the `a` of its matrix), or null without one. */
const copyScale = (page: Page) =>
  page.evaluate(() => {
    const copy = document.querySelector("[data-pop-layer] [data-pop]");
    if (!copy) return null;
    return Number.parseFloat(getComputedStyle(copy).transform.replace("matrix(", "").split(",")[0]);
  });

test("a hovered background poster pops forward over the poster of a nearer layer that covers it", async ({ page }) => {
  await openDepth(page);
  const id = await slideBackgroundPosterUnderCollab(page, 2);
  await page.waitForTimeout(200);
  const box = await posterBox(page, id);
  // Not hovered: the film made together is what is at the poster's centre.
  expect((await hitAt(page, box.x, box.y)).film).not.toBe(id);

  const base = box.width / (await scene(page).evaluate((scroller, filmId) => Number.parseFloat((scroller.querySelector(`[data-poster="${filmId}"]`) as HTMLElement).style.width), id));
  await page.mouse.move(box.right - 4, box.y);
  const copy = page.locator("[data-pop-layer] [data-pop]");
  await expect(copy).toHaveCount(1);
  // It grows (about 1.1) and, settled, is on top: the hit at its centre is its own button, in the copy.
  await expect.poll(() => copyScale(page)).toBeGreaterThan(base * 1.07);
  await expect.poll(async () => (await hitAt(page, box.x, box.y)).inCopy).toBe(true);
  expect((await hitAt(page, box.x, box.y)).film).toBe(id);
  // The copy is at full opacity and fully sharp, whatever the film's obscurity.
  expect(await copyLook(page)).toEqual({ opacity: "1", focus: "1", sharp: "1" });
  // The hover card still opens after its own short wait.
  await expect(page.getByRole("tooltip")).toBeVisible();

  // And settles back when the pointer leaves.
  await page.mouse.move(box.x - 300, box.y + 200);
  await expect(copy).toHaveCount(0);
  await expect(page.getByRole("tooltip")).toHaveCount(0);
});

test("a popped poster opens its film on a click and pans on a drag", async ({ page }) => {
  await openDepth(page);
  const id = await slideBackgroundPosterUnderCollab(page, 1);
  await page.waitForTimeout(200);
  const box = await posterBox(page, id);
  await page.mouse.move(box.right - 4, box.y);
  await expect(page.locator("[data-pop-layer] [data-pop]")).toHaveCount(1);
  await expect.poll(async () => (await hitAt(page, box.x, box.y)).inCopy).toBe(true);

  // A drag that starts on the copy scrolls the scene and opens nothing.
  const before = await scene(page).evaluate((scroller) => scroller.scrollTop);
  await page.mouse.down();
  // (Down: the scene is at the end of the axis, so it can only scroll back.)
  await page.mouse.move(box.right - 4, box.y + 120, { steps: 8 });
  await page.mouse.up();
  expect(await scene(page).evaluate((scroller) => scroller.scrollTop)).toBeLessThan(before - 100);
  await page.waitForTimeout(250);
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // A click on it opens the film.
  const again = await posterBox(page, id);
  await page.mouse.move(again.right - 4, again.y);
  await expect(page.locator("[data-pop-layer] [data-pop]")).toHaveCount(1);
  await page.mouse.click(again.x, again.y);
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

/** A point `distance` px from (x, y) with no poster under it (so hovering there pops nothing), on the screen: the first of the directions that is free. */
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

  // Beside it (within the field's sharp inner radius, 77px, but not on it: nothing pops): the most obscure film is at full opacity and sharp.
  const beside = (await freeSpot(page, center.x, center.y, center.width / 2 + 24))!;
  expect(beside).not.toBeNull();
  await page.mouse.move(beside.x, beside.y);
  await expect.poll(async () => (await lookOf(page, 1014)).focus).toBeGreaterThan(0.99);
  await expect.poll(async () => (await lookOf(page, 1014)).opacity).toBeCloseTo(1, 2);
  // (The sharp image fades in over 100ms.)
  await expect.poll(() => region.locator('[data-poster="1014"] img[data-window="sharp"]').evaluate((image) => Number(getComputedStyle(image).opacity))).toBeCloseTo(1, 2);
  await expect(page.locator("[data-pop-layer] [data-pop]")).toHaveCount(0);

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

  // On it: the poster pops (a copy at full opacity, sharp, over everything), and a move over the copy keeps the field on it.
  const on = await scrollToCentre(page, 1014);
  await page.mouse.move(on.x, on.y);
  await expect(page.locator("[data-pop-layer] [data-pop]")).toHaveCount(1);
  expect(await copyLook(page)).toEqual({ opacity: "1", focus: "1", sharp: "1" });
  await page.mouse.move(on.x + 1, on.y + 1);
  await expect.poll(async () => (await lookOf(page, 1014)).focus).toBeGreaterThan(0.99);
});

test("keyboard focus pops a background poster too, and reduced motion keeps the stacking without the scale", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openDepth(page);
  const poster = scene(page).locator('button[data-layer="1"]').first();
  await poster.focus();
  // Only keyboard focus shows (a script's focus counts as one when nothing was clicked before it).
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(page.locator("[data-pop-layer] [data-pop]")).toHaveCount(1);
  // Keyboard focus takes the poster itself to full opacity too, whatever its resting one (the first of layer 1 is the best-known: 0.8).
  await expect(poster.locator("xpath=ancestor::li")).toHaveCSS("opacity", "1");
  expect(await copyLook(page)).toEqual({ opacity: "1", focus: "1", sharp: "1" });
  // No animation and no growth: the copy is at the poster's own scale, drawn above the scene.
  const base = await poster.evaluate((button) => button.getBoundingClientRect().width / Number.parseFloat((button.closest("[data-poster]") as HTMLElement).style.width));
  expect(await page.evaluate(() => document.querySelector("[data-pop-layer] [data-pop]")!.getAnimations().length)).toBe(0);
  expect(await copyScale(page)).toBeCloseTo(base, 3);
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

    // A tap on a poster opens its film and makes no hover copy (a finger has no hover).
    const poster = scene(page).locator("button[data-film]").first();
    await poster.scrollIntoViewIfNeeded();
    await poster.tap();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.locator("[data-pop-layer] > *")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();

    // A tap opens the card, and it fits the screen.
    await pill(page).tap();
    const card = peopleCard(page);
    await expect(card).toBeVisible();
    const cardBox = (await card.boundingBox())!;
    expect(cardBox.x).toBeGreaterThanOrEqual(0);
    expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(390);
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
});
