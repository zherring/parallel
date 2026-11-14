import type { Page } from "@playwright/test";
import { embedPath, quotePath } from "../../src/lib/quote-embed";
import {
  EMBED_COUNT as COUNT,
  EMBED_PAIR as PAIR,
  EMBED_QUOTES as QUOTES,
  EMBED_START as START,
  EMBED_START_ID as START_ID,
  embedTest as test,
  expect,
  expectQuoteAt as expectAt,
  pathnameOf as pathname,
} from "./fixtures";

// The pages X frames in a post (src/components/embed): a quote's share page and embed, which step through the pair's quotes and keep the address on the one shown, and the
// pair's embed's sequence. How a frame fits its room is in `embeds-fit.spec.ts` (the pair's) and `embeds-quote-fit.spec.ts` (the quote's); the TMDB stub and the helpers they
// share are in `fixtures.ts`.

// The server's TMDB stub (`next`, in `embedTest`) must be in place before the first page: the fixture is only set up for a test that asks for it.
test.beforeEach(async ({ next }) => {
  void next;
});

async function expectReloadStays(page: Page, path: (id: string) => string, index: number) {
  await page.reload();
  await expectAt(page, path, index);
}

test("the quotes are real: the one the link opens on is in the list, with others to step through", () => {
  expect(START).toBeGreaterThanOrEqual(0);
  expect(COUNT).toBeGreaterThan(2);
});

const VARIANTS = [
  { name: "share page", path: (id: string) => quotePath(PAIR, id) },
  { name: "embed", path: (id: string) => embedPath(PAIR, id) },
] as const;

for (const { name, path } of VARIANTS) {
  test.describe(`${name}: the address follows the quote`, () => {
    test("Next and then Previous is back on the quote the link opened on, in its address, and a reload stays on it", async ({ page }) => {
      await page.goto(path(START_ID));
      await expectAt(page, path, START);

      // No reload in between: a reload would make the quote it lands on the one the page "opened on".
      await page.getByRole("button", { name: "Next quote", exact: true }).click();
      await expectAt(page, path, (START + 1) % COUNT);
      await page.getByRole("button", { name: "Previous quote", exact: true }).click();
      await expectAt(page, path, START);
      await expect.poll(() => pathname(page)).toBe(path(START_ID));
      await expectReloadStays(page, path, START);

      // And the other way: Previous and then Next.
      await page.getByRole("button", { name: "Previous quote", exact: true }).click();
      await expectAt(page, path, (START - 1 + COUNT) % COUNT);
      await page.getByRole("button", { name: "Next quote", exact: true }).click();
      await expectAt(page, path, START);
      await expectReloadStays(page, path, START);
    });

    test("stepping all the way round, either way, wraps back to the quote it opened on, and the address, the quote and a reload agree at every step", async ({ page }) => {
      await page.goto(path(START_ID));
      await expectAt(page, path, START);
      const next = page.getByRole("button", { name: "Next quote", exact: true });
      const previous = page.getByRole("button", { name: "Previous quote", exact: true });

      for (let step = 1; step <= COUNT; step++) {
        await next.click();
        await expectAt(page, path, (START + step) % COUNT);
      }
      await expectReloadStays(page, path, START);

      for (let step = 1; step <= COUNT; step++) {
        await previous.click();
        await expectAt(page, path, (START - step + COUNT * 2) % COUNT);
      }
      await expectReloadStays(page, path, START);
    });

    test("the first quote's Previous is the last, and the last quote's Next is the first, in the address and after a reload", async ({ page }) => {
      const first = 0;
      const last = COUNT - 1;

      await page.goto(path(QUOTES[first].id));
      await expectAt(page, path, first);
      await page.getByRole("button", { name: "Previous quote", exact: true }).click();
      await expectAt(page, path, last);
      await expectReloadStays(page, path, last);
      await page.getByRole("button", { name: "Next quote", exact: true }).click();
      await expectAt(page, path, first);
      await expectReloadStays(page, path, first);

      // Opened on the last, stepped on to the first and back: the address is the last's again.
      await page.goto(path(QUOTES[last].id));
      await expectAt(page, path, last);
      await page.getByRole("button", { name: "Next quote", exact: true }).click();
      await expectAt(page, path, first);
      await page.getByRole("button", { name: "Previous quote", exact: true }).click();
      await expectAt(page, path, last);
      await expectReloadStays(page, path, last);
    });

    test("the arrow keys step it from the page, and the address follows", async ({ page }) => {
      await page.goto(path(START_ID));
      await expectAt(page, path, START);
      await page.locator("blockquote").click();
      await page.keyboard.press("ArrowRight");
      await expectAt(page, path, (START + 1) % COUNT);
      await page.keyboard.press("ArrowLeft");
      await expectAt(page, path, START);
      await page.keyboard.press("ArrowLeft");
      await expectAt(page, path, (START - 1 + COUNT) % COUNT);
      await page.keyboard.press("ArrowRight");
      await expectAt(page, path, START);
      // A modifier is the browser's (Alt+Left is back), not the quotes'.
      await page.keyboard.press("Shift+ArrowRight");
      await expectAt(page, path, START);
    });
  });
}

test.describe("share page: the quotes' arrow keys are not taken from the search", () => {
  const path = VARIANTS[0].path;

  test("typing in the Search field, or any key in its dialog, leaves the quote and the address where they were; the page has them back once it is closed", async ({ page }) => {
    await page.goto(path(START_ID));
    await expectAt(page, path, START);

    await page.getByRole("banner").getByRole("button", { name: "Search", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Search people", exact: true });
    await expect(dialog).toBeVisible();
    const field = dialog.getByRole("combobox");
    await expect(field).toBeFocused();

    await field.fill("Steven");
    await expect(dialog.getByRole("option").first()).toBeVisible();
    for (const key of ["ArrowRight", "ArrowLeft", "ArrowRight", "ArrowRight"]) await page.keyboard.press(key);
    await expect(field).toHaveValue("Steven");
    await expectAt(page, path, START);

    // From the dialog's close button, too: it is the dialog's, not the page's.
    await dialog.getByRole("button", { name: "Close search", exact: true }).focus();
    await page.keyboard.press("ArrowRight");
    await expectAt(page, path, START);
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expectAt(page, path, START);

    // Closed, the focus is on the Search button, which is not a field: the arrows are the quotes' again.
    await page.keyboard.press("ArrowRight");
    await expectAt(page, path, (START + 1) % COUNT);
    await page.locator("blockquote").click();
    await page.keyboard.press("ArrowLeft");
    await expectAt(page, path, START);
  });

  test("a key the search handled itself (prevented) is not a step either", async ({ page }) => {
    await page.goto(path(START_ID));
    await expectAt(page, path, START);
    await page.evaluate(() => {
      // Something earlier in the page took the key, as a field's own handler does.
      document.addEventListener("keydown", (event) => event.key === "ArrowRight" && event.preventDefault());
    });
    await page.keyboard.press("ArrowRight");
    await expectAt(page, path, START);
    await page.keyboard.press("ArrowLeft");
    await expectAt(page, path, (START - 1 + COUNT) % COUNT);
  });
});

test.describe("pair embed: the sequence", () => {
  test.use({ reducedMotion: "no-preference" });

  test("the headshots do not move or change at any point of it (no nod, no ring, nothing behind them), and the posters still lift", async ({ page }) => {
    await page.setViewportSize({ width: 600, height: 315 });
    await page.goto(`/embed/p/${PAIR}`);
    const samples = await page.evaluate(async () => {
      const out: { people: string[]; posters: string; rings: number; rects: string[] }[] = [];
      const start = performance.now();
      while (performance.now() - start < 4800) {
        const people = [...document.querySelectorAll<HTMLElement>('[data-part="person"]')];
        out.push({
          people: people.map((el) => `${getComputedStyle(el).transform}|${getComputedStyle(el).opacity}|${getComputedStyle(el).boxShadow}`),
          posters: [...document.querySelectorAll<HTMLElement>('[data-part="poster"]')].map((el) => getComputedStyle(el).transform).join(" "),
          rings: document.querySelectorAll('[data-part="ring"]').length,
          // Relative to the stage, so that the poster's own fade and lift at the end (the whole card, one thing) is not counted.
          rects: people.map((el) => {
            const stage = el.closest<HTMLElement>('[data-part="stage"]')?.getBoundingClientRect();
            const rect = el.getBoundingClientRect();
            return stage ? `${(rect.left - stage.left).toFixed(1)},${(rect.top - stage.top).toFixed(1)},${(rect.width / stage.width).toFixed(4)}` : "";
          }),
        });
        await new Promise((resolve) => setTimeout(resolve, 40));
      }
      return out;
    });
    expect(samples.length).toBeGreaterThan(20);
    expect(samples[0].people.length).toBe(2);
    for (const sample of samples) {
      expect(sample.people).toEqual(samples[0].people);
      expect(sample.rings).toBe(0);
    }
    // The posters' lift is kept: they are at a different transform at some point of the sequence.
    expect(new Set(samples.map((sample) => sample.posters)).size).toBeGreaterThan(2);
    await expect(page.getByRole("button", { name: "Replay", exact: true })).toBeVisible();
  });
});
