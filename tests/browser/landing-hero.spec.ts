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

test.describe("the variants", () => {
  /** The figure, the first frame and the last, as boxes. */
  const geometry = async (page: Page) => ({
    figure: await box(stage(page).locator("[data-part='figure']").first()),
    frameLeft: await box(stage(page).locator("[data-frame]").first()),
    frameRight: await box(stage(page).locator("[data-frame]").last()),
  });

  test("edge=full (the default) strokes the whole outline, frame edges included; edge=none draws no outline at all", async ({ page }) => {
    await page.goto("/");
    await expect(stageLink(page)).toBeVisible();
    const paths = stage(page).locator("[data-part='figure'] svg path");
    await expect.poll(() => paths.count()).toBeGreaterThan(0);
    // The closed outline ends in a Z: it goes on along the photo's own frame edge where the cut meets it.
    for (const d of await paths.evaluateAll((elements) => elements.map((element) => element.getAttribute("d")!))) expect(d.endsWith("Z")).toBe(true);

    await page.goto("/?edge=none");
    await expect(stageLink(page)).toBeVisible();
    await expect(stage(page).locator("[data-part='figure'] svg image").first()).toBeAttached();
    await expect(stage(page).locator("[data-part='figure'] svg path")).toHaveCount(0);
  });

  test("layout=wide lets each half run out to the screen's edge, the figures stay where they are, and the keycaps and caps do not move", async ({ page }) => {
    await page.goto("/");
    await ready(page);
    const viewport = page.viewportSize()!;
    const panels = await geometry(page);
    // Two inset panels, the seam between them.
    expect(panels.frameLeft.x).toBeGreaterThan(20);
    expect(viewport.width - (panels.frameRight.x + panels.frameRight.width)).toBeGreaterThan(20);
    const prev = await box(stage(page).getByRole("button", { name: "Previous pairing", exact: true }));
    const cap = await box(stage(page).locator("span.tabular-nums.text-strong").first());
    const seam = panels.frameRight.x - (panels.frameLeft.x + panels.frameLeft.width);
    expect(seam).toBeGreaterThan(0);
    expect(seam).toBeLessThanOrEqual(14);

    await page.goto("/?layout=wide");
    await ready(page);
    await expect(stage(page)).toHaveAttribute("data-layout", "wide");
    const wide = await geometry(page);
    expect(Math.round(wide.frameLeft.x)).toBe(0);
    expect(Math.round(wide.frameRight.x + wide.frameRight.width)).toBe(viewport.width);
    // The same narrow seam at the centre.
    expect(Math.abs(wide.frameRight.x - (wide.frameLeft.x + wide.frameLeft.width) - seam)).toBeLessThanOrEqual(1);
    // The figure, the keycap and the cap are where they were.
    expect(Math.abs(wide.figure.x - panels.figure.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(wide.figure.y - panels.figure.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(wide.figure.width - panels.figure.width)).toBeLessThanOrEqual(1);
    const prevWide = await box(stage(page).getByRole("button", { name: "Previous pairing", exact: true }));
    expect(Math.abs(prevWide.x - prev.x)).toBeLessThanOrEqual(1);
    const capWide = await box(stage(page).locator("span.tabular-nums.text-strong").first());
    expect(Math.abs(capWide.x - cap.x)).toBeLessThanOrEqual(1);
    // The outer corners are the screen's, square; the corners at the seam stay rounded.
    const radii = await stage(page).locator("[data-frame]").evaluateAll((frames) => ({
      outerLeft: getComputedStyle(frames[0]).borderTopLeftRadius,
      innerRight: getComputedStyle(frames[0]).borderTopRightRadius,
      outerRight: getComputedStyle(frames[1]).borderTopRightRadius,
      innerLeft: getComputedStyle(frames[1]).borderTopLeftRadius,
    }));
    expect(radii.outerLeft).toBe("0px");
    expect(radii.outerRight).toBe("0px");
    expect(radii.innerRight).not.toBe("0px");
    expect(radii.innerLeft).not.toBe("0px");
    // The line spans the whole width.
    const line = await box(stage(page).locator("[data-line]"));
    expect(line.x).toBeLessThanOrEqual(1);
    expect(line.x + line.width).toBeGreaterThanOrEqual(viewport.width - 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  });

  test("the Variants control sets the query without a reload, and the stage follows", async ({ page }) => {
    await page.goto("/");
    await expect(stageLink(page)).toBeVisible();
    // A marker that a reload would lose.
    await page.evaluate(() => ((window as unknown as { __kept: boolean }).__kept = true));
    const lab = page.getByRole("group", { name: "Variants", exact: true });
    await expect(lab).toBeVisible();
    await expect(lab.getByRole("button", { name: "full", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(lab.getByRole("button", { name: "panels", exact: true })).toHaveAttribute("aria-pressed", "true");

    await lab.getByRole("button", { name: "wide", exact: true }).click();
    await expect(page).toHaveURL(/\?layout=wide$/);
    await expect(stage(page)).toHaveAttribute("data-layout", "wide");
    await lab.getByRole("button", { name: "none", exact: true }).click();
    await expect(page).toHaveURL(/\?layout=wide&edge=none$/);
    await expect(stage(page).locator("[data-part='figure'] svg path")).toHaveCount(0);
    await lab.getByRole("button", { name: "panels", exact: true }).click();
    await expect(stage(page)).toHaveAttribute("data-layout", "panels");
    expect(await page.evaluate(() => (window as unknown as { __kept?: boolean }).__kept)).toBe(true);
    // It does not sit over the dev server's badge (bottom left).
    const labBox = await box(lab);
    expect(labBox.x).toBeGreaterThan((page.viewportSize()!.width * 2) / 3);
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

  test("a link to a genre never paints the splash first: before any script runs, the genre's panel and pill are the ones showing", async ({ page }) => {
    await page.route("**/_next/static/**", (route) => (route.request().resourceType() === "script" ? route.abort() : route.continue()));
    await page.goto("/#horror", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#pairings-panel-horror")).toBeVisible();
    await expect(page.locator("#pairings-panel-featured")).toBeHidden();
    // "How it works", for a genre's view, shows with its grid.
    await expect(page.getByRole("heading", { name: "How it works", level: 2 })).toBeVisible();
    // The pill follows (the server's markup has Featured's selected: the style that goes with the script says otherwise).
    const colors = await page.evaluate(() => {
      const border = (id: string) => getComputedStyle(document.querySelector(`[data-genre-tab='${id}']`)!).borderTopColor;
      return { featured: border("featured"), horror: border("horror") };
    });
    expect(colors.featured).toBe("rgba(0, 0, 0, 0)");
    expect(colors.horror).not.toBe("rgba(0, 0, 0, 0)");
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
