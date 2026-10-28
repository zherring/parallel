import { describe, expect, it, vi } from "vitest";
import {
  canCopyImage,
  copyImage,
  copyImageMessage,
  imageUrlFor,
  type CopyImageDeps,
  type ImageClipboardEnv,
} from "@/lib/copy-image";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const png = () => new Blob([new Uint8Array([...PNG_SIGNATURE, 0, 0, 0, 0])], { type: "image/png" });

class FakeItem {
  constructor(readonly items: Record<string, Promise<Blob>>) {}
}

interface Harness {
  deps: CopyImageDeps<FakeItem>;
  write: ReturnType<typeof vi.fn>;
  fetch: ReturnType<typeof vi.fn>;
  written: () => FakeItem;
}

function harness(
  respond: () => Promise<{ ok: boolean; status: number; blob: () => Promise<Blob> }>,
  write: (items: FakeItem[]) => Promise<void> = async (items) => {
    // Like a browser: the item's promise is awaited, and a rejection fails the write.
    await Promise.all(Object.values(items[0].items));
  },
): Harness {
  const fetchFn = vi.fn((url: string) => {
    void url;
    return respond();
  });
  const writeFn = vi.fn(write);
  return {
    deps: { fetch: fetchFn, clipboard: { write: writeFn }, ClipboardItem: FakeItem },
    write: writeFn,
    fetch: fetchFn,
    written: () => writeFn.mock.calls[0][0][0] as FakeItem,
  };
}

const okPng = async () => ({ ok: true, status: 200, blob: async () => png() });

describe("canCopyImage", () => {
  const full = (): ImageClipboardEnv => ({
    ClipboardItem: class {},
    navigator: { clipboard: { write: () => Promise.resolve() } },
    isSecureContext: true,
  });

  it("is true when ClipboardItem and clipboard.write exist on a secure page", () => {
    expect(canCopyImage(full())).toBe(true);
  });

  it("is false without ClipboardItem", () => {
    expect(canCopyImage({ ...full(), ClipboardItem: undefined })).toBe(false);
    const { ClipboardItem: _omitted, ...without } = full();
    void _omitted;
    expect(canCopyImage(without)).toBe(false);
  });

  it("is false without navigator.clipboard.write", () => {
    expect(canCopyImage({ ...full(), navigator: {} })).toBe(false);
    expect(canCopyImage({ ...full(), navigator: { clipboard: {} } })).toBe(false);
    expect(canCopyImage({ ...full(), navigator: undefined })).toBe(false);
  });

  it("is false on an insecure page", () => {
    expect(canCopyImage({ ...full(), isSecureContext: false })).toBe(false);
  });

  it("asks ClipboardItem.supports about PNG where it exists", () => {
    const supports = vi.fn((type: string) => type !== "image/png");
    const env = { ...full(), ClipboardItem: Object.assign(class {}, { supports }) };
    expect(canCopyImage(env)).toBe(false);
    expect(supports).toHaveBeenCalledWith("image/png");

    const yes = { ...full(), ClipboardItem: Object.assign(class {}, { supports: () => true }) };
    expect(canCopyImage(yes)).toBe(true);
  });

  it("is false for an empty environment", () => {
    expect(canCopyImage({})).toBe(false);
  });
});

describe("imageUrlFor", () => {
  it("is the page path plus /opengraph-image on the same origin", () => {
    expect(imageUrlFor({ origin: "https://parallel.example", pathname: "/p/3-harrison-ford" })).toBe(
      "https://parallel.example/p/3-harrison-ford/opengraph-image",
    );
  });

  it("strips trailing slashes and keeps the percent-encoded path as it is", () => {
    expect(imageUrlFor({ origin: "http://localhost:4700", pathname: "/p/1-a+2-b/" })).toBe(
      "http://localhost:4700/p/1-a+2-b/opengraph-image",
    );
    expect(imageUrlFor({ origin: "http://localhost:4700", pathname: "/p/1-a%2B2-b//" })).toBe(
      "http://localhost:4700/p/1-a%2B2-b/opengraph-image",
    );
  });
});

describe("copyImage", () => {
  const URL = "https://parallel.example/p/3-harrison-ford/opengraph-image";

  it("writes the PNG to the clipboard", async () => {
    const h = harness(okPng);
    await expect(copyImage(URL, h.deps)).resolves.toBe("copied");

    expect(h.fetch).toHaveBeenCalledWith(URL);
    expect(h.write).toHaveBeenCalledTimes(1);
    const item = h.written();
    expect(Object.keys(item.items)).toEqual(["image/png"]);
    const blob = await item.items["image/png"];
    expect(blob.type).toBe("image/png");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(Array.from(bytes.slice(0, 8))).toEqual(PNG_SIGNATURE);
  });

  it("hands the clipboard the pending fetch, not a finished blob (so Safari keeps the click's permission)", async () => {
    let finish: (value: { ok: boolean; status: number; blob: () => Promise<Blob> }) => void = () => {};
    const h = harness(() => new Promise((resolve) => (finish = resolve)));
    const done = copyImage(URL, h.deps);

    // The write has started while the image is still downloading.
    expect(h.write).toHaveBeenCalledTimes(1);
    const pending = h.written().items["image/png"];
    expect(pending).toBeInstanceOf(Promise);

    finish({ ok: true, status: 200, blob: async () => png() });
    await expect(done).resolves.toBe("copied");
    await expect(pending).resolves.toBeInstanceOf(Blob);
  });

  it("fails when the response is not a PNG", async () => {
    const html = new Blob(["<html></html>"], { type: "text/html" });
    const h = harness(async () => ({ ok: true, status: 200, blob: async () => html }));
    await expect(copyImage(URL, h.deps)).resolves.toBe("failed");
  });

  it("fails when the blob has no type", async () => {
    const h = harness(async () => ({ ok: true, status: 200, blob: async () => new Blob([new Uint8Array(PNG_SIGNATURE)]) }));
    await expect(copyImage(URL, h.deps)).resolves.toBe("failed");
  });

  it("fails on a server error", async () => {
    const h = harness(async () => ({ ok: false, status: 500, blob: async () => png() }));
    await expect(copyImage(URL, h.deps)).resolves.toBe("failed");
  });

  it("reports the rate limit apart from other failures", async () => {
    const h = harness(async () => ({ ok: false, status: 429, blob: async () => new Blob(["{}"], { type: "application/json" }) }));
    await expect(copyImage(URL, h.deps)).resolves.toBe("rate-limited");
  });

  it("fails when the network does", async () => {
    const h = harness(() => Promise.reject(new TypeError("Failed to fetch")));
    await expect(copyImage(URL, h.deps)).resolves.toBe("failed");
  });

  it("fails when the clipboard refuses the write", async () => {
    const h = harness(okPng, async () => {
      throw new DOMException("Document is not focused", "NotAllowedError");
    });
    await expect(copyImage(URL, h.deps)).resolves.toBe("failed");
  });

  it("fails, without an unhandled rejection, when the clipboard throws before reading the item", async () => {
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    const h = harness(() => Promise.reject(new TypeError("Failed to fetch")), async () => {
      throw new DOMException("denied", "NotAllowedError");
    });
    await expect(copyImage(URL, h.deps)).resolves.toBe("failed");
    await new Promise((resolve) => setTimeout(resolve, 10));
    process.off("unhandledRejection", unhandled);
    expect(unhandled).not.toHaveBeenCalled();
  });
});

describe("copyImageMessage", () => {
  it("words each outcome calmly", () => {
    expect(copyImageMessage("copied")).toBe("Image copied");
    expect(copyImageMessage("failed")).toBe("Could not copy the image");
    expect(copyImageMessage("rate-limited")).toBe("Could not copy the image. Try again in a minute.");
  });
});
