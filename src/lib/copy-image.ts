/**
 * "Copy image" in the share menu: puts the page's generated preview card (the PNG behind
 * `/p/<slug>/opengraph-image`) on the clipboard, ready to paste into a post or a chat.
 *
 * Everything the browser provides is passed in, so the rules are testable without a browser and
 * the menu never offers something this browser cannot do.
 */

/** The part of `window` that decides whether images can be written to the clipboard. */
export interface ImageClipboardEnv {
  ClipboardItem?: unknown;
  navigator?: { clipboard?: { write?: unknown } };
  isSecureContext?: boolean;
}

/**
 * Whether the browser can write an image to the clipboard: a secure page, `ClipboardItem` and
 * `navigator.clipboard.write` (Firefox before 127 and some embedded browsers lack them), and
 * PNG among the types `ClipboardItem` says it accepts, where it can say so.
 */
export function canCopyImage(env: ImageClipboardEnv): boolean {
  if (env.isSecureContext === false) return false;
  if (typeof env.ClipboardItem !== "function") return false;
  if (typeof env.navigator?.clipboard?.write !== "function") return false;

  const supports = (env.ClipboardItem as { supports?: unknown }).supports;
  return typeof supports === "function" ? supports.call(env.ClipboardItem, "image/png") !== false : true;
}

/**
 * Where this page's preview card is, on the same origin: `<page>/opengraph-image`. The route
 * serves the card without the content-hash query the page's meta tags carry.
 */
export function imageUrlFor(location: { origin: string; pathname: string }): string {
  return `${location.origin}${location.pathname.replace(/\/+$/, "")}/opengraph-image`;
}

export type CopyImageOutcome = "copied" | "rate-limited" | "failed";

export interface CopyImageDeps<Item> {
  fetch: (url: string) => Promise<{ ok: boolean; status: number; blob: () => Promise<Blob> }>;
  clipboard: { write: (items: Item[]) => Promise<void> };
  ClipboardItem: new (items: Record<string, Promise<Blob>>) => Item;
}

/** Why the image could not be had, remembered because the clipboard reports its own, vaguer error. */
class ImageUnavailable extends Error {
  constructor(readonly outcome: Exclude<CopyImageOutcome, "copied">) {
    super(outcome);
  }
}

async function loadPng(url: string, fetchImage: CopyImageDeps<unknown>["fetch"]): Promise<Blob> {
  const response = await fetchImage(url);
  if (response.status === 429) throw new ImageUnavailable("rate-limited");
  if (!response.ok) throw new ImageUnavailable("failed");

  const blob = await response.blob();
  // Anything but a PNG (an error page, a redirect to HTML) must never reach the clipboard as an image.
  if (blob.type !== "image/png") throw new ImageUnavailable("failed");
  return blob;
}

/**
 * Fetches the card at `url` and writes it to the clipboard. The clipboard item is given the
 * pending fetch (a promise of the blob), not the finished blob: browsers only allow the write
 * during the click that asked for it, and Safari lets that click's permission wait for the
 * promise. Never throws; the outcome says what to tell the visitor.
 */
export async function copyImage<Item>(url: string, deps: CopyImageDeps<Item>): Promise<CopyImageOutcome> {
  let rejection: unknown;
  const png = loadPng(url, deps.fetch).catch((error: unknown) => {
    rejection = error;
    throw error;
  });
  // If the clipboard never looks at the promise, its rejection is handled here (and reported below).
  png.catch(() => {});

  try {
    await deps.clipboard.write([new deps.ClipboardItem({ "image/png": png })]);
    return "copied";
  } catch {
    return rejection instanceof ImageUnavailable ? rejection.outcome : "failed";
  }
}

/** What to tell the visitor, in the words of the share menu's status line. */
export function copyImageMessage(outcome: CopyImageOutcome): string {
  switch (outcome) {
    case "copied":
      return "Image copied";
    case "rate-limited":
      return "Could not copy the image. Try again in a minute.";
    case "failed":
      return "Could not copy the image";
  }
}
