/**
 * Asks the page's Share menu to open (the "Share" button on the period label under the timeline):
 * the menu and the label are in different parts of the page, so the label only sends this and the
 * menu answers it. See `ShareMenu`.
 */
export const OPEN_SHARE_EVENT = "parallel:open-share";

export function requestShareMenu(): void {
  window.dispatchEvent(new Event(OPEN_SHARE_EVENT));
}
