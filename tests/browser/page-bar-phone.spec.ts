import type { Page } from "next/experimental/testmode/playwright";
import { PEOPLE_PATH, bar, collapseHero, expect, test } from "./fixtures";

/**
 * A phone's page bar with three people, the one that is tightest: the home arrow, the people pill (three heads and the family names, "Alpha, Beta, & Gamma") and
 * the gear (left of the year rail on Films) in one row of a 360px screen. The names give way with an ellipsis; the arrow, the heads and the gear do not shrink or
 * wrap, nothing is over the rail, and the page does not scroll sideways. (The two-person pair, with the Quotes, is in page-bar.spec.ts.)
 */

// Activate the server-side fetch fixtures before any test navigates to a people page.
test.beforeEach(async ({ next }) => {
  void next;
});

const THREE = `${PEOPLE_PATH}+90000003-scroll-gamma`;

type Box = { x: number; y: number; width: number; height: number };
const intersects = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

async function openCollapsed(page: Page, view: "depth" | "timeline") {
  await page.goto(`${THREE}?view=${view}`);
  await expect(bar(page)).toBeVisible();
  // A state transition of the live page, not a sleep: the gear's sheet opens and closes.
  const settings = page.getByRole("dialog", { name: "Settings", exact: true });
  await page.getByRole("button", { name: "Settings", exact: true }).tap();
  await expect(settings).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(settings).toBeHidden();
  await collapseHero(page);
  // The hero's body eases away over 300ms: the bar is its compact self (58px with its padding) when that is over.
  await expect.poll(async () => (await bar(page).boundingBox())!.height).toBe(58);
}

for (const [width, height] of [
  [390, 844],
  [360, 740],
] as const) {
  test.describe(`three people on a ${width}px phone`, () => {
    test.use({ viewport: { width, height }, hasTouch: true, isMobile: true });

    for (const view of ["depth", "timeline"] as const) {
      test(`on ${view === "depth" ? "Films" : "the Timeline"} the bar has the arrow, the family names and the gear, and nothing overflows`, async ({ page }) => {
        await openCollapsed(page, view);
        const root = bar(page);
        const home = (await root.getByRole("link", { name: "Back to Parallel home", exact: true }).boundingBox())!;
        const capsule = (await root.locator("[data-pill-capsule]").boundingBox())!;
        const gear = (await root.getByRole("button", { name: "Settings", exact: true }).boundingBox())!;
        const rail = view === "depth" ? (await page.locator("[data-depth-rail]").boundingBox())! : null;

        // The arrow and the gear are 46px squares and keep to the bar's edges; the pill is between them.
        expect({ width: home.width, height: home.height }).toEqual({ width: 46, height: 46 });
        expect({ width: gear.width, height: gear.height }).toEqual({ width: 46, height: 46 });
        expect(home.x).toBe(12);
        expect(capsule.x).toBe(home.x + home.width + 12);
        expect(gear.x - (capsule.x + capsule.width)).toBeGreaterThanOrEqual(8);
        expect(gear.x + gear.width).toBeLessThanOrEqual(width);
        // On Films the rail is at the right edge (28px on a phone), clear of the gear.
        if (rail) {
          expect(rail.width).toBeLessThanOrEqual(28);
          expect(intersects(rail, gear)).toBe(false);
          expect(intersects(rail, capsule)).toBe(false);
          expect(rail.x - (gear.x + gear.width)).toBeGreaterThanOrEqual(8);
        }

        // The three heads are whole, 28px each, inside the pill; none has shrunk or wrapped to another row.
        const heads = await root.locator("[data-pill-head]").evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect()));
        expect(heads).toHaveLength(3);
        for (const head of heads) {
          expect(Math.round(head.width)).toBe(28);
          expect(head.left).toBeGreaterThanOrEqual(capsule.x);
          expect(head.right).toBeLessThanOrEqual(capsule.x + capsule.width);
          expect(head.top).toBe(heads[0].top);
        }

        // The names, the family ones, after the heads, on one line; the pill's name for a screen reader is the full one.
        const names = root.locator("[data-pill-capsule] button span.truncate").filter({ hasText: "Alpha, Beta, & Gamma" });
        await expect(names).toBeVisible();
        const text = await names.evaluate((element) => (element as HTMLElement).innerText);
        expect(text).toBe("Alpha, Beta, & Gamma");
        const line = (await names.boundingBox())!;
        expect(line.x).toBeGreaterThanOrEqual(heads[2].right);
        expect(line.height).toBeLessThanOrEqual(24);
        await expect(root.getByRole("button", { name: /^People on this page/ })).toHaveAccessibleName("People on this page: Scroll Alpha, Scroll Beta & Scroll Gamma");

        // Nothing makes the page scroll sideways.
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
      });
    }

    test("the open pill's field and card stay on the screen, after the arrow", async ({ page }) => {
      await openCollapsed(page, "depth");
      const home = (await bar(page).getByRole("link", { name: "Back to Parallel home", exact: true }).boundingBox())!;
      await bar(page).getByRole("button", { name: /^People on this page/ }).tap();
      const card = page.getByRole("dialog", { name: "People", exact: true });
      await expect(card).toBeVisible();
      const cardBox = (await card.boundingBox())!;
      const fieldBox = (await page.locator("[data-pill-open]").boundingBox())!;
      for (const box of [cardBox, fieldBox]) {
        // After the arrow (which stays), within the screen, with the bar's gutter on the right.
        expect(box.x).toBeGreaterThanOrEqual(home.x + home.width + 12 - 0.5);
        expect(box.x + box.width).toBeLessThanOrEqual(width - 12 + 0.5);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    });
  });
}
