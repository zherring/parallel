/** Largest image the card will embed; TMDB's w342 files are a few tens of KB. */
const MAX_IMAGE_BYTES = 1_500_000;
const FETCH_TIMEOUT_MS = 4000;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png"]);

type Fetcher = (input: string, init?: RequestInit & { next?: { revalidate: number } }) => Promise<Response>;

/**
 * Downloads an image and returns it as a data URI, or null on any failure (network error,
 * timeout, bad status, not a JPEG/PNG, too big). The preview card is drawn by an engine that
 * throws if a remote image cannot be loaded, so every image is fetched here first and the card
 * falls back to initials or leaves the poster out when this returns null.
 */
export async function fetchImageDataUri(url: string, fetcher: Fetcher = fetch): Promise<string | null> {
  try {
    const response = await fetcher(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      next: { revalidate: 24 * 60 * 60 },
    });
    if (!response.ok) return null;

    const type = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!IMAGE_TYPES.has(type)) return null;

    const length = Number(response.headers.get("content-length"));
    if (length > MAX_IMAGE_BYTES) return null;

    const bytes = await response.arrayBuffer();
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) return null;
    return `data:${type};base64,${Buffer.from(bytes).toString("base64")}`;
  } catch {
    return null;
  }
}
