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
  const addPerson = useCallback((person: StagedPerson) => setPending((now) => stageAdd(people, now, person)), [people]);
  const removePerson = useCallback((personId: number) => setPending((now) => stageRemove(people, now, personId)), [people]);
  const hold = useCallback(() => {
    setHolders((now) => now + 1);
    return () => setHolders((now) => now - 1);
  }, []);

  // The last panel has closed: apply what was staged. This runs after the render that followed the closing, so after the panel handed focus back to what opened it.
  useEffect(() => {
    const held = holders > 0;
    const released = wasHeld.current && !held;
    wasHeld.current = held;
    if (!released) return;
    const href = pendingHref(people, pending, carry);
    // Nothing staged, or it cancels out; or this navigation is already on its way (a panel opened and shut again meanwhile).
    if (href === null || href === inFlight.current) return;
    inFlight.current = href;
    startNavigation(() => router.push(href));
  }, [holders, people, pending, carry, router]);
  useEffect(() => {
    if (!navigating) inFlight.current = null;
  }, [navigating]);

  const value = useMemo<PeopleStaging>(
    () => ({ current: people, pending, people: final, addPerson, removePerson, hold }),
    [people, pending, final, addPerson, removePerson, hold],
  );
  return <PeopleStagingContext.Provider value={value}>{children}</PeopleStagingContext.Provider>;
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
