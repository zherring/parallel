import { test, expect, type Page } from "next/experimental/testmode/playwright";
import { PIXEL } from "./fixtures";

const PATH = "/p/1032-martin-scorsese+3661-thelma-schoonmaker?view=clippings";
const people: Record<string, string> = { "1032": "Martin Scorsese", "3661": "Thelma Schoonmaker" };

test.beforeEach(async ({ page, next }) => {
  await page.route("https://image.tmdb.org/**", (route) => route.fulfill({ contentType: "image/png", body: PIXEL }));
  next.onFetch((request) => {
    const url = new URL(request.url);
    if (url.hostname !== "api.themoviedb.org") return "abort";
    const match = url.pathname.match(/^\/3\/person\/(\d+)(\/movie_credits)?$/);
    if (match && people[match[1]]) {
      if (!match[2]) return Response.json({ id: Number(match[1]), name: people[match[1]], profile_path: `/portrait-${match[1]}.jpg`, biography: "A biography for the Quotes study." });
      return Response.json({ cast: [{ id: 1, title: "A Shared Film", release_date: "1998-01-01", poster_path: null, vote_count: 100, order: 0, character: "Lead" }], crew: [] });
    }
    if (url.pathname === "/3/discover/movie") return Response.json({ total_pages: 1, results: [] });
    return "abort";
  });
});

/** How many pixels of a PNG are light: the quote's words (a light grey) on the dark pane, so a quote that is not painted has none. */
async function lightPixels(page: Page, png: Buffer): Promise<number> {
  return page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d")!;
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let light = 0;
    for (let at = 0; at < data.length; at += 4) if (data[at] > 120 && data[at + 1] > 120 && data[at + 2] > 120) light += 1;
    return light;
  }, png.toString("base64"));
}

/**
 * Rendering only, no input, so it runs in every engine (`WEBKIT=1`, `FIREFOX=1`): the quote is on the page. Its type is sized by arithmetic that an engine can
 * parse and get wrong: Safari 26.6 read tan(atan2(1rem, 1px)) and the like as 0, so the quote's font-size was 0px and its box 0 high, and every other part of the
 * page was fine. A size, a box with a line in it and light pixels in it are what that looks like when it is not so.
 */
test("the quote's words are drawn, at a size the fit left them", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(PATH);
  await expect(page.locator("[data-quote-exhibit-deck]")).toBeVisible();
  const quote = page.locator('[data-quote-slide][aria-current="true"] blockquote');
  await expect(quote).toBeVisible();
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await expect(quote).toBeVisible();
    // 11px is the floor of the fit (`.quote-exhibit-words` in quote-exhibit.css); the quote's lines are at least one of them high.
    const { fontSize, box } = await quote.evaluate((element) => ({ fontSize: Number.parseFloat(getComputedStyle(element).fontSize), box: element.getBoundingClientRect().height }));
    const label = `${width}x${height}`;
    expect(fontSize, label).toBeGreaterThanOrEqual(11);
    expect(box, label).toBeGreaterThanOrEqual(fontSize);
    expect(await lightPixels(page, await quote.screenshot()), label).toBeGreaterThan(300);
  }
});
