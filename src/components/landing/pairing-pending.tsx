"use client";

import { LoaderCircle } from "lucide-react";
import { useLinkStatus } from "next/link";

/**
 * The small cue inside a pairing card while its page is being prepared. Landing to a `/p/` page can
 * take a moment (a cold request loads TMDB data), and without this the card looks inert until the new
 * page appears. `useLinkStatus` only reports the nearest `<Link>`.
 */
export function PairingPending() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span role="status" className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-canvas/90 px-2 py-1 text-xs text-strong">
      <LoaderCircle aria-hidden className="size-3.5 motion-safe:animate-spin" />
      Opening…
    </span>
  );
}
