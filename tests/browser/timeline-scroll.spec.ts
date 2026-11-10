import { test, expect, collapseHero, openPeople, scrollState, timeline, viewLink, PEOPLE_PATH } from "./fixtures";

// Activate the server-side fetch fixtures before any test navigates to a people page.
test.beforeEach(async ({ next }) => { void next; });

async function expectBaseline(track: ReturnType<typeof timeline>) {
  await expect.poll(async () => {
    const { top, max } = await scrollState(track);
    return max > 50 && Math.abs(top - max) <= 1;
  }).toBe(true);
}

test("initial Combined view opens at its baseline in an overflowing viewport", async ({ page }) => {
  await openPeople(page);
  await expectBaseline(timeline(page));
});

test("a linked period finishes its programmatic zoom at the Combined baseline", async ({ page }) => {
  await openPeople(page, "?from=2000&to=2019");
  await expectBaseline(timeline(page));
});

test("the first Timeline visit from Table initializes the Combined baseline", async ({ page }) => {
  await page.goto(`${PEOPLE_PATH}?view=table`);
  await expect(viewLink(page, "table")).toHaveAttribute("aria-current", "page");
  await viewLink(page, "timeline").click();
  await expect(viewLink(page, "timeline")).toHaveAttribute("aria-current", "page");
  await expectBaseline(timeline(page));
});

test("manual zoom preserves vertical exploration with Show all films enabled", async ({ page }) => {
  await openPeople(page);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("checkbox", { name: "Show all films", exact: true }).check();
  await page.keyboard.press("Escape");
  const track = timeline(page);
  await expect.poll(async () => (await scrollState(track)).max).toBeGreaterThan(50);
  await track.evaluate((element) => { element.scrollTop = 25; });
  await expect.poll(async () => (await scrollState(track)).top).toBe(25);
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect.poll(async () => (await scrollState(track)).top).toBe(25);
  expect((await scrollState(track)).max).toBeGreaterThan(50);
});

test("the Timeline is the whole screen under the bar, edge to edge: no box, no border, and the minimap pinned to the bottom of the viewport", async ({ page }) => {
  await openPeople(page);
  const track = timeline(page);
  // No people column, no card over the corner: the track starts at the screen's own left edge, and has no start inset (this pair has no Quotes, so no nav floats over it).
  await expect(page.getByRole("complementary", { name: "People", exact: true })).toHaveCount(0);
  await expect.poll(async () => (await scrollState(track)).inset).toBe(0);
  const viewport = page.viewportSize()!;
  const box = (await track.boundingBox())!;
  expect(box.x).toBe(0);
  expect(box.y).toBe(0);
  expect(box.width).toBe(viewport.width);
  // No card: no border, no rounded corners, and no outline while nothing has the keyboard.
  const look = await track.evaluate((element) => {
    const css = getComputedStyle(element);
    return { border: css.borderTopWidth, radius: css.borderTopLeftRadius, outline: css.outlineStyle };
  });
  expect(look).toEqual({ border: "0px", radius: "0px", outline: "none" });
  // The minimap and zoom bar are the last of the screen: under the track, at the viewport's bottom edge.
  const bar = (await page.locator("[data-minimap-bar]").boundingBox())!;
  expect(Math.round(bar.y + bar.height)).toBe(viewport.height);
  expect(Math.round(box.y + box.height)).toBe(Math.round(bar.y));
  // The page does not scroll under it: the footer is out of the way while the Timeline is the view shown.
  await expect(page.locator("body > footer")).toBeHidden();
});

test("the track's focus ring is for the keyboard, drawn inside its edge; a click gives it none", async ({ page }) => {
  await openPeople(page);
  const track = timeline(page);
  const ring = () => track.evaluate((element) => {
    const css = getComputedStyle(element);
    return { style: css.outlineStyle, width: css.outlineWidth, offset: parseFloat(css.outlineOffset) };
  });
  expect((await ring()).style).toBe("none");
  // A click on the empty surface focuses it (it is focusable for the arrow keys), but a mouse does not show a ring. (With the pair hero collapsed: while it is open its
  // band is over the top of the track.)
  await collapseHero(page);
  await page.mouse.click(700, 120);
  await expect(track).toBeFocused();
  expect((await ring()).style).toBe("none");
  // The keyboard does: 2px, and inside the edge (a negative offset), not the page's usual ring round the outside.
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(track).toBeFocused();
  const shown = await ring();
  expect(shown.style).toBe("solid");
  expect(shown.width).toBe("2px");
  expect(shown.offset).toBeLessThan(0);
});

test("row 1 is clear of the page bar, whatever the rows: with the track at the top, the highest poster starts under the bar with room", async ({ page }) => {
  await openPeople(page);
  const track = timeline(page);
  // Every film has a poster (Show all films is on): the fixture's pile of shared films makes more rows than a short screen has room for, so the track scrolls.
  await expect.poll(async () => (await scrollState(track)).max).toBeGreaterThan(50);
  await track.evaluate((element) => {
    element.scrollTop = 0;
  });
  await expect.poll(async () => (await scrollState(track)).top).toBe(0);
  const bar = (await page.locator("[data-people-bar] [data-pill-capsule]").boundingBox())!;
  const tops = await track.locator("li > button[data-film]").evaluateAll((cards) => cards.map((card) => card.getBoundingClientRect().top));
  expect(tops.length).toBeGreaterThan(10);
  // Clear of the bar's bottom edge by its breathing room (10px), the top row being the first.
  expect(Math.min(...tops)).toBeGreaterThanOrEqual(bar.y + bar.height + 8);
});

test("the footer is under the Timeline's screen: it is there on the Table, and not on the Timeline", async ({ page }) => {
  await page.goto(`${PEOPLE_PATH}?view=table`);
  await expect(viewLink(page, "table")).toHaveAttribute("aria-current", "page");
  await expect(page.locator("body > footer")).toBeAttached();
  await expect(page.locator("body > footer")).toBeVisible();
  await viewLink(page, "timeline").click();
  await expect(viewLink(page, "timeline")).toHaveAttribute("aria-current", "page");
  await expect(page.locator("body > footer")).toBeHidden();
});
