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

test("home puts an obvious match's pairings ahead of More artists, and clicking one opens the pair", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("combobox").fill("Scroll Alpha");
  const options = page.getByRole("option");
  await expect(options).toHaveCount(4);
  await expect(options.nth(0)).toContainText("Scroll Alpha");
  await expect(options.nth(1)).toContainText("Scroll Alpha × Scroll Beta");
  await expect(options.nth(1)).toContainText("9 films together");
  await expect(options.nth(2)).toContainText("Scroll Alpha × Scroll Gamma");
  await expect(options.nth(3)).toContainText("Scroll Beta");
  await expect(page.getByRole("group", { name: "More artists", exact: true }).getByRole("option")).toHaveCount(1);
  await expect(page.getByText("Related pairings", { exact: true })).toBeVisible();
  const related = page.getByRole("group", { name: "Related pairings", exact: true });
  await expect(related).toBeVisible();
  await expect(related.getByRole("option")).toHaveCount(2);
  await options.nth(1).click();
  await expect(page).toHaveURL(PEOPLE_PATH);
});

for (const example of [
  { query: "gerwig", id: 45400, name: "Greta Gerwig", other: (i: number) => `Artist ${i} Gerwig` },
  { query: "james cameron", id: 2710, name: "James Cameron", other: () => "James Cameron" },
]) {
  test(`${example.query}: pairings appear before seven other matches without scrolling the menu`, async ({ page }) => {
    const first = { ...people[0], id: example.id, name: example.name };
    const matches = [first, ...Array.from({ length: 7 }, (_, i) => ({ ...people[1], id: 10000 + i, name: example.other(i) }))];
    const related = pairings.map((pairing) => ({ ...pairing, people: [first, pairing.people[1]] }));
    await page.route("**/api/search?*", (route) => route.fulfill({ json: { results: matches, pairings: related } }));
    await page.goto("/");
    await page.getByRole("combobox").fill(example.query);
    const options = page.getByRole("option");
    await expect(options).toHaveCount(10);
    await expect(options.first()).toContainText(example.name);
    const relatedGroup = page.getByRole("group", { name: "Related pairings", exact: true });
    await expect(relatedGroup.getByRole("option")).toHaveCount(2);
    const more = page.getByRole("group", { name: "More artists", exact: true });
    await expect(more.getByRole("option")).toHaveCount(7);
    const panel = page.getByRole("tabpanel", { name: "All", exact: true }).locator("..");
    expect(await panel.evaluate((element) => element.scrollTop)).toBe(0);
    const menu = (await panel.boundingBox())!;
    const firstPair = (await relatedGroup.getByRole("option").first().boundingBox())!;
    expect(firstPair.y + firstPair.height).toBeLessThanOrEqual(menu.y + menu.height);
    await expect(options.nth(1)).toContainText(`${example.name} ×`);
    await expect(options.nth(3)).toContainText(example.other(0));
  });
}

test("a broad first-name search keeps all artists before the related pairings", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("combobox").fill("Scroll");
  const options = page.getByRole("option");
  await expect(options).toHaveCount(4);
  await expect(options.nth(0)).toContainText("Scroll Alpha");
  await expect(options.nth(1)).toContainText("Scroll Beta");
  await expect(options.nth(2)).toContainText("Scroll Alpha × Scroll Beta");
  await expect(page.getByRole("group", { name: "More artists", exact: true })).toHaveCount(0);
});

test("keyboard navigation reaches More artists using the same indices as the visible rows", async ({ page }) => {
  await page.goto("/");
  const field = page.getByRole("combobox");
  await field.fill("Scroll Alpha");
  await expect(page.getByRole("option")).toHaveCount(4);
  await field.press("ArrowDown");
  await field.press("End");
  const alternative = page.getByRole("group", { name: "More artists", exact: true }).getByRole("option");
  await expect(alternative).toHaveAttribute("aria-selected", "true");
  await expect(field).toHaveAttribute("aria-activedescendant", await alternative.getAttribute("id") as string);
  await field.press("Enter");
  await expect(page.getByRole("list", { name: "Selected people" })).toContainText("Scroll Beta");
  await expect(page).toHaveURL("/");
});

test("universal search opens a pairing with Enter and dismisses after navigation", async ({ page }) => {
  await page.goto("/search-test-not-found");
  await page.getByRole("banner").getByRole("button", { name: "Search", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Search people", exact: true });
  const field = dialog.getByRole("combobox");
  await field.fill("Scroll Alpha");
  await expect(dialog.getByRole("option")).toHaveCount(4);
  await field.press("ArrowDown");
  await field.press("ArrowDown");
  const pairing = dialog.getByRole("group", { name: "Related pairings", exact: true }).getByRole("option").first();
  await expect(pairing).toHaveAttribute("aria-selected", "true");
  await expect(field).toHaveAttribute("aria-activedescendant", await pairing.getAttribute("id") as string);
  await field.press("Enter");
  await expect(page).toHaveURL(PEOPLE_PATH);
  await expect(dialog).toHaveCount(0);
});

test("Tab moves to category tabs without selecting; arrows switch categories and Tab reaches results", async ({ page }) => {
  await page.goto("/search-test-not-found");
  await page.getByRole("banner").getByRole("button", { name: "Search", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Search people", exact: true });
  const field = dialog.getByRole("combobox");
  await field.fill("Scroll Alpha");
  await expect(dialog.getByRole("option")).toHaveCount(4);
  await field.press("Tab");
  const all = dialog.getByRole("tab", { name: "All", exact: true });
  const artists = dialog.getByRole("tab", { name: "Artists", exact: true });
  const pairingsTab = dialog.getByRole("tab", { name: "Pairings", exact: true });
  await expect(all).toBeFocused();
  await expect(dialog.getByRole("list", { name: "Selected people" })).toHaveCount(0);
  await expect(field).toHaveValue("Scroll Alpha");
  await page.keyboard.press("ArrowRight");
  await expect(artists).toBeFocused();
  await expect(artists).toHaveAttribute("aria-selected", "true");
  await expect(dialog.getByRole("option")).toHaveCount(2);
  await expect(dialog.getByRole("group", { name: "Related pairings", exact: true })).toHaveCount(0);
  await page.keyboard.press("ArrowRight");
  await expect(pairingsTab).toBeFocused();
  await expect(pairingsTab).toHaveAttribute("aria-selected", "true");
  await expect(dialog.getByRole("tabpanel", { name: "Pairings", exact: true })).toBeVisible();
  await expect(dialog.getByRole("option")).toHaveCount(2);
  await page.keyboard.press("Tab");
  const results = dialog.getByRole("listbox", { name: "Pairings", exact: true });
  await expect(results).toBeFocused();
  await expect(results.getByRole("option").first()).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(PEOPLE_PATH);
  await expect(dialog).toHaveCount(0);
});

for (const surface of ["home", "dialog"] as const) {
  test(`${surface}: repeated Tab activates All, Artists, Pairings and results; Shift+Tab goes backwards`, async ({ page }) => {
    await page.goto(surface === "home" ? "/" : "/search-test-not-found");
    if (surface === "dialog") {
      await page.getByRole("banner").getByRole("button", { name: "Search", exact: true }).click();
    }
    const scope = surface === "home" ? page : page.getByRole("dialog", { name: "Search people", exact: true });
    const field = scope.getByRole("combobox");
    await field.fill("Scroll Alpha");
    await expect(scope.getByRole("option")).toHaveCount(4);
    for (const [name, count] of [["All", 4], ["Artists", 2], ["Pairings", 2]] as const) {
      await page.keyboard.press("Tab");
      const tab = scope.getByRole("tab", { name, exact: true });
      await expect(tab).toBeFocused();
      await expect(tab).toHaveAttribute("aria-selected", "true");
      await expect(scope.getByRole("option")).toHaveCount(count);
    }
    await page.keyboard.press("Tab");
    const results = scope.getByRole("listbox", { name: "Pairings", exact: true });
    await expect(results).toBeFocused();
    await expect(results.getByRole("option").first()).toHaveAttribute("aria-selected", "true");
    for (const [name, count] of [["Pairings", 2], ["Artists", 2], ["All", 4]] as const) {
      await page.keyboard.press("Shift+Tab");
      const tab = scope.getByRole("tab", { name, exact: true });
      await expect(tab).toBeFocused();
      await expect(tab).toHaveAttribute("aria-selected", "true");
      await expect(scope.getByRole("option")).toHaveCount(count);
    }
    await page.keyboard.press("Shift+Tab");
    await expect(field).toBeFocused();
    await expect(field).toHaveValue("Scroll Alpha");
    await expect(scope.getByRole("list", { name: "Selected people" })).toHaveCount(0);
    await expect(scope.getByRole("tablist", { name: "Search categories", exact: true })).toBeVisible();
  });
}

test("category clicks preserve the query and reuse results without another API request", async ({ page }) => {
  let requests = 0;
  await page.route("**/api/search?*", (route) => {
    requests += 1;
    return route.fulfill({ json: { results: people, pairings } });
  });
  await page.goto("/");
  const field = page.getByRole("combobox");
  await field.fill("Scroll Alpha");
  await expect(page.getByRole("option")).toHaveCount(4);
  await page.getByRole("tab", { name: "Artists", exact: true }).click();
  await expect(page.getByRole("option")).toHaveCount(2);
  await expect(page.getByRole("option").nth(1)).toContainText("Scroll Beta");
  await page.getByRole("tab", { name: "Pairings", exact: true }).click();
  await expect(page.getByRole("option")).toHaveCount(2);
  await expect(page.getByRole("option").first()).toContainText("Scroll Alpha × Scroll Beta");
  await page.getByRole("tab", { name: "All", exact: true }).click();
  await expect(page.getByRole("option")).toHaveCount(4);
  await expect(field).toHaveValue("Scroll Alpha");
  expect(requests).toBe(1);
});

test("Pairings has an empty state and Artists remains available", async ({ page }) => {
  await page.route("**/api/search?*", (route) => route.fulfill({ json: { results: people, pairings: [] } }));
  await page.goto("/");
  await page.getByRole("combobox").fill("Scroll Alpha");
  await expect(page.getByRole("option")).toHaveCount(2);
  await page.getByRole("tab", { name: "Pairings", exact: true }).click();
  await expect(page.getByRole("option")).toHaveCount(0);
  await expect(page.getByRole("tabpanel", { name: "Pairings", exact: true })).toContainText("No curated pairings for this search.");
  await page.getByRole("tab", { name: "Artists", exact: true }).click();
  await expect(page.getByRole("option")).toHaveCount(2);
});

test("category keyboard navigation wraps, and Escape returns to the field with the menu closed", async ({ page }) => {
  await page.goto("/");
  const field = page.getByRole("combobox");
  await field.fill("Scroll Alpha");
  await expect(page.getByRole("option")).toHaveCount(4);
  await field.press("Tab");
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("tab", { name: "Pairings", exact: true })).toBeFocused();
  await page.keyboard.press("Home");
  await expect(page.getByRole("tab", { name: "All", exact: true })).toBeFocused();
  await page.keyboard.press("End");
  await expect(page.getByRole("tab", { name: "Pairings", exact: true })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("listbox", { name: "Pairings", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(field).toBeFocused();
  await expect(page.getByRole("tablist", { name: "Search categories", exact: true })).toHaveCount(0);
  await expect(page.getByRole("option")).toHaveCount(0);
  await expect(field).toHaveValue("Scroll Alpha");
});

test("the default commit still adds the person, and pairings cannot replace selected chips", async ({ page }) => {
  await page.goto("/");
  const field = page.getByRole("combobox");
  await field.fill("Scroll Alpha");
  await expect(page.getByRole("option")).toHaveCount(4);
  await field.press("Enter");
  await expect(page.getByRole("list", { name: "Selected people" })).toContainText("Scroll Alpha");
  await expect(page).toHaveURL("/");
  await field.fill("Scroll Beta");
  await expect(page.getByRole("option")).toHaveCount(2);
  await expect(page.getByText("Related pairings", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("tablist", { name: "Search categories", exact: true })).toHaveCount(0);
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
  const stalePairing = page.getByRole("option").nth(1);
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
    const tab = page.getByRole("tab", { name: "Pairings", exact: true });
    await tab.tap();
    expect((await tab.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    const pairing = page.getByRole("option").first();
    await expect(pairing).toContainText("Scroll Alpha × Scroll Beta");
    const box = (await pairing.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(320);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    await pairing.tap();
    await expect(page).toHaveURL(PEOPLE_PATH);
  });
});
