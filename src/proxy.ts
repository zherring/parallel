import { NextResponse, type NextRequest } from "next/server";
import { clientIp, createRateLimiter } from "@/lib/ratelimit";

/** /api/*: 60 requests per minute per client (the limiter's default). */
const checkApi = createRateLimiter();

/**
 * /p/<people>/opengraph-image: 30 requests per minute per client, counted apart from /api so one
 * cannot starve the other. Every id combination is its own image and each one costs a render
 * (a fraction of a second of CPU) plus up to eight TMDB image downloads, so the URL space is a
 * free way to burn the server and the TMDB budget. Real use is far below this: a link unfurl
 * fetches the card once, and finished cards are cached for a day (`Cache-Control` on the route,
 * `revalidate` in it). The limiter lives in process memory, which is enough for one instance.
 */
const checkImage = createRateLimiter({ limit: 30 });

const IMAGE_PATH = /^\/p\/[^/]+\/opengraph-image\/?$/;

export function proxy(request: NextRequest) {
  const check = IMAGE_PATH.test(request.nextUrl.pathname) ? checkImage : checkApi;
  const { allowed, retryAfter } = check(clientIp(request.headers));
  if (allowed) return NextResponse.next();

  return NextResponse.json(
    { error: "Too many requests" },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}

export const config = { matcher: ["/api/:path*", "/p/:people/opengraph-image"] };
