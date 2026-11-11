import { describe, expect, it } from "vitest";
import { followsLink, type ClickLike, type LinkLike } from "@/lib/explicit-navigation";

const HERE = "https://parallel.test/p/1-ann+2-bo?view=timeline";
const plain: ClickLike = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };
const link = (href: string, rest: Partial<LinkLike> = {}): LinkLike => ({ href, target: "", download: false, ...rest });

describe("followsLink", () => {
  it("is a plain click on a link to another page of the app", () => {
    expect(followsLink(plain, link("https://parallel.test/"), HERE)).toBe(true);
    expect(followsLink(plain, link("https://parallel.test/p/1-ann"), HERE)).toBe(true);
    // The same people in another view is another address.
    expect(followsLink(plain, link("https://parallel.test/p/1-ann+2-bo?view=table"), HERE)).toBe(true);
    expect(followsLink(plain, link("https://parallel.test/p/1-ann+2-bo"), HERE)).toBe(true);
  });

  it("is a link to another site that opens in this tab too: it leaves this page as well", () => {
    expect(followsLink(plain, link("https://example.org/"), HERE)).toBe(true);
    expect(followsLink(plain, link("https://example.org/", { target: "_self" }), HERE)).toBe(true);
  });

  it("is not a click that opens the link elsewhere: a modifier key or another button", () => {
    for (const click of [{ metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }, { button: 2 }]) {
      expect(followsLink({ ...plain, ...click }, link("https://parallel.test/"), HERE)).toBe(false);
    }
  });

  it("is not a link that opens in a new tab or window, or in a frame, or one that downloads", () => {
    expect(followsLink(plain, link("https://www.themoviedb.org/movie/1", { target: "_blank" }), HERE)).toBe(false);
    expect(followsLink(plain, link("https://parallel.test/", { target: "preview" }), HERE)).toBe(false);
    expect(followsLink(plain, link("https://parallel.test/films.csv", { download: true }), HERE)).toBe(false);
  });

  it("is not a link to this very page, with or without a hash: nothing is left", () => {
    expect(followsLink(plain, link(HERE), HERE)).toBe(false);
    expect(followsLink(plain, link(`${HERE}#films`), HERE)).toBe(false);
    expect(followsLink(plain, link("#films"), HERE)).toBe(false);
  });

  it("is not a link that is not a web address: mail, a phone number, a script", () => {
    expect(followsLink(plain, link("mailto:someone@parallel.test"), HERE)).toBe(false);
    expect(followsLink(plain, link("tel:+15555550100"), HERE)).toBe(false);
    expect(followsLink(plain, link("javascript:void(0)"), HERE)).toBe(false);
  });

  it("is not a link or a page address it cannot read", () => {
    expect(followsLink(plain, link("http://"), HERE)).toBe(false);
    expect(followsLink(plain, link("https://parallel.test/"), "not an address")).toBe(false);
  });
});
