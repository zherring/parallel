"use client";

import { Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useEffectEvent, useId, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { FINE_POINTER, useMediaQuery } from "@/components/depth/use-media";
import { PersonSearch } from "@/components/person-search/person-search";
import { trapTab, useModalPage } from "@/components/side-panel/modal-page";
import { rememberOpener, takeOpener, useRememberPressed } from "@/components/side-panel/side-panel";
import type { ElementLike } from "@/lib/hero-keys";
import {
  PEOPLE_BAR_ATTRIBUTE,
  SEARCH_DIALOG_ATTRIBUTE,
  describeShortcutTarget,
  isApplePlatform,
  platformName,
  searchKeyAction,
  shortcutHint,
  shortcutKeys,
} from "@/lib/people-shortcut";

const subscribeNothing = () => () => {};

/**
 * The site's one search, for the header's Search button and ⌘K (Command+K on a Mac, Control+K elsewhere: the people overlay's shortcut, by the same rules,
 * see `searchKeyAction`): a modal dialog with the chip field that starts a new timeline with up to four people, independent of the Add a person field of a
 * timeline. Not on the landing page, whose hero field is its search, and not where the key is the people overlay's (a page with a people bar, whose header is
 * hidden as well: globals.css).
 */
export function UniversalSearch() {
  const pathname = usePathname();
  if (pathname === "/") return null;
  // Route changes dismiss the dialog and discard its draft, even with a persistent root layout.
  return <SearchControl key={pathname} />;
}

function SearchControl() {
  // For the control to hand focus back to when the dialog closes: a press that opens it is over before it exists, and Safari does not focus a pressed button.
  useRememberPressed();
  const [opened, setOpened] = useState<{ opener: Element | null } | null>(null);
  const fine = useMediaQuery(FINE_POINTER);
  // The platform is known in the browser only: the server's markup and the hydrating render say Ctrl K, and the render after says the real one.
  const mac = useSyncExternalStore(subscribeNothing, () => isApplePlatform(platformName()), () => false);

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    const target = event.target instanceof Element ? (event.target as ElementLike) : null;
    const action = searchKeyAction(
      {
        key: event.key,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        defaultPrevented: event.defaultPrevented,
        isComposing: event.isComposing,
        repeat: event.repeat,
      },
      {
        mac: isApplePlatform(platformName()),
        open: opened !== null,
        target: describeShortcutTarget(target, SEARCH_DIALOG_ATTRIBUTE),
        peopleBar: document.querySelector(`[${PEOPLE_BAR_ATTRIBUTE}]`) !== null,
      },
    );
    if (!action) return;
    // The browser's own ⌘K (the address bar's search, in Firefox and Chromium) is not wanted.
    event.preventDefault();
    if (action === "swallow") return;
    if (action === "toggle" && !opened) setOpened({ opener: takeOpener() });
    else setOpened(null);
  });
  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKeyDown(event);
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, []);

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-keyshortcuts={shortcutKeys(mac)}
        onClick={(event) => {
          // The control itself, which no browser gets wrong (a pointer's click and a key's alike).
          rememberOpener(event.currentTarget);
          setOpened({ opener: takeOpener() });
        }}
        className="ml-auto flex h-9 cursor-pointer items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-medium text-strong hover:bg-border pointer-coarse:h-11"
      >
        <Search aria-hidden="true" className="size-4 shrink-0 text-muted" />
        Search
        {fine && (
          <span aria-hidden="true" className="text-xs font-normal text-muted">
            {shortcutHint(mac)}
          </span>
        )}
      </button>
      {opened && createPortal(<SearchDialog opener={opened.opener} onClose={() => setOpened(null)} />, document.body)}
    </>
  );
}

function SearchDialog({ opener, onClose }: { opener: Element | null; onClose: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  // The page behind is locked and inert. The field took focus as it mounted (`autoFocus`, before this runs): inert does not touch what is in the dialog.
  useModalPage(rootRef, true);

  // Focus back to what had it, once the page is no longer inert (cleanups run in declaration order, and this is declared after the page's). The opener may be gone:
  // a person picked is a new page.
  useEffect(
    () => () => {
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true });
    },
    [opener],
  );

  return (
    <div ref={rootRef} className="fixed inset-0 z-50 overflow-y-auto overscroll-contain">
      {/* A sibling of the dialog, as the slide-out panels' is: a press that starts in the field and ends here is a press on neither, and does not close it. */}
      <div aria-hidden="true" onClick={onClose} className="fixed inset-0 bg-black/70" />
      <div
        ref={dialogRef}
        // `data-universal-search` is how the shortcut's rules know a key is in the dialog (see `describeShortcutTarget`). It takes focus, not the Tab key, when its blank space is pressed.
        data-universal-search
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        onKeyDown={(event) => trapTab(event, dialogRef.current)}
        className="relative mx-auto mb-8 mt-[12dvh] w-[calc(100%-2rem)] max-w-2xl rounded-xl border border-border bg-canvas p-4 text-body shadow-2xl shadow-black/60 outline-none sm:p-5"
      >
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 id={titleId} className="text-lg font-semibold text-strong">Search people</h2>
          <button
            type="button"
            aria-label="Close search"
            onClick={onClose}
            className="grid size-9 cursor-pointer place-items-center rounded-md text-muted hover:bg-surface hover:text-strong pointer-coarse:size-11"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
        <p id={descriptionId} className="mb-4 text-sm text-muted">
          Find filmmakers and start a new timeline with up to four people.
        </p>
        {/* The field's own Escape first (it clears its text and closes its list); with nothing to dismiss, Escape closes the dialog, as the people overlay's does. */}
        <PersonSearch size="hero" mode="chips" autoFocus onIdleEscape={onClose} onNavigate={onClose} />
        <div className="mt-4 flex items-center justify-between text-xs text-muted">
          <Link href="/" onClick={onClose} className="underline hover:text-strong">Back to home</Link>
          <span><kbd className="font-sans">Esc</kbd> to close</span>
        </div>
      </div>
    </div>
  );
}
