import { NextResponse, type NextRequest } from "next/server";
import { clientIp, createRateLimiter } from "@/lib/ratelimit";

const check = createRateLimiter();

export function proxy(request: NextRequest) {
  const { allowed, retryAfter } = check(clientIp(request.headers));
  if (allowed) return NextResponse.next();

  return NextResponse.json(
    { error: "Too many requests" },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}

export const config = { matcher: "/api/:path*" };
