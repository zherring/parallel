"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import {
  NOTHING_PENDING,
  finalPeople,
  pendingHref,
  stageAdd,
  stageRemove,
  type PendingPeople,
  type StagedPerson,
} from "@/lib/pending-people";
import { followsLink } from "@/lib/explicit-navigation";
import type { PersonRef } from "@/lib/people-nav";

interface PeopleStaging {
  /** The people the page has now. */
  current: readonly PersonRef[];
  /** What is staged on them (see `src/lib/pending-people.ts`). */
  pending: PendingPeople;
  /** The people the page will have once the staged changes apply: who a picker works from while a panel is open. */
  people: readonly PersonRef[];
  /** Stages adding a person (or takes back their removal). Nothing is redrawn: the page changes when the panel closes. */
  addPerson: (person: StagedPerson) => void;
  /** Stages removing a person (or takes back their being added). */
  removePerson: (personId: number) => void;
  /** A panel that stages changes has opened; the returned function says it has closed. See `useStagingSurface`. */
  hold: () => () => void;
}

const PeopleStagingContext = createContext<PeopleStaging | null>(null);

interface ProviderProps {
  /** The people of the page now. Memoize it: the provider holds what is staged against it. */
  people: readonly PersonRef[];
  /** Keeps the view the visitor is on in the address the staged changes lead to (see `pendingHref`). Stable; read when the changes are applied. */
  carry: (href: string) => string;
  children: ReactNode;
}

/**
 * Adding and removing people on a `/p/` page while a panel is open: the film's panel, the people pill's card and the ⌘K people search all change who is on
 * the page, and each used to navigate the moment a person was added or removed, redrawing the whole screen behind the panel as soon as someone loaded. They
 * only stage the change now (the provider holds it, and every one of them shows it at once: "Added", a removed row with Undo, a new row in the list), and the
 * page changes once, when the last of them closes: every staged change in one soft navigation (`router.push`, as every add and remove has always made) to the page
 * of the final people, with the visitor's view kept (`pendingHref`). With nothing staged, or changes that cancel out, closing does nothing.
 *
 * Where the visitor goes by their own choice beats it: a link followed (the way home, a view, "View their timeline" in a person's panel) or the browser's back or
 * forward drops what is staged, so the page they chose is the one they get, not the staged page after it. A press on a link that opens in a new tab, or on
 * non-link space, does not: closing a panel any other way still applies the changes.
 *
 * It lives inside the page's keyed view, so a navigation to another set of people (this one's own, or any other) drops what was staged with it.
 */
export function PeopleStagingProvider({ people, carry, children }: ProviderProps) {
  const router = useRouter();
  const [pending, setPending] = useState<PendingPeople>(NOTHING_PENDING);
  // How many panels that stage changes are open now.
  const [holders, setHolders] = useState(0);
  const [navigating, startNavigation] = useTransition();
  const wasHeld = useRef(false);
  /** The address a navigation is on its way to, while it is. */
  const inFlight = useRef<string | null>(null);

  const final = useMemo(() => finalPeople(people, pending), [people, pending]);
  // The visitor is going somewhere of their own: what is staged is dropped (the panel or the pill closing after it has nothing to apply).
  const abandon = useCallback(() => setPending((now) => (now === NOTHING_PENDING ? now : NOTHING_PENDING)), []);
  const addPerson = useCallback((person: StagedPerson) => setPending((now) => stageAdd(people, now, person)), [people]);
  const removePerson = useCallback((personId: number) => setPending((now) => stageRemove(people, now, personId)), [people]);
  const hold = useCallback(() => {
    setHolders((now) => now + 1);
    return () => setHolders((now) => now - 1);
  }, []);

  // The visitor's own navigation (a link followed, back or forward) beats what is staged: see `useExplicitNavigation`.
  const pressing = useExplicitNavigation(abandon);
  /** The last panel has closed and what is staged is to be applied, unless a link that the visitor is pressing takes them elsewhere first. */
  const due = useRef(false);

  // The last panel has closed: apply what was staged. This runs after the render that followed the closing, so after the panel handed focus back to what opened it.
  useEffect(() => {
    const held = holders > 0;
    if (wasHeld.current && !held) due.current = true;
    wasHeld.current = held;
    // A panel is open (again), or a link is pressed: the pill closes on the press that follows a link, before the click that follows it. The changes wait for the click
    // (it drops them), and apply if there is none (the press moved off the link and let go: `useExplicitNavigation` says so).
    if (held) due.current = false;
    if (!due.current || pressing) return;
    due.current = false;
    const href = pendingHref(people, pending, carry);
    // Nothing staged, or it cancels out; or this navigation is already on its way (a panel opened and shut again meanwhile).
    if (href === null || href === inFlight.current) return;
    inFlight.current = href;
    startNavigation(() => router.push(href));
  }, [holders, people, pending, carry, router, pressing]);
  useEffect(() => {
    if (!navigating) inFlight.current = null;
  }, [navigating]);

  const value = useMemo<PeopleStaging>(
    () => ({ current: people, pending, people: final, addPerson, removePerson, hold }),
    [people, pending, final, addPerson, removePerson, hold],
  );
  return <PeopleStagingContext.Provider value={value}>{children}</PeopleStagingContext.Provider>;
}

/** How long after a press is let go a click on a link is waited for: it follows at once, a touch's a frame or two later. */
const CLICK_FOLLOWS_MS = 300;

/**
 * Where the visitor goes by their own choice beats what is staged. A click on a link that takes this tab to another page (`followsLink`) calls `abandon`: it is caught
 * on its way down, before the link's own handler, and the people pill's close that comes with the press before it. And `popstate` (the browser's back and forward) does.
 *
 * The press comes before the click, with the time it takes to let go between them, and the pill closes on the press: the staged page would be on its way, and in
 * the way, by the time the link is let go (the page it commits to replaces the link under the pointer, and no click is made). So a press on such a link is
 * `pressing` until the click comes (`abandon`), or the press ends without one (let go away from the link, or turned into a scroll or a drag), when the staged
 * changes may apply after all.
 */
function useExplicitNavigation(abandon: () => void): boolean {
  const [pressing, setPressing] = useState(false);
  useEffect(() => {
    let down = false;
    let ended: ReturnType<typeof setTimeout> | undefined;
    const leaves = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      return link instanceof HTMLAnchorElement && followsLink(event, { href: link.href, target: link.target, download: link.hasAttribute("download") }, window.location.href);
    };
    const onPointerDown = (event: PointerEvent) => {
      clearTimeout(ended);
      down = leaves(event);
      setPressing(down);
    };
    // A press that is let go (or taken over by a scroll or a drag) may still be followed by its click: wait for it.
    const onPointerEnd = () => {
      if (!down) return;
      clearTimeout(ended);
      ended = setTimeout(() => {
        down = false;
        setPressing(false);
      }, CLICK_FOLLOWS_MS);
    };
    const onClick = (event: MouseEvent) => {
      clearTimeout(ended);
      down = false;
      setPressing(false);
      if (!event.defaultPrevented && leaves(event)) abandon();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointerup", onPointerEnd, true);
    document.addEventListener("pointercancel", onPointerEnd, true);
    document.addEventListener("dragstart", onPointerEnd, true);
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", abandon);
    return () => {
      clearTimeout(ended);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("pointerup", onPointerEnd, true);
      document.removeEventListener("pointercancel", onPointerEnd, true);
      document.removeEventListener("dragstart", onPointerEnd, true);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", abandon);
    };
  }, [abandon]);
  return pressing;
}

/** What is staged on the page's people, and the controls to stage more. Only inside a `/p/` page's view (`PeopleStagingProvider`). */
export function usePeopleStaging(): PeopleStaging {
  const staging = useContext(PeopleStagingContext);
  if (!staging) throw new Error("usePeopleStaging is used outside a PeopleStagingProvider");
  return staging;
}

/**
 * Marks a panel as one that stages changes, for as long as it is `open`: closing the last of them applies the staged changes (see `PeopleStagingProvider`).
 * A panel that closes by sliding out says it is closed when it starts to, not when it is gone, so the page follows the visitor's closing at once.
 */
export function useStagingSurface(open: boolean): void {
  const { hold } = usePeopleStaging();
  useEffect(() => {
    if (!open) return;
    return hold();
  }, [open, hold]);
}
