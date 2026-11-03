"use client";

import { Share2 } from "lucide-react";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
} from "react";
import { canCopyImage, copyImage, copyImageMessage, imageUrlFor } from "@/lib/copy-image";
import { menuIndex } from "@/lib/menu-nav";
import { inPeriod, periodLabel, resolvePeriod, searchWithPeriod, spanOfYears, type Period } from "@/lib/period";
import { shareLinks, type ShareInput } from "@/lib/share";
import { SITE_URL } from "@/lib/site-url";
import { scrollBehavior } from "./scroll-behavior";
import { OPEN_SHARE_EVENT } from "./share-event";
import { useUrlPeriod } from "./use-period";

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
const clientCanCopyImage = () => canCopyImage(window);
const serverCanCopyImage = () => false;

/** Menu width (w-60) and the gap kept to the screen edge, to decide which side of the button the menu opens towards. */
const MENU_WIDTH = 240;
const SCREEN_GAP = 16;

/** Opens left-aligned with the button, unless that would run off the right edge of the screen: then right-aligned. */
function menuSide(button: HTMLElement | null): "left" | "right" {
  if (!button) return "left";
  const screen = document.documentElement.clientWidth;
  const width = Math.min(MENU_WIDTH, screen - 2 * SCREEN_GAP);
  return button.getBoundingClientRect().left + width > screen - SCREEN_GAP ? "right" : "left";
}

// The primary button of the row: green with white text (Export is the secondary one). The green is
// the deeper button shade, not the accent: white on the accent is only 1.78:1 (see globals.css). The
// transparent border makes it as tall as Export, whose border is visible.
const buttonClass =
  "inline-flex w-full items-center justify-center gap-2 rounded-md border border-transparent bg-button-green px-4 py-2 text-sm font-semibold text-white hover:bg-button-green-hover";
const itemClass =
  "flex w-full cursor-pointer items-center rounded-md px-3 py-2 text-left text-sm font-medium text-strong hover:bg-border focus:bg-border focus-visible:outline-offset-[-2px]";
const selectClass =
  "min-w-0 flex-1 cursor-pointer rounded-md border border-border bg-canvas px-2 py-1.5 text-sm text-strong hover:border-muted focus-visible:outline-offset-[-2px]";

/**
 * "Share" button with a small menu: Post on X, Post on Bluesky, Copy link, Copy image (where the
 * browser can put an image on the clipboard) and, where it has a native share sheet, "More...".
 * The posting items are plain links to the platforms' compose pages, so nothing is sent anywhere
 * until the visitor follows one, and no third-party script is loaded.
 *
 * At the top of the menu a Period control (two year selects, from and to, over the years of the
 * page's films) narrows what is shared to a stretch of years: the link then carries
 * `?from=&to=`, the text says "6 films together, 1978-1993", and the preview card (Copy image,
 * and the one the link unfurls into) shows only those years. The whole span is no period. The
 * selects show and write the page's period (the address bar), as the brush on the minimap does,
 * so a page opened on a period starts them on it and a drag on the minimap moves them.
 *
 * Menu button pattern: Enter, Space or the arrow keys open it; Arrow keys, Home and End move
 * between items (and the two selects, whose list opens with Enter or Space); Escape closes it
 * and returns focus to the button; Tab or a click elsewhere closes it. The menu stays in the DOM
 * (hidden) so that following a link never races with it being removed.
 */
export function ShareMenu({ input, onStatus, className }: ShareMenuProps) {
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState<"left" | "right">("left");
  const [copying, setCopying] = useState(false);
  // A failure shown inside the open menu: the menu covers the status line under the buttons.
  const [problem, setProblem] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const focusOnOpen = useRef<"first" | "last">("first");
  const buttonId = useId();
  const menuId = useId();
  const periodId = useId();

  // The server renders the links for the configured site URL; once mounted they point at the
  // origin the visitor is actually on (localhost, the Railway URL, the custom domain).
  const origin = useSyncExternalStore(noSubscription, clientOrigin, serverOrigin);
  const canShare = useSyncExternalStore(noSubscription, clientCanShare, serverCanShare);
  const canImage = useSyncExternalStore(noSubscription, clientCanCopyImage, serverCanCopyImage);
  const pathname = usePathname();

  // The period is the page's: the address bar's `?from=&to=`, which the minimap's brush writes too. The selects
  // below read it and write it back, so the two stay in step. Only years of the page's films are offered, so a
  // link never asks for a period without films; the whole span is no period.
  const years = useMemo(() => input.years ?? [], [input.years]);
  const span = useMemo(() => spanOfYears(years), [years]);
  const [urlPeriod, setPeriod] = useUrlPeriod();
  const period = useMemo(() => resolvePeriod(urlPeriod, span), [urlPeriod, span]);
  const shown = useMemo<Period | null>(() => period ?? (span ? { from: span.first, to: span.last } : null), [period, span]);
  const yearChoices = useMemo(
    () => [...new Set([...years, ...(shown ? [shown.from, shown.to] : [])])].sort((a, b) => a - b),
    [years, shown],
  );
  const choose = (next: Period) => setPeriod(resolvePeriod(next, span));

  const periodText = period ? periodLabel(period) : undefined;
  const url = `${origin}${pathname}${period ? searchWithPeriod("", period) : ""}`;
  // The count in the text is the films of the period; 0 stays 0 (nothing is shared, so the text names no films).
  const count = period && input.count > 0 ? years.filter((year) => inPeriod(year, period)).length : input.count;
  const links = shareLinks({ ...input, count, period: periodText }, url);

  /** Everything the arrow keys visit, in order: the period selects, then the items. */
  const stops = useCallback(
    () => Array.from(menuRef.current?.querySelectorAll<HTMLElement>('select, [role="menuitem"]') ?? []),
    [],
  );
  /** The items alone: where focus goes when the menu opens. */
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

  // The period label under the timeline has a Share button: it asks for this menu to open (and brings the button into view).
  useEffect(() => {
    const onRequest = () => {
      focusOnOpen.current = "first";
      buttonRef.current?.scrollIntoView({ block: "center", behavior: scrollBehavior() });
      setSide(menuSide(buttonRef.current));
      setProblem("");
      setOpen(true);
    };
    window.addEventListener(OPEN_SHARE_EVENT, onRequest);
    return () => window.removeEventListener(OPEN_SHARE_EVENT, onRequest);
  }, []);

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
    if (!open) {
      setSide(menuSide(buttonRef.current));
      setProblem("");
    }
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
      setSide(menuSide(buttonRef.current));
      setProblem("");
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

    const list = stops();
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

  /** Tells the status line (for screen readers) and, as the menu stays open, the menu itself. */
  const fail = (message: string) => {
    setProblem(message);
    onStatus(message);
  };

  // The address bar as it is now, so a link with a sort in it is copied as the visitor sees it, with the
  // period of the menu in place of any it carries (a link without a period is copied exactly as it is).
  const copyLink = async () => {
    const { origin: here, pathname: path, search, hash } = window.location;
    const carriesPeriod = /[?&](?:from|to)=/.test(search);
    const href = period || carriesPeriod ? `${here}${path}${searchWithPeriod(search, period)}${hash}` : window.location.href;
    try {
      await navigator.clipboard.writeText(href);
    } catch {
      fail("Could not copy automatically. Copy the address from your browser's address bar.");
      return;
    }
    onStatus("Link copied");
    close(true);
  };

  const copyPreviewImage = async () => {
    if (copying) return;
    setCopying(true);
    // Called straight from the click, with the fetch still pending: see `copyImage`.
    const outcome = await copyImage(imageUrlFor(window.location, period), {
      fetch: (imageUrl) => fetch(imageUrl),
      clipboard: navigator.clipboard,
      ClipboardItem: window.ClipboardItem,
    });
    setCopying(false);
    if (outcome === "copied") {
      onStatus(copyImageMessage(outcome));
      close(true);
    } else {
      fail(copyImageMessage(outcome));
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
        className={`absolute ${side === "right" ? "right-0" : "left-0"} top-full z-30 mt-2 w-60 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-surface p-1 shadow-xl shadow-black/40`}
      >
        {shown && yearChoices.length > 1 && (
          <div role="group" aria-labelledby={periodId} className="mb-1 border-b border-border px-3 pb-3 pt-2">
            <p id={periodId} className="text-xs font-medium text-muted">
              Period
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              <select
                aria-label="From year"
                value={shown.from}
                onChange={(event) => choose({ from: Number(event.target.value), to: Math.max(Number(event.target.value), shown.to) })}
                className={selectClass}
              >
                {yearChoices.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
              <span aria-hidden="true" className="text-sm text-muted">
                to
              </span>
              <select
                aria-label="To year"
                value={shown.to}
                onChange={(event) => choose({ from: Math.min(Number(event.target.value), shown.from), to: Number(event.target.value) })}
                className={selectClass}
              >
                {yearChoices.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
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
        <button role="menuitem" tabIndex={-1} type="button" className={itemClass} onClick={copyLink}>
          Copy link
        </button>
        {canImage && (
          <button
            role="menuitem"
            tabIndex={-1}
            type="button"
            className={itemClass}
            aria-disabled={copying || undefined}
            onClick={copyPreviewImage}
          >
            {copying ? "Copying image..." : "Copy image"}
          </button>
        )}
        {canShare && (
          <button role="menuitem" tabIndex={-1} type="button" className={itemClass} onClick={nativeShare}>
            More...
          </button>
        )}
        {problem && (
          // The status line (a live region) speaks it; this copy is for the eyes.
          <p aria-hidden="true" className="mt-1 border-t border-border px-3 py-2 text-xs text-body">
            {problem}
          </p>
        )}
      </div>
    </div>
  );
}
