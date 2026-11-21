import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";

// The landing page's first screen: the sticky top bar (the wordmark, the search that opens the universal search, and the genre pills) over the stage (two portrait halves with
// the headline over the seam, the timeline of everyone's films, and the shared films' posters in a cluster over it). The stage is drawn in the browser once its images are in (or after 2.5s, TMDB's host being out of reach here).
// The genre pills are tabs that choose the view under the bar: Featured (the splash, and nothing under it) or one genre's grid (and "How it works" under that).

const stage = (page: Page) => page.locator("[data-hero-stage]");
const stageLink = (page: Page) => stage(page).getByRole("link", { name: /films? together$/ });
const bar = (page: Page) => page.locator("[data-landing-bar]");

/** The stage is drawn and its reveal is over: nothing is still animating (the dots pop in, the posters are dealt and the figures rise for about two seconds), so what is measured is where things rest. */
async function ready(page: Page) {
  await expect(stageLink(page)).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.getAnimations().filter((animation) => animation.playState === "running").length)).toBe(0);
}

const box = async (locator: ReturnType<Page["locator"]>) => (await locator.boundingBox())!;
const centreY = (rect: { y: number; height: number }) => rect.y + rect.height / 2;
const centreX = (rect: { x: number; width: number }) => rect.x + rect.width / 2;

test("the headline is the one h1, the stage is one labelled link to a pair, and the top bar sticks to the top of the screen", async ({ page }) => {
  await page.goto("/");
  const h1 = page.getByRole("heading", { level: 1 });
  await expect(h1).toHaveCount(1);
  await expect(h1).toHaveText("Watch filmmakers cross paths");

  const link = stageLink(page);
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", /^\/p\/\d+-[^+]+\+\d+-[^+]+$/);
  // The decorative layers are inside it and carry no text of their own: its name is the label.
  await expect(link.locator("[aria-hidden='true']").first()).toBeAttached();
  await expect(link.getByRole("link")).toHaveCount(0);
  await expect(link.getByRole("button")).toHaveCount(0);
  // Previous and Next are outside the link.
  await expect(stage(page).getByRole("button", { name: "Previous pairing", exact: true })).toBeVisible();
  await expect(stage(page).getByRole("button", { name: "Next pairing", exact: true })).toBeVisible();

  await expect(bar(page).getByRole("tablist", { name: "Genres", exact: true })).toBeVisible();
  await expect(bar(page).getByRole("tab")).toHaveCount(10);
  await page.evaluate(() => window.scrollTo(0, 1400));
  await expect.poll(() => bar(page).evaluate((element) => Math.round(element.getBoundingClientRect().top))).toBe(0);
});

test("the top bar reads wordmark, then the genre pills taking the width left, then the search pinned to the right end; the pills fade at the edge by the search and never run under it", async ({ page }) => {
  await page.goto("/");
  await expect(stageLink(page)).toBeVisible();
  const home = await box(bar(page).getByRole("link", { name: "Parallel home", exact: true }));
  // The strip the pills scroll in (the tablist inside it is as wide as all of them, and runs on past the strip's edge).
  const strip = bar(page).getByRole("tablist").locator("xpath=..");
  const pills = await box(strip);
  const search = await box(bar(page).getByRole("button", { name: /Search any film artist/ }));
  expect(home.x + home.width).toBeLessThanOrEqual(pills.x);
  expect(pills.x + pills.width).toBeLessThanOrEqual(search.x - 8);
  // One row: the three are on the same middle.
  expect(Math.abs(centreY(home) - centreY(search))).toBeLessThanOrEqual(3);
  expect(Math.abs(centreY(pills) - centreY(search))).toBeLessThanOrEqual(4);
  // The search keeps its width (a quarter of the screen's, 240 to 340px) and sits at the bar's right end, as far in as its left padding keeps the wordmark.
  expect(search.width).toBeGreaterThanOrEqual(240);
  expect(search.width).toBeLessThanOrEqual(340);
  const row = bar(page).locator(":scope > div");
  const rowBox = await box(row);
  const padding = await row.evaluate((element) => parseFloat(getComputedStyle(element).paddingRight));
  expect(Math.abs(search.x + search.width - (rowBox.x + rowBox.width - padding))).toBeLessThanOrEqual(1);
  // The pills scroll in their own strip, and its end edge, the one by the search, fades.
  expect(await strip.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  expect(await strip.evaluate((element) => getComputedStyle(element).maskImage)).toMatch(/calc\(100% - 40px\), rgba\(0, 0, 0, 0\)\)$/);
});

test("the timeline has every film as a dot on the one line, as the pair page's does: each person's in their colour, the shared films larger and white, and a cap at each end", async ({ page }) => {
  await page.goto("/");
  await ready(page);
  const label = (await stageLink(page).getAttribute("aria-label"))!;
  const together = Number(label.match(/(\d+) films? together$/)![1]);

  const line = await box(stage(page).locator("[data-line]"));
  const lineY = centreY(line);
  const dots = await stage(page).locator("circle[data-dot]").evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, size: rect.width, color: getComputedStyle(element).fill };
    }),
  );
  // Every dot is on the line itself, none in a lane above or below it.
  expect(dots.length).toBeGreaterThan(0);
  for (const dot of dots) expect(Math.abs(dot.y - lineY)).toBeLessThanOrEqual(1);
  // The shared films are the white dots (one per year of them, so no more than the label says), larger than any of the people's, which are in their two colours.
  const white = dots.filter((dot) => dot.color === "rgb(255, 255, 255)");
  const own = dots.filter((dot) => dot.color !== "rgb(255, 255, 255)");
  expect(white.length).toBeGreaterThanOrEqual(1);
  expect(white.length).toBeLessThanOrEqual(together);
  // (A pair who have only ever made films together, the Coens, have no dots of their own colours.)
  if (own.length > 0) {
    expect(new Set(own.map((dot) => dot.color)).size).toBeLessThanOrEqual(2);
    expect(Math.min(...white.map((dot) => dot.size))).toBeGreaterThan(Math.max(...own.map((dot) => dot.size)));
    // They are the pair page's dots (`FilmDot`): the people's 8px at full size, smaller only where the years are crowded.
    expect(Math.min(...own.map((dot) => dot.size))).toBeGreaterThanOrEqual(4);
  }
  // The shared films' are 12px at full size, ringed in the page's colour.
  expect(Math.max(...white.map((dot) => dot.size))).toBeLessThanOrEqual(12.5);
  // The caps are the years of the first and the last film of either person, and the dots lie between them.
  const caps = stage(page).locator("span.tabular-nums.text-strong");
  await expect(caps).toHaveCount(2);
  const [first, last] = await caps.allInnerTexts();
  expect(first).toMatch(/^\d{4}$/);
  expect(last).toMatch(/^\d{4}$/);
  expect(Number(first)).toBeLessThanOrEqual(Number(last));
  const leftCap = await box(caps.first());
  const rightCap = await box(caps.last());
  for (const dot of dots) {
    expect(dot.x).toBeGreaterThan(leftCap.x + leftCap.width);
    expect(dot.x).toBeLessThan(rightCap.x);
  }
  // The years labelled along it are over the line, between the caps, and each is a year of the axis.
  const years = stage(page).locator("span.tabular-nums.text-white\\/75");
  const labels = await years.evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return { text: element.textContent ?? "", x: rect.x + rect.width / 2, bottom: rect.bottom };
    }),
  );
  for (const year of labels) {
    expect(year.text).toMatch(/^\d{4}$/);
    expect(year.bottom).toBeLessThan(lineY);
    expect(year.x).toBeGreaterThan(leftCap.x + leftCap.width);
    expect(year.x).toBeLessThan(rightCap.x);
    expect(Number(year.text)).toBeGreaterThan(Number(first));
    expect(Number(year.text)).toBeLessThan(Number(last));
  }
  // The line is the one line of the page.
  await expect(stage(page).locator("[data-line]")).toHaveCount(1);
});

test("the shared films' posters are a tight, fanned cluster over the seam, off the timeline, with '+N more' beside it on the posters' middle", async ({ page }) => {
  await page.goto("/");
  await ready(page);
  const posters = stage(page).locator("[data-part='poster']");
  await expect.poll(async () => (await posters.count()) >= 3 && (await posters.count()) <= 5).toBe(true);
  // They are not tied to the timeline: no stems, no dot or year under each.
  await expect(stage(page).locator("[data-part='stem'], [data-part='year']")).toHaveCount(0);
  await expect(stage(page).locator("[data-part='dot']")).toHaveCount(0);

  const count = await posters.count();
  const boxes = [];
  for (let i = 0; i < count; i++) boxes.push(await box(posters.nth(i)));
  // Chronological, left to right, each over the one before it: neighbours overlap.
  for (let i = 1; i < count; i++) {
    expect(boxes[i].x).toBeGreaterThan(boxes[i - 1].x);
    expect(boxes[i].x).toBeLessThan(boxes[i - 1].x + boxes[i - 1].width);
  }
  const left = Math.min(...boxes.map((rect) => rect.x));
  const right = Math.max(...boxes.map((rect) => rect.x + rect.width));
  expect(right - left).toBeLessThanOrEqual(430);
  // Centred on the seam, above the line.
  const link = await box(stageLink(page));
  expect(Math.abs((left + right) / 2 - centreX(link))).toBeLessThanOrEqual(12);
  const lineY = centreY(await box(stage(page).locator("[data-line]")));
  for (const rect of boxes) expect(rect.y + rect.height).toBeLessThan(lineY - 10);
  // Their tilts alternate a little (a fan), so they are not ruled.
  const tilts = await posters.evaluateAll((elements) => elements.map((element) => getComputedStyle(element.firstElementChild!.firstElementChild!).rotate));
  expect(new Set(tilts).size).toBeGreaterThan(1);

  // "+N more", when the pair has more films than posters, is to the right of the cluster and on the posters' middle (not the line's).
  const more = stage(page).getByText(/^\+\d+\s*more$/).filter({ visible: true });
  if ((await more.count()) > 0) {
    const pill = await box(more.first());
    expect(pill.x).toBeGreaterThanOrEqual(right);
    const top = Math.min(...boxes.map((rect) => rect.y));
    const bottom = Math.max(...boxes.map((rect) => rect.y + rect.height));
    expect(Math.abs(centreY(pill) - (top + bottom) / 2)).toBeLessThanOrEqual(16);
    expect(Math.abs(centreY(pill) - lineY)).toBeGreaterThan(40);
  }
});

test("the shared films' posters have a crisp white border at rest", async ({ page }) => {
  await page.goto("/");
  await ready(page);
  const shadows = await stage(page).locator("[data-part='poster'] img").evaluateAll((images) => images.map((image) => getComputedStyle(image.parentElement!).boxShadow));
  expect(shadows.length).toBeGreaterThanOrEqual(3);
  // The drop shadow stays, and a white ring about 1.5px wide (a little less on a phone) is round each poster.
  for (const shadow of shadows) {
    expect(shadow).toMatch(/rgb\(255, 255, 255\) 0px 0px 0px 1\.5px/);
    expect(shadow).toMatch(/rgba\(0, 0, 0, 0\.8\) 0px 14px 22px -8px/);
  }
});

test("a poster lifts and names its film when hovered, and the stage is still one link", async ({ page }) => {
  await page.goto("/");
  await expect(stageLink(page)).toBeVisible();
  const poster = stage(page).locator("[data-part='poster']").nth(1);
  const before = await box(poster);
  await poster.hover();
  // The label is "Title, 1990", over the poster; the poster comes up.
  const label = poster.getByText(/, \d{4}$/);
  await expect(label).toBeVisible();
  await expect.poll(async () => (await box(poster)).y).toBeLessThan(before.y - 3);
  await expect(stageLink(page)).toHaveCount(1);
});

/** The cue's pieces (hero-cue.css): the stage's own attribute, the line under the names, the posters' places in the cluster and the shared films' dots. */
const cueLine = (page: Page) => stage(page).locator("[data-cue-cta]").first();
/** Whether the cue is showing: the stage has its one link (the action zone) hovered or keyboard-focused (hero-cue.css). */
const cueOn = (page: Page) => stage(page).evaluate((element) => element.matches(":has([data-stage-link]:is(:hover, :focus-visible))"));
const opacityOf = (locator: ReturnType<Page["locator"]>) => locator.evaluate((element) => getComputedStyle(element).opacity);
/** The width of the cluster, outer edge to outer edge. */
async function clusterWidth(page: Page) {
  const boxes = await stage(page).locator("[data-part='poster']").filter({ visible: true }).evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect()));
  return Math.max(...boxes.map((rect) => rect.right)) - Math.min(...boxes.map((rect) => rect.left));
}

test("hovering the cluster, timeline and names opens the cue: the posters ease apart, the shared dots light up and a line says where the click goes; a face does not", async ({ page }) => {
  await page.goto("/");
  await ready(page);
  const link = await box(stage(page));
  const sharedDots = stage(page).locator("[data-dot][data-shared]");
  // The shared dots' look: a ring in the page's colour at rest; when lit, no ring (plain solid white), a small soft glow, and never larger.
  const dotLook = () => sharedDots.first().evaluate((element) => ({ stroke: getComputedStyle(element).stroke, scale: getComputedStyle(element).scale, filter: getComputedStyle(element).filter }));

  // At rest: the line is not there, the dots are as drawn.
  expect(await cueOn(page)).toBe(false);
  expect(await opacityOf(cueLine(page))).toBe("0");
  const dotRest = await dotLook();
  expect(dotRest).toEqual({ stroke: "rgb(20, 24, 28)", scale: "none", filter: "none" });
  const rest = await clusterWidth(page);

  // A face (the left panel, up where the head is) is the stage, and a link, but not the cue.
  await page.mouse.move(link.x + link.width * 0.2, link.y + link.height * 0.3, { steps: 4 });
  await page.waitForTimeout(700);
  expect(await cueOn(page)).toBe(false);
  expect(await opacityOf(cueLine(page))).toBe("0");
  expect(await clusterWidth(page)).toBeCloseTo(rest, 0);
  await expect(stageLink(page)).toHaveCSS("cursor", "pointer");
  await expect(stage(page)).toHaveCSS("cursor", "auto");

  // The zone's corner, over bare panel: the cue.
  const zone = await box(stageLink(page));
  await page.mouse.move(zone.x + 16, zone.y + zone.height - 16, { steps: 4 });
  await expect.poll(() => cueOn(page)).toBe(true);
  await expect.poll(() => opacityOf(cueLine(page))).toBe("1");
  // It reads "See all 11 films together →", with the pair's own count.
  const count = Number((await stageLink(page).getAttribute("aria-label"))!.match(/: (\d+) films? together$/)![1]);
  await expect(cueLine(page)).toHaveText(`See all ${count} films together →`);
  // The cluster is wider by about 10px a poster, the shared dots are larger and glow, the line sits under the names.
  await expect.poll(async () => (await clusterWidth(page)) - rest).toBeGreaterThanOrEqual(19);
  await expect.poll(async () => (await dotLook()).stroke).toBe("rgba(0, 0, 0, 0)");
  const lit = await dotLook();
  expect(lit.scale).toBe("none");
  expect(lit.filter).toMatch(/drop-shadow\(rgba\(255, 255, 255, 0\.55\) 0px 0px 3px\)/);
  // Plain white: the dot's fill is white, and its neighbours' (the people's colours) are not lit.
  expect(await sharedDots.first().evaluate((element) => getComputedStyle(element).fill)).toBe("rgb(255, 255, 255)");
  const names = await box(stage(page).locator("[data-names]"));
  const line = await box(cueLine(page));
  expect(line.y).toBeGreaterThanOrEqual(names.y + names.height);
  expect(Math.abs(centreX(line) - centreX(link))).toBeLessThanOrEqual(3);

  // Out of the zone, it eases shut again.
  await page.mouse.move(link.x + link.width * 0.2, link.y + link.height * 0.3, { steps: 4 });
  await expect.poll(() => cueOn(page)).toBe(false);
  await expect.poll(() => opacityOf(cueLine(page))).toBe("0");
  await expect.poll(async () => Math.abs((await clusterWidth(page)) - rest)).toBeLessThan(1);
  await expect.poll(async () => (await dotLook()).stroke).toBe("rgb(20, 24, 28)");
  expect((await dotLook()).filter).toBe("none");
});

test("only the action zone is a link: the faces, the montage and the headline are plain (no pointer, no click), and the posters and the names are the link", async ({ page }) => {
  await page.goto("/");
  await ready(page);
  const root = await box(stage(page));
  const zone = await box(stageLink(page));
  await expect(stage(page).getByRole("link")).toHaveCount(1);
  // The link's box is the zone: the cluster, the band and the names, centred on the stage, as wide as the band and down to the stage's bottom.
  expect(zone.width).toBeLessThan(root.width * 0.8);
  expect(Math.abs(centreX(zone) - centreX(root))).toBeLessThanOrEqual(1);
  expect(zone.y).toBeGreaterThan(root.y + root.height * 0.4);
  expect(Math.abs(zone.y + zone.height - (root.y + root.height))).toBeLessThanOrEqual(1);
  const posterBoxes = await stage(page).locator("[data-part='poster']").filter({ visible: true }).evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect()));
  const names = await box(stage(page).locator("[data-names]"));
  for (const rect of posterBoxes) {
    expect(rect.left).toBeGreaterThanOrEqual(zone.x);
    expect(rect.right).toBeLessThanOrEqual(zone.x + zone.width);
    expect(rect.top).toBeGreaterThanOrEqual(zone.y);
  }
  expect(names.y).toBeGreaterThanOrEqual(zone.y);
  expect(names.y + names.height).toBeLessThanOrEqual(zone.y + zone.height);

  // What is under the pointer, and its cursor: the face, the headline and an empty corner are not in a link and have no pointer; a poster and the names are in it, with one.
  const at = (x: number, y: number) => page.evaluate(({ x, y }) => { const element = document.elementFromPoint(x, y)!; return { inLink: element.closest("a") !== null, cursor: getComputedStyle(element).cursor }; }, { x, y });
  const face = await at(root.x + root.width * 0.2, root.y + root.height * 0.45);
  const h1 = await box(page.getByRole("heading", { level: 1 }));
  const headline = await at(centreX(h1), centreY(h1));
  const corner = await at(root.x + 40, root.y + root.height - 12);
  for (const spot of [face, headline, corner]) expect(spot).toEqual({ inLink: false, cursor: "auto" });
  const poster = posterBoxes[1];
  expect(await at(poster.x + poster.width / 2, poster.y + poster.height / 2)).toEqual({ inLink: true, cursor: "pointer" });
  expect(await at(centreX(names), centreY(names))).toEqual({ inLink: true, cursor: "pointer" });
  // The zone's own empty part (over the halves, under the cluster's padding) is the link too.
  expect(await at(zone.x + 20, zone.y + 20)).toEqual({ inLink: true, cursor: "pointer" });

  // Clicks on the face, the headline and the empty corner go nowhere.
  const path = new URL(page.url()).pathname;
  for (const [x, y] of [[root.x + root.width * 0.2, root.y + root.height * 0.45], [centreX(h1), centreY(h1)], [root.x + 40, root.y + root.height - 12]]) {
    await page.mouse.click(x, y);
    await page.waitForTimeout(400);
    expect(new URL(page.url()).pathname).toBe(path);
  }
});

test("the headline and the line under it are plain text: they can be selected by dragging over them, a click or a drag on them goes nowhere, and a scene change leaves the selection and the node alone", async ({ page }) => {
  await page.clock.install();
  await page.goto("/");
  await ready(page);
  const h1 = page.getByRole("heading", { level: 1 });
  const subcopy = page.locator("section[aria-labelledby='hero-heading'] p").first();
  await expect(subcopy).toContainText("Search any actor");
  const path = new URL(page.url()).pathname;
  // Text, to the pointer and to the selection: nothing stops either (no user-select: none, and the text's own box takes the pointer).
  for (const element of [h1, subcopy]) {
    const style = await element.evaluate((node) => ({ select: getComputedStyle(node).userSelect, events: getComputedStyle(node).pointerEvents, cursor: getComputedStyle(node).cursor }));
    expect(style.select).not.toBe("none");
    expect(style.events).not.toBe("none");
    expect(["auto", "text"]).toContain(style.cursor);
  }
  // What is at a point on the text is the text, not a layer of the stage: the headline's own element, and the line's.
  const heading = await box(h1);
  const line = await box(subcopy);
  expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.id, { x: heading.x + 4, y: heading.y + 10 })).toBe("hero-heading");
  expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, { x: line.x + 4, y: line.y + 8 })).toBe("P");
  await page.evaluate(() => ((window as unknown as { __h1: Element }).__h1 = document.getElementById("hero-heading")!));

  // Drag over them, from the start of the headline to the end of the line under it.
  await page.mouse.move(heading.x + 2, heading.y + 8);
  await page.mouse.down();
  await page.mouse.move(line.x + line.width - 4, line.y + line.height - 6, { steps: 14 });
  await page.mouse.up();
  const selected = await page.evaluate(() => window.getSelection()!.toString());
  expect(selected).toContain("Watch filmmakers");
  expect(selected).toContain("cross paths");
  expect(selected).toContain("Search any actor");
  expect(new URL(page.url()).pathname).toBe(path);

  // The scene changes by itself (the pointer is not over the stage's link, and the selection does not hold it): the selection is still there, and the headline is the same node.
  const label = () => stageLink(page).getAttribute("aria-label");
  const first = await label();
  await page.clock.runFor(30_000);
  await expect.poll(label).not.toBe(first);
  expect(await page.evaluate(() => window.getSelection()!.toString())).toBe(selected);
  expect(await page.evaluate(() => (window as unknown as { __h1: Element }).__h1 === document.getElementById("hero-heading"))).toBe(true);

  // A click on the headline, too, goes nowhere.
  await page.mouse.click(heading.x + heading.width / 2, heading.y + 12);
  await page.waitForTimeout(300);
  expect(new URL(page.url()).pathname).toBe(path);
});

test("clicking a poster, or the names, opens the pair's page", async ({ page }) => {
  for (const target of ["poster", "names"] as const) {
    await page.goto("/");
    await ready(page);
    const href = (await stageLink(page).getAttribute("href"))!;
    expect(href).toMatch(/^\/p\//);
    const spot = target === "poster" ? stage(page).locator("[data-part='poster']").nth(1) : stage(page).locator("[data-names]");
    const rect = await box(spot);
    await Promise.all([page.waitForURL((url) => url.pathname === href, { timeout: 45_000 }), page.mouse.click(centreX(rect), centreY(rect))]);
  }
});

test("keyboard focus on the stage's link opens the cue, and the rotation holds still for as long as the cue shows", async ({ page }) => {
  await page.clock.install();
  await page.goto("/");
  await ready(page);
  const label = () => stageLink(page).getAttribute("aria-label");
  const first = await label();

  // Tab to the link (Previous is before it): the cue shows, and the scene does not change under it.
  for (let i = 0; i < 12 && !(await stageLink(page).evaluate((element) => element === document.activeElement)); i++) await page.keyboard.press("Tab");
  await expect.poll(() => cueOn(page)).toBe(true);
  await expect.poll(() => opacityOf(cueLine(page))).toBe("1");
  await page.clock.runFor(40_000);
  expect(await label()).toBe(first);
  expect(await cueOn(page)).toBe(true);

  // Tab on, to Next: the cue is gone (focus there holds the rotation as well); focus away from the stage and the rotation carries on.
  await page.keyboard.press("Tab");
  await expect.poll(() => cueOn(page)).toBe(false);
  await page.evaluate(() => (document.activeElement as HTMLElement).blur());
  await page.clock.runFor(40_000);
  await expect.poll(label).not.toBe(first);
});

test("a pointer in the zone holds the rotation still, and a scene changed under it (an arrow key) settles straight into the open state", async ({ page }) => {
  await page.clock.install();
  await page.goto("/");
  await ready(page);
  const label = () => stageLink(page).getAttribute("aria-label");
  const first = await label();
  const zone = await box(stageLink(page));
  await page.mouse.move(zone.x + 16, zone.y + zone.height - 16, { steps: 4 });
  await expect.poll(() => cueOn(page)).toBe(true);
  await page.clock.runFor(40_000);
  expect(await label()).toBe(first);

  // The arrow key is the visitor's own step: the stage changes under the pointer, which has not moved.
  await page.keyboard.press("ArrowRight");
  await expect.poll(label).not.toBe(first);
  await page.clock.runFor(2500);
  await ready(page);
  expect(await cueOn(page)).toBe(true);
  // The line says the new pair's count, once; the new posters are in their open places (lifted off the anchor), not at rest.
  const next = Number((await label())!.match(/: (\d+) films? together$/)![1]);
  await expect(stage(page).locator("[data-cue-cta]")).toHaveCount(1);
  await expect(cueLine(page)).toHaveText(`See all ${next} films together →`);
  expect(await opacityOf(cueLine(page))).toBe("1");
  // (An anchor has no size of its own, so it is found by what it shows: the ones a width hides are display: none.)
  const lifts = await stage(page)
    .locator("[data-cue-poster]")
    .evaluateAll((elements) => elements.filter((element) => getComputedStyle(element).display !== "none").map((element) => getComputedStyle(element).translate));
  expect(lifts.length).toBeGreaterThanOrEqual(3);
  for (const lift of lifts) expect(lift).toMatch(/ -4px$/);
  expect(await stage(page).locator("[data-dot][data-shared]").first().evaluate((element) => getComputedStyle(element).stroke)).toBe("rgba(0, 0, 0, 0)");
});

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("the cue only fades its line in and lights the dots: nothing moves", async ({ page }) => {
    await page.goto("/");
    await ready(page);
    const rest = await clusterWidth(page);
    const zone = await box(stageLink(page));
    await page.mouse.move(zone.x + 16, zone.y + zone.height - 16, { steps: 4 });
    await expect.poll(() => cueOn(page)).toBe(true);
    await expect.poll(() => opacityOf(cueLine(page))).toBe("1");
    const dot = stage(page).locator("[data-dot][data-shared]").first();
    await expect.poll(() => dot.evaluate((element) => getComputedStyle(element).filter)).toContain("drop-shadow");
    expect(await dot.evaluate((element) => getComputedStyle(element).scale)).toBe("none");
    expect(await clusterWidth(page)).toBeCloseTo(rest, 0);
    expect(await cueLine(page).evaluate((element) => getComputedStyle(element).translate)).toBe("none");
  });
});

/** The two names of the stage's label and its "&", from the link's name ("A and B: 6 films together"), as boxes. */
async function nameBoxes(page: Page) {
  const label = (await stageLink(page).getAttribute("aria-label"))!;
  const [first, second] = label.replace(/: \d+ films? together$/, "").split(" and ");
  const names = stage(page).locator("[data-names]");
  return {
    first,
    second,
    container: names,
    a: await box(names.getByText(first, { exact: true })),
    amp: await box(names.getByText("&", { exact: true })),
    b: await box(names.getByText(second, { exact: true })),
  };
}

test("the names are one label under the timeline, centred on the seam: A against the '&' on its left, B on its right, plain text; and the foot gradient is over the figure and under it", async ({ page }) => {
  await page.goto("/");
  await ready(page);
  // None is in a corner any more: the one label has them both.
  await expect(stage(page).locator("[data-part='name']")).toHaveCount(0);
  const { first, second, container, a, amp, b } = await nameBoxes(page);
  await expect(container).toHaveCount(1);
  expect((await container.innerText()).replace(/\s+/g, " ").trim()).toBe(`${first} & ${second}`);
  const lineY = centreY(await box(stage(page).locator("[data-line]")));
  const link = await box(stageLink(page));
  // Under the line, a comfortable gap, on one line at this width.
  for (const rect of [a, amp, b]) expect(rect.y).toBeGreaterThan(lineY + 12);
  expect(Math.abs(centreY(a) - centreY(b))).toBeLessThanOrEqual(3);
  expect(Math.abs(centreY(a) - centreY(amp))).toBeLessThanOrEqual(3);
  // The "&" is on the seam; the names are against it, balanced either side of it, A right-aligned to its left and B left-aligned to its right.
  expect(Math.abs(centreX(amp) - centreX(link))).toBeLessThanOrEqual(2);
  expect(a.x + a.width).toBeLessThanOrEqual(amp.x);
  expect(b.x).toBeGreaterThanOrEqual(amp.x + amp.width);
  expect(Math.abs(amp.x - (a.x + a.width) - (b.x - (amp.x + amp.width)))).toBeLessThanOrEqual(2);
  // Plain text: no box, background or border behind it; semibold white.
  const style = await container.evaluate((element) => {
    const css = getComputedStyle(element);
    return { background: css.backgroundColor, border: css.borderTopWidth, weight: css.fontWeight, color: css.color, size: parseFloat(css.fontSize) };
  });
  expect(style.background).toBe("rgba(0, 0, 0, 0)");
  expect(style.border).toBe("0px");
  expect(style.weight).toBe("600");
  expect(style.color).toBe("rgb(255, 255, 255)");
  expect(style.size).toBeGreaterThanOrEqual(16);
  expect(style.size).toBeLessThanOrEqual(24);

  const order = await stage(page).evaluate((root) => {
    const first = (name: string) => root.querySelector<HTMLElement>(`[data-part='${name}']`)!;
    const follows = (a: HTMLElement, b: HTMLElement) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    const foot = first("foot");
    return {
      footAfterFigure: follows(first("figure"), foot),
      footAfterBackdrop: follows(first("backdrop"), foot),
      namesAfterFoot: follows(foot, root.querySelector<HTMLElement>("[data-names]")!),
      // The foot is the page's canvas colour at the very bottom, fading to nothing at the top.
      image: getComputedStyle(foot).backgroundImage,
      height: foot.getBoundingClientRect().height / root.getBoundingClientRect().height,
    };
  });
  expect(order.footAfterFigure && order.footAfterBackdrop && order.namesAfterFoot).toBe(true);
  expect(order.image).toContain("rgb(20, 24, 28)");
  expect(order.height).toBeGreaterThan(0.33);
  expect(order.height).toBeLessThan(0.46);
});

test.describe("at tablet widths (sm up to lg) the figures stand higher and the foot is twice as tall; desktop and phone are as they were", () => {
  /** What the figures and the foot of the stage are: the eye line of each cut (where the eyes of its photo are, as a share of the stage's height), the foot's height, and any fade on a figure. */
  async function figures(page: Page) {
    return stage(page).evaluate((root) => {
      const rootBox = root.getBoundingClientRect();
      const frames = [...root.querySelectorAll<HTMLElement>("[data-frame]")];
      const parts = frames.map((frame) => {
        const figure = frame.querySelector<HTMLElement>("[data-part='figure']")!;
        const foot = frame.querySelector<HTMLElement>("[data-part='foot']")!;
        const box = figure.parentElement!.parentElement!;
        const eye = parseFloat(box.style.getPropertyValue("--eye"));
        const rect = box.getBoundingClientRect();
        // Every element from the figure up to the frame: none of them fades the figure (a mask, or less than full opacity).
        const fades: string[] = [];
        for (let element: HTMLElement | null = figure; element && element !== frame; element = element.parentElement) {
          const style = getComputedStyle(element);
          if (style.maskImage !== "none" || style.opacity !== "1") fades.push(`${element.tagName}.${style.maskImage}.${style.opacity}`);
        }
        return {
          cut: Number.isFinite(eye),
          eyeLine: Number.isFinite(eye) ? (rect.top + eye * rect.height - rootBox.top) / rootBox.height : null,
          bottom: (rect.bottom - rootBox.top) / rootBox.height,
          foot: foot.getBoundingClientRect().height / frame.getBoundingClientRect().height,
          footInFront: !!(figure.compareDocumentPosition(foot) & Node.DOCUMENT_POSITION_FOLLOWING),
          fades,
        };
      });
      const poster = root.querySelector<HTMLElement>("[data-part='poster']")!.getBoundingClientRect();
      return { parts, posterTop: (poster.top - rootBox.top) / rootBox.height };
    });
  }

  for (const width of [640, 768, 1000]) {
    test(`at ${width}px the eyes are at about 44% of the stage, clear above the poster cluster, the foot is 84% of a half, and no figure is faded`, async ({ page }) => {
      await page.setViewportSize({ width, height: 960 });
      await page.goto("/");
      await ready(page);
      const { parts, posterTop } = await figures(page);
      expect(parts).toHaveLength(2);
      for (const part of parts) {
        if (part.cut) {
          expect(part.eyeLine!).toBeGreaterThan(0.4);
          expect(part.eyeLine!).toBeLessThan(0.5);
          // The faces are above the cluster, not under it.
          expect(part.eyeLine!).toBeLessThan(posterTop - 0.08);
        }
        expect(part.foot).toBeCloseTo(0.84, 2);
        expect(part.footInFront).toBe(true);
        expect(part.fades).toEqual([]);
      }
    });
  }

  for (const [width, label] of [[1440, "a desktop"], [390, "a phone"]] as const) {
    test(`${label} (${width}px) keeps its figures where they were, anchored to the bottom, and its foot 42% of a half`, async ({ page }) => {
      await page.setViewportSize({ width, height: width < 640 ? 844 : 900 });
      await page.goto("/");
      await ready(page);
      const { parts } = await figures(page);
      for (const part of parts) {
        expect(part.foot).toBeCloseTo(0.42, 2);
        expect(part.footInFront).toBe(true);
        expect(part.fades).toEqual([]);
        // A cut stands on the bottom of the stage (past it on a desktop; on the line, 82% down, on a phone).
        if (part.cut) expect(part.bottom).toBeGreaterThan(width < 640 ? 0.8 : 1);
      }
    });
  }

  test("a scene change brings the incoming panel's foot in at once, over its figure: the foot is not faded in, nor the old one out", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 960 });
    await page.goto("/");
    await ready(page);
    // The next scene: the foot of every panel on screen, during the change, has no animation and is fully opaque.
    await page.keyboard.press("ArrowRight");
    const seen = await page.evaluate(
      () =>
        new Promise<{ animated: number; opacities: string[]; feet: number }>((resolve) => {
          const stageRoot = document.querySelector("[data-hero-stage]")!;
          let animated = 0;
          let feet = 0;
          const opacities = new Set<string>();
          const start = performance.now();
          const tick = () => {
            for (const foot of stageRoot.querySelectorAll<HTMLElement>("[data-part='foot']")) {
              feet++;
              animated += foot.getAnimations().length;
              opacities.add(getComputedStyle(foot).opacity);
            }
            if (performance.now() - start < 900) requestAnimationFrame(tick);
            else resolve({ animated, opacities: [...opacities], feet });
          };
          tick();
        }),
    );
    expect(seen.feet).toBeGreaterThan(2);
    expect(seen.animated).toBe(0);
    expect(seen.opacities).toEqual(["1"]);
  });
});

/** The stage's box and the geometry the timeline's content is in, for the band and drop tests below. */
async function bandGeometry(page: Page) {
  const root = await box(stage(page));
  const link = await box(stageLink(page));
  const line = await box(stage(page).locator("[data-line]"));
  const caps = stage(page).locator("span.tabular-nums.text-strong");
  await expect(caps).toHaveCount(2);
  const leftCap = await box(caps.first());
  const rightCap = await box(caps.last());
  const dots = await stage(page).locator("circle[data-dot]").evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().x + element.getBoundingClientRect().width / 2));
  const names = await box(stage(page).locator("[data-names]"));
  return { root, link, line, leftCap, rightCap, dots, names, lineY: centreY(line) };
}

test.describe("the timeline's content is in a band centred on the seam, and the line runs on past it", () => {
  test.describe("at 1440px", () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test("the caps are at the ends of a band half the screen wide, every dot and year is between them, and the line fills the width", async ({ page }) => {
      await page.goto("/");
      await ready(page);
      const g = await bandGeometry(page);
      const viewport = page.viewportSize()!;
      // The band is 720px, centred on the seam: the caps' outer edges are its ends.
      expect(Math.abs(g.leftCap.x - (viewport.width - 720) / 2)).toBeLessThanOrEqual(1);
      expect(Math.abs(g.rightCap.x + g.rightCap.width - (viewport.width + 720) / 2)).toBeLessThanOrEqual(1);
      for (const x of g.dots) {
        expect(x).toBeGreaterThan(g.leftCap.x + g.leftCap.width);
        expect(x).toBeLessThan(g.rightCap.x);
      }
      // The line is not clipped to it: it runs on, out to the screen's edges (and over each half's panel).
      expect(g.line.x).toBeLessThanOrEqual(g.leftCap.x - 200);
      expect(g.line.x + g.line.width).toBeGreaterThanOrEqual(g.rightCap.x + g.rightCap.width + 200);
      expect(g.line.width).toBeGreaterThanOrEqual(viewport.width - 2);
    });

    test("the posters, the line, the dots and the names are 50px lower than a line at 82% of the stage, and the names keep clear of its bottom edge", async ({ page }) => {
      await page.goto("/");
      await ready(page);
      const g = await bandGeometry(page);
      // 1440 x 900: the stage is 816px high, so the line is at 82% and 50px.
      expect(Math.abs(g.root.height - 816)).toBeLessThanOrEqual(1);
      expect(Math.abs(g.lineY - g.root.y - (0.82 * g.root.height + 50))).toBeLessThanOrEqual(1);
      // The dots and the caps are on the line itself, and the names are the same 22px under it as before.
      expect(Math.abs(centreY(g.leftCap) - g.lineY)).toBeLessThanOrEqual(1);
      expect(Math.abs(g.names.y - (g.lineY + 22))).toBeLessThanOrEqual(1.5);
      expect(g.root.y + g.root.height - (g.names.y + g.names.height)).toBeGreaterThanOrEqual(40);
      // The posters stand the same distance over the line (26px, and the fan's few px), so they came down with it.
      const posters = stage(page).locator("[data-part='poster']");
      const bottoms = [];
      for (let i = 0; i < (await posters.count()); i++) bottoms.push((await box(posters.nth(i))).y + (await box(posters.nth(i))).height);
      expect(Math.max(...bottoms)).toBeLessThan(g.lineY - 10);
      expect(Math.max(...bottoms)).toBeGreaterThan(g.lineY - 60);
      // The figures are 25px lower, half as far: a cut stands 3% and 25px past the stage's bottom.
      const figures = await stage(page).locator("[data-part='figure']").evaluateAll((elements) =>
        elements.map((element) => ({ cut: element.parentElement!.parentElement!.style.getPropertyValue("--eye") !== "", bottom: element.getBoundingClientRect().bottom })),
      );
      expect(figures.some((item) => item.cut)).toBe(true);
      for (const figure of figures.filter((item) => item.cut)) expect(Math.abs(figure.bottom - (g.root.y + g.root.height + 0.03 * g.root.height + 25))).toBeLessThanOrEqual(2);
      // (Whatever the scene's figures are, tears included, the offset they are given is 25px here.)
      const figDrop = await stage(page).evaluate((element) => {
        const probe = document.createElement("div");
        probe.style.height = "var(--fig-drop)";
        element.append(probe);
        const height = probe.getBoundingClientRect().height;
        probe.remove();
        return height;
      });
      expect(Math.abs(figDrop - 25)).toBeLessThanOrEqual(0.5);
    });

    test("the panels have no border at rest or when the stage is hovered; the focus ring is the action zone's, in the focus colour, and not the halves'", async ({ page }) => {
      await page.goto("/");
      await ready(page);
      // The halves have no ring at all, focused or not.
      await expect(stage(page).locator("[data-frame] > span")).toHaveCount(0);
      for (const border of await stage(page).locator("[data-frame]").evaluateAll((frames) => frames.map((frame) => getComputedStyle(frame).borderTopWidth))) expect(border).toBe("0px");
      const ring = () => stageLink(page).evaluate((element) => getComputedStyle(element).boxShadow);
      expect(await ring()).toBe("none");
      await stageLink(page).hover();
      await page.waitForTimeout(450);
      expect(await ring()).toBe("none");

      await page.mouse.move(2, 2);
      await stageLink(page).focus();
      await expect(stageLink(page)).toBeFocused();
      expect(await stageLink(page).evaluate((element) => element.matches(":focus-visible"))).toBe(true);
      // A 2px ring in the focus colour (#40bcf4) round the zone's box, which has rounded corners; and the cue is showing.
      await expect.poll(ring).toMatch(/rgb\(64, 188, 244\) 0px 0px 0px 2px/);
      expect(parseFloat(await stageLink(page).evaluate((element) => getComputedStyle(element).borderTopLeftRadius))).toBeGreaterThan(8);
      expect(await cueOn(page)).toBe(true);
      await expect(stage(page).locator("[data-frame] > span")).toHaveCount(0);
    });
  });

  test.describe("at 390px", () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

    test("the band is 86% of the screen, the caps at its ends, and the phone's positions have not moved down", async ({ page }) => {
      await page.goto("/");
      await ready(page);
      const g = await bandGeometry(page);
      const band = 0.86 * 390;
      expect(Math.abs(g.leftCap.x - (390 - band) / 2)).toBeLessThanOrEqual(1.5);
      expect(Math.abs(g.rightCap.x + g.rightCap.width - (390 + band) / 2)).toBeLessThanOrEqual(1.5);
      expect(g.leftCap.x).toBeGreaterThanOrEqual(16);
      for (const x of g.dots) {
        expect(x).toBeGreaterThan(g.leftCap.x + g.leftCap.width);
        expect(x).toBeLessThan(g.rightCap.x);
      }
      // No drop on a phone: the line is at 82% of the stage.
      expect(Math.abs(g.lineY - g.root.y - 0.82 * g.root.height)).toBeLessThanOrEqual(1);
    });
  });

  test.describe("at 1280 x 720", () => {
    test.use({ viewport: { width: 1280, height: 720 } });

    test("the drop is less on a shorter stage, and the names still have room above its bottom edge", async ({ page }) => {
      await page.goto("/");
      await ready(page);
      const g = await bandGeometry(page);
      const drop = g.lineY - g.root.y - 0.82 * g.root.height;
      expect(drop).toBeGreaterThan(15);
      expect(drop).toBeLessThan(50);
      expect(g.root.y + g.root.height - (g.names.y + g.names.height)).toBeGreaterThanOrEqual(36);
    });
  });
});

test.describe("the halves and the figures", () => {
  test("the figures have no outline: the cut is its own edge against the montage", async ({ page }) => {
    await page.goto("/");
    await expect(stageLink(page)).toBeVisible();
    await expect(stage(page).locator("[data-part='figure'] svg image").first()).toBeAttached();
    await expect(stage(page).locator("[data-part='figure'] svg path")).toHaveCount(0);
  });

  test("each half runs out to the screen's edge, a narrow seam between them, rounded only at the seam; the figures and the keycaps stand inside the gutters, and the line spans the whole width", async ({ page }) => {
    await page.goto("/");
    await ready(page);
    const viewport = page.viewportSize()!;
    const frames = stage(page).locator("[data-frame]");
    const left = await box(frames.first());
    const right = await box(frames.last());
    // The halves are the screen's whole width, but for the narrow seam at the centre.
    expect(Math.round(left.x)).toBe(0);
    expect(Math.round(right.x + right.width)).toBe(viewport.width);
    const seam = right.x - (left.x + left.width);
    expect(seam).toBeGreaterThan(0);
    expect(seam).toBeLessThanOrEqual(14);
    expect(Math.abs(centreX({ x: left.x + left.width, width: seam }) - viewport.width / 2)).toBeLessThanOrEqual(1);

    // The stage's decoration box is inset by the gutters, and the halves run out past it on their outer sides; what stands in it (the figures, the keycaps) is inset too.
    const decoration = await box(frames.first().locator("xpath=.."));
    expect(decoration.x).toBeGreaterThan(20);
    expect(Math.abs(decoration.x + decoration.width - (viewport.width - decoration.x))).toBeLessThanOrEqual(1);
    const prev = await box(stage(page).getByRole("button", { name: "Previous pairing", exact: true }));
    const next = await box(stage(page).getByRole("button", { name: "Next pairing", exact: true }));
    expect(Math.abs(prev.x - (decoration.x + 8))).toBeLessThanOrEqual(1);
    expect(Math.abs(viewport.width - (next.x + next.width) - (decoration.x + 8))).toBeLessThanOrEqual(1);
    const figures = stage(page).locator("[data-part='figure']");
    const first = await box(figures.first());
    const last = await box(figures.last());
    expect(centreX(first)).toBeGreaterThan(decoration.x);
    expect(centreX(first)).toBeLessThan(viewport.width / 2);
    expect(centreX(last)).toBeGreaterThan(viewport.width / 2);
    expect(centreX(last)).toBeLessThan(viewport.width - decoration.x);

    // The outer corners are the screen's, square; the corners at the seam are rounded.
    const radii = await frames.evaluateAll((elements) => ({
      outerLeft: getComputedStyle(elements[0]).borderTopLeftRadius,
      innerRight: getComputedStyle(elements[0]).borderTopRightRadius,
      outerRight: getComputedStyle(elements[1]).borderTopRightRadius,
      innerLeft: getComputedStyle(elements[1]).borderTopLeftRadius,
    }));
    expect(radii.outerLeft).toBe("0px");
    expect(radii.outerRight).toBe("0px");
    expect(radii.innerRight).not.toBe("0px");
    expect(radii.innerLeft).not.toBe("0px");

    // The line spans the whole width, and nothing makes the page scroll sideways.
    const line = await box(stage(page).locator("[data-line]"));
    expect(line.x).toBeLessThanOrEqual(1);
    expect(line.x + line.width).toBeGreaterThanOrEqual(viewport.width - 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  });
});

test.describe("the genre pills are tabs of views", () => {
  test("Featured is the splash alone; a genre takes the splash's place with its grid, under the bar", async ({ page }) => {
    await page.goto("/");
    const featured = bar(page).getByRole("tab", { name: "Featured", exact: true });
    const horror = bar(page).getByRole("tab", { name: "Horror", exact: true });
    await expect(featured).toHaveAttribute("aria-selected", "true");
    await expect(horror).toHaveAttribute("aria-controls", "pairings-panel-horror");
    await expect(page.locator("#pairings-panel-horror")).toBeHidden();
    // The splash (and its one h1) is the Featured tabpanel's content, and all of it: no cards under it, and no "How it works".
    const howItWorks = page.getByRole("heading", { name: "How it works", level: 2 });
    const panel = page.locator("#pairings-panel-featured");
    await expect(panel).toHaveAttribute("role", "tabpanel");
    await expect(panel).toHaveAttribute("aria-labelledby", "pairings-tab-featured");
    await expect(panel.locator("[data-hero-stage]")).toHaveCount(1);
    await expect(panel.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(panel.getByRole("heading", { level: 2 })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Try a pairing" })).toHaveCount(0);
    await expect(panel.locator("a[href^='/p/']")).toHaveCount(1);
    await expect(howItWorks).toBeHidden();
    await expect(stageLink(page)).toBeVisible();

    await horror.click();
    await expect(page).toHaveURL(/#horror$/);
    await expect(horror).toHaveAttribute("aria-selected", "true");
    const grid = page.locator("#pairings-panel-horror");
    await expect(grid).toBeVisible();
    await expect(panel).toBeHidden();
    await expect(stage(page)).toBeHidden();
    // A small heading with the genre and the number of pairings; it is the page's heading there (the splash's h1 is in the hidden panel: still exactly one in the page).
    await expect(grid.getByRole("heading", { level: 2 })).toHaveText(/^Horror\s*\d+ pairings$/);
    await expect(grid.getByRole("heading", { level: 1 })).toHaveCount(0);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(0);
    // It is directly under the bar, at the top of the page, with no scroll.
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    const barBox = await box(bar(page));
    const heading = await box(grid.getByRole("heading", { level: 2 }));
    expect(heading.y - (barBox.y + barBox.height)).toBeLessThan(80);
    await expect(grid.getByRole("link").first()).toBeInViewport();
    // How it works stays at the bottom of a genre's view.
    await expect(howItWorks).toBeVisible();
    expect((await box(howItWorks)).y).toBeGreaterThan((await box(grid)).y + (await box(grid)).height - 1);

    await featured.click();
    await expect(page).not.toHaveURL(/#/);
    await expect(stageLink(page)).toBeVisible();
    await expect(grid).toBeHidden();
    await expect(howItWorks).toBeHidden();
  });

  test("choosing a tab brings a scrolled page back to the top, and the arrow keys move between tabs (and wrap) with the same effect", async ({ page }) => {
    await page.goto("/");
    await expect(stageLink(page)).toBeVisible();
    const horror = bar(page).getByRole("tab", { name: "Horror", exact: true });
    await horror.click();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    // Scrolled down the grid, then back to Featured (which is only the splash): it is at the top.
    await page.evaluate(() => window.scrollTo(0, 700));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(300);
    await bar(page).getByRole("tab", { name: "Featured", exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await horror.click();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);

    // Scrolled down the grid, then a key: the new view starts at the top.
    await page.evaluate(() => window.scrollTo(0, 500));
    await horror.focus();
    await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(/#sci-fi$/);
    await expect(bar(page).getByRole("tab", { name: "Sci-Fi", exact: true })).toBeFocused();
    await expect(page.locator("#pairings-panel-sci-fi")).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await page.keyboard.press("End");
    await expect(page).toHaveURL(/#animation$/);
    await page.keyboard.press("ArrowRight");
    await expect(page).not.toHaveURL(/#/);
    await expect(bar(page).getByRole("tab", { name: "Featured", exact: true })).toBeFocused();
    await expect(bar(page).getByRole("tab", { name: "Featured", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(stageLink(page)).toBeVisible();
  });

  test("a link to a genre opens straight on its grid, and the splash is never drawn (nor its images fetched) until the visitor comes to it", async ({ page }) => {
    const imageRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().startsWith("https://image.tmdb.org/t/p/h632")) imageRequests.push(request.url());
    });
    await page.goto("/#comedy");
    await expect(page.locator("#pairings-panel-comedy")).toBeVisible();
    await expect(bar(page).getByRole("tab", { name: "Comedy", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("#pairings-panel-featured")).toBeHidden();
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    // Let the page settle: the splash did not start.
    await page.waitForTimeout(1500);
    await expect(stage(page).locator("[data-frame]")).toHaveCount(0);
    expect(imageRequests).toEqual([]);
    // The deep link's mark is gone once the page is live (the state is the hash's).
    await expect(page.locator("[data-landing]")).not.toHaveAttribute("data-genre", /.+/);

    // Coming to Featured starts it.
    await bar(page).getByRole("tab", { name: "Featured", exact: true }).click();
    await expect(stageLink(page)).toBeVisible();
    await expect(stage(page).locator("[data-frame]")).toHaveCount(2);
  });

  test("a pairing card has its people as a large diagonal cascade of two tilted portrait cards straight on its surface at its left, nearly its whole height: A at the upper left turned left, B lower and to the right, turned right and over A's bottom right, in the link's order", async ({ page }) => {
    await page.goto("/#classic");
    const cards = page.locator("#pairings-panel-classic [data-landing-card]");
    await expect(cards.first().locator("[data-card-tile]")).toHaveCount(2);
    expect(await cards.count()).toBeGreaterThan(5);

    const card = cards.first();
    const href = (await card.getAttribute("href"))!;
    const ids = [...href.matchAll(/(\d+)-[^+/]+/g)].map((match) => match[1]);
    const rect = await box(card);
    const tiles = card.locator("[data-card-tile]");
    expect([await tiles.nth(0).getAttribute("data-card-tile"), await tiles.nth(1).getAttribute("data-card-tile")]).toEqual(ids);

    // Each is a cut-out over its montage (an SVG over the posters), a portrait rectangle of 3:4 (before it is turned), with rounded corners and a soft drop shadow.
    await expect(tiles.nth(0).locator("svg image, svg polygon").first()).toBeAttached();
    const sizes = await tiles.evaluateAll((elements) => elements.map((element) => ({ w: (element as HTMLElement).offsetWidth, h: (element as HTMLElement).offsetHeight, rotate: getComputedStyle(element).rotate, radius: parseFloat(getComputedStyle(element).borderTopLeftRadius), shadow: getComputedStyle(element).boxShadow, z: Number(getComputedStyle(element).zIndex) })));
    for (const size of sizes) {
      expect(size.w / size.h).toBeCloseTo(0.75, 1);
      expect(size.radius).toBeGreaterThanOrEqual(6);
      expect(size.shadow).not.toBe("none");
    }
    // Turned the opposite ways, about 5 degrees to the left and 4 to the right; B drawn over A.
    expect(parseFloat(sizes[0].rotate)).toBeCloseTo(-5, 0);
    expect(parseFloat(sizes[1].rotate)).toBeCloseTo(4, 0);
    expect(sizes[1].z).toBeGreaterThan(sizes[0].z);

    // No tile, box or background behind them: they sit on the card's surface (its own colour), with their shadows; the box they are in is a third of the card's width and its height.
    const cell = card.locator("[data-card-cell]");
    const cellBox = await box(cell);
    expect(await cell.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe("rgba(0, 0, 0, 0)");
    expect(await cell.evaluate((element) => getComputedStyle(element).borderTopWidth)).toBe("0px");
    expect(cellBox.width / rect.width).toBeGreaterThan(0.28);
    expect(cellBox.width / rect.width).toBeLessThan(0.36);
    // As tall as the card less its border and what is left of the padding (it goes 8px into it at the top and the bottom): the pair runs from near the card's top to near its bottom.
    expect(Math.abs(cellBox.height - (rect.height - 2 - 2 * (16 - 8)))).toBeLessThanOrEqual(2);
    expect(rect.height).toBeGreaterThanOrEqual(150);

    // Diagonal: B is to the right of and below A, and covers part of A's bottom right (about a quarter of it, by area), and is drawn over it.
    const a = await box(tiles.nth(0));
    const b = await box(tiles.nth(1));
    expect(b.x).toBeGreaterThan(a.x + 8);
    expect(b.y).toBeGreaterThan(a.y + 8);
    const overlap = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - b.x) * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - b.y);
    expect(overlap / (a.width * a.height)).toBeGreaterThan(0.15);
    expect(overlap / (a.width * a.height)).toBeLessThan(0.45);
    const topmost = await page.evaluate(({ x, y }) => (document.elementFromPoint(x, y)?.closest("[data-card-tile]") as HTMLElement | null)?.dataset.cardTile, { x: b.x + 8, y: b.y + 8 });
    expect(topmost).toBe(ids[1]);
    // Large, and centred on the card's height inside it: in a box as wide as a third of the card the pair is as wide as the box (and so, on a narrow card, a little shorter than the card);
    // where the card is short and wide enough it runs from near its top to near its bottom.
    const pairTop = Math.min(a.y, b.y);
    const pairBottom = Math.max(a.y + a.height, b.y + b.height);
    expect(pairTop).toBeGreaterThanOrEqual(rect.y + 1);
    expect(pairBottom).toBeLessThanOrEqual(rect.y + rect.height - 1);
    expect(Math.abs((pairTop + pairBottom) / 2 - (rect.y + rect.height / 2))).toBeLessThanOrEqual(4);
    expect((pairBottom - pairTop) / rect.height).toBeGreaterThan(0.55);
    expect(Math.min(a.x, b.x)).toBeGreaterThanOrEqual(rect.x + 8);
    expect(sizes[0].h / rect.height).toBeGreaterThan(0.38);
    // The text starts just past B's right edge.
    const text = await box(card.locator("h3").locator("xpath=.."));
    expect(text.x).toBeGreaterThanOrEqual(Math.max(a.x + a.width, b.x + b.width));
    expect(text.x - Math.max(a.x + a.width, b.x + b.width)).toBeLessThan(40);

    // The text is the card's own: the names, the blurb, "N films together"; no flush column, poster row, strip or headline.
    await expect(card.getByRole("heading", { level: 3 })).toHaveText(/ & /);
    await expect(card.locator("p").first()).not.toBeEmpty();
    await expect(card).toContainText(/\d+ films? together/);
    await expect(card.locator("img[src*='/w185/'], [data-dot], svg circle")).toHaveCount(0);
  });

  test("hovering or focusing a card slides its portraits a little (B 3px down and to the right, A 2px up and to the left) and with reduced motion nothing moves", async ({ page }) => {
    await page.goto("/#classic");
    const card = page.locator("#pairings-panel-classic [data-landing-card]").first();
    const tiles = card.locator("[data-card-tile]");
    await expect(tiles.nth(1)).toBeVisible();
    await page.waitForTimeout(600);
    const state = () => tiles.evaluateAll((elements) => elements.map((element) => getComputedStyle(element).translate));
    expect(await state()).toEqual(["none", "none"]);

    await card.hover();
    await expect.poll(async () => (await state())[0]).toBe("-2px -2px");
    expect((await state())[1]).toBe("3px 3px");
    // Eased: it is not instant (a 250ms transition runs).
    expect(await tiles.first().evaluate((element) => getComputedStyle(element).transitionDuration)).toContain("0.25s");

    // Away, and back with the keyboard: the same.
    await page.mouse.move(5, 300);
    await expect.poll(async () => (await state())[0]).toBe("none");
    await card.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect.poll(async () => (await state())[0]).toBe("-2px -2px");
  });

  test.describe("with reduced motion", () => {
    test.use({ reducedMotion: "reduce" });

    test("a hovered card's portraits do not move", async ({ page }) => {
      await page.goto("/#classic");
      const card = page.locator("#pairings-panel-classic [data-landing-card]").first();
      const tiles = card.locator("[data-card-tile]");
      await expect(tiles.nth(1)).toBeVisible();
      const before = await tiles.evaluateAll((elements) => elements.map((element) => [getComputedStyle(element).translate, getComputedStyle(element).rotate]));
      await card.hover();
      await page.waitForTimeout(500);
      const after = await tiles.evaluateAll((elements) => elements.map((element) => [getComputedStyle(element).translate, getComputedStyle(element).rotate]));
      expect(after).toEqual(before);
    });
  });

  test("the count follows the blurb in the text's flow (about 12px under it), and a card is only as tall as its text and padding", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/#classic");
    const cards = page.locator("#pairings-panel-classic [data-landing-card]");
    await expect(cards.first().locator("[data-card-tile] svg").first()).toBeAttached();
    const measured = await cards.evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        const blurb = element.querySelector("p")!.getBoundingClientRect();
        const count = [...element.querySelectorAll("p")].at(-1)!.getBoundingClientRect();
        const heading = element.querySelector("h3")!.getBoundingClientRect();
        const style = getComputedStyle(element);
        return { row: Math.round(rect.top), height: rect.height, gap: count.top - blurb.bottom, bottomRoom: rect.bottom - count.bottom, padding: parseFloat(style.paddingTop) + parseFloat(style.paddingBottom), textHeight: count.bottom - heading.top };
      }),
    );
    for (const card of measured) {
      // Straight after the blurb: a small gap (the p's own line-height adds a few px), not pushed to the card's bottom.
      expect(card.gap).toBeGreaterThanOrEqual(8);
      expect(card.gap).toBeLessThanOrEqual(18);
      expect(card.height).toBeGreaterThanOrEqual(110);
    }
    // The cards of a row stretch to the one with the most text, which is as tall as its text and its padding: nothing left under it but the padding (and the 1px border).
    const rows = new Map<number, typeof measured>();
    for (const card of measured) rows.set(card.row, [...(rows.get(card.row) ?? []), card]);
    expect(rows.size).toBeGreaterThan(3);
    for (const row of rows.values()) {
      expect(new Set(row.map((card) => Math.round(card.height))).size).toBe(1);
      const fullest = row.reduce((a, b) => (b.bottomRoom < a.bottomRoom ? b : a));
      expect(fullest.bottomRoom).toBeLessThanOrEqual(fullest.padding / 2 + 3);
      expect(fullest.height).toBeLessThanOrEqual(fullest.textHeight + fullest.padding + 4);
    }
    expect(Math.max(...measured.map((card) => card.height))).toBeLessThan(260);
  });

  for (const [width, columns] of [[1280, 3], [800, 2], [390, 1]] as const) {
    test(`at ${width}px the pairing cards are ${columns} to a row, and no title, blurb, count or tilted portrait runs out of its card (the longest of each, in their own genres)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      for (const genre of ["classic", "world-cinema", "drama", "comedy"]) {
        await page.goto(`/#${genre}`);
        const cards = page.locator(`#pairings-panel-${genre} [data-landing-card]`);
        await expect(cards.first().locator("[data-card-tile] svg").first()).toBeAttached();
        const boxes = await cards.evaluateAll((elements) => {
          return elements.map((element) => {
            const card = element.getBoundingClientRect();
            const inside = [...element.querySelectorAll("h3, p")].every((text) => {
              const rect = text.getBoundingClientRect();
              return rect.right <= card.right + 0.5 && rect.left >= card.left && rect.bottom <= card.bottom + 0.5 && text.scrollWidth <= text.clientWidth + 1;
            });
            // The tilted portraits (their boxes as drawn, tilt included) inside the card, their box a third of it, and the text clear of them.
            const tiles = [...element.querySelectorAll("[data-card-tile]")].map((tile) => tile.getBoundingClientRect());
            const box = element.querySelector("[data-card-cell]")!.getBoundingClientRect();
            const textLeft = element.querySelector("h3")!.getBoundingClientRect().left;
            const fanRight = Math.max(...tiles.map((tile) => tile.right));
            return {
              y: Math.round(card.y),
              inside,
              tilesInside: tiles.every((tile) => tile.left >= card.left + 4 && tile.top >= card.top + 1 && tile.bottom <= card.bottom - 1 && tile.right <= box.right + 6),
              clear: textLeft >= fanRight + 8,
              span: box.width / card.width,
              heights: [card.height],
            };
          });
        });
        expect(boxes.every((card) => card.inside)).toBe(true);
        expect(boxes.every((card) => card.tilesInside)).toBe(true);
        expect(boxes.every((card) => card.clear)).toBe(true);
        // The columns of the grid: the cards of the first row.
        expect(boxes.filter((card) => card.y === boxes[0].y)).toHaveLength(Math.min(columns, boxes.length));
        // The card at least 150px tall, the portraits' box about a third of its width.
        for (const card of boxes) {
          for (const height of card.heights) expect(height).toBeGreaterThanOrEqual(150);
          expect(card.span).toBeLessThan(0.36);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
      }
    });
  }

  test("a Featured visit never fetches the cards' portraits (they are not even in a hidden panel), and the images of a card that is shown are lazy", async ({ page }) => {
    // The cards' montages are w154 posters (the hero's are w185, its posters w342): nothing at that size is for the splash.
    const montage: string[] = [];
    page.on("request", (request) => {
      if (request.url().startsWith("https://image.tmdb.org/t/p/w154/")) montage.push(request.url());
    });
    await page.goto("/");
    await expect(stageLink(page)).toBeVisible();
    await page.waitForTimeout(1500);
    expect(montage).toEqual([]);
    // The cards are in the markup (crawlable), their portraits not: a hidden panel has no tiles to load.
    const hidden = page.locator("#pairings-panel-horror [data-landing-card]");
    expect(await hidden.count()).toBeGreaterThan(3);
    await expect(hidden.first().locator("[data-card-tile]")).toHaveCount(0);
    // Every image in a card is lazy.
    await bar(page).getByRole("tab", { name: "Horror", exact: true }).click();
    await expect(hidden.first().locator("[data-card-tile] img").first()).toBeAttached();
    const eager = await hidden.first().locator("img").evaluateAll((images) => images.filter((image) => (image as HTMLImageElement).loading !== "lazy").length);
    expect(eager).toBe(0);
  });

  test("a link to a genre never paints the splash first: before any script runs, the genre's panel and pill are the ones showing", async ({ page }) => {
    await page.route("**/_next/static/**", (route) => (route.request().resourceType() === "script" ? route.abort() : route.continue()));
    await page.goto("/#horror", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#pairings-panel-horror")).toBeVisible();
    await expect(page.locator("#pairings-panel-featured")).toBeHidden();
    // "How it works", for a genre's view, shows with its grid.
    await expect(page.getByRole("heading", { name: "How it works", level: 2 })).toBeVisible();
    // The pill follows (the server's markup has Featured's selected: the style that goes with the script says otherwise).
    // (The pills' borders ease between colours: poll for where they settle, so a slow machine's mid-transition frame is not read.)
    const border = (id: string) => page.evaluate((tab) => getComputedStyle(document.querySelector(`[data-genre-tab='${tab}']`)!).borderTopColor, id);
    await expect.poll(() => border("featured")).toBe("rgba(0, 0, 0, 0)");
    expect(await border("horror")).not.toBe("rgba(0, 0, 0, 0)");
    // A hash that names no genre is the splash.
    await page.goto("/?again#nonsense", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#pairings-panel-featured")).toBeVisible();
    await expect(page.getByRole("heading", { name: "How it works", level: 2 })).toBeHidden();
  });

  test("the hero's rotation holds still while a genre's grid is shown, and carries on when the splash comes back", async ({ page }) => {
    await page.clock.install();
    await page.goto("/");
    await expect(stageLink(page)).toBeVisible();
    // Past the reveal's animations, which are the browser's, not the clock's.
    await page.waitForTimeout(2000);
    const label = () => stageLink(page).getAttribute("aria-label");
    const first = await label();

    await bar(page).getByRole("tab", { name: "Horror", exact: true }).click();
    await expect(stage(page)).toBeHidden();
    await page.clock.runFor(40_000);
    await bar(page).getByRole("tab", { name: "Featured", exact: true }).click();
    await expect(stageLink(page)).toBeVisible();
    // Nothing changed behind the tab: the same scene is there.
    expect(await label()).toBe(first);

    // And it runs again: a few scene lengths later the scene is another.
    await page.waitForTimeout(500);
    await page.clock.runFor(30_000);
    await expect.poll(label).not.toBe(first);
  });
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 320, height: 640 }, hasTouch: true, isMobile: true });

  test("the names wrap to two centred lines: A on the first and '& B' on the second", async ({ page }) => {
    await page.goto("/");
    await ready(page);
    const { container, a, amp, b } = await nameBoxes(page);
    const link = await box(stageLink(page));
    // A is above the "&" and B; the "&" is beside B, on the second line, and the two lines are centred under the line.
    expect(a.y + a.height).toBeLessThanOrEqual(b.y + 2);
    expect(Math.abs(centreY(amp) - centreY(b))).toBeLessThanOrEqual(3);
    expect(Math.abs(centreX(a) - centreX(link))).toBeLessThanOrEqual(3);
    expect(Math.abs((amp.x + (b.x + b.width - amp.x) / 2) - centreX(link))).toBeLessThanOrEqual(3);
    expect(a.x).toBeGreaterThanOrEqual(link.x);
    expect(b.x + b.width).toBeLessThanOrEqual(link.x + link.width);
    expect(await container.evaluate((element) => parseFloat(getComputedStyle(element).fontSize))).toBe(16);
    const stageBox = await box(stage(page));
    expect(b.y + b.height).toBeLessThanOrEqual(stageBox.y + stageBox.height);
  });

  test("a touch screen gets no cue: no line under the names, and the stage is only a link", async ({ page }) => {
    await page.goto("/");
    await ready(page);
    expect(await cueOn(page)).toBe(false);
    await expect(cueLine(page)).toBeHidden();
    await expect(stageLink(page)).toHaveCount(1);
  });

  test("the headline is under the stage, nothing overflows sideways, the cluster and its pill fit, and the pills scroll in their own row", async ({ page }) => {
    await page.goto("/");
    await expect(stageLink(page)).toBeVisible();
    const stageBox = await box(stage(page));
    const h1 = await box(page.getByRole("heading", { level: 1 }));
    expect(h1.y).toBeGreaterThanOrEqual(stageBox.y + stageBox.height - 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    // Three posters at most, bunched at the middle, and "+N" (the number alone, for want of room) on the screen.
    const posters = stage(page).locator("[data-part='poster']").filter({ visible: true });
    expect(await posters.count()).toBeLessThanOrEqual(3);
    const first = await box(posters.first());
    const lastPoster = await box(posters.last());
    expect(lastPoster.x + lastPoster.width - first.x).toBeLessThanOrEqual(260);
    const more = stage(page).getByText(/^\+\d+/).filter({ visible: true });
    if ((await more.count()) > 0) {
      const pill = await box(more.first());
      expect(pill.x + pill.width).toBeLessThanOrEqual(320);
    }
    // The pills are a row of their own under the search, and the row scrolls (it is wider than the screen) without the page doing so.
    const search = await box(bar(page).getByRole("button", { name: /Search any film artist/ }));
    const pills = await box(bar(page).getByRole("tablist"));
    expect(pills.y).toBeGreaterThanOrEqual(search.y + search.height - 1);
    // Row one is the wordmark at the left and the search taking the rest, to the right.
    const home = await box(bar(page).getByRole("link", { name: "Parallel home", exact: true }));
    expect(home.x + home.width).toBeLessThanOrEqual(search.x);
    expect(Math.abs(centreY(home) - centreY(search))).toBeLessThanOrEqual(4);
    expect(search.x + search.width).toBeLessThanOrEqual(320 - 8);
    expect(await bar(page).getByRole("tablist").evaluate((list) => list.parentElement!.scrollWidth > list.parentElement!.clientWidth)).toBe(true);
  });
});
