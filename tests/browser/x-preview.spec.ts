import { test as base, expect } from "next/experimental/testmode/playwright";
import { PIXEL } from "./fixtures";

// The development-only X preview page (`/dev/x-preview`): it reads the target page's tags from this server and frames the pair's embed the way a post does.

const PEOPLE = [
  { id: 488, name: "Steven Spielberg", slug: "488-steven-spielberg" },
  { id: 491, name: "John Williams", slug: "491-john-williams" },
] as const;
const PAIR_PATH = `/p/${PEOPLE[0].slug}+${PEOPLE[1].slug}`;

const film = (id: number, year: number) => ({ id, title: `Preview Film ${id}`, release_date: `${year}-03-17`, poster_path: `/poster-${id}.png`, vote_count: 500, character: "Lead", order: 0 });

const test = base.extend({
  page: async ({ page }, provide) => {
    await page.route("https://image.tmdb.org/**", (route) => route.fulfill({ contentType: "image/png", body: PIXEL }));
    await provide(page);
  },
  next: async ({ next }, provide) => {
    next.onFetch((request) => {
      const url = new URL(request.url);
      // The preview reads the pair's own page from this server: that request is the real one.
      if (url.hostname === "127.0.0.1") return "continue";
      if (url.hostname !== "api.themoviedb.org") return "abort";
      const match = url.pathname.match(/^\/3\/person\/(\d+)(\/movie_credits)?$/);
      const person = match && PEOPLE.find((p) => p.id === Number(match[1]));
      if (match && person) {
        if (!match[2]) return Response.json({ id: person.id, name: person.name, profile_path: null, biography: "A biography." });
        return Response.json({ cast: [film(100, 2001), film(101, 2003), film(102, 2005)], crew: [] });
      }
      return "abort";
    });
    await provide(next);
  },
});

test.beforeEach(async ({ next }) => {
  void next;
});

test("the page reads the pair's tags and frames its embed: an iframe of twitter:player on this server, in the settings asked for", async ({ page }) => {
  await page.goto(`/dev/x-preview?target=${encodeURIComponent(PAIR_PATH)}`);

  // The debug panel shows the tags the page really sends, and the frame and picture it uses (the production URLs moved to this server).
  const tags = page.getByRole("region", { name: "Tags read from the page" });
  await expect(tags.getByRole("row", { name: /^twitter:card player/ })).toBeVisible();
  await expect(tags.getByRole("row", { name: /^twitter:player https:\/\/.*\/embed\/p\/488-steven-spielberg\+491-john-williams/ })).toBeVisible();
  await expect(tags.getByText(/\/p\/488-steven-spielberg%2B491-john-williams\/opengraph-image/).first()).toBeVisible();
  await expect(page.getByText("From parallel.zachherring.com")).toBeVisible();

  // Then the frame, at the card's 1200 x 630 shape scaled to 600 wide, on this server's own embed.
  const frame = page.locator('iframe[title^="The post"]');
  await expect(frame).toBeVisible();
  const origin = new URL(page.url()).origin;
  await expect(frame).toHaveAttribute("src", `${origin}/embed/p/${PEOPLE[0].slug}+${PEOPLE[1].slug}`);
  expect(await frame.evaluate((node) => [node.clientWidth, node.clientHeight])).toEqual([600, 315]);
  await expect(page.frameLocator('iframe[title^="The post"]').getByRole("link", { name: /^Open in Parallel/ })).toBeVisible();

  // The width, the sandbox and the reduced motion are settings of the frame.
  await page.getByRole("button", { name: "516", exact: true }).click();
  await expect(frame).toBeVisible();
  expect(await frame.evaluate((node) => [node.clientWidth, node.clientHeight])).toEqual([516, 271]);
  expect(await frame.getAttribute("sandbox")).toBeNull();
  await page.getByRole("button", { name: "Strict guess" }).click();
  await expect(frame).toHaveAttribute("sandbox", "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox");
  await page.getByLabel("Reduced motion").check();
  await expect(frame).toHaveAttribute("src", /\?motion=reduce$/);
});

test("on a phone the card is the picture, and a tap opens the embed in a panel of the height set", async ({ page }) => {
  await page.goto(`/dev/x-preview?target=${encodeURIComponent(PAIR_PATH)}`);
  await page.getByRole("button", { name: "Mobile", exact: true }).click();
  await page.getByRole("button", { name: /^Open the card/ }).click();
  const panel = page.locator('iframe[title^="The post"]');
  await expect(panel).toBeVisible();
  expect(await panel.evaluate((node) => [node.clientWidth, node.clientHeight])).toEqual([390, 591]);
  await page.getByRole("button", { name: "253", exact: true }).click({ force: true });
  expect(await panel.evaluate((node) => [node.clientWidth, node.clientHeight])).toEqual([390, 253]);
});
