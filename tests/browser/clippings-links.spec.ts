import { test, expect } from "next/experimental/testmode/playwright";

test("both attribution names and source links stay white on desktop and mobile", async ({ page, next }) => {
  next.onFetch((request) => {
    const url = new URL(request.url);
    if (url.hostname !== "api.themoviedb.org") return "abort";
    const match = url.pathname.match(/^\/3\/person\/(309|955)(\/movie_credits)?$/);
    if (match) {
      if (!match[2]) return Response.json({
        id: Number(match[1]),
        name: match[1] === "309" ? "Pedro Almodóvar" : "Penélope Cruz",
        profile_path: null,
        biography: "A biography for testing the attribution's dialog.",
      });
      return Response.json({ cast: [{
        id: 1, title: "Volver", release_date: "2006-03-17", poster_path: null,
        vote_count: 100, character: "Lead", order: 0,
      }], crew: [] });
    }
    if (url.pathname === "/3/discover/movie") return Response.json({ total_pages: 1, results: [] });
    return "abort";
  });

  await page.goto("/p/309-pedro-almodovar+955-penelope-cruz?view=clippings");
  await expect(page.getByRole("tab", { name: "Clippings", exact: true })).toHaveAttribute("aria-selected", "true");
  const quote = page.locator("#quote-i-was-so-happy-that-he");
  const speaker = quote.getByRole("button", { name: "Penélope Cruz", exact: true });
  const subject = quote.getByRole("button", { name: "Pedro Almodóvar", exact: true });
  const source = quote.getByRole("link", { name: /Tribeca Film Festival/ });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(speaker).toHaveCSS("color", "rgb(255, 255, 255)");
    await expect(subject).toHaveCSS("color", "rgb(255, 255, 255)");
    await expect(source).toHaveCSS("color", "rgb(255, 255, 255)");
    await subject.hover();
    await expect(subject).toHaveCSS("color", "rgb(255, 255, 255)");
    await source.hover();
    await expect(source).toHaveCSS("color", "rgb(255, 255, 255)");
    await expect(subject.locator("..")).not.toHaveCSS("color", "rgb(255, 255, 255)");
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await subject.click();
  // The same slide-out panel the films use, not a centred modal: a sheet against the right edge at desktop width
  // (measured once its slide-in has finished).
  const dialog = page.getByRole("dialog", { name: "Pedro Almodóvar", exact: true });
  await expect(dialog.getByText("Person", { exact: true })).toBeVisible();
  // Focus is on the panel's scroll container, so the arrow keys scroll a long biography.
  await expect(dialog.locator("[data-side-panel-scroll]")).toBeFocused();
  await expect
    .poll(async () => {
      const box = await dialog.boundingBox();
      return box && [Math.round(box.x + box.width), Math.round(box.height)];
    })
    .toEqual([1440, 900]);
  const tmdbLink = dialog.getByRole("heading").getByRole("link");
  await expect(tmdbLink).toHaveAttribute("href", "https://www.themoviedb.org/person/309");
  await expect(tmdbLink).toHaveAttribute("target", "_blank");
  await expect(tmdbLink).toHaveCSS("color", "rgb(255, 255, 255)");
  await page.keyboard.press("Escape");
  await expect(subject).toBeFocused();
});
