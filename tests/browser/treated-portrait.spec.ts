import { test, expect, type Locator, type Page } from "next/experimental/testmode/playwright";
import { PIXEL } from "./fixtures";
import cuts from "../../src/lib/portrait-cuts.json";
import { portraitPersonHexes } from "../../src/lib/portrait-cuts";
import { initials } from "../../src/lib/person-labels";

/**
 * The cut-out portraits (`TreatedPortrait`) in the app: what they show when the photo cannot be loaded, and what they sit on.
 * - Kevin Smith and Jason Mewes have no committed cut, so their portraits are tears (`portrait-tears.ts`), over a montage of their own films' posters.
 * - Scorsese and Schoonmaker are cut from the photo the page has (a real cut); Anderson and Murray are cut from another one, so their portraits are tears too.
 * The last two pairs have Quotes.
 */

const UNCUT = "/p/19303-kevin-smith+19302-jason-mewes";
const CUT = "/p/1032-martin-scorsese+3661-thelma-schoonmaker";
const CHANGED = "/p/5655-wes-anderson+1532-bill-murray";

const names: Record<string, string> = {
  "19303": "Kevin Smith", "19302": "Jason Mewes",
  "1032": "Martin Scorsese", "3661": "Thelma Schoonmaker",
  "5655": "Wes Anderson", "1532": "Bill Murray",
};

/** The photo TMDB gives each person: the one the committed cut was made from (a real cut), or another (a tear). */
const COMMITTED_CUT = new Set(["1032", "3661"]);
const profileOf = (id: string) => (COMMITTED_CUT.has(id) ? (cuts as Record<string, { profilePath: string }>)[id].profilePath : `/profile-${id}.jpg`);

/** Films of their own, best known first: the posters of the montage behind a tear are the first nine. */
const OWN_FILMS = 10;
const ownPoster = (id: string, index: number) => `/own-${id}-${index}.jpg`;

/** A dozen films the two have in common (so the pair page has a shared list), and the ten each has alone, whose votes put them ahead of the shared ones. */
const credits = (id: string) => ({
  cast: [
    ...Array.from({ length: 12 }, (_, index) => ({ id: 100 + index, title: `Shared Film ${index + 1}`, release_date: `${2000 + index}-03-17`, poster_path: `/shared-${index}.jpg`, vote_count: 100 + index, order: 0, character: "Lead" })),
    ...Array.from({ length: OWN_FILMS }, (_, index) => ({ id: Number(id) * 100 + index, title: `Own Film ${id}-${index}`, release_date: `${1980 + index * 2}-06-01`, poster_path: ownPoster(id, index), vote_count: 5000 - index * 100, order: 1, character: "Lead" })),
  ],
  crew: [],
});

test.beforeEach(async ({ page, next }) => {
  await page.route("https://image.tmdb.org/**", (route) => route.fulfill({ contentType: "image/png", body: PIXEL }));
  next.onFetch((request) => {
    const url = new URL(request.url);
    if (url.hostname !== "api.themoviedb.org") return "abort";
    const match = url.pathname.match(/^\/3\/person\/(\d+)(\/movie_credits)?$/);
    if (match && names[match[1]]) {
      if (!match[2]) return Response.json({ id: Number(match[1]), name: names[match[1]], profile_path: profileOf(match[1]), biography: "A biography for the portraits." });
      return Response.json(credits(match[1]));
    }
    if (url.pathname === "/3/discover/movie") return Response.json({ total_pages: 1, results: [] });
    return "abort";
  });
});

/** Every portrait request is answered 404 (the posters still load): a photo that TMDB has lost, or that a blocker took. Later routes win over `beforeEach`'s. */
async function failPortraits(page: Page) {
  const photos = Object.keys(names).map(profileOf);
  await page.route((url) => url.hostname === "image.tmdb.org" && photos.some((path) => url.pathname.endsWith(path)), (route) => route.fulfill({ status: 404 }));
}

/** "#rrggbb" as the computed colour: "rgb(r, g, b)". */
const rgbOf = (hex: string) => `rgb(${[1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16)).join(", ")})`;

const deck = (page: Page) => page.locator("[data-quote-exhibit-deck]");
const heroPortrait = (page: Page, id: string) => page.locator(`[data-hero-body] [data-hero-portrait="${id}"] [data-treated-portrait]`);
const quotesPortrait = (page: Page, id: string) => deck(page).locator(`.quote-exhibit-media [data-portrait-person="${id}"] [data-treated-portrait]`);

test.describe("a portrait whose photo cannot be loaded is the person's colour and their initials, in the same box", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("in the pair hero, for people with no cut (a tear)", async ({ page }) => {
    await failPortraits(page);
    await page.goto(`${UNCUT}?view=timeline`);
    const [first, second] = portraitPersonHexes([19303, 19302])!;
    for (const [id, hex] of [["19303", first], ["19302", second]]) {
      const portrait = heroPortrait(page, id);
      await expect(portrait).toHaveAttribute("data-treated-failed", "");
      await expect(portrait.locator("[data-treated-initials]")).toBeVisible();
      await expect(portrait.locator("[data-treated-initials]")).toHaveText(initials(names[id]));
      // Not an empty card: the person's colour behind the initials, in the tile's size (4.75rem by 7rem).
      await expect(portrait.locator(":scope > span")).toHaveCSS("background-color", rgbOf(hex));
      const box = (await portrait.boundingBox())!;
      expect(box.width).toBeCloseTo(76, 0);
      expect(box.height).toBeCloseTo(112, 0);
      // The photo that failed draws nothing (no picture of any kind, and no cut).
      await expect(portrait.locator("svg")).toHaveCount(0);
      await expect(portrait.locator("img")).toHaveCount(0);
    }
  });

  test("in the pair hero, for people with a cut", async ({ page }) => {
    await failPortraits(page);
    await page.goto(`${CUT}?view=timeline`);
    for (const id of ["1032", "3661"]) {
      const portrait = heroPortrait(page, id);
      await expect(portrait).toHaveAttribute("data-treated-failed", "");
      await expect(portrait.locator("[data-treated-initials]")).toHaveText(initials(names[id]));
      await expect(portrait.locator("svg")).toHaveCount(0);
    }
  });

  test("in the Quotes, for people with a cut and for people with a tear", async ({ page }) => {
    await failPortraits(page);
    for (const [path, ids] of [[CUT, ["1032", "3661"]], [CHANGED, ["5655", "1532"]]] as const) {
      await page.goto(`${path}?view=clippings`);
      await expect(deck(page)).toBeVisible();
      for (const id of ids) {
        const portrait = quotesPortrait(page, id);
        await expect(portrait).toHaveAttribute("data-treated-failed", "");
        await expect(portrait.locator("[data-treated-initials]")).toBeVisible();
        await expect(portrait.locator("[data-treated-initials]")).toHaveText(initials(names[id]));
        // It fills the panel, as the picture does.
        const panel = (await page.locator(`.quote-exhibit-media [data-portrait-person="${id}"]`).boundingBox())!;
        const box = (await portrait.boundingBox())!;
        expect(box.width).toBeCloseTo(panel.width, 0);
        expect(box.height).toBeCloseTo(panel.height, 0);
      }
    }
  });
});

/** The montage behind a portrait: the `src` of each poster, in the order of the cells. */
const montageOf = (portrait: Locator) => portrait.locator("img").evaluateAll((images) => images.map((image) => image.getAttribute("src")));
/** What the montage of `id` is: the nine best-known of their own films, as the embeds draw (`montagePosters`), at the card's poster size. */
const ownMontage = (id: string, size: string) => Array.from({ length: 9 }, (_, index) => `https://image.tmdb.org/t/p/${size}${ownPoster(id, index)}`);

test.describe("a portrait with no cut is torn over the montage of the person's own films, wherever the app draws it", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("in the pair hero and the person panel, for people with no cut at all", async ({ page }) => {
    await page.goto(`${UNCUT}?view=timeline`);
    for (const id of ["19303", "19302"]) {
      const portrait = heroPortrait(page, id);
      // A tear, not the flat colour: nine posters, the person's best-known films first.
      await expect(portrait.locator("svg")).toHaveCount(1);
      await expect.poll(() => montageOf(portrait)).toEqual(ownMontage(id, "w92"));
    }

    // The same person's panel, opened by their portrait, once the page is live (the gear's sheet opening is the proof).
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Settings", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Settings", exact: true })).toBeHidden();
    const bio = page.getByRole("dialog", { name: names["19302"], exact: true });
    await page.locator("[data-hero-body]").getByRole("button", { name: `Details for ${names["19302"]}`, exact: true }).click();
    await expect(bio).toBeVisible();
    await expect.poll(() => montageOf(bio.locator("[data-treated-portrait]"))).toEqual(ownMontage("19302", "w154"));
  });

  test("in the Depth view's hero", async ({ page }) => {
    await page.goto(`${UNCUT}?view=depth`);
    for (const id of ["19303", "19302"]) {
      await expect.poll(() => montageOf(heroPortrait(page, id))).toEqual(ownMontage(id, "w92"));
    }
  });

  test("in the Quotes, for people whose photo is not the one they were cut from", async ({ page }) => {
    // Anderson and Murray have Quotes, and a cut of a photo TMDB no longer has: their tear sits on the films the page has, not on the posters the cut file kept.
    await page.goto(`${CHANGED}?view=clippings`);
    await expect(deck(page)).toBeVisible();
    for (const id of ["5655", "1532"]) {
      await expect.poll(() => montageOf(quotesPortrait(page, id))).toEqual(ownMontage(id, "w185"));
    }
  });
});
