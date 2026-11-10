import type { Page } from "next/experimental/testmode/playwright";
import { PEOPLE_PATH, bar, expect, scene, test, timeline, viewLink } from "./fixtures";

/**
 * The pill after the people pill, "9 films together", is the page's count of the films the people made together: the headline's, the table's rows.
 * It has to say the same as the green films in the Timeline and in Focus, and the people pill's rows hold the eyes that show or hide a person's films
 * on the Timeline (they were the legend card's). The pair is the fixture's Scroll Alpha and Scroll Beta: nine films together, sixteen of their own each,
 * a cameo both have (a minor credit: it counts only with "Include minor credits" on).
 */

// Activate the server-side fetch fixtures before any test navigates to a people page.
test.beforeEach(async ({ next }) => {
  void next;
});

const SHARED = 9;
const pill = (page: Page) => bar(page).locator("[data-together-pill]");
const peoplePill = (page: Page) => bar(page).getByRole("button", { name: /^People on this page/ });
const peopleCard = (page: Page) => page.getByRole("dialog", { name: "People", exact: true });
const eye = (page: Page, name: string) => peopleCard(page).getByRole("button", { name: `Show ${name}'s films on the timeline`, exact: true });
const gear = (page: Page) => page.getByRole("button", { name: "Settings", exact: true });
const sheet = (page: Page) => page.getByRole("dialog", { name: "Settings", exact: true });

/** The Timeline's green films: the cards that have the green ring of a film made together. */
const greenOnTimeline = (page: Page) => timeline(page).locator("button[data-film]:has(.shadow-lit)");
/** Focus's films made together: the posters on the layer at the screen plane. */
const greenInFocus = (page: Page) => scene(page).locator('button[data-layer="0"]');
/** The table's rows, without its header. */
const tableRows = async (page: Page) => (await page.getByRole("table").getByRole("row").count()) - 1;

async function setMinor(page: Page, on: boolean) {
  await gear(page).click();
  const box = sheet(page).getByRole("checkbox", { name: /Show shorts, music videos, cameos and uncredited/ });
  if (on) await box.check();
  else await box.uncheck();
  await page.keyboard.press("Escape");
  await expect(sheet(page)).toBeHidden();
}

test.describe("the number in the pill is the number of green films", () => {
  test("it is the Timeline's, Focus's and the Table's: nine films, in all three", async ({ page }) => {
    await page.goto(PEOPLE_PATH);
    await expect(viewLink(page, "timeline")).toHaveAttribute("aria-current", "page");
    await expect(pill(page)).toHaveAccessibleName(`${SHARED} films together`);
    await expect(pill(page)).toHaveText(`${SHARED} films together`);
    await expect(greenOnTimeline(page)).toHaveCount(SHARED);

    await viewLink(page, "table").click();
    await expect(page.getByRole("table")).toBeVisible();
    expect(await tableRows(page)).toBe(SHARED);
    await expect(pill(page)).toHaveAccessibleName(`${SHARED} films together`);

    await viewLink(page, "depth").click();
    await expect(scene(page)).toBeVisible();
    await expect(greenInFocus(page)).toHaveCount(SHARED);
    await expect(pill(page)).toHaveAccessibleName(`${SHARED} films together`);
  });

  test("with the minor credits on, the cameo both have is one more, in the pill, the Timeline and the Table", async ({ page }) => {
    await page.goto(PEOPLE_PATH);
    await expect(viewLink(page, "timeline")).toHaveAttribute("aria-current", "page");
    await setMinor(page, true);
    await expect(pill(page)).toHaveAccessibleName(`${SHARED + 1} films together`);
    await expect(greenOnTimeline(page)).toHaveCount(SHARED + 1);
    await viewLink(page, "table").click();
    await expect(page.getByRole("table")).toBeVisible();
    expect(await tableRows(page)).toBe(SHARED + 1);
    await expect(pill(page)).toHaveAccessibleName(`${SHARED + 1} films together`);
    await setMinor(page, false);
    await expect(pill(page)).toHaveAccessibleName(`${SHARED} films together`);
  });

  test("a page of one person has the plain count of their films instead, the same on every view", async ({ page }) => {
    await page.goto("/p/90000001-scroll-alpha");
    await expect(viewLink(page, "timeline")).toHaveAttribute("aria-current", "page");
    await expect(pill(page)).toHaveCount(0);
    // Sixteen of their own and the nine films with the other: the table's rows.
    const count = bar(page).getByText(/^\d+ films$/);
    await expect(count).toHaveText("25 films");
    await expect(count).toHaveCSS("pointer-events", "none");
    // Muted text, not a pill: no outline and no dot.
    await expect(count).toHaveCSS("border-top-width", "0px");
    await viewLink(page, "table").click();
    expect(await tableRows(page)).toBe(25);
    await expect(count).toHaveText("25 films");
    await viewLink(page, "depth").click();
    await expect(scene(page)).toBeVisible();
    await expect(count).toHaveText("25 films");
  });
});

test("a page without Quotes has no section nav, and the bar is the same on every view", async ({ page }) => {
  const boxes: unknown[] = [];
  for (const view of ["timeline", "table", "depth"] as const) {
    await page.goto(`${PEOPLE_PATH}${{ timeline: "", table: "?view=table", depth: "?view=depth" }[view]}`);
    await expect(viewLink(page, view)).toHaveAttribute("aria-current", "page");
    // Films | Quotes is for a page that has Quotes: nowhere on this one (the bar's row does not hold it either way).
    await expect(page.locator('nav[aria-label="Sections"]')).toHaveCount(0);
    boxes.push(await pill(page).boundingBox());
  }
  expect(boxes[1]).toEqual(boxes[0]);
  expect(boxes[2]).toEqual(boxes[0]);
});

test.describe("the eyes in the people pill", () => {
  test("hide a person's films on the Timeline and show them again; the last person's eye is off, and the count of films together does not move", async ({ page }) => {
    await page.goto(PEOPLE_PATH);
    await expect(viewLink(page, "timeline")).toHaveAttribute("aria-current", "page");
    const track = timeline(page);
    // The fixture's own films: Alpha's are 1000 to 1015, Beta's 2000 to 2015 (the ones with a card or only a node are both `data-film`).
    await expect(track.locator('[data-film="1005"]').first()).toBeAttached();
    await expect(track.locator('[data-film="2005"]').first()).toBeAttached();
    await expect(greenOnTimeline(page)).toHaveCount(SHARED);

    await peoplePill(page).click();
    await expect(peopleCard(page)).toBeVisible();
    // One eye in each row, pressed while the person's films are shown, with the people column's name for it and the same words in its tooltip.
    await expect(peopleCard(page).getByRole("button", { name: /^Show .+ films on the timeline$/ })).toHaveCount(2);
    for (const name of ["Scroll Alpha", "Scroll Beta"]) {
      await expect(eye(page, name)).toHaveAttribute("aria-pressed", "true");
      await expect(eye(page, name)).toHaveAttribute("title", "Hide their films");
      await expect(eye(page, name)).toBeEnabled();
    }

    // Beta's films are off the timeline, and so is the green (nobody else made them with Alpha, among those that are shown), while the pill stays open.
    await eye(page, "Scroll Beta").click();
    await expect(eye(page, "Scroll Beta")).toHaveAttribute("aria-pressed", "false");
    await expect(eye(page, "Scroll Beta")).toHaveAttribute("title", "Show their films");
    await expect(peopleCard(page)).toBeVisible();
    await expect(track.locator('[data-film="2005"]')).toHaveCount(0);
    await expect(track.locator('[data-film="2000"]')).toHaveCount(0);
    await expect(track.locator('[data-film="1005"]').first()).toBeAttached();
    await expect(greenOnTimeline(page)).toHaveCount(0);
    // The row says so, dimmed, and the last person on the track cannot be hidden: Alpha's eye is off.
    await expect(peopleCard(page).getByText("25 films, hidden")).toHaveCount(1);
    await expect(eye(page, "Scroll Alpha")).toBeDisabled();
    await expect(eye(page, "Scroll Alpha")).toHaveAttribute("title", "At least one person has to stay on the timeline");
    // "Green: made together" is for two people on the track.
    await expect(peopleCard(page).getByText("Green: made together")).toHaveCount(0);
    // Closed, the pill says someone's films are off: their head is faint. (The bar's other pills step aside while it is open.)
    await page.keyboard.press("Escape");
    await expect(peopleCard(page)).toBeHidden();
    // The count is of the films the page lists, which the eyes do not change.
    await expect(pill(page)).toHaveAccessibleName(`${SHARED} films together`);
    await expect(page.locator('[data-pill-head="90000002"] > *')).toHaveClass(/opacity-50/);
    await expect(page.locator('[data-pill-head="90000001"] > *')).not.toHaveClass(/opacity-50/);

    // And back: Beta's films are on the timeline again, green too.
    await peoplePill(page).click();
    await eye(page, "Scroll Beta").click();
    await expect(eye(page, "Scroll Beta")).toHaveAttribute("aria-pressed", "true");
    await expect(track.locator('[data-film="2005"]').first()).toBeAttached();
    await expect(greenOnTimeline(page)).toHaveCount(SHARED);
    await expect(eye(page, "Scroll Alpha")).toBeEnabled();
    await expect(peopleCard(page).getByText("Green: made together")).toBeVisible();
  });

  test("work by keyboard: Tab reaches the eye after the name, and Space presses it", async ({ page }) => {
    await page.goto(PEOPLE_PATH);
    await expect(viewLink(page, "timeline")).toHaveAttribute("aria-current", "page");
    await peoplePill(page).click();
    await expect(page.getByRole("combobox", { name: "Add a person", exact: true })).toBeFocused();
    // Field, close button, then the first row: the name, the eye, Remove.
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(peopleCard(page).getByRole("button", { name: "Scroll Alpha", exact: true })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(eye(page, "Scroll Alpha")).toBeFocused();
    await expect(eye(page, "Scroll Alpha")).toHaveCSS("cursor", "pointer");
    await page.keyboard.press("Space");
    await expect(eye(page, "Scroll Alpha")).toHaveAttribute("aria-pressed", "false");
    await expect(timeline(page).locator('[data-film="1005"]')).toHaveCount(0);
    await expect(timeline(page).locator('[data-film="2005"]').first()).toBeAttached();
  });

  test("are on the Timeline only, where hiding a person changes something: not on the Table, not in Focus", async ({ page }) => {
    for (const view of ["table", "depth"] as const) {
      await page.goto(`${PEOPLE_PATH}?view=${view}`);
      if (view === "depth") await expect(scene(page)).toBeVisible();
      else await expect(viewLink(page, "table")).toHaveAttribute("aria-current", "page");
      await peoplePill(page).click();
      await expect(peopleCard(page)).toBeVisible();
      await expect(peopleCard(page).getByRole("link", { name: "Remove Scroll Alpha", exact: true })).toBeVisible();
      await expect(peopleCard(page).getByRole("button", { name: /^Show .+ films on the timeline$/ })).toHaveCount(0);
    }
    // And on the Timeline they are there, in place of the legend card that used to be over the timeline.
    await page.goto(PEOPLE_PATH);
    await expect(viewLink(page, "timeline")).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("complementary", { name: "People", exact: true })).toHaveCount(0);
    await peoplePill(page).click();
    await expect(peopleCard(page).getByRole("button", { name: /^Show .+ films on the timeline$/ })).toHaveCount(2);
  });

  test("are not on a page of one person: there is no one else to hide", async ({ page }) => {
    await page.goto("/p/90000001-scroll-alpha");
    await expect(viewLink(page, "timeline")).toHaveAttribute("aria-current", "page");
    await peoplePill(page).click();
    await expect(peopleCard(page)).toBeVisible();
    await expect(peopleCard(page).getByRole("button", { name: /^Show .+ films on the timeline$/ })).toHaveCount(0);
    await expect(peopleCard(page).getByText("Green: made together")).toHaveCount(0);
  });
});
