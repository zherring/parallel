"use client";

import { ChevronDown, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useEffectEvent, useId, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { REDUCED_MOTION, useMediaQuery } from "@/components/depth/use-media";
import { springEasing } from "@/components/landing/hero-motion";
import { PersonAvatar } from "@/components/person-avatar";
import { PersonSearch } from "@/components/person-search/person-search";
import { cn } from "@/components/timeline/cn";
import { flatSearch } from "@/lib/depth-url";
import { filmCountLabel, joinNames } from "@/lib/format";
import { personColor } from "@/lib/person-colors";

/** One person of the page as the pill shows them. */
export interface PillPerson {
  id: number;
  name: string;
  profilePath: string | null;
  /** Palette slot: their position in the URL (see `personSlots`). */
  slot: number;
  /** "Director, Writer" over the films shown. */
  roles: string;
  /** Films of theirs in the scene. */
  filmCount: number;
  /** The page without them. */
  removeHref: string;
}

interface PeoplePillProps {
  people: readonly PillPerson[];
  /** The scene's scroller: scrolling it more than `SCROLL_CLOSE_PX` closes the panel. */
  scrollerRef: RefObject<HTMLDivElement | null>;
}

/** Closed, open, or on its way back to closed (the heads are flying home). */
type Phase = "closed" | "open" | "closing";

/** The panel closes once the scene has scrolled this far (px) from where it was when the panel opened. */
const SCROLL_CLOSE_PX = 24;
const OPEN_MS = 360;
const CLOSE_MS = 260;
/** Each head leaves a little after the one before it, so they fan out rather than jump. */
const HEAD_STAGGER_MS = 35;

const EASE_IN_OUT = "cubic-bezier(0.4, 0, 0.2, 1)";
const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";

/** Where `from`'s box sits relative to `to`'s, as the transform that moves `to` onto `from` (the "F" and "I" of FLIP). */
function flipTransform(from: DOMRect, to: DOMRect): string {
  const scale = to.width > 0 ? from.width / to.width : 1;
  return `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${scale})`;
}

function headRects(root: ParentNode, attribute: string): Map<string, DOMRect> {
  const rects = new Map<string, DOMRect>();
  root.querySelectorAll<HTMLElement>(`[${attribute}]`).forEach((el) => rects.set(el.getAttribute(attribute) ?? "", el.getBoundingClientRect()));
  return rects;
}

/**
 * The people on the page, folded into a pill at the top left: their overlapping heads (in their colours) and names,
 * with no logo. Tapping the heads opens a floating card: each person's row, the key to the green, a
 * field to add someone and the way back to the flat timeline. The heads fly apart into their rows when it opens and fly
 * back together when it closes (a FLIP animation with the hero's spring, on the compositor; none for reduced motion).
 * While it is open the capsule says "People" with a close icon where the heads were, so it never looks emptied out; it
 * is the same button, still toggling the card.
 *
 * It closes on its own once the scene scrolls more than 24px from where it was, on a press anywhere outside it, and
 * on Escape (which also puts focus back on the pill's button). It is closed on the server.
 *
 * A sibling of the scroller, never inside it: perspective would turn its `fixed` into `absolute`.
 */
export function PeoplePill({ people, scrollerRef }: PeoplePillProps) {
  const reduced = useMediaQuery(REDUCED_MOTION);
  const pathname = usePathname();
  const search = useSearchParams().toString();
  // The way back to the flat timeline: this page without `view=depth`, keeping the period. The bare path on the server.
  const flatHref = `${pathname}${flatSearch(search)}`;

  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("closed");
  /** Where each head was in the pill when it was pressed (client rects by person id), for the heads' flight into the rows. */
  const fromRects = useRef<Map<string, DOMRect>>(new Map());
  /** The scroller's scrollTop when the panel opened. */
  const openedAt = useRef(0);
  const running = useRef<Animation[]>([]);

  const peopleInView = useMemo(() => people.map(({ id, name }) => ({ id, name })), [people]);
  const names = joinNames(people.map((person) => person.name));
  const single = people.length === 1;

  const open = () => {
    const root = rootRef.current;
    if (!root) return;
    fromRects.current = headRects(root, "data-pill-head");
    openedAt.current = scrollerRef.current?.scrollTop ?? 0;
    setPhase("open");
  };

  const close = (restoreFocus: boolean) => {
    if (restoreFocus) buttonRef.current?.focus({ preventScroll: true });
    // Nothing to fly home for a visitor who asked for less motion: shut at once.
    setPhase((current) => (current !== "open" ? current : reduced ? "closed" : "closing"));
  };
  // The listeners below are set up once per opening and call whatever `close` is current.
  const requestClose = useEffectEvent((restoreFocus: boolean) => close(restoreFocus));

  const toggle = () => {
    if (phase === "closed") open();
    else if (phase === "open") close(false);
  };

  // ---- the heads' flight -------------------------------------------------------
  const play = useEffectEvent((target: Phase) => {
    const panel = panelRef.current;
    const root = rootRef.current;
    if (!panel || !root) return;
    for (const animation of running.current) animation.cancel();
    running.current = [];
    if (reduced) return;

    const animate = (el: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions) => {
      const animation = el.animate(keyframes, options);
      running.current.push(animation);
      return animation;
    };
    const opening = target === "open";
    const bg = panel.querySelector("[data-panel-bg]");
    if (bg) {
      animate(
        bg,
        opening ? [{ opacity: 0, transform: "scale(0.9)" }, { opacity: 1, transform: "none" }] : [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(0.94)" }],
        opening ? { duration: 300, easing: EASE_OUT, fill: "backwards" } : { duration: CLOSE_MS - 40, easing: EASE_IN_OUT, fill: "forwards" },
      );
    }
    // The capsule's "People" label and close icon, which stand where the heads were.
    root.querySelectorAll("[data-pill-open]").forEach((el) => {
      animate(
        el,
        opening ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 1 }, { opacity: 0 }],
        opening ? { duration: 200, delay: 60, easing: "ease-out", fill: "backwards" } : { duration: 140, easing: "ease-in", fill: "forwards" },
      );
    });
    panel.querySelectorAll("[data-fade]").forEach((el) => {
      animate(
        el,
        opening ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 1 }, { opacity: 0 }],
        opening ? { duration: 200, delay: 100, easing: "ease-out", fill: "backwards" } : { duration: 120, easing: "ease-in", fill: "forwards" },
      );
    });
    // Opening: from the pill into the rows. Closing: from the rows back into the pill.
    const rows = headRects(panel, "data-row-head");
    const pill = opening ? fromRects.current : headRects(root, "data-pill-head");
    let index = 0;
    panel.querySelectorAll<HTMLElement>("[data-row-head]").forEach((el) => {
      const id = el.getAttribute("data-row-head") ?? "";
      const row = rows.get(id);
      const home = pill.get(id);
      if (!row || !home) return;
      const flown = flipTransform(home, row);
      animate(
        el,
        opening ? [{ transform: flown }, { transform: "none" }] : [{ transform: "none" }, { transform: flown }],
        opening
          ? { duration: OPEN_MS, delay: index * HEAD_STAGGER_MS, easing: springEasing(), fill: "backwards" }
          : { duration: CLOSE_MS, delay: index * (HEAD_STAGGER_MS / 2), easing: EASE_IN_OUT, fill: "forwards" },
      );
      index += 1;
    });

    if (!opening) {
      // The panel goes once the last head is home; a cancelled animation (reopened, unmounted) rejects and changes nothing.
      Promise.all(running.current.map((animation) => animation.finished)).then(
        () => setPhase((current) => (current === "closing" ? "closed" : current)),
        () => {},
      );
    }
  });

  useLayoutEffect(() => {
    if (phase === "closed") return;
    if (phase === "open") panelRef.current?.focus({ preventScroll: true });
    play(phase);
  }, [phase]);

  useEffect(
    () => () => {
      for (const animation of running.current) animation.cancel();
    },
    [],
  );

  // ---- what closes it ------------------------------------------------------------
  useEffect(() => {
    if (phase !== "open") return;
    const scroller = scrollerRef.current;
    const onScroll = () => {
      if (scroller && Math.abs(scroller.scrollTop - openedAt.current) > SCROLL_CLOSE_PX) requestClose(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && rootRef.current?.contains(event.target)) return;
      requestClose(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      // A key the field in the panel handled (closing its list of results) is not for the panel as well.
      if (event.key !== "Escape" || event.defaultPrevented) return;
      requestClose(true);
    };
    scroller?.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      scroller?.removeEventListener("scroll", onScroll);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [phase, scrollerRef]);

  const shown = phase !== "closed";

  return (
    <div ref={rootRef} data-people-pill className="fixed left-3 top-3 z-30 max-w-[calc(100vw-3rem)]">
      <div className="inline-flex max-w-full items-center rounded-full border border-border bg-canvas/80 p-1 backdrop-blur-md supports-[backdrop-filter]:bg-canvas/70">
        <button
          ref={buttonRef}
          type="button"
          aria-expanded={phase === "open"}
          aria-controls={shown ? panelId : undefined}
          aria-label={`People on this page: ${names}`}
          onClick={toggle}
          className="group flex min-w-0 cursor-pointer items-center gap-2 rounded-full py-1 pl-2 pr-2 hover:bg-surface/60 max-sm:pl-1.5"
        >
          {/* One grid cell, two faces: the heads and names (closed) and, while open, a "People" label with a close icon. */}
          <span className="grid min-w-0 items-center">
            <span className="col-start-1 row-start-1 flex min-w-0 items-center gap-2">
              <span className="flex shrink-0 items-center -space-x-1 pl-1">
                {people.map((person) => (
                  <span
                    key={person.id}
                    data-pill-head={person.id}
                    // The heads are in the panel's rows while it is open (they fly there); this is where they come back to.
                    className={cn("relative inline-flex rounded-full", shown && "opacity-0")}
                  >
                    <PersonAvatar
                      name={person.name}
                      profilePath={person.profilePath}
                      size={32}
                      ringColor={personColor(person.slot)}
                      className="max-sm:size-7!"
                    />
                  </span>
                ))}
              </span>
              <span
                className={cn(
                  "hidden min-w-0 max-w-[18rem] truncate text-sm font-medium text-strong transition-opacity duration-150 motion-reduce:transition-none sm:block",
                  phase === "open" && "opacity-0",
                )}
              >
                {names}
              </span>
              <ChevronDown
                aria-hidden="true"
                className={cn("hidden size-4 shrink-0 text-muted transition-opacity duration-150 motion-reduce:transition-none sm:block", phase === "open" && "opacity-0")}
              />
            </span>
            {shown && (
              <span aria-hidden data-pill-open className="col-start-1 row-start-1 flex items-center justify-between gap-3 pl-1 pr-0.5">
                <span className="text-sm font-medium text-strong">People</span>
                <X className="size-4 shrink-0 text-muted group-hover:text-strong" />
              </span>
            )}
          </span>
        </button>
      </div>

      {shown && (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label="People"
          tabIndex={-1}
          // No overflow clipping: the search's list of results hangs below the card. The card's own box is `data-panel-bg`.
          className="relative mt-2 w-[min(22rem,calc(100vw-3rem))] outline-none"
        >
          <div
            aria-hidden
            data-panel-bg
            className="absolute inset-0 origin-top-left rounded-2xl border border-border bg-canvas/90 shadow-xl shadow-black/40 backdrop-blur-md"
          />
          <div className="relative p-2">
            <ul className="m-0 list-none p-0">
              {people.map((person) => (
                <li key={person.id} className="flex items-center gap-3 rounded-xl px-2 py-2">
                  <span data-row-head={person.id} className="inline-flex shrink-0 origin-top-left">
                    <PersonAvatar name={person.name} profilePath={person.profilePath} size={40} ringColor={personColor(person.slot)} />
                  </span>
                  <div data-fade className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold leading-tight text-strong">{person.name}</p>
                    {person.roles && <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-body">{person.roles}</p>}
                    <p className="mt-0.5 text-xs tabular-nums text-muted">{filmCountLabel(person.filmCount)}</p>
                  </div>
                  <Link
                    data-fade
                    href={person.removeHref}
                    prefetch={false}
                    aria-label={`Remove ${person.name}`}
                    title={`Remove ${person.name} from the page`}
                    className="shrink-0 rounded-md px-2 py-1.5 text-xs text-muted hover:bg-surface hover:text-strong"
                  >
                    Remove
                  </Link>
                </li>
              ))}
            </ul>
            {people.length > 1 && (
              <p data-fade className="flex items-center gap-1.5 px-2 pb-2 pt-1 text-xs text-muted">
                <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-lit shadow-[0_0_6px_var(--lit-glow)]" />
                Green: made together
              </p>
            )}
            <div data-fade className="px-2">
              <PersonSearch peopleInView={peopleInView} size="compact" ariaLabel="Add a person" suggestFor={single ? people[0].id : undefined} />
            </div>
            <div data-fade className="px-2 pb-1 pt-2.5">
              <Link
                href={flatHref}
                prefetch={false}
                className="flex h-9 items-center justify-center rounded-md border border-border text-sm font-medium text-strong hover:bg-surface"
              >
                Flat timeline
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
