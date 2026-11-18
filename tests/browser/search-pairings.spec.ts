import { test, expect, openPeople, PEOPLE_PATH } from "./fixtures";

const people = [
  { id: 90000001, name: "Scroll Alpha", profilePath: null, knownFor: "Acting", knownForTitles: ["Scroll Film"] },
  { id: 90000002, name: "Scroll Beta", profilePath: null, knownFor: "Acting", knownForTitles: ["Scroll Film"] },
];
const pairings = [
  { href: PEOPLE_PATH, people, sharedCount: 9, blurb: "Two actors in Scroll Film." },
  { href: "/p/90000001-scroll-alpha+90000003-scroll-gamma", people: [people[0], { id: 90000003, name: "Scroll Gamma", profilePath: null }], sharedCount: 8, blurb: "Another collaboration." },
];

test.beforeEach(async ({ page, next }) => {
  void next;
  await page.route("**/api/search?*", (route) => route.fulfill({ json: { results: people, pairings } }));
});

test("home lists people first, then every related pairing, and clicking one opens the pair", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("combobox").fill("Scroll Alpha");
  const options = page.getByRole("option");
  await expect(options).toHaveCount(4);
  await expect(options.nth(0)).toContainText("Scroll Alpha");
  await expect(options.nth(1)).toContainText("Scroll Beta");
  await expect(options.nth(2)).toContainText("Scroll Alpha × Scroll Beta");
  await expect(options.nth(2)).toContainText("9 films together");
  await expect(options.nth(3)).toContainText("Scroll Alpha × Scroll Gamma");
  await expect(page.getByText("Related pairings", { exact: true })).toBeVisible();
  const related = page.getByRole("group", { name: "Related pairings", exact: true });
  await expect(related).toBeVisible();
  await expect(related.getByRole("option")).toHaveCount(2);
  await options.nth(2).click();
  await expect(page).toHaveURL(PEOPLE_PATH);
});

for (const key of ["Enter", "Tab"]) {
  test(`universal search can open a pairing with ${key} and dismisses after navigation`, async ({ page }) => {
    await page.goto("/search-test-not-found");
    await page.getByRole("banner").getByRole("button", { name: "Search", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Search people", exact: true });
    const field = dialog.getByRole("combobox");
    await field.fill("Scroll Alpha");
    await expect(dialog.getByRole("option")).toHaveCount(4);
    await field.press("ArrowDown");
    await field.press("ArrowDown");
    await field.press("ArrowDown");
    const pairing = dialog.getByRole("group", { name: "Related pairings", exact: true }).getByRole("option").first();
    await expect(pairing).toHaveAttribute("aria-selected", "true");
    await expect(field).toHaveAttribute("aria-activedescendant", await pairing.getAttribute("id") as string);
    await field.press(key);
    await expect(page).toHaveURL(PEOPLE_PATH);
    await expect(dialog).toHaveCount(0);
  });
}

test("the default commit still adds the person, and pairings cannot replace selected chips", async ({ page }) => {
  await page.goto("/");
  const field = page.getByRole("combobox");
  await field.fill("Scroll Alpha");
  await expect(page.getByRole("option")).toHaveCount(4);
  await field.press("Tab");
  await expect(page.getByRole("list", { name: "Selected people" })).toContainText("Scroll Alpha");
  await expect(page).toHaveURL("/");
  await field.fill("Scroll Beta");
  await expect(page.getByRole("option")).toHaveCount(2);
  await expect(page.getByText("Related pairings", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("option").nth(1)).not.toHaveAttribute("aria-disabled", "true");
  await field.press("Enter");
  await expect(page.getByRole("list", { name: "Selected people" }).getByRole("listitem")).toHaveCount(2);
  await field.press("Enter");
  await expect(page).toHaveURL(PEOPLE_PATH);
});

test("stale pairings stay inert while the next query is loading", async ({ page }) => {
  await page.goto("/");
  const field = page.getByRole("combobox");
  await field.fill("Scroll Alpha");
  await expect(page.getByRole("option")).toHaveCount(4);
  let respond!: () => void;
  const pending = new Promise<void>((resolve) => { respond = resolve; });
  await page.route("**/api/search?q=nobody", async (route) => {
    await pending;
    await route.fulfill({ json: { results: [], pairings: [] } });
  });
  await field.fill("nobody");
  const stalePairing = page.getByRole("option").nth(2);
  await expect(stalePairing).toHaveAttribute("aria-disabled", "true");
  await stalePairing.click({ force: true });
  await field.press("Enter");
  await expect(page).toHaveURL("/");
  respond();
  await expect(page.getByRole("option")).toHaveCount(0);
  await expect(page.getByText("Related pairings", { exact: true })).toHaveCount(0);
  await expect(page.getByText("No one found for", { exact: false })).toBeVisible();
});

test("a person with no curated pairings keeps the usual people-only search", async ({ page }) => {
  await page.route("**/api/search?*", (route) => route.fulfill({ json: { results: people.slice(0, 1), pairings: [] } }));
  await page.goto("/");
  await page.getByRole("combobox").fill("Scroll Alpha");
  await expect(page.getByRole("option")).toHaveCount(1);
  await expect(page.getByText("Related pairings", { exact: true })).toHaveCount(0);
  await page.getByRole("combobox").press("Enter");
  await expect(page.getByRole("list", { name: "Selected people" })).toContainText("Scroll Alpha");
});

test("the contextual People search never offers a shortcut that would replace the timeline", async ({ page }) => {
  await openPeople(page);
  await page.keyboard.press("ControlOrMeta+k");
  const dialog = page.getByRole("dialog", { name: "People", exact: true });
  await dialog.getByRole("combobox").fill("Scroll Alpha");
  await expect(dialog.getByRole("option")).toHaveCount(2);
  await expect(dialog.getByText("Related pairings", { exact: true })).toHaveCount(0);
  await expect(page).toHaveURL(PEOPLE_PATH);
});

test.describe("on a narrow phone", () => {
  test.use({ viewport: { width: 320, height: 568 }, hasTouch: true, isMobile: true });

  test("can read and tap a pairing without horizontal overflow", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("combobox").fill("Scroll Alpha");
    const pairing = page.getByRole("option").nth(2);
    await expect(pairing).toContainText("Scroll Alpha × Scroll Beta");
    const box = (await pairing.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(320);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    await pairing.tap();
    await expect(page).toHaveURL(PEOPLE_PATH);
  });
});
