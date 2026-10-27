"use client";

import { Share2 } from "lucide-react";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
} from "react";
import { menuIndex } from "@/lib/menu-nav";
import { shareLinks, type ShareInput } from "@/lib/share";
import { SITE_URL } from "@/lib/site-url";

interface ShareMenuProps {
  input: ShareInput;
  /** Reports a short status message (used when the native share sheet fails). */
  onStatus: (message: string) => void;
  /** Classes for the wrapper, e.g. to let the button grow on narrow screens. */
  className?: string;
}

const noSubscription = () => () => {};
const clientOrigin = () => window.location.origin;
const serverOrigin = () => SITE_URL;
const clientCanShare = () => typeof navigator.share === "function";
const serverCanShare = () => false;

const buttonClass =
  "inline-flex w-full items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-strong hover:border-muted";
const itemClass =
  "flex w-full cursor-pointer items-center rounded-md px-3 py-2 text-left text-sm font-medium text-strong hover:bg-border focus:bg-border focus-visible:outline-offset-[-2px]";

/**
 * "Share" button with a small menu: Post on X, Post on Bluesky and, where the browser has a
 * native share sheet, "More...". The items are plain links to the platforms' compose pages, so
 * nothing is sent anywhere until the visitor follows one, and no third-party script is loaded.
 *
 * Menu button pattern: Enter, Space or the arrow keys open it; Arrow keys, Home and End move
 * between items; Escape closes it and returns focus to the button; Tab or a click elsewhere
 * closes it. The menu stays in the DOM (hidden) so that following a link never races with it
 * being removed.
 */
export function ShareMenu({ input, onStatus, className }: ShareMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const focusOnOpen = useRef<"first" | "last">("first");
  const buttonId = useId();
  const menuId = useId();

  // The server renders the links for the configured site URL; once mounted they point at the
  // origin the visitor is actually on (localhost, the Railway URL, the custom domain).
  const origin = useSyncExternalStore(noSubscription, clientOrigin, serverOrigin);
  const canShare = useSyncExternalStore(noSubscription, clientCanShare, serverCanShare);
  const pathname = usePathname();
  const url = `${origin}${pathname}`;
  const links = shareLinks(input, url);

  const items = useCallback(
    () => Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []),
    [],
  );

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }, []);

  // Move focus into the menu once it is visible.
  useEffect(() => {
    if (!open) return;
    const list = items();
    list[focusOnOpen.current === "last" ? list.length - 1 : 0]?.focus();
  }, [open, items]);

  // A press anywhere outside closes the menu; focus stays where the visitor put it.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const toggle = () => {
    focusOnOpen.current = "first";
    setOpen((value) => !value);
  };

  const onButtonKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    focusOnOpen.current = event.key === "ArrowUp" ? "last" : "first";
    if (open) {
      const list = items();
      list[event.key === "ArrowUp" ? list.length - 1 : 0]?.focus();
    } else {
      setOpen(true);
    }
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!open) return;

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close(true);
      return;
    }
    if (event.key === "Tab") {
      // Let Tab continue from the button, as if the menu had never been in the way.
      buttonRef.current?.focus();
      setOpen(false);
      return;
    }

    const list = items();
    const current = list.indexOf(document.activeElement as HTMLElement);
    const next = menuIndex(event.key, current, list.length);
    if (next === null) return;
    event.preventDefault();
    list[next]?.focus();
  };

  const nativeShare = async () => {
    close(true);
    try {
      await navigator.share({ text: links.text, url });
    } catch (error) {
      // Dismissing the sheet rejects with an AbortError; that is not a failure.
      if (error instanceof DOMException && error.name === "AbortError") return;
      onStatus("Could not open the share sheet.");
    }
  };

  return (
    <div ref={rootRef} className={`relative ${className ?? ""}`} onKeyDown={onMenuKeyDown}>
      <button
        ref={buttonRef}
        id={buttonId}
        type="button"
        className={buttonClass}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={toggle}
        onKeyDown={onButtonKeyDown}
      >
        <Share2 aria-hidden="true" className="size-4 shrink-0" />
        Share
      </button>
      <div
        ref={menuRef}
        id={menuId}
        role="menu"
        aria-labelledby={buttonId}
        hidden={!open}
        className="absolute left-0 top-full z-30 mt-2 w-60 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-surface p-1 shadow-xl shadow-black/40"
      >
        <a
          role="menuitem"
          tabIndex={-1}
          href={links.x}
          target="_blank"
          rel="noopener noreferrer"
          className={itemClass}
          onClick={() => close(true)}
        >
          Post on X<span className="sr-only"> (opens in a new tab)</span>
        </a>
        <a
          role="menuitem"
          tabIndex={-1}
          href={links.bluesky}
          target="_blank"
          rel="noopener noreferrer"
          className={itemClass}
          onClick={() => close(true)}
        >
          Post on Bluesky<span className="sr-only"> (opens in a new tab)</span>
        </a>
        {canShare && (
          <button role="menuitem" tabIndex={-1} type="button" className={itemClass} onClick={nativeShare}>
            More...
          </button>
        )}
      </div>
    </div>
  );
}
