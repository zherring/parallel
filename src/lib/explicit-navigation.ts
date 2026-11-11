/**
 * Whether a click is the visitor choosing to go somewhere else, which beats whatever the page was about to do on its own (see `PeopleStagingProvider`: the
 * changes staged on the page's people apply when the last panel closes, and a link pressed meanwhile is where the visitor said they wanted to go). Pure, like
 * the other rules of what a click or a key means (people-shortcut.ts, hero-keys.ts): the component reads the event and the link into plain values.
 */

/** The slice of a click event the rules look at. */
export interface ClickLike {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

/** What the rules need to know about the link (an `a` element) that was pressed. */
export interface LinkLike {
  /** The link's address, absolute (`HTMLAnchorElement.href`). */
  href: string;
  /** The `target` attribute: where the browser opens it ("" and "_self" are this tab). */
  target: string;
  /** The link has a `download` attribute: it saves a file instead of going anywhere. */
  download: boolean;
}

/**
 * Whether a click on a link takes this tab to another page: a plain left click (a modifier key or the middle button opens it elsewhere, which is the browser's
 * and leaves this page where it is), on a link that opens in this tab and does not download, to an http(s) address that is not this page's own (the same
 * path and query, with or without a hash, is not going anywhere). The pages of this app and any other: both leave this one.
 * `here` is the address the page is on (`location.href`).
 */
export function followsLink(click: ClickLike, link: LinkLike, here: string): boolean {
  if (click.button !== 0 || click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return false;
  if (link.download || (link.target !== "" && link.target !== "_self")) return false;
  let to: URL;
  let from: URL;
  try {
    to = new URL(link.href, here);
    from = new URL(here);
  } catch {
    return false;
  }
  if (to.protocol !== "http:" && to.protocol !== "https:") return false;
  return !(to.origin === from.origin && to.pathname === from.pathname && to.search === from.search);
}
