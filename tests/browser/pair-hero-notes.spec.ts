import type { Page } from "next/experimental/testmode/playwright";
import { test as base, expect } from "next/experimental/testmode/playwright";
import { getPairClippingSet } from "../../src/lib/clippings";
import { splitCitations } from "../../src/lib/citations";
import { getPairCritics } from "../../src/lib/critics";
import { PAIR_DESCRIPTIONS } from "../../src/lib/pair-descriptions";
import { getHeroNote } from "../../src/lib/pair-hero-note";
import { buildPeopleSlug } from "../../src/lib/slug";
import { PEOPLE_PATH, test as scrollTest, bar, heroBody } from "./fixtures";

/**
 * What the pair hero says beside the portraits, when the pair has no quote: its curated description, set with Wikipedia-style footnotes (the inline `[n]` markers are
 * small superscript links to the sources, which open in a new tab), and nothing at all for a pair that has no note of its own.
 *
 * Which pair shows its description depends on the data: the hero features a pair's first quote that fits whole before its description (`pickHeroNote`), and the
 * quotes are researched pair by pair (`clippings.json`), so a pair that had none yesterday has some today. So the pair of these specs is not named: it is the first curated pair
 * (`PAIR_DESCRIPTIONS`) that has a description of about forty words with at least two sources, and no quotes at all (no Quotes view for `?view=clippings` to open), whose hero
 * note is that description, found in the data as the server reads it. Its films and names are mocked as a director's and a cinematographer's credits, whoever it is, so the layout
 * these specs measure does not depend on whose it is. If every described pair has quotes, there is nothing to show and the specs skip (the rule itself has unit tests, `pair-hero.test.ts`).
 */

const SUBJECT = (() => {
  for (const [key, description] of Object.entries(PAIR_DESCRIPTIONS)) {
    const ids = key.split("+").map(Number);
    const parts = splitCitations(description.text, description.sources.length);
    const words = parts.filter((part) => part.kind === "text").map((part) => part.text).join("").split(/\s+/).filter(Boolean).length;
    const citations = parts.filter((part) => part.kind === "citation").length;
    const showsDescription = getHeroNote(ids)?.kind === "description";
    if (showsDescription && getPairClippingSet(ids) === null && getPairCritics(ids) === null && words >= 35 && words <= 45 && citations >= 2) {
      const people = [
        { id: ids[0], name: "Alex Auteur" },
        { id: ids[1], name: "Sam Shooter" },
      ];
      return { ids, description, path: `/p/${buildPeopleSlug(people)}`, people };
    }
  }
  return null;
})();
const MISSING = "every pair with a description has quotes now (or a description of another length): there is no pair left that shows its description";
const PAIR_PATH = SUBJECT?.path ?? "";
const DESCRIPTION = SUBJECT?.description ?? { text: "", sources: [] };
const [FIRST, SECOND] = SUBJECT?.ids ?? [0, 0];

const credit = (id: number, year: number, job: string) => ({ id, title: `Mocked Film ${id - 1000}`, release_date: `${year}-07-16`, poster_path: null, vote_count: 100, job });
const FILMS = [2014, 2017, 2020, 2023].map((year, index) => [1001 + index, year] as const);

const test = base.extend({
  next: async ({ next }, provide) => {
    next.onFetch((request) => {
      const url = new URL(request.url);
      if (url.hostname !== "api.themoviedb.org") return "abort";
      const match = url.pathname.match(/^\/3\/person\/(\d+)(\/movie_credits)?$/);
      if (match && [FIRST, SECOND].includes(Number(match[1]))) {
        const director = Number(match[1]) === FIRST;
        if (!match[2]) return Response.json({ id: Number(match[1]), name: SUBJECT!.people[director ? 0 : 1].name, profile_path: null, biography: "A biography." });
        return Response.json({ cast: [], crew: FILMS.flatMap(([id, year]) => (director ? [credit(id, year, "Director"), credit(id, year, "Writer")] : [credit(id, year, "Director of Photography")])) });
      }
      if (url.pathname === "/3/discover/movie") return Response.json({ total_pages: 1, results: [] });
      return "abort";
    });
    await provide(next);
  },
});

test.beforeEach(async ({ next }) => {
  void next;
});
scrollTest.beforeEach(async ({ next }) => {
  void next;
});

const note = (page: Page) => heroBody(page).locator('[data-hero-note="description"]');

/** The flat page reads ?view= after hydration: the Table's hero body moves out of the bar's band into the page then (a new element), so wait for that before measuring it. */
const placed = (page: Page, view: string) => expect(bar(page)).toHaveAttribute("data-hero-placement", view === "?view=table" ? "page" : "band");

test.describe("a pair whose hero shows its description", () => {
  test.skip(!SUBJECT, MISSING);

  for (const view of ["", "?view=timeline", "?view=table", "?view=clippings", "?view=depth"]) {
    test(`${view || "the plain address"}: the description shows when there is no quote, with a footnote for each marker, and no Sources disclosure`, async ({ page }) => {
      // "?view=clippings" is not offered to a pair without quotes: it is the Timeline there, with the same hero.
      await page.goto(`${PAIR_PATH}${view}`);
      await expect(bar(page)).toHaveAttribute("data-hero", "expanded");
      await expect(note(page)).toBeVisible();
      // Roles, and the count the table lists, in the line under the names.
      await expect(bar(page).locator("[data-pair-subtitle]")).toHaveText(/^director × cinematographer · 4 films$/i);

      // The words are the description's, with the markers taken out of the text and set as links.
      const parts = splitCitations(DESCRIPTION.text, DESCRIPTION.sources.length);
      const words = parts.filter((part) => part.kind === "text").map((part) => part.text).join("");
      const citations = parts.filter((part) => part.kind === "citation");
      expect((await note(page).innerText()).replace(/\[\d+\]/g, "").replace(/\s+/g, " ").trim()).toBe(words.replace(/\s+/g, " ").trim());
      const links = note(page).locator("sup a[data-hero-citation]");
      await expect(links).toHaveCount(citations.length);
      await expect(heroBody(page).getByText("Sources", { exact: true })).toHaveCount(0);
      await expect(heroBody(page).locator("details")).toHaveCount(0);

      // Each is [n] in superscript, in the muted link colour, a link to sources[n - 1] in a new tab, named "Source n: <title>" with the title as its tooltip.
      for (const [index, citation] of citations.entries()) {
        const link = links.nth(index);
        const source = DESCRIPTION.sources[citation.n - 1];
        await expect(link).toHaveText(`[${citation.n}]`);
        await expect(link).toHaveAttribute("href", source.url);
        await expect(link).toHaveAttribute("target", "_blank");
        await expect(link).toHaveAttribute("rel", "noopener noreferrer");
        await expect(link).toHaveAttribute("title", source.title);
        await expect(link).toHaveAccessibleName(`Source ${citation.n}: ${source.title}`);
      }
      const look = await links.first().evaluate((element) => {
        const probe = document.createElement("span");
        probe.style.color = "var(--text-muted)";
        document.body.append(probe);
        const muted = getComputedStyle(probe).color;
        probe.remove();
        return {
          raised: element.parentElement!.tagName,
          color: getComputedStyle(element).color,
          muted,
          size: Number.parseFloat(getComputedStyle(element.parentElement!).fontSize),
          body: Number.parseFloat(getComputedStyle(element.closest("p")!).fontSize),
        };
      });
      expect(look.raised).toBe("SUP");
      expect(look.color).toBe(look.muted);
      expect(look.size).toBeLessThan(look.body);
    });
  }

  test("a footnote brightens on hover and on keyboard focus, and Tab reaches each in order", async ({ page }) => {
    await page.goto(`${PAIR_PATH}?view=table`);
    const links = note(page).locator("sup a[data-hero-citation]");
    const first = links.first();
    await expect(first).toBeVisible();
    const muted = await first.evaluate(() => {
      const probe = document.createElement("span");
      probe.style.color = "var(--text-muted)";
      document.body.append(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    });
    await first.hover();
    await expect.poll(() => first.evaluate((element) => getComputedStyle(element).color)).not.toBe(muted);
    await page.mouse.move(5, 500);
    await expect.poll(() => first.evaluate((element) => getComputedStyle(element).color)).toBe(muted);
    await first.focus();
    await expect(first).toBeFocused();
    await expect.poll(() => first.evaluate((element) => getComputedStyle(element).color)).not.toBe(muted);
    await page.keyboard.press("Tab");
    await expect(links.nth(1)).toBeFocused();
  });

  test("a footnote opens its source in a new tab and leaves the page where it is", async ({ page }) => {
    await page.goto(`${PAIR_PATH}?view=table`);
    const link = note(page).locator("sup a[data-hero-citation]").first();
    const href = (await link.getAttribute("href"))!;
    const popupPromise = page.context().waitForEvent("page");
    // The new tab asks the real site: it is not what is under test, so the request is not made.
    await page.context().route(href, (route) => route.fulfill({ contentType: "text/html", body: "<title>source</title>" }));
    await link.click();
    const popup = await popupPromise;
    await popup.waitForLoadState("domcontentloaded");
    expect(popup.url()).toBe(href);
    // `noopener`: the new tab has no handle on this page.
    expect(await popup.evaluate(() => window.opener)).toBeNull();
    expect(new URL(page.url()).pathname).toBe(PAIR_PATH);
  });
});

scrollTest("a pair with no quote, no description and no blurb has no note: the portraits and the chips are all the hero has under the names", async ({ page }) => {
  await page.goto(PEOPLE_PATH);
  await expect(bar(page)).toHaveAttribute("data-hero", "expanded");
  await expect(heroBody(page).locator("[data-hero-note]")).toHaveCount(0);
  await expect(heroBody(page).locator("[data-hero-portrait]")).toHaveCount(2);
  await expect(heroBody(page).locator("[data-hero-chip]")).toHaveCount(3);
  await expect(heroBody(page).getByText("Sources")).toHaveCount(0);
});

test.describe("at 390px wide", () => {
  test.skip(!SUBJECT, MISSING);
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  for (const view of ["?view=timeline", "?view=table", "?view=depth"]) {
    test(`${view}: a description of about forty words is set whole and the hero is 360px tall at most before any scroll`, async ({ page }) => {
      await page.goto(`${PAIR_PATH}${view}`);
      await expect(bar(page)).toHaveAttribute("data-hero", "expanded");
      await placed(page, view);
      await expect(note(page)).toBeVisible();
      // Whole: every word is there, no clamp or clip cuts it, and the citations are links on the screen.
      const state = await note(page).evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const css = getComputedStyle(element);
        return {
          clamped: css.overflow !== "visible" || css.webkitLineClamp !== "none",
          words: element.textContent!.replace(/\[\d+\]/g, "").split(/\s+/).filter(Boolean).length,
          citations: [...element.querySelectorAll("a[data-hero-citation]")].map((link) => {
            const box = link.getBoundingClientRect();
            return box.width > 0 && box.left >= 0 && box.right <= window.innerWidth && box.top >= rect.top && box.bottom <= rect.bottom + 2;
          }),
        };
      });
      expect(state.clamped).toBe(false);
      expect(state.words).toBeGreaterThanOrEqual(35);
      expect(state.words).toBeLessThanOrEqual(45);
      expect(state.citations.length).toBeGreaterThan(0);
      expect(state.citations.every(Boolean)).toBe(true);
      // The bar's band (Timeline, Films) or the body in the page under the bar (Table): no further down than 360px. The cap was 220px until the phone's hero was laid out for readability (upright
      // portraits at the left, the note in a column of its own at the right, the films underneath: ef2d86d); `pair-hero.spec.ts` holds the same 360px for a quote.
      const bottom = await page.evaluate(() => {
        const bottomOf = (selector: string) => document.querySelector(selector)!.getBoundingClientRect().bottom;
        return Math.max(bottomOf("[data-people-bar]"), bottomOf("[data-hero-body]"));
      });
      expect(bottom).toBeLessThanOrEqual(360);
    });
  }
});
