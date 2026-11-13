"use client";

import { Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PersonSearch } from "@/components/person-search/person-search";

/** One site-wide entry point, independent of the timeline's Add a person field. */
export function UniversalSearch() {
  const pathname = usePathname();
  // Route changes dismiss the dialog and discard its draft, even with a persistent root layout.
  return <SearchControl key={pathname} />;
}

function SearchControl() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (
        event.key.toLowerCase() !== "k" ||
        !(event.metaKey || event.ctrlKey) ||
        event.altKey || event.shiftKey || event.isComposing || event.defaultPrevented
      ) return;
      event.preventDefault();
      // Holding the shortcut should not repeatedly open and close the dialog.
      if (!event.repeat) setOpen((current) => !current);
    }
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, []);

  return (
    <>
      <button
        type="button"
        aria-label="Open search"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-keyshortcuts="Meta+K Control+K"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 flex h-10 items-center gap-2 rounded-full border border-border bg-surface px-4 text-sm text-strong shadow-lg shadow-black/30 hover:bg-border"
      >
        <Search aria-hidden="true" className="h-4 w-4" />
        Search
        <kbd aria-hidden="true" className="hidden font-sans text-xs text-muted pointer-fine:inline">
          ⌘ / Ctrl K
        </kbd>
      </button>
      {open && createPortal(<SearchDialog onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

function SearchDialog({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useLayoutEffect(() => {
    const dialog = dialogRef.current!;
    const opener = document.activeElement;
    const { body, documentElement } = document;
    const previous = { overflow: body.style.overflow, paddingRight: body.style.paddingRight };
    const scrollbar = window.innerWidth - documentElement.clientWidth;
    // The native modal provides an inert background and stays above existing detail panels.
    dialog.showModal();
    body.style.overflow = "hidden";
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
    return () => {
      dialog.close();
      body.style.overflow = previous.overflow;
      body.style.paddingRight = previous.paddingRight;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDownCapture={(event) => {
        if (event.key !== "Escape" || event.nativeEvent.isComposing) return;
        // Escape dismisses only search, not a detail panel underneath it or just the results list.
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Tab" || event.defaultPrevented) return;
        const controls = event.currentTarget.querySelectorAll<HTMLElement>(
          "a[href], button:not([disabled]), input:not([disabled])",
        );
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
      className="fixed inset-x-0 bottom-auto top-[12dvh] m-0 mx-auto w-[calc(100%-2rem)] max-w-2xl overflow-visible rounded-xl border border-border bg-canvas p-0 text-body shadow-2xl shadow-black/60 backdrop:bg-black/70"
    >
      <div className="p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 id={titleId} className="text-lg font-semibold text-strong">Search people</h2>
          <button
            type="button"
            aria-label="Close search"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface hover:text-strong"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
        <p id={descriptionId} className="mb-4 text-sm text-muted">
          Find filmmakers and start a new timeline with up to four people.
        </p>
        <PersonSearch size="compact" mode="chips" autoFocus onNavigate={onClose} />
        <div className="mt-4 flex items-center justify-between text-xs text-muted">
          <Link href="/" onClick={onClose} className="underline hover:text-strong">Back to home</Link>
          <span><kbd className="font-sans">Esc</kbd> to close</span>
        </div>
      </div>
    </dialog>
  );
}
