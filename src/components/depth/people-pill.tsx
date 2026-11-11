"use client";

import { ChevronDown, Eye, EyeOff, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useEffectEvent, useId, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { REDUCED_MOTION, useMediaQuery } from "@/components/depth/use-media";
import { springEasing } from "@/components/landing/hero-motion";
import { PersonAvatar } from "@/components/person-avatar";
import { PersonSearch } from "@/components/person-search/person-search";
import { cn } from "@/components/timeline/cn";
import { PersonBio } from "@/components/timeline/person-bio";
import { filmCountLabel, joinNames } from "@/lib/format";
import { personColor } from "@/lib/person-colors";
import { pageHeading } from "@/lib/short-name";
import type { OpenPerson } from "@/lib/side-panel";
import type { PersonSummary } from "@/lib/types";

/** One person of the page as the pill shows them. */
export interface PillPerson {
  /** The person, with the details their name opens. */
  person: PersonSummary;
  /** Palette slot: their position in the URL (see `personSlots`). */
  slot: number;
  /** "Director, Writer" over the films shown. */
  roles: string;
  /** Films of theirs in the scene. */
  filmCount: number;
  /** The page without them. */
  removeHref: string;
  /** Their films are on the timeline (the eye); only meaningful where the pill has `onToggleVisible`. A person is shown unless this says false. */
  visible?: boolean;
}

interface PeoplePillProps {
  people: readonly PillPerson[];
  /** A name or a portrait was pressed: open the person's details in the slide-out panel (it is over the pill, which stays open under it). */
  onOpenPerson: OpenPerson;
  /**
   * Shows or hides a person's films: the eye in each row, where the view has films to hide (the flat Timeline of several people). Without it
   * the rows have no eye, and nobody is dimmed. Hiding the last person on the track is refused (that eye is disabled): it is never empty.
   */
  onToggleVisible?: (personId: number) => void;
  /** The scene's scroller: scrolling it more than `SCROLL_CLOSE_PX` closes the panel. None on the flat pages, where the window is what scrolls. */
  scrollerRef?: RefObject<HTMLDivElement | null>;
}

/** Closed, open, or on its way back to closed (the heads are flying home). */
type Phase = "closed" | "open" | "closing";

/** The panel closes once the scene has scrolled this far (px) from where it was when the panel opened. */
const SCROLL_CLOSE_PX = 24;
/** A scroll within this long (ms) of a viewport resize is the browser re-fitting the scene, not the visitor scrolling. */
const RESIZE_SETTLE_MS = 500;
const OPEN_MS = 360;
const CLOSE_MS = 260;
/** Each head leaves a little after the one before it, so they fan out rather than jump. */
const HEAD_STAGGER_MS = 35;

const EASE_IN_OUT = "cubic-bezier(0.4, 0, 0.2, 1)";
const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";

/** Where `from`'s box sits relative to `to`'s, as the transform that moves `to` onto `from` (the "F" and "I" of FLIP). */
export function flipTransform(from: DOMRect, to: DOMRect): string {
  const scale = to.width > 0 ? from.width / to.width : 1;
  return `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${scale})`;
}

/** Whether the event is in the slide-out panel a name or a portrait opened (a dialog on the body, see `SidePanel`), which is not inside the pill's box. */
function inSidePanel(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest("[data-side-panel]") !== null;
}

function headRects(root: ParentNode, attribute: string): Map<string, DOMRect> {
  const rects = new Map<string, DOMRect>();
  root.querySelectorAll<HTMLElement>(`[${attribute}]`).forEach((el) => rects.set(el.getAttribute(attribute) ?? "", el.getBoundingClientRect()));
  return rects;
}

interface PersonRowProps {
  entry: PillPerson;
  /** The name and the portrait open the person's details in the slide-out panel. */
  onOpenPerson: OpenPerson;
  /** Whether their films are shown (the eye is on); a hidden person is faint, with a ring that is still their colour. */
  visible: boolean;
  /** The eye that shows or hides their films, where the view has films to hide (see `PeoplePill`). Without it the row has no eye. */
  onToggleVisible?: (personId: number) => void;
  /** The one person left on the track: their eye is disabled, since the track would be empty. */
  onlyVisible?: boolean;
}

/**
 * One person's row, in the open pill's card and in the full-screen people search (`PeopleOverlay`): their portrait (in their colour's ring) and name,
 * both opening their details, their roles and film count, the eye where the view has one, and "Remove", the link to the page without them. Its heads and
 * fades are marked (`data-row-head`, `data-fade`) for the pill's flight, which looks only inside its own card.
 */
export function PersonRow({ entry, onOpenPerson, visible, onToggleVisible, onlyVisible = false }: PersonRowProps) {
  const { person, slot, roles, filmCount, removeHref } = entry;
  return (
    <li className="flex items-center gap-3 rounded-xl px-2 py-2">
      <span data-row-head={person.id} className="inline-flex shrink-0 origin-top-left">
        {/* The portrait opens the person's details, as the name does (and as the Quotes' names do). */}
        <PersonBio
          person={person}
          onOpen={onOpenPerson}
          portrait={
            <PersonAvatar
              name={person.name}
              profilePath={person.profilePath}
              size={40}
              // A hidden person keeps a faint ring, so their colour is still how you find them again.
              ringColor={visible ? personColor(slot) : `color-mix(in srgb, ${personColor(slot)} 35%, transparent)`}
              className={cn(!visible && "opacity-50 grayscale")}
            />
          }
        />
      </span>
      <div data-fade className={cn("min-w-0 flex-1", !visible && "opacity-60")}>
        {/* The name (up to two lines, the whole of it on hover) opening the person's details, the roles in full, the film count. */}
        <p title={person.name} className="line-clamp-2 break-words text-sm font-semibold leading-tight text-strong">
          <span className="relative inline-block max-w-full align-top">
            <PersonBio person={person} onOpen={onOpenPerson} nameTrigger />
          </span>
        </p>
        {roles && <p className="mt-0.5 text-xs leading-snug text-body">{roles}</p>}
        <p className="mt-0.5 text-xs tabular-nums text-muted">{visible ? filmCountLabel(filmCount) : `${filmCountLabel(filmCount)}, hidden`}</p>
      </div>
      {onToggleVisible && (
        // The eye that shows or hides this person's films on the timeline (the people column's had one, which the pill took over): pressed while their films are shown.
        <button
          data-fade
          type="button"
          aria-pressed={visible}
          aria-label={`Show ${person.name}'s films on the timeline`}
          title={onlyVisible ? "At least one person has to stay on the timeline" : visible ? "Hide their films" : "Show their films"}
          disabled={onlyVisible}
          onClick={() => onToggleVisible(person.id)}
          className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-surface hover:text-strong disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted"
        >
          {visible ? <Eye aria-hidden="true" className="size-4" /> : <EyeOff aria-hidden="true" className="size-4" />}
        </button>
      )}
      <Link
        data-fade
        href={removeHref}
        prefetch={false}
        aria-label={`Remove ${person.name}`}
        title={`Remove ${person.name} from the page`}
        className="shrink-0 rounded-md px-2 py-1.5 text-xs text-muted hover:bg-surface hover:text-strong"
      >
        Remove
      </Link>
    </li>
  );
}

/**
 * The people on the page, folded into a pill at the top left: their overlapping heads (in their colours) and names,
 * with no logo. Tapping the heads opens a floating card: each person's row, with a way to remove them and, on the flat Timeline of several people, an
 * eye that shows or hides their films (what the timeline's people column, now gone, had), and the key to the green. The views are in `PeopleBar`, which also holds the pill's place. The heads fly apart into their rows when it opens and fly back together when it closes (a FLIP animation
 * with the hero's spring, on the compositor; none for reduced motion). While it is open the pill's outline fades away and, in
 * its place, the app's usual search field to add someone (focused) takes the card's width, with a close button of its own,
 * a square icon just to its right.
 *
 * It closes on its own once the scene scrolls more than 24px from where it was (a viewport resize, such as a phone's
 * keyboard opening, is not the visitor scrolling), on a press anywhere outside it (the field's dropdown is inside it) and
 * on Escape, which also puts focus back on the pill's button (as does the close button). The field gets Escape first: with
 * text typed or a dropdown showing it clears or closes that, and only an Escape with nothing to dismiss closes the pill. It is
 * closed on the server.
 *
 * It is laid out by `PeopleBar` (a fixed bar, a sibling of the Depth view's scroller, never inside it: perspective would turn `fixed` into
 * `absolute`); while it is open it has `data-open`, which the bar's other controls look for to step aside.
 */
export function PeoplePill({ people, onOpenPerson, scrollerRef, onToggleVisible }: PeoplePillProps) {
  const reduced = useMediaQuery(REDUCED_MOTION);

  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const capsuleRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("closed");
  /** Where each head was in the pill when it was pressed (client rects by person id), for the heads' flight into the rows. */
  const fromRects = useRef<Map<string, DOMRect>>(new Map());
  /** The scroller's scrollTop when the panel opened. */
  const openedAt = useRef(0);
  const running = useRef<Animation[]>([]);

  const peopleInView = useMemo(() => people.map(({ person }) => ({ id: person.id, name: person.name })), [people]);
  const names = joinNames(people.map(({ person }) => person.name));
  // On a phone the names are the family names ("Tracy & Hepburn", "Ford, Lucas, & Spielberg"), the ones the page's headline uses for three or more people.
  const familyNames = pageHeading(people.map(({ person }) => ({ id: person.id, name: person.name })), { short: true }).text;
  const single = people.length === 1;
  /** The eyes are on offer here; a person is on the track unless theirs is off. Without them nobody is hidden. */
  const hideable = onToggleVisible !== undefined;
  const isVisible = (entry: PillPerson) => !hideable || entry.visible !== false;
  const visibleCount = people.filter(isVisible).length;

  const open = () => {
    const root = rootRef.current;
    if (!root) return;
    fromRects.current = headRects(root, "data-pill-head");
    openedAt.current = scrollerRef?.current?.scrollTop ?? window.scrollY;
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
    // The pill's outline (the capsule, with its names) is gone before the field fades in, and comes back once the field has faded out, as the heads
    // land: so the pill's border and the field's are never on screen together. (`fill: backwards` holds the start of the fade through its delay.)
    const capsule = capsuleRef.current;
    if (capsule) {
      animate(
        capsule,
        opening ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 0 }, { opacity: 1 }],
        opening ? { duration: 80, easing: "ease-out", fill: "backwards" } : { duration: 150, delay: 140, easing: "ease-out", fill: "backwards" },
      );
    }
    // The field to add a person and the close button, which stand over the pill.
    root.querySelectorAll("[data-pill-open]").forEach((el) => {
      animate(
        el,
        opening ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 1 }, { opacity: 0 }],
        opening ? { duration: 200, delay: 80, easing: "ease-out", fill: "backwards" } : { duration: 140, easing: "ease-in", fill: "forwards" },
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
    if (phase === "closed") {
      // Finished animations that fill forwards would pin what they closed to.
      for (const animation of running.current) animation.cancel();
      running.current = [];
      return;
    }
    // Focus goes to the field: it takes `autoFocus` when it mounts, which is this render.
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
    // The scene's scroller, or the page itself on the flat pages (their bar is fixed, and the window is what scrolls under it).
    const scroller = scrollerRef?.current ?? null;
    const scrolled = () => (scroller ? scroller.scrollTop : window.scrollY);
    const scrollTarget: HTMLElement | Window = scroller ?? window;
    // The scene is re-fitted when the viewport changes (a phone's keyboard opening for the field, its address bar folding), and
    // the browser may move the scroller with it: that is not the visitor scrolling, so the distance starts again from there.
    let settleUntil = 0;
    const onResize = () => {
      settleUntil = performance.now() + RESIZE_SETTLE_MS;
      openedAt.current = scrolled();
    };
    const onScroll = () => {
      if (performance.now() < settleUntil) {
        openedAt.current = scrolled();
        return;
      }
      if (Math.abs(scrolled() - openedAt.current) > SCROLL_CLOSE_PX) requestClose(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      // The field's dropdown hangs inside the pill's box (it is not portalled), so a press on it is a press inside.
      if (event.target instanceof Node && rootRef.current?.contains(event.target)) return;
      // The panel a name opened (`PersonBio`) is a dialog on the body: a press in it is not one outside the pill, which stays open under it, for
      // the focus to come back to the name that opened it.
      if (inSidePanel(event.target)) return;
      requestClose(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      // A key the field handled (closing its list of results, clearing its text) is not for the pill as well.
      if (event.key !== "Escape" || event.defaultPrevented) return;
      // An Escape in an open panel closes the panel (its own), not the pill under it.
      if (inSidePanel(event.target)) return;
      requestClose(true);
    };
    scrollTarget.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("resize", onResize);
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      scrollTarget.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [phase, scrollerRef]);

  const shown = phase !== "closed";

  return (
    <div ref={rootRef} data-people-pill data-open={shown ? "" : undefined} className="pointer-events-auto relative z-30 min-w-0 max-w-[calc(100vw-3rem)] max-sm:max-w-[calc(100vw-5.125rem)]">
      {/* The bar: the pill, and over it, while open, the field and the close button, which together are as wide as the card (the pill may be wider: a long list of names). */}
      <div className="relative">
        <div
          ref={capsuleRef}
          data-pill-capsule
          // The pill's outline is on this box, and it is the whole of the closed pill: open, it is gone (faded, see `play`) and the
          // box stays where it is, so the heads have their places to fly back to.
          className={cn(
            // As tall as the bar's other controls (`--bar-h`, set by `PeopleBar`: 50px, 46px on a phone), which it is the measure of.
            "flex h-(--bar-h) w-fit max-w-full items-center rounded-(--bar-radius) border border-border bg-canvas/80 p-1 backdrop-blur-md supports-[backdrop-filter]:bg-canvas/70",
            phase === "open" && "opacity-0",
          )}
        >
          <button
            ref={buttonRef}
            type="button"
            aria-expanded={phase === "open"}
            aria-controls={shown ? panelId : undefined}
            aria-label={`People on this page: ${names}`}
            onClick={toggle}
            // Open, it is out of the Tab order (the field and the close button are the way in and out) but still the one that holds focus once closed.
            tabIndex={phase === "open" ? -1 : undefined}
            // Concentric with the capsule: its radius less the capsule's 4px of padding.
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-[max(0px,calc(var(--bar-radius)-0.25rem))] py-1 pl-2 pr-2 hover:bg-surface/60 max-sm:pl-1.5"
          >
            <span className="flex shrink-0 items-center -space-x-1 pl-1">
              {people.map((entry) => {
                const { person, slot } = entry;
                const visible = isVisible(entry);
                return (
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
                      // A hidden person keeps a faint ring, so their colour is still how you find them again; their head is faint too, closed, so that
                      // the pill says someone's films are off the timeline.
                      ringColor={visible ? personColor(slot) : `color-mix(in srgb, ${personColor(slot)} 35%, transparent)`}
                      className={cn("max-sm:size-7!", !visible && "opacity-50 grayscale")}
                    />
                  </span>
                );
              })}
            </span>
            {/* The names, after the heads: in full from `sm` up, and on a phone the family names, which give way with an ellipsis (the heads, the arrow before the pill and the gear after it never do). */}
            <span className="min-w-0 truncate text-sm font-medium text-strong sm:hidden">{familyNames}</span>
            <span className="hidden min-w-0 max-w-[18rem] truncate text-sm font-medium text-strong sm:block">{names}</span>
            <ChevronDown aria-hidden="true" className="hidden size-4 shrink-0 text-muted sm:block" />
          </button>
        </div>
        {shown && (
          // Over the pill, as wide as the card: the app's usual search field (the same as the flat page's, boxed, with its own border) and, to
          // its right, the close button as a square of its own. The field is the dropdown's anchor, so the dropdown hangs from it; z-10 lifts
          // the row (and the dropdown in it) over the card below. First in the DOM after the pill so Tab goes field, close button, card.
          <div
            data-pill-open
            inert={phase !== "open"}
            // Starts at the pill's own left edge, after the home arrow (a phone's too: its 46px and the gap, 58px, and the bar's 12px each side, are the 5.125rem the
            // width gives up), and the field, as wide as the card, ends clear of the right edge, over the count and the gear, which step aside.
            className="absolute left-0 top-0 z-10 flex h-full w-[min(22rem,calc(100vw-3rem))] items-center gap-2 [--search-radius:var(--bar-radius)] max-sm:w-[min(22rem,calc(100vw-5.125rem))]"
          >
            <div className="min-w-0 flex-1">
              <PersonSearch
                autoFocus
                peopleInView={peopleInView}
                size="compact"
                ariaLabel="Add a person"
                suggestFor={single ? people[0].person.id : undefined}
                onIdleEscape={() => close(true)}
              />
            </div>
            <button
              type="button"
              aria-label="Close people"
              title="Close"
              onClick={() => close(true)}
              className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-(--bar-radius) border border-border bg-surface text-muted transition-colors hover:bg-border hover:text-strong"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
        )}
      </div>

      {shown && (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label="People"
          tabIndex={-1}
          // No overflow clipping, so nothing of the field's dropdown could be cut off by the card. The card's own box is `data-panel-bg`.
          className="relative mt-2 w-[min(22rem,calc(100vw-3rem))] outline-none max-sm:w-[min(22rem,calc(100vw-5.125rem))]"
        >
          <div
            aria-hidden
            data-panel-bg
            className="absolute inset-0 origin-top-left rounded-(--bar-radius) border border-border bg-canvas/90 shadow-xl shadow-black/40 backdrop-blur-md"
          />
          <div className="relative p-2">
            <ul className="m-0 list-none p-0">
              {people.map((entry) => {
                const visible = isVisible(entry);
                return (
                  <PersonRow
                    key={entry.person.id}
                    entry={entry}
                    onOpenPerson={onOpenPerson}
                    visible={visible}
                    onToggleVisible={onToggleVisible}
                    // The last person on the track cannot be hidden: it would be empty.
                    onlyVisible={visible && visibleCount === 1}
                  />
                );
              })}
            </ul>
            {/* Only while two or more people are on the track: with one left, nothing is made together on screen. */}
            {people.length > 1 && visibleCount > 1 && (
              <p data-fade className="flex items-center gap-1.5 px-2 pb-2 pt-1 text-xs text-muted">
                {/* A small poster in the ring the films made together have in the scene: a crisp green edge, no glow. */}
                <span aria-hidden className="h-3.5 w-2.5 shrink-0 rounded-[2px] border-2 border-lit" />
                Green: made together
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
