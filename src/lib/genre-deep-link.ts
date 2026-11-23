/**
 * A link to a genre (`/#horror`) opens the landing page on that genre's grid, in place of the splash. The page is static, so its server markup cannot know the
 * hash and shows the default tab (Featured, with the splash): without more, a deep link would paint the splash for as long as the page takes to be live. So the
 * markup carries a tiny inline script that runs before anything under it is painted and marks the page's root element (`GENRE_ROOT`) with the genre, and a style that, while the mark is
 * there, shows that genre's panel and pill and hides the splash's. The tabs take over once the page is live and remove the mark (genre-tabs.tsx). Pure strings,
 * so what they say is tested.
 */

/** The attribute the landing page's root element carries (`<div data-landing>`, which says `suppressHydrationWarning`: the mark is added before React hydrates it). */
export const GENRE_ROOT = "data-landing";
/** The attribute that marks it with the genre; the tabs remove it once they are live. */
export const GENRE_MARK = "data-genre";

const ROOT = `[${GENRE_ROOT}]`;

const SAFE_ID = /^[a-z0-9-]+$/;

/**
 * The script: it reads the hash as the tabs do (`tabFromHash`: percent-decoded, lower case) and marks the document when it names a tab other than the first
 * (the default, which needs no mark). `ids` is the tabs' ids, the default first.
 */
export function deepLinkScript(ids: readonly string[]): string {
  return `(function(){try{var ids=${JSON.stringify(ids)};var h=decodeURIComponent(location.hash.slice(1)).toLowerCase();if(ids.indexOf(h)>0)document.querySelector("${ROOT}").setAttribute("${GENRE_MARK}",h)}catch(e){}})();`;
}

/** The pill of the tab the mark names looks selected (white, with black text and icon), and the default's does not (the look of `GenreTablist`'s own selected and unselected pills). */
const SELECTED_PILL = `border-color:transparent;background-color:#fff;color:#000`;
const PLAIN_PILL = `border-color:transparent;background-color:transparent;color:var(--text-muted)`;

/**
 * The style: with the mark on the root, the default panel is hidden and the marked genre's panel shown (over the `hidden` the server's markup gives it), what is
 * for a genre's view only (`data-genre-only`, hidden in the server's markup) shown, and the pills follow. `ids` is the tabs' ids, the default first; an id that is not plain (lower case, digits, hyphens) is left out, so nothing can break out of a selector.
 */
export function deepLinkCss(ids: readonly string[]): string {
  const [fallback, ...others] = ids;
  const rules = [
    `${ROOT}[${GENRE_MARK}] [data-genre-panel="${fallback}"]{display:none}`,
    `${ROOT}[${GENRE_MARK}] [data-genre-only]{display:block}`,
    `${ROOT}[${GENRE_MARK}] [data-genre-tab="${fallback}"]{${PLAIN_PILL}}`,
    `${ROOT}[${GENRE_MARK}] [data-genre-tab="${fallback}"] [data-genre-icon]{color:var(--text-muted)}`,
  ];
  for (const id of others.filter((other) => SAFE_ID.test(other))) {
    rules.push(
      `${ROOT}[${GENRE_MARK}="${id}"] [data-genre-panel="${id}"]{display:block}`,
      `${ROOT}[${GENRE_MARK}="${id}"] [data-genre-tab="${id}"]{${SELECTED_PILL}}`,
      `${ROOT}[${GENRE_MARK}="${id}"] [data-genre-tab="${id}"] [data-genre-icon]{color:#000}`,
    );
  }
  return rules.join("");
}
