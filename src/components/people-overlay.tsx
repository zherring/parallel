"use client";

import { Users, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FINE_POINTER, REDUCED_MOTION, useMediaQuery } from "@/components/depth/use-media";
import { PersonRow, pillRows, type PillPerson } from "@/components/depth/people-pill";
import { usePeopleStaging, useStagingSurface } from "@/components/people-staging";
import { PersonSearch } from "@/components/person-search/person-search";
import { trapTab, useModalPage } from "@/components/side-panel/modal-page";
import type { ElementLike } from "@/lib/hero-keys";
import { hasRoom } from "@/lib/pending-people";
import { describeShortcutTarget, isApplePlatform, peopleKeyAction, platformName, shortcutHint, shortcutKeys } from "@/lib/people-shortcut";
import type { OpenPerson } from "@/lib/side-panel";

interface PeopleOverlayProps {
  /** The people of the page, with the links to the page without each of them (the same the people pill's card has). */
  people: readonly PillPerson[];
  /** A name or a portrait in a row was pressed: open the person's details in the slide-out panel (it is over the overlay, which stays open under it). */
  onOpenPerson: OpenPerson;
  /** Whether it is open, and the one way to open and close it (see `usePeopleOverlayControl`). */
  control: PeopleOverlayControl;
}

/** Whether the overlay is open, and how to open and close it: held by `PeopleBar`, so that the shortcut and the gear's "People" row open the same overlay the same way. */
export interface PeopleOverlayControl {
  open: boolean;
  /** Opens it. `opener` is what gets focus back when it closes (null: nothing in particular). */
  show: (opener: Element | null) => void;
  hide: () => void;
  /** What gets focus back when it closes; only meaningful while it is open. */
  opener: Element | null;
}

/**
 * The state of the people overlay (see `PeopleOverlay`), for whatever opens it: the shortcut, which is in the overlay, and the gear's "People" row, which is in the
 * bar. It is open for the address it was opened on: a navigation (a person added or removed) moves on and closes it.
 */
export function usePeopleOverlayControl(): PeopleOverlayControl {
  const pathname = usePathname();
  const [opened, setOpened] = useState<{ path: string; opener: Element | null } | null>(null);
  const open = opened !== null && opened.path === pathname;
  const show = useCallback((opener: Element | null) => setOpened({ path: pathname, opener }), [pathname]);
  const hide = useCallback(() => setOpened(null), []);
  const opener = opened?.opener ?? null;
  return useMemo(() => ({ open, show, hide, opener }), [open, show, hide, opener]);
}

/**
 * The full-screen people search of a `/p/` page, for ⌘K (Command+K on a Mac, Control+K elsewhere; see `peopleKeyAction`): on every view, with the pair hero
 * expanded or collapsed. The people pill is only in reach once the hero has collapsed, and a short page (an empty Table) or a Timeline that cannot be
 * scrolled never collapses it; this is how a visitor changes who is on the page from there.
 *
 * It is the pill's open card at the size of the screen: the same search field to add a person (`PersonSearch`, which keeps the view the visitor is on),
 * focused, and the people on the page, in the same rows as the card's (`PersonRow`: their portrait in their colour's ring, name, roles, and "Remove", the
 * link to the page without them), but for the eyes, which are the Timeline's. It is a modal dialog ("People") in a portal on the body, over the page, which is made
 * inert and keeps its scroll while it is open (`useModalPage`, as the slide-out panels do); Tab stays in it. ⌘K again, Escape (the field's own Escape first: it clears its
 * text and closes its list before this one closes the overlay) or the close button closes it, and focus goes back to what had it before. Adding a person or removing
 * one only stages the change (`PeopleStagingProvider`): the new person has a row at once, marked new, a removed one's row says so and has Undo, and nothing behind is redrawn;
 * closing the overlay applies everything staged in one navigation. It fades in and grows a little, but not for a visitor who asked for less motion.
 *
 * A touch-only visitor has no shortcut: the gear's sheet has a "People" row that opens it (`PeopleSheetRow`), for a page whose hero cannot collapse as well.
 *
 * ⌘K is not taken while the visitor types in a text field or textarea elsewhere (the overlay's own field aside), nor over the film's or the person's panel.
 * It is the page bar's: it is mounted once, by `PeopleBar`, after the bar's own box (the bar forwards a wheel to the scene under it, and the overlay's portal
 * would bubble its wheel through React to that).
 */
export function PeopleOverlay({ people, onOpenPerson, control }: PeopleOverlayProps) {
  const { open, opener, show, hide } = control;

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    const target = event.target instanceof Element ? (event.target as ElementLike) : null;
    const action = peopleKeyAction(
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
      { mac: isApplePlatform(platformName()), open, target: describeShortcutTarget(target) },
    );
    if (!action) return;
    // The browser's own ⌘K (the address bar's search, in Firefox and Chromium) is not wanted.
    event.preventDefault();
    if (action === "swallow") return;
    // What had focus gets it back when the overlay closes.
    const active = document.activeElement;
    if (action === "toggle" && !open) show(active && active !== document.body ? active : null);
    else hide();
  });
  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKeyDown(event);
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, []);

  if (!open) return null;
  return createPortal(<PeopleDialog people={people} onOpenPerson={onOpenPerson} opener={opener} onClose={hide} />, document.body);
}

/**
 * The gear's "People" row, which opens the people overlay (`onOpen`: the same opener as the shortcut's) on every width: a touch-only visitor on a page that is too short to
 * collapse its hero has neither the pill nor the keys. Where there is a keyboard and a mouse, the shortcut is its hint, at the right, muted: ⌘K on a Mac, Ctrl K elsewhere.
 * It is the row of the sheet that the way home was (36px tall, the surface colour the views control and Export have), and the sheet closes on it (`data-close-sheet` around it).
 */
export function PeopleSheetRow({ onOpen }: { onOpen: () => void }) {
  const fine = useMediaQuery(FINE_POINTER);
  const mac = isApplePlatform(platformName());
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-keyshortcuts={shortcutKeys(mac)}
      onClick={onOpen}
      className="flex h-9 w-full cursor-pointer items-center gap-2 rounded-md bg-surface px-3 text-sm font-medium text-strong hover:bg-border"
    >
      <Users aria-hidden="true" className="size-4 shrink-0 text-muted" />
      People
      {fine && (
        <span aria-hidden="true" className="ml-auto text-xs font-normal text-muted">
          {shortcutHint(mac)}
        </span>
      )}
    </button>
  );
}

function PeopleDialog({ people, onOpenPerson, opener, onClose }: Omit<PeopleOverlayProps, "control"> & { opener: Element | null; onClose: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  // Adding and removing people only stages the change while this is open; the page changes once, when it closes (see `PeopleStagingProvider`).
  const staging = usePeopleStaging();
  useStagingSurface(true);
  const rows = useMemo(() => pillRows(people, staging.pending), [people, staging.pending]);

  // A quick fade in with a little growth, none for a visitor who asked for less motion.
  useLayoutEffect(() => {
    if (window.matchMedia(REDUCED_MOTION).matches) return;
    rootRef.current?.animate([{ opacity: 0, transform: "scale(0.98)" }, { opacity: 1, transform: "none" }], { duration: 140, easing: "ease-out" });
  }, []);

  // The page behind is locked and inert. The field took focus as it mounted (`autoFocus`, before this runs): inert does not touch what is in the dialog.
  useModalPage(rootRef, true);

  // Focus back to what had it, once the page is no longer inert (cleanups run in declaration order, and this is declared after the page's). The opener may be gone:
  // a person added or removed is a new page.
  useEffect(
    () => () => {
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true });
    },
    [opener],
  );

  return (
    <div
      ref={rootRef}
      // `data-people-overlay` is how the shortcut's rules know a key is in the dialog (see `describeShortcutTarget`). It takes focus, not the Tab key, when its blank space is pressed.
      data-people-overlay
      role="dialog"
      aria-modal="true"
      aria-label="People"
      tabIndex={-1}
      onKeyDown={(event) => trapTab(event, rootRef.current)}
      className="fixed inset-0 z-40 overflow-y-auto overscroll-contain bg-canvas outline-none"
    >
      <div className="mx-auto w-full max-w-xl px-4 pb-10 pt-[max(1.5rem,12dvh)]">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <PersonSearch
              autoFocus
              size="hero"
              // The people as the page will have them: a person added here is "In timeline" at once, and one removed can be added back.
              peopleInView={staging.people}
              ariaLabel="Add a person"
              suggestFor={staging.people.length === 1 ? staging.people[0].id : undefined}
              onIdleEscape={onClose}
              onPick={staging.addPerson}
            />
          </div>
          <button
            type="button"
            aria-label="Close people"
            title="Close"
            onClick={onClose}
            className="grid size-14 shrink-0 cursor-pointer place-items-center rounded-md border border-border bg-surface text-muted transition-colors hover:bg-border hover:text-strong"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
        <h2 className="mb-1 mt-8 px-2 text-xs font-medium uppercase tracking-wide text-muted">On this page</h2>
        <ul className="m-0 list-none p-0">
          {rows.map((row) => (
            <PersonRow
              key={row.entry.person.id}
              row={row}
              onOpenPerson={onOpenPerson}
              visible
              onRemove={staging.removePerson}
              onRestore={staging.addPerson}
              undoDisabled={!hasRoom(staging.current, staging.pending)}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}
