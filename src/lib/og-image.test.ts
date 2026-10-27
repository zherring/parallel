import { describe, expect, it } from "vitest";
import { fetchImageDataUri } from "@/lib/og-image";

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);

const respond = (body: BodyInit | null, init: ResponseInit & { type?: string } = {}) => {
  const { type = "image/jpeg", ...rest } = init;
  return async () => new Response(body, { headers: { "content-type": type }, ...rest });
};

describe("fetchImageDataUri", () => {
  it("returns a base64 data URI with the image's type", async () => {
    const uri = await fetchImageDataUri("https://image.tmdb.org/t/p/w342/a.jpg", respond(png));
    expect(uri).toBe(`data:image/jpeg;base64,${Buffer.from(png).toString("base64")}`);
  });

  it("ignores content-type parameters", async () => {
    const uri = await fetchImageDataUri("u", respond(png, { type: "image/png; charset=binary" }));
    expect(uri?.startsWith("data:image/png;base64,")).toBe(true);
  });

  it("passes a timeout and a cache hint to fetch", async () => {
    let seen: RequestInit | undefined;
    await fetchImageDataUri("u", async (_url, init) => {
      seen = init;
      return new Response(png, { headers: { "content-type": "image/jpeg" } });
    });
    expect(seen?.signal).toBeInstanceOf(AbortSignal);
    expect((seen as { next?: { revalidate: number } }).next?.revalidate).toBeGreaterThan(0);
  });

  it("returns null for a failed status", async () => {
    expect(await fetchImageDataUri("u", respond("nope", { status: 404 }))).toBeNull();
    expect(await fetchImageDataUri("u", respond("nope", { status: 500 }))).toBeNull();
  });

  it("returns null when the network fails or times out", async () => {
    expect(
      await fetchImageDataUri("u", async () => {
        throw new TypeError("fetch failed");
      }),
    ).toBeNull();
    expect(
      await fetchImageDataUri("u", async () => {
        throw new DOMException("timed out", "TimeoutError");
      }),
    ).toBeNull();
  });

  it("returns null for anything that is not a JPEG or PNG", async () => {
    expect(await fetchImageDataUri("u", respond("<html>", { type: "text/html" }))).toBeNull();
    expect(await fetchImageDataUri("u", respond(png, { type: "image/svg+xml" }))).toBeNull();
  });

  it("returns null for an empty or oversized body", async () => {
    expect(await fetchImageDataUri("u", respond(new Uint8Array(0)))).toBeNull();
    expect(await fetchImageDataUri("u", respond(new Uint8Array(1_600_000)))).toBeNull();
  });

  it("refuses an oversized body announced by its length header", async () => {
    const big = async () =>
      new Response(png, { headers: { "content-type": "image/jpeg", "content-length": "9000000" } });
    expect(await fetchImageDataUri("u", big)).toBeNull();
  });
});
