import { PEOPLE_PATH, expect, test } from "./fixtures";

// The Share menu hangs from the Share button in the gear's sheet. On a short phone (600px tall) that button is low in the sheet, and a menu that always opened
// downward ran off the bottom of the screen: "Copy image" in Chromium, "More..." in Safari too (src/components/timeline/share-menu.tsx, `fitMenu`).

// Activate the server-side fetch fixtures before any test navigates to a people page.
test.beforeEach(async ({ next }) => {
  void next;
});

const VIEWPORTS = [
  { width: 390, height: 600 },
  { width: 360, height: 600 },
] as const;
/** Every action the menu has, in order, once the browser can share (`navigator.share`, stubbed: not every engine has it) and copy an image. */
const ACTIONS = ["Post on X", "Post on Bluesky", "Copy link", "Copy image", "More..."];

for (const view of ["timeline", "depth"] as const) {
  for (const { width, height } of VIEWPORTS) {
    test(`at ${width}x${height} every Share action is on the screen, on the ${view} view`, async ({ page }) => {
      await page.addInitScript(() => {
        Object.defineProperty(navigator, "share", { value: async () => {}, configurable: true });
      });
      await page.setViewportSize({ width, height });
      await page.goto(`${PEOPLE_PATH}?view=${view}`);
      const gear = page.getByRole("button", { name: "Settings", exact: true });
      await gear.click();
      const sheet = page.getByRole("dialog", { name: "Settings", exact: true });
      await expect(sheet).toBeVisible();
      const share = sheet.getByRole("button", { name: "Share", exact: true });
      await share.click();

      const menu = sheet.getByRole("menu");
      await expect(menu).toBeVisible();
      const items = menu.getByRole("menuitem");
      await expect(items).toHaveCount(ACTIONS.length);

      const inside = (box: { x: number; y: number; width: number; height: number }) =>
        box.x >= 0 && box.y >= 0 && box.x + box.width <= width && box.y + box.height <= height;
      // Wait out the placement (before the first paint, but a resize observer may settle it once more).
      await expect.poll(async () => inside((await menu.locator("xpath=..").boundingBox())!)).toBe(true);
      for (let index = 0; index < ACTIONS.length; index++) {
        const item = items.nth(index);
        await expect(item).toContainText(ACTIONS[index].replace("...", ""));
        // Reachable as a visitor reaches it: on the screen where the pointer would land, with nothing over it (a trial click checks both).
        expect(inside((await item.boundingBox())!), ACTIONS[index]).toBe(true);
        await item.click({ trial: true, timeout: 3000 });
      }
      // It opened upward: the Share button is low in the sheet, with more room above it than below.
      const shareBox = (await share.boundingBox())!;
      const menuBox = (await menu.locator("xpath=..").boundingBox())!;
      expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(shareBox.y);

      // Escape closes it and puts focus back on the button, as it always has.
      await page.keyboard.press("Escape");
      await expect(menu).toBeHidden();
      await expect(share).toBeFocused();
    });
  }
}

test("on a tall phone the menu still opens downward, under the Share button", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${PEOPLE_PATH}?view=timeline`);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Settings", exact: true });
  await expect(sheet).toBeVisible();
  const share = sheet.getByRole("button", { name: "Share", exact: true });
  await share.click();
  const menu = sheet.getByRole("menu");
  await expect(menu).toBeVisible();
  const shareBox = (await share.boundingBox())!;
  await expect.poll(async () => (await menu.locator("xpath=..").boundingBox())!.y).toBeGreaterThanOrEqual(shareBox.y + shareBox.height);
});
