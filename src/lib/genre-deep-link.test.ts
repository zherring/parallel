import { describe, expect, it } from "vitest";
import { GENRE_MARK, GENRE_ROOT, deepLinkCss, deepLinkScript } from "@/lib/genre-deep-link";
import { tabFromHash } from "@/lib/tabs";

const ids = ["featured", "classic", "horror", "sci-fi"];

/** Runs the script against a fake document, as the browser would at the top of the page. */
function run(hash: string): string | null {
  let mark: string | null = null;
  const document = { querySelector: (selector: string) => (selector === `[${GENRE_ROOT}]` ? { setAttribute: (name: string, value: string) => name === GENRE_MARK && (mark = value) } : null) };
  new Function("document", "location", deepLinkScript(ids))(document, { hash });
  return mark;
}

describe("deepLinkScript", () => {
  it("marks the page with the genre a hash names, as the tabs read the hash", () => {
    expect(run("#horror")).toBe("horror");
    expect(run("#Sci-Fi")).toBe("sci-fi");
    expect(run("#%68orror")).toBe("horror");
  });

  it("leaves the default, no hash and a hash that names no tab unmarked", () => {
    expect(run("")).toBeNull();
    expect(run("#featured")).toBeNull();
    expect(run("#nonsense")).toBeNull();
    expect(run("#%E0%A4%A")).toBeNull();
  });

  it("agrees with the tabs about which hashes are which", () => {
    for (const hash of ["", "#horror", "#HORROR", "#sci-fi", "#featured", "#x", "#%zz"]) {
      const tab = tabFromHash(hash, ids, ids[0]);
      expect(run(hash) ?? ids[0], hash).toBe(tab);
    }
  });
});

describe("deepLinkCss", () => {
  const css = deepLinkCss(ids);

  it("hides the default panel and shows the marked genre's, for each genre", () => {
    expect(css).toContain(`[${GENRE_ROOT}][${GENRE_MARK}] [data-genre-panel="featured"]{display:none}`);
    for (const id of ids.slice(1)) {
      expect(css).toContain(`[${GENRE_ROOT}][${GENRE_MARK}="${id}"] [data-genre-panel="${id}"]{display:block}`);
    }
  });

  it("makes the marked genre's pill the selected one", () => {
    expect(css).toContain(`[${GENRE_MARK}="horror"] [data-genre-tab="horror"]{border-color:`);
    expect(css).toContain(`[data-genre-tab="featured"]{border-color:transparent`);
  });

  it("leaves out an id that could break out of a selector", () => {
    expect(deepLinkCss(["featured", 'x"]{}a{']).includes('x"')).toBe(false);
  });
});
