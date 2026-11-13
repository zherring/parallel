import { test, expect, bar, collapseHero, openPeople, scene, timeline } from "./fixtures";

test.beforeEach(async ({ next }) => { void next; });

for (const width of [1440, 390]) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 700 } });

    for (const view of ["depth", "timeline"] as const) {
      test(`${view}: nav fades and minimap colors follow the visible films`, async ({ page }) => {
        await openPeople(page, `?view=${view}`);
        const vertical = view === "depth";
        const track = vertical ? scene(page) : timeline(page);
        const overview = page.locator(vertical ? "[data-depth-rail] > div" : "[data-minimap-bar]");
        const backdrop = bar(page).locator("[data-nav-backdrop]");
        await expect(backdrop).toBeVisible();
        await expect(backdrop).toHaveCSS("pointer-events", "none");
        expect(await backdrop.evaluate((element) => getComputedStyle(element).backgroundImage)).toContain("linear-gradient");

        if (vertical) {
          expect((await overview.boundingBox())!.width).toBeLessThanOrEqual(32);
          const gear = await bar(page).getByRole("button", { name: "Settings", exact: true }).boundingBox();
          expect((await overview.boundingBox())!.x).toBeGreaterThan(gear!.x + gear!.width);
          if (width >= 640) {
            const label = (await page.locator("[data-rail-year-label]").first().boundingBox())!;
            const readout = (await page.locator("[data-rail-readout-box]").boundingBox())!;
            expect(Math.abs(readout.x + readout.width - label.x - label.width)).toBeLessThanOrEqual(2);
          }
        }
        await collapseHero(page);
        await expect(backdrop).toBeVisible();

        const marks = page.locator(vertical ? "[data-depth-rail] [data-minimap-fraction]" : "[data-minimap-bar] [data-minimap-fraction]");
        expect(await marks.count()).toBeGreaterThan(10);
        // Both the green shared nodes and the person-colored ticks use the same emphasis rule.
        await expect(marks.filter({ has: page.locator("span.bg-lit") }).first()).toBeAttached();
        expect(await marks.and(page.locator("span")).count()).toBeGreaterThan(0);

        for (const position of [0, 0.5, 1]) {
          await track.evaluate((element, { vertical, position }) => {
            if (vertical) element.scrollTop = ((element.querySelector<HTMLElement>("[data-depth-track]")?.offsetHeight ?? element.scrollHeight) - element.clientHeight) * position;
            else element.scrollLeft = (element.scrollWidth - element.clientWidth) * position;
          }, { vertical, position });

          await expect.poll(async () => {
            const handle = page.getByRole("scrollbar", { name: "Timeline position", exact: true });
            const window = await handle.evaluate((element, vertical) => ({
              left: Number.parseFloat(vertical ? (element as HTMLElement).style.top : (element as HTMLElement).style.left) / 100,
              width: Number.parseFloat(vertical ? (element as HTMLElement).style.height : (element as HTMLElement).style.width) / 100,
            }), vertical);
            // Wait for the scroll sync, not just the previous window's colors.
            const percent = Number(await handle.getAttribute("aria-valuenow"));
            if (Math.abs(percent - position * 100) > 1) return false;
            return marks.evaluateAll((elements, window) => elements.every((element) => {
              const fraction = Number((element as HTMLElement).dataset.minimapFraction);
              const visible = fraction >= window.left - 1e-9 && fraction <= window.left + window.width + 1e-9;
              return element.hasAttribute("data-in-view") === visible && getComputedStyle(element).filter === (visible ? "saturate(1)" : "saturate(0.25)");
            }), window);
          }).toBe(true);
          expect(await marks.and(page.locator(":not([data-in-view])")).count()).toBeGreaterThan(0);
          expect(await marks.and(page.locator("[data-in-view]")).count()).toBeGreaterThan(0);
        }

        // A resize also changes the primary viewport, without changing any film's palette color.
        await page.setViewportSize({ width: width === 1440 ? 1100 : 430, height: 800 });
        await expect(marks.and(page.locator("[data-in-view]")).first()).toHaveCSS("filter", "saturate(1)");
        await page.screenshot({ path: test.info().outputPath("minimap-polish.png") });
      });
    }
  });
}
