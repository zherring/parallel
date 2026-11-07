import { test, expect, openPeople, scrollState, timeline, PEOPLE_PATH } from "./fixtures";

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
  await expect(page.getByRole("tab", { name: "Table", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Timeline", exact: true }).click();
  await expectBaseline(timeline(page));
});

test("manual zoom preserves vertical exploration with Show all films enabled", async ({ page }) => {
  await openPeople(page);
  await page.getByRole("button", { name: "Film settings", exact: true }).click();
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

test("an individual caret preserves the centred year when undocking the People column", async ({ page }) => {
  await openPeople(page);
  await page.getByRole("button", { name: "Expand every person's details", exact: true }).click();
  const track = timeline(page);
  await expect.poll(async () => (await scrollState(track)).inset).toBe(272);
  const before = await scrollState(track);
  expect(before.centre).toBeGreaterThan(500); // Not at the clamped start of the axis.
  await page.getByRole("button", { name: "Collapse Scroll Alpha", exact: true }).click();
  await expect.poll(async () => (await scrollState(track)).inset).toBe(296);
  await expect.poll(async () => Math.abs((await scrollState(track)).centre - before.centre)).toBeLessThanOrEqual(1);
});
