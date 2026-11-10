import { test, expect, openPeople, scrollState, timeline, viewLink, PEOPLE_PATH } from "./fixtures";

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

test("the combined track has no left column: the timeline is as wide as the page, with the bar's gutter, and no room is kept at its left", async ({ page }) => {
  await openPeople(page);
  const track = timeline(page);
  // No people column, no card over the corner: the track starts at the box's own left edge.
  await expect(page.getByRole("complementary", { name: "People", exact: true })).toHaveCount(0);
  await expect.poll(async () => (await scrollState(track)).inset).toBe(0);
  const viewport = page.viewportSize()!;
  const box = (await track.boundingBox())!;
  // The page's own gutter (12px, the bar's), both sides: the Table and Quotes are the ones with a reading column.
  expect(Math.round(box.x)).toBe(12);
  expect(Math.round(viewport.width - (box.x + box.width))).toBe(12);
});
