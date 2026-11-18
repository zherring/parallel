"use client";

import { Search } from "lucide-react";
import { useSyncExternalStore } from "react";
import { FINE_POINTER, useMediaQuery } from "@/components/depth/use-media";
import { useSearch } from "@/components/search-provider";
import { rememberOpener, takeOpener } from "@/components/side-panel/side-panel";
import { isApplePlatform, platformName, shortcutHint, shortcutKeys } from "@/lib/people-shortcut";

const subscribeNothing = () => () => {};

/**
 * The landing page's search: a button drawn as the app's search field (the magnifier, the placeholder, the shortcut at its right end) that opens the
 * universal search overlay (`UniversalSearch`, the site's one search), which the same shortcut opens from anywhere on the page. It is not a second search
 * and has no text of its own to type in.
 */
export function LandingSearchTrigger({ className = "" }: { className?: string }) {
  const { show } = useSearch();
  const fine = useMediaQuery(FINE_POINTER);
  // Before the page is live a click does nothing.
  const hydrated = useSyncExternalStore(subscribeNothing, () => true, () => false);
  // The platform is known in the browser only: the server's markup and the hydrating render say Ctrl K, and the render after says the real one.
  const mac = useSyncExternalStore(subscribeNothing, () => isApplePlatform(platformName()), () => false);

  return (
    <button
      type="button"
      disabled={!hydrated}
      aria-haspopup="dialog"
      aria-keyshortcuts={shortcutKeys(mac)}
      onClick={(event) => {
        // The control itself, which no browser gets wrong (a pointer's click and a key's alike).
        rememberOpener(event.currentTarget);
        show(takeOpener());
      }}
      className={`flex h-9 min-w-0 cursor-pointer items-center gap-2.5 rounded-md border border-border bg-surface px-3 text-left text-sm transition-colors hover:border-muted/50 disabled:cursor-default disabled:hover:border-border pointer-coarse:h-11 ${className}`}
    >
      <Search aria-hidden="true" className="size-4 shrink-0 text-muted" />
      <span className="min-w-0 flex-1 truncate text-muted">Search any film artist…</span>
      {fine && (
        <kbd aria-hidden="true" className="shrink-0 rounded border border-border bg-canvas/60 px-1.5 py-0.5 font-sans text-[11px] font-medium leading-none text-muted">
          {shortcutHint(mac)}
        </kbd>
      )}
    </button>
  );
}
