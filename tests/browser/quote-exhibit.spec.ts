import { test, expect, type Page } from "next/experimental/testmode/playwright";
import { PIXEL } from "./fixtures";

const SCORSESE = "/p/1032-martin-scorsese+3661-thelma-schoonmaker";
const ANDERSON = "/p/5655-wes-anderson+1532-bill-murray";
const FIRST = "i-want-to-thank-first-of";
const SECOND = "money-didnt-mean-anything-to-me";
const people: Record<string, string> = { "1032": "Martin Scorsese", "3661": "Thelma Schoonmaker", "5655": "Wes Anderson", "1532": "Bill Murray", "488": "Steven Spielberg", "491": "John Williams" };

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

const deck = (page: Page) => page.locator("[data-quote-exhibit-deck]");
const active = (page: Page) => deck(page).locator('[data-quote-slide][aria-current="true"]');
const backdrop = (page: Page) => deck(page).locator(".quote-exhibit-media");
const scroller = (page: Page) => page.getByRole("region", { name: "Quotes exhibition", exact: true });

async function openExhibit(page: Page, path = `${SCORSESE}?view=clippings`) {
  await page.goto(path);
  await expect(deck(page)).toBeVisible();
  await expect(scroller(page)).toBeFocused();
}

async function expectSnap(page: Page, index: number) {
  await expect.poll(() => scroller(page).evaluate((element, target) => Math.abs(element.scrollTop - target * element.clientHeight), index)).toBeLessThan(1);
}

test("the split exhibit keeps compact navigation without the masthead, with framed imagery and one viewport per quote", async ({ page }) => {
  let photos = 0;
  page.on("request", (request) => { if (request.url().includes("/images/collaborations/")) photos++; });
  await page.goto(`${SCORSESE}?view=timeline`);
  const filter = page.getByRole("group", { name: "Show quotes by speaker" });
  await expect(deck(page)).toHaveCount(0);
  await expect(page.locator("[data-people-bar]")).toBeVisible();
  expect(photos).toBe(0);

  const views = page.getByRole("navigation", { name: "Views", exact: true });
  await expect(views.getByRole("link", { name: "Timeline", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.locator("[data-people-bar]")).toBeVisible();
  await expect(deck(page)).toHaveCount(0);
  expect(photos).toBe(0);
  await views.getByRole("link", { name: "Quotes", exact: true }).click();
  await expect(scroller(page)).toBeFocused();
  await expect(deck(page)).toHaveAttribute("data-active-quote", FIRST);
  await expect(filter).toHaveCount(0);
  await expect(deck(page).locator(".quote-exhibit-image-shade, .quote-exhibit-kicker, .quote-exhibit-hatching")).toHaveCount(0);
  await expect(scroller(page)).toHaveCSS("scroll-snap-type", "y mandatory");
  await expect(active(page).locator(".quote-exhibit-quote")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  const credit = deck(page).getByRole("link", { name: /Portraits via TMDB/ });
  await expect(credit).toHaveAttribute("href", "https://www.themoviedb.org/");
  await expect(credit).toHaveAttribute("target", "_blank");
  await expect(page.getByRole("button", { name: /Photograph|Portraits|Reading view/ })).toHaveCount(0);
  expect(photos).toBe(0);
  await expect(page.locator("[data-people-bar]")).toBeVisible();
  await expect(page.locator("[data-people-bar]")).toHaveAttribute("data-hero", "collapsed");
  await expect(page.locator("[data-hero-body]")).toBeHidden();
  await credit.click({ trial: true });
  await expect(active(page).locator(".quote-exhibit-context")).toBeVisible();
  const share = active(page).getByRole("button", { name: /Share this quote/ });
  await expect(share).toHaveCSS("opacity", "1");
  expect((await share.boundingBox())!.y + (await share.boundingBox())!.height).toBeLessThan((await active(page).locator("blockquote").boundingBox())!.y);

  for (const [width, height] of [[1440, 900], [768, 900], [390, 844], [464, 538], [650, 900], [320, 568], [844, 390]]) {
    await page.setViewportSize({ width, height });
    await expectSnap(page, 0);
    expect(await deck(page).boundingBox()).toEqual({ x: 0, y: 0, width, height });
    const media = (await backdrop(page).boundingBox())!;
    const frame = (await deck(page).locator(".quote-exhibit-visual").boundingBox())!;
    const plate = (await active(page).locator(".quote-exhibit-plate").boundingBox())!;
    const siteBackground = await page.locator("body").evaluate((element) => getComputedStyle(element).backgroundColor);
    await expect(backdrop(page)).toHaveCSS("background-color", siteBackground);
    await expect(deck(page)).not.toHaveCSS("background-color", siteBackground);
    expect(frame.x).toBeGreaterThan(media.x);
    expect(frame.x + frame.width).toBeLessThan(media.x + media.width);
    expect(frame.y).toBeGreaterThan(media.y);
    const bar = (await page.locator("[data-people-bar]").boundingBox())!;
    expect(frame.y).toBeGreaterThanOrEqual(bar.y + bar.height);
    await expect(page.getByRole("button", { name: /^People on this page:/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Settings", exact: true })).toBeVisible();
    if (width >= 768) {
      expect(frame.y + frame.height).toBeLessThan(media.y + media.height);
      expect(media).toEqual({ x: 0, y: 0, width: width / 2, height });
      expect(frame.x + frame.width / 2).toBeCloseTo(width / 4 - 0.5, 0);
      expect(frame.y + frame.height / 2).toBeCloseTo(height / 2, 0);
      expect(plate.x).toBeGreaterThan(width / 2);
      expect(plate.x + plate.width / 2).toBeCloseTo(width * 0.75, 0);
      await expect(backdrop(page)).toHaveCSS("border-right-width", "1px");
    } else {
      expect(media.width).toBe(width);
      expect(frame.width).toBeCloseTo(width - 48, 0);
      expect(frame.x).toBe(24);
      // The portrait panel meets the quote panel: no empty strip below a small inset image.
      expect(frame.y + frame.height).toBeCloseTo(media.y + media.height, 0);
      expect(plate.y).toBeCloseTo(media.height + 16, 0);
      await expect(backdrop(page)).toHaveCSS("border-bottom-width", "0px");
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const toolbar = (await deck(page).locator(".quote-exhibit-toolbar").boundingBox())!;
    expect(toolbar.x).toBeGreaterThanOrEqual(0);
    expect(toolbar.x + toolbar.width).toBeLessThanOrEqual(width);
    expect(plate.y + plate.height).toBeLessThanOrEqual(toolbar.y);
  }
});

test("mobile uses a broad stationary picture above a compact, top-aligned quote panel", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openExhibit(page);
  await page.evaluate(() => document.fonts.ready);
  const picture = deck(page).locator(".quote-exhibit-visual");
  const frame = (await picture.boundingBox())!;
  expect(frame.width).toBe(342);
  expect(frame.height).toBeCloseTo(228, 0);
  const text = (await active(page).locator("blockquote").boundingBox())!;
  const source = (await active(page).locator(".quote-exhibit-source").boundingBox())!;
  const toolbar = (await deck(page).locator(".quote-exhibit-toolbar").boundingBox())!;
  expect(text.y).toBeGreaterThan(frame.y + frame.height);
  expect(text.x).toBeGreaterThan(frame.x);
  expect(source.y + source.height).toBeLessThan(toolbar.y);
  expect(await active(page).locator(".quote-exhibit-plate").evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(false);

  // Scrolling the picture still advances the quotes without moving the picture itself.
  await page.mouse.move(frame.x + frame.width / 2, frame.y + frame.height / 2);
  await page.mouse.wheel(0, 600);
  await expect(deck(page)).toHaveAttribute("data-active-quote", SECOND);
  await expectSnap(page, 1);
  expect(await picture.boundingBox()).toEqual(frame);

  // The compact proportions in the reference still leave a short quote's explainer and source on screen.
  await page.setViewportSize({ width: 464, height: 538 });
  await deck(page).getByRole("button", { name: "Previous quote", exact: true }).click();
  await expectSnap(page, 0);
  expect(await active(page).locator(".quote-exhibit-plate").evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(false);
  const compactSource = (await active(page).locator(".quote-exhibit-source").boundingBox())!;
  const compactToolbar = (await deck(page).locator(".quote-exhibit-toolbar").boundingBox())!;
  expect(compactSource.y + compactSource.height).toBeLessThan(compactToolbar.y);
});

test("native wheel scrolling snaps forwards and backwards by quote", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  await openExhibit(page);
  await page.mouse.move(100, 300); // Wheel over the stationary image pane still scrolls the deck.
  await page.mouse.wheel(0, 600);
  await expect(deck(page)).toHaveAttribute("data-active-quote", SECOND);
  await expectSnap(page, 1);
  await expect(page).toHaveURL(new RegExp(`quote=${SECOND}`));
  await page.mouse.wheel(0, -600);
  await expect(deck(page)).toHaveAttribute("data-active-quote", FIRST);
  await expectSnap(page, 0);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

for (const width of [1440, 390]) {
  test(`pairing controls and view navigation work above Quotes at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await openExhibit(page);
    const bar = page.locator("[data-people-bar]");
    await expect(bar).toHaveAttribute("data-hero", "collapsed");
    await expect(bar.getByRole("link", { name: "Back to Parallel home", exact: true })).toBeVisible();
    await bar.getByRole("button", { name: /^People on this page:/ }).click();
    const field = page.getByRole("combobox", { name: "Add a person", exact: true });
    await expect(field).toBeVisible();
    await expect(field).toBeFocused();
    await page.keyboard.press("Space");
    await expect(deck(page)).toHaveAttribute("data-active-quote", FIRST);
    await bar.getByRole("button", { name: "Close people", exact: true }).click();
    await expect(field).toBeHidden();

    await bar.getByRole("button", { name: "Settings", exact: true }).click();
    const settings = page.getByRole("dialog", { name: "Settings", exact: true });
    await expect(settings).toBeVisible();
    if (width < 640) {
      const views = settings.getByRole("navigation", { name: "Views", exact: true });
      await expect(views.getByRole("link", { name: "Quotes", exact: true })).toHaveAttribute("aria-current", "page");
      await views.getByRole("link", { name: "Table", exact: true }).click();
    } else {
      await page.keyboard.press("Escape");
      await expect(settings).toBeHidden();
      const views = bar.getByRole("navigation", { name: "Views", exact: true });
      await expect(views.getByRole("link", { name: "Quotes", exact: true })).toHaveAttribute("aria-current", "page");
      await views.getByRole("link", { name: "Table", exact: true }).click();
    }
    await expect(deck(page)).toHaveCount(0);
    await expect(bar).toBeVisible();
    await expect(page.locator("[data-hero-body]")).toBeVisible();
    await expect(page).toHaveURL(/view=table/);
  });
}

test("Space advances, Shift+Space goes back, held Space advances once, and the ends wrap without adding history entries", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openExhibit(page, `${SCORSESE}?view=clippings&from=1980&to=2000`);
  const historyLength = await page.evaluate(() => history.length);
  await page.keyboard.press("Space");
  await expect(deck(page)).toHaveAttribute("data-active-quote", SECOND);
  await expectSnap(page, 1);
  await page.keyboard.press("Shift+Space");
  await expect(deck(page)).toHaveAttribute("data-active-quote", FIRST);
  await expectSnap(page, 0);

  await page.keyboard.down("Space");
  await page.keyboard.down("Space");
  await page.keyboard.down("Space");
  await page.keyboard.up("Space");
  await expect(deck(page)).toHaveAttribute("data-active-quote", SECOND);
  await expectSnap(page, 1);

  const slides = deck(page).locator("[data-quote-slide]");
  const count = await slides.count();
  const lastId = await slides.last().getAttribute("data-quote-slide");
  await scroller(page).evaluate((element) => element.scrollTo({ top: element.scrollHeight, behavior: "instant" }));
  await expect(deck(page)).toHaveAttribute("data-active-quote", lastId!);
  await expectSnap(page, count - 1);
  await page.keyboard.press("Space");
  await expect(deck(page)).toHaveAttribute("data-active-quote", FIRST);
  await expectSnap(page, 0);
  expect(await page.evaluate(() => history.length)).toBe(historyLength);
  expect(await page.evaluate(() => Object.fromEntries(new URLSearchParams(location.search)))).toEqual({ view: "clippings", from: "1980", to: "2000", quote: FIRST });
});

test("Space leaves typing, native button activation and a person's dialog alone; exiting cleans up the shortcut", async ({ page }) => {
  await openExhibit(page);
  await page.evaluate(() => {
    const input = document.createElement("input");
    input.setAttribute("aria-label", "Typing test");
    document.querySelector(".quote-exhibit-toolbar")!.append(input);
    input.focus();
  });
  await page.keyboard.press("Space");
  await expect(page.getByRole("textbox", { name: "Typing test" })).toHaveValue(" ");
  await expect(deck(page)).toHaveAttribute("data-active-quote", FIRST);
  await page.getByRole("textbox", { name: "Typing test" }).evaluate((input) => input.remove());

  const next = deck(page).getByRole("button", { name: "Next quote", exact: true });
  await next.focus();
  await page.keyboard.press("Space");
  await expect(deck(page)).toHaveAttribute("data-active-quote", SECOND);
  await deck(page).getByRole("button", { name: "Previous quote", exact: true }).click();
  await expect(deck(page)).toHaveAttribute("data-active-quote", FIRST);
  const person = active(page).locator(".quote-exhibit-context").getByRole("link", { name: "Thelma Schoonmaker", exact: true });
  await person.click();
  const panel = page.getByRole("dialog", { name: "Thelma Schoonmaker", exact: true });
  await expect(panel).toBeVisible();
  await page.keyboard.press("Space");
  await expect(deck(page)).toHaveAttribute("data-active-quote", FIRST);
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(person).toBeFocused();

  await page.getByRole("navigation", { name: "Views", exact: true }).getByRole("link", { name: "Table", exact: true }).click();
  await expect(deck(page)).toHaveCount(0);
  await expect(page.locator("[data-people-bar]")).toBeVisible();
  const address = page.url();
  await page.locator("body").evaluate((body) => (body as HTMLElement).focus());
  await page.keyboard.press("Space");
  expect(page.url()).toBe(address);
  await expect(page.locator("html")).not.toHaveCSS("overflow-y", "hidden");
  await page.getByRole("navigation", { name: "Views", exact: true }).getByRole("link", { name: "Timeline", exact: true }).click();
  await expect(page.locator("[data-people-bar]")).toBeVisible();
  await expect(page.locator('[data-quotes-page="true"]')).toHaveCount(0);
});

test("labels, custom controls and overlays retain Space instead of navigating the deck", async ({ page }) => {
  await openExhibit(page);
  for (const html of [
    '<label tabindex="0">Label</label>',
    '<span role="link" tabindex="0">Custom link</span>',
    '<span role="tab" tabindex="0">Tab</span>',
    '<span role="slider" tabindex="0" aria-valuenow="1">Slider</span>',
    '<span data-film="1" tabindex="0">Film</span>',
    '<div role="alertdialog"><div tabindex="0">Alert content</div></div>',
    '<div aria-modal="true"><div tabindex="0">Modal content</div></div>',
    '<div popover="manual"><div tabindex="0">Popover content</div></div>',
  ]) {
    await page.evaluate((markup) => {
      const host = document.createElement("div");
      host.id = "shortcut-test";
      host.innerHTML = markup;
      document.querySelector(".quote-exhibit-toolbar")!.append(host);
      host.querySelector<HTMLElement>("[popover]")?.showPopover();
      host.querySelector<HTMLElement>("[tabindex]")!.focus();
    }, html);
    await page.keyboard.press("Space");
    await expect(deck(page)).toHaveAttribute("data-active-quote", FIRST);
    await page.locator("#shortcut-test").evaluate((element) => element.remove());
  }
});

test("the explainer carries person links without a separate name-on-name byline", async ({ page }) => {
  await openExhibit(page, `${SCORSESE}?quote=for-me-the-editing-process-of`);
  const explainer = active(page).locator(".quote-exhibit-context");
  await expect(explainer).toHaveText("From Scorsese's video tribute played before Thelma accepted the BAFTA Fellowship at the Royal Albert Hall; reported in a PA wire story.");
  const scorsese = explainer.getByRole("link", { name: "Martin Scorsese", exact: true });
  const thelma = explainer.getByRole("link", { name: "Thelma Schoonmaker", exact: true });
  await expect(scorsese).toHaveText("Scorsese");
  await expect(scorsese).toHaveAttribute("href", "/p/1032-martin-scorsese");
  await expect(thelma).toHaveText("Thelma");
  await expect(thelma).toHaveAttribute("href", "/p/3661-thelma-schoonmaker");
  await expect(active(page).locator("figcaption > :not(.quote-exhibit-context):not(.quote-exhibit-source):not(.sr-only)")).toHaveCount(0);
  await scorsese.focus();
  await page.keyboard.press("Enter");
  const panel = page.getByRole("dialog", { name: "Martin Scorsese", exact: true });
  await expect(panel).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(scorsese).toBeFocused();

  const [popup] = await Promise.all([
    page.context().waitForEvent("page"),
    scorsese.click({ modifiers: ["ControlOrMeta"] }),
  ]);
  await popup.waitForLoadState("domcontentloaded");
  expect(new URL(popup.url()).pathname).toBe("/p/1032-martin-scorsese");
  await expect(panel).toBeHidden();
  await expect(deck(page)).toHaveAttribute("data-active-quote", "for-me-the-editing-process-of");
  await popup.close();
});

test("the counter opens a keyboard-accessible index that jumps to a quote without adding history", async ({ page }) => {
  await openExhibit(page);
  const count = await deck(page).locator("[data-quote-slide]").count();
  const historyLength = await page.evaluate(() => history.length);
  const browse = deck(page).getByRole("button", { name: "Browse all quotes", exact: true });
  await browse.click();
  const index = page.getByRole("dialog", { name: "All quotes", exact: true });
  await expect(index).toBeVisible();
  await expect(page.locator("dialog")).toHaveCount(0);
  await expect(index.locator("[data-side-panel-scroll]")).toBeFocused();
  const links = index.locator("ol a");
  await expect(links).toHaveCount(count);
  await expect(links.first()).toHaveAttribute("aria-current", "true");
  await page.keyboard.press("Space");
  await expect(deck(page)).toHaveAttribute("data-active-quote", FIRST);
  await page.keyboard.press("Escape");
  await expect(index).toBeHidden();
  await expect(browse).toBeFocused();
  await browse.click();
  await links.nth(1).click();
  await expect(index).toBeHidden();
  await expect(deck(page)).toHaveAttribute("data-active-quote", SECOND);
  await expectSnap(page, 1);
  await expect(browse).toBeFocused();
  expect(await page.evaluate(() => history.length)).toBe(historyLength);
});

test("further reading stays reachable and legacy exhibit links become ordinary quote links", async ({ page }) => {
  await openExhibit(page, "/p/488-steven-spielberg+491-john-williams?view=clippings");
  await deck(page).getByRole("button", { name: "More reading", exact: true }).click();
  const index = page.getByRole("dialog", { name: "More reading", exact: true });
  await expect(index.getByRole("heading", { name: "More reading", exact: true })).toBeVisible();
  await expect(index.locator(".quote-exhibit-index-list")).toHaveCount(0);
  await expect(index.getByRole("link", { name: /Spielberg-Williams: Symphonic Cinema/ })).toHaveAttribute("target", "_blank");
  await page.keyboard.press("Escape");

  await openExhibit(page, `${SCORSESE}?view=clippings&exhibit=photograph&quote=${SECOND}&from=1980&to=2000`);
  await expect(deck(page)).toHaveAttribute("data-active-quote", SECOND);
  await expect(deck(page).locator("[data-quote-exhibit]")).toHaveAttribute("data-quote-exhibit", "portraits");
  expect(new URL(page.url()).searchParams.has("exhibit")).toBe(false);
  expect(new URL(page.url()).searchParams.get("from")).toBe("1980");
  await expect(page.getByRole("button", { name: /Photograph|Portraits|Reading view/ })).toHaveCount(0);
});

for (const width of [1440, 390]) {
  test(`More reading uses the shared slide-out shell and restores its opener at ${width}px`, async ({ page }) => {
    const height = 844;
    await page.setViewportSize({ width, height });
    await openExhibit(page, "/p/488-steven-spielberg+491-john-williams?view=clippings");
    const quote = await deck(page).getAttribute("data-active-quote");
    const button = deck(page).getByRole("button", { name: "More reading", exact: true });
    await button.click();
    const panel = page.getByRole("dialog", { name: "More reading", exact: true });
    await expect(panel).toBeVisible();
    await expect(panel.locator("[data-side-panel-scroll]")).toBeFocused();
    await expect(page.locator("[data-side-panel]")).toHaveCount(1);
    await expect(page.locator("dialog")).toHaveCount(0);
    await expect.poll(async () => {
      const box = (await panel.boundingBox())!;
      return Math.round(box.y + box.height);
    }).toBe(height);
    await expect.poll(async () => {
      const box = (await panel.boundingBox())!;
      return Math.round(box.x + box.width);
    }).toBe(width);
    const box = (await panel.boundingBox())!;
    expect(Math.round(box.x + box.width)).toBe(width);
    if (width >= 768) {
      expect(box.y).toBe(0);
      expect(box.width).toBe(480);
    } else {
      expect(box.x).toBe(0);
      expect(box.y).toBeGreaterThan(0);
      expect(box.height).toBeLessThanOrEqual(height * 0.9 + 1);
    }
    await page.keyboard.press("Space");
    await expect(deck(page)).toHaveAttribute("data-active-quote", quote!);
    await panel.getByRole("button", { name: "Close more reading", exact: true }).click();
    await expect(panel).toBeHidden();
    await expect(button).toBeFocused();
    await button.click();
    await expect(panel).toBeVisible();
    await page.mouse.click(4, 4);
    await expect(panel).toBeHidden();
    await expect(button).toBeFocused();
  });
}

test("linked quotes keep their original order; history and resizing retain the active quote and canonical share URL", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const quoteId = "when-i-read-rushmore-i-figured";
  await openExhibit(page, `${ANDERSON}?view=clippings&quote=${quoteId}`);
  await expect(active(page).locator("blockquote")).toContainText("When I read Rushmore");
  await expect(backdrop(page).locator('[data-portrait-person="1532"]')).toHaveAttribute("data-speaking", "true");
  await expect(backdrop(page).locator('[data-portrait-person="5655"] img')).toHaveCSS("filter", "grayscale(1) brightness(0.72)");
  await expect(active(page).locator(".quote-exhibit-plate")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  const ids = await deck(page).locator("[data-quote-slide]").evaluateAll((elements) => elements.map((element) => element.getAttribute("data-quote-slide")));
  await active(page).getByRole("button", { name: "Share this quote by Bill Murray", exact: true }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(`http://127.0.0.1:3102${ANDERSON}/q/${quoteId}`);

  const otherId = ids.find((id) => id !== quoteId)!;
  await page.evaluate((id) => {
    const params = new URLSearchParams(location.search);
    params.set("quote", id!);
    history.pushState(null, "", `${location.pathname}?${params}`);
  }, otherId);
  await expect(deck(page)).toHaveAttribute("data-active-quote", otherId!);
  await page.goBack();
  await expect(deck(page)).toHaveAttribute("data-active-quote", quoteId);
  expect(await deck(page).locator("[data-quote-slide]").evaluateAll((elements) => elements.map((element) => element.getAttribute("data-quote-slide")))).toEqual(ids);

  await openExhibit(page);
  await scroller(page).focus();
  await page.keyboard.press("Space");
  await expect(deck(page)).toHaveAttribute("data-active-quote", SECOND);
  await expect(deck(page).locator("[data-quote-exhibit]")).toHaveAttribute("data-quote-exhibit", "portraits");
  await expect(deck(page)).toHaveAttribute("data-active-quote", SECOND);
  await expectSnap(page, 1);
  await page.setViewportSize({ width: 320, height: 568 });
  await expectSnap(page, 1);
  await expect(deck(page)).toHaveAttribute("data-active-quote", SECOND);
});

test("long quotes remain scrollable inside a slide, and switching views removes and restores the exhibition cleanly", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 320, height: 568 });
  await openExhibit(page, `${ANDERSON}?view=clippings&quote=when-i-read-rushmore-i-figured`);
  const quote = active(page).locator(".quote-exhibit-plate");
  expect(await quote.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  const quoteId = await deck(page).getAttribute("data-active-quote");
  // Tab from the deck reaches the named text pane; click focus is not stolen by the outer scroller either.
  await page.keyboard.press("Tab");
  await expect(quote).toBeFocused();
  await expect(quote).toHaveAttribute("aria-label", /Quote \d+ text/);
  await page.keyboard.press("Space");
  await expect.poll(() => quote.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expect(deck(page)).toHaveAttribute("data-active-quote", quoteId!);
  await page.keyboard.press("Shift+Space");
  await expect.poll(() => quote.evaluate((element) => element.scrollTop)).toBe(0);
  await expect(deck(page)).toHaveAttribute("data-active-quote", quoteId!);
  await quote.click({ position: { x: 3, y: 3 } });
  await expect(quote).toBeFocused();
  await quote.evaluate((element) => element.scrollTo({ top: element.scrollHeight, behavior: "instant" }));
  expect(await quote.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expectSnap(page, await active(page).evaluate((element) => Array.from(element.parentElement!.children).indexOf(element)));
  await page.keyboard.press("Space");
  await expect(deck(page)).not.toHaveAttribute("data-active-quote", quoteId!);
  await expect(scroller(page)).toBeFocused();

  // The restored top switcher works directly from the exhibit.
  await page.setViewportSize({ width: 1440, height: 900 });
  const views = page.getByRole("navigation", { name: "Views", exact: true });
  await expect(views).toBeVisible();
  await views.getByRole("link", { name: "Table", exact: true }).click();
  await expect(deck(page)).toHaveCount(0);
  await expect(views).toBeVisible();
  await expect(page.locator("html")).not.toHaveCSS("overflow-y", "hidden");
  const address = page.url();
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await page.keyboard.press("Space");
  expect(page.url()).toBe(address);
  await views.getByRole("link", { name: "Quotes", exact: true }).click();
  await expect(scroller(page)).toBeFocused();
  const returnedId = await deck(page).getAttribute("data-active-quote");
  expect(returnedId).toBeTruthy();
  await page.keyboard.press("Space");
  await expect(deck(page)).not.toHaveAttribute("data-active-quote", returnedId!);
});

test("critics treat the portraits equally, and broken portraits fall back to initials", async ({ page }) => {
  await openExhibit(page, "/p/488-steven-spielberg+491-john-williams?view=clippings&quote=critic-knowing-the-family-issues-of-spielbergs");
  await expect(active(page).locator("blockquote")).toContainText("Knowing the family issues");
  await expect(backdrop(page).locator('[data-speaking="true"], [data-quiet="true"]')).toHaveCount(0);

  await page.route("https://image.tmdb.org/**", (route) => route.abort());
  await openExhibit(page);
  await expect(deck(page).locator("[data-quote-exhibit]")).toHaveAttribute("data-quote-exhibit", "portraits");
  await expect(deck(page).locator(".quote-exhibit-credit")).toContainText("Portraits via TMDB");
  await expect(deck(page).getByRole("link", { name: /ACMI/ })).toHaveCount(0);
  await expect(backdrop(page).locator('[data-portrait-person="1032"] img')).toHaveCount(0);
  await expect(backdrop(page).locator('[data-portrait-person="1032"]')).toContainText("MS");
});

test("one image and credit stay stationary while quotes move, and portrait changes reuse the same images", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  await openExhibit(page);
  await page.evaluate(() => document.fonts.ready);
  await expect(backdrop(page)).toHaveCount(1);
  await expect(backdrop(page).locator("img")).toHaveCount(2);
  expect(await backdrop(page).evaluate((element) => element.closest(".quote-exhibit-scroller") === null)).toBe(true);
  const image = backdrop(page).locator("img").first();
  const originalImage = (await image.elementHandle())!;
  const imageBox = await image.boundingBox();
  const credit = deck(page).locator(".quote-exhibit-credit");
  const creditBox = await credit.boundingBox();
  const firstQuote = deck(page).locator(`[data-quote-slide="${FIRST}"] blockquote`);
  const quoteBox = (await firstQuote.boundingBox())!;

  // Hold the content between snap points to verify the backdrop is stationary during the movement, not just after it.
  await scroller(page).evaluate((element) => {
    element.style.scrollSnapType = "none";
    element.scrollTo({ top: element.clientHeight / 4, behavior: "instant" });
  });
  await expect.poll(() => scroller(page).evaluate((element) => element.scrollTop)).toBe(200);
  expect(await image.boundingBox()).toEqual(imageBox);
  expect(await credit.boundingBox()).toEqual(creditBox);
  expect((await firstQuote.boundingBox())!.y).toBeCloseTo(quoteBox.y - 200, 0);

  await scroller(page).evaluate((element) => {
    element.style.scrollSnapType = "";
    element.scrollTo({ top: element.clientHeight, behavior: "instant" });
  });
  await expect(deck(page)).toHaveAttribute("data-active-quote", SECOND);
  await expectSnap(page, 1);
  expect(await originalImage.evaluate((element) => element === document.querySelector(".quote-exhibit-portrait img"))).toBe(true);
  expect(await image.boundingBox()).toEqual(imageBox);

  const portraits = backdrop(page).locator(".quote-exhibit-portrait img");
  await expect(portraits).toHaveCount(2);
  const originals = await portraits.elementHandles();
  const boxes = await portraits.evaluateAll((images) => images.map((element) => element.getBoundingClientRect().toJSON()));
  await page.evaluate(() => {
    const params = new URLSearchParams(location.search);
    params.set("quote", "for-me-the-editing-process-of");
    history.replaceState(null, "", `${location.pathname}?${params}`);
  });
  await expect(backdrop(page).locator('[data-portrait-person="1032"]')).toHaveAttribute("data-speaking", "true");
  await expect(backdrop(page).locator('[data-portrait-person="3661"] img')).toHaveCSS("filter", "grayscale(1) brightness(0.72)");
  for (const original of originals) expect(await original.evaluate((element) => element.isConnected)).toBe(true);
  expect(await portraits.evaluateAll((images) => images.map((element) => element.getBoundingClientRect().toJSON()))).toEqual(boxes);
  await expect(backdrop(page)).toHaveCount(1);
});
