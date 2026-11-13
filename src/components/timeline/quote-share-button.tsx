"use client";

import { Check, Share2 } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { quoteLinkSearch, truncateQuote } from "@/lib/clippings-view";

const LINK_COPIED = "Link copied";

/** How long "Link copied" stays up. */
const STATUS_MS = 2600;
/** The longest a quote is in the text a share sheet is offered; the link's own card carries the rest. */
const SHARE_TEXT_QUOTE_CHARS = 140;

/** What the button needs of a quote, an artist's or a critic's: its id, the words and whose they are (the critic, or the publication for an unsigned piece). */
export interface ShareableQuote {
  id: string;
  quote: string;
  speaker: string;
}

/** A phone or a tablet in the hand: the visitor has a share sheet to choose from there, and a hover does not exist. */
function prefersShareSheet(): boolean {
  return (
    typeof navigator.share === "function" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches
  );
}

/**
 * The small share icon of a quote: it shares the link that opens the Clippings tab on this one quote
 * (`/p/<people>?view=clippings&quote=<id>`), the way the page's Share menu shares the page. Where the
 * device has a native share sheet and a finger for a pointer it opens the sheet (the menu's "More...");
 * everywhere else it copies the link (the menu's "Copy link") and says so under the button, in a
 * live region so that it is announced. The preview card the link unfurls into is the quote's own.
 *
 * Always visible above the quote, on pointer and touch devices alike.
 */
export function QuoteShareButton({ item }: { item: ShareableQuote }) {
  const pathname = usePathname();
  const [status, setStatus] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const announce = (message: string) => {
    clearTimeout(timer.current);
    setStatus(message);
    timer.current = setTimeout(() => setStatus(""), STATUS_MS);
  };

  const share = async () => {
    const url = `${window.location.origin}${pathname}${quoteLinkSearch(item.id)}`;

    if (prefersShareSheet()) {
      try {
        await navigator.share({ text: `“${truncateQuote(item.quote, SHARE_TEXT_QUOTE_CHARS)}” — ${item.speaker}`, url });
      } catch (error) {
        // Dismissing the sheet rejects with an AbortError; that is not a failure.
        if (error instanceof DOMException && error.name === "AbortError") return;
        announce("Could not open the share sheet.");
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      announce(LINK_COPIED);
    } catch {
      announce("Could not copy the link.");
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={share}
        title="Share this quote"
        aria-label={`Share this quote by ${item.speaker}`}
        className="inline-flex size-9 cursor-pointer items-center justify-center rounded-full text-muted transition-colors hover:text-strong motion-reduce:transition-none"
      >
        <Share2 aria-hidden="true" className="size-4" />
      </button>
      {/* Floats under the button like the status of the page's Share menu, so that it never moves the quote. */}
      <p
        role="status"
        aria-live="polite"
        className={
          status
            ? "pointer-events-none absolute right-0 top-full z-20 mt-1 inline-flex w-max items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 text-xs text-body shadow-lg shadow-black/40"
            : "sr-only"
        }
      >
        {status === LINK_COPIED && <Check aria-hidden="true" className="size-3.5 text-accent-green" />}
        {status}
      </p>
    </div>
  );
}
