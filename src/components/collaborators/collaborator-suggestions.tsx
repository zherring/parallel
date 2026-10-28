"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type CSSProperties,
  type ReactNode,
} from "react";
import { PersonAvatar } from "@/components/person-avatar";
import { Spinner } from "@/components/spinner";
import { scrollBehavior } from "@/components/timeline/scroll-behavior";
import {
  chipDescription,
  chipLabel,
  edgeFades,
  fadeMask,
  filmCountLabel,
  scrollStep,
  type EdgeFades,
} from "@/lib/collaborator-chip";
import { extendedPeopleHref, type PersonRef } from "@/lib/people-nav";
import type { CollaboratorSuggestion } from "@/lib/types";
import { useCollaborators } from "./use-collaborators";

const subscribe = () => () => {};

/** Skeleton chip widths: a few different ones so the placeholder reads as names, not as a bar. */
const SKELETON_WIDTHS = ["w-40", "w-36", "w-44", "w-36", "w-40"];

interface Props {
  /** The one person on the page; the chips are the people to add next to them. */
  person: PersonRef;
}

/**
 * "Frequent collaborators": one-click chips for the people this person has worked with most,
 * beside the "Add person" field on a single-person page. A click adds the person to the timeline,
 * exactly like picking a search result.
 *
 * Nothing is rendered on the server or during hydration, and the list is fetched only after the
 * page is on screen, so the page's HTML never waits on it and does not change. While it loads a
 * few skeleton chips hold the row's height; with no suggestions, or on any error, the whole block
 * disappears.
 */
export function CollaboratorSuggestions({ person }: Props) {
  const router = useRouter();
  const labelId = useId();
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  const state = useCollaborators(person.id);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!hydrated || state.status === "hidden") return null;

  function add(suggestion: CollaboratorSuggestion) {
    if (isPending) return;
    const href = extendedPeopleHref([person], { id: suggestion.id, name: suggestion.name });
    if (!href) return;
    setPendingId(suggestion.id);
    startTransition(() => router.push(href));
  }

  const loading = state.status === "loading";
  return (
    <section aria-labelledby={labelId} aria-busy={loading || undefined} className="min-w-0 flex-1">
      <p id={labelId} className="mb-2 text-sm font-medium text-muted">
        Frequent collaborators
      </p>
      <ScrollRow labelId={labelId} arrows={!loading}>
        {state.status === "ready"
          ? state.results.map((suggestion, index) => (
              <Chip
                key={suggestion.id}
                suggestion={suggestion}
                index={index}
                pending={isPending && pendingId === suggestion.id}
                onAdd={() => add(suggestion)}
              />
            ))
          : SKELETON_WIDTHS.map((width, index) => (
              <li
                key={index}
                aria-hidden="true"
                className={`h-9 shrink-0 rounded-full border border-border bg-surface motion-safe:animate-pulse ${width}`}
              />
            ))}
      </ScrollRow>
    </section>
  );
}

function Chip({
  suggestion,
  index,
  pending,
  onAdd,
}: {
  suggestion: CollaboratorSuggestion;
  index: number;
  pending: boolean;
  onAdd: () => void;
}) {
  const descriptionId = useId();
  const description = chipDescription(suggestion);
  const style: CSSProperties = { animationDelay: `${Math.min(index, 8) * 35}ms` };

  return (
    <li className="shrink-0 motion-safe:animate-chip-in" style={style}>
      <button
        type="button"
        onClick={onAdd}
        aria-label={chipLabel(suggestion)}
        aria-describedby={description ? descriptionId : undefined}
        aria-busy={pending || undefined}
        title={description ?? undefined}
        // As tall as the search field beside it (h-9), so the two read as one row.
        className={`flex h-9 max-w-60 items-center gap-2 rounded-full border bg-surface py-[3px] pl-[3px] pr-3.5 text-left transition-colors hover:bg-border focus-visible:outline-offset-0 ${
          pending ? "cursor-progress border-accent-green/60" : "border-border hover:border-muted/50"
        }`}
      >
        <span className="relative shrink-0">
          <PersonAvatar name={suggestion.name} profilePath={suggestion.profilePath} size={28} />
          {pending && (
            <span className="absolute inset-0 grid place-items-center rounded-full bg-black/60 text-strong">
              <Spinner className="h-4 w-4" />
            </span>
          )}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-[13px] font-medium leading-[15px] text-strong">{suggestion.name}</span>
          <span className="flex min-w-0 gap-1 text-[11px] leading-[13px] text-muted">
            {suggestion.roles && <span className="truncate">{suggestion.roles}</span>}
            {suggestion.roles && (
              <span aria-hidden="true" className="shrink-0">
                ·
              </span>
            )}
            <span className="shrink-0">{filmCountLabel(suggestion.sharedCount)}</span>
          </span>
        </span>
      </button>
      {description && (
        <span id={descriptionId} className="sr-only">
          {description}
        </span>
      )}
    </li>
  );
}

/**
 * A single row of chips that scrolls sideways inside its own box (the page never scrolls
 * sideways because of it). The edges that have more chips behind them fade out, and on devices
 * with a mouse arrow buttons scroll by most of a screenful (not while `arrows` is false, as with
 * the loading skeleton); keyboard users just Tab, and the browser scrolls each focused chip into
 * view.
 */
function ScrollRow({ labelId, arrows, children }: { labelId: string; arrows: boolean; children: ReactNode }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [fades, setFades] = useState<EdgeFades>({ start: false, end: false });

  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const update = () => {
      const next = edgeFades(element.scrollLeft, element.clientWidth, element.scrollWidth);
      setFades((previous) => (previous.start === next.start && previous.end === next.end ? previous : next));
    };
    element.addEventListener("scroll", update, { passive: true });
    // The box changes size with the window, and its content when the chips replace the skeleton.
    const observer = new ResizeObserver(update);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    return () => {
      element.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, []);

  function scrollBy(direction: 1 | -1) {
    const element = scroller.current;
    element?.scrollBy({ left: direction * scrollStep(element.clientWidth), behavior: scrollBehavior() });
  }

  const mask = fadeMask(fades);
  return (
    <div className="relative">
      {/*
        3px of padding (and the same negative margin) keeps the focus ring of the edge chips from
        being clipped. `relative` makes this box the containing block of the chips' screen-reader
        only descriptions (absolutely positioned): without it they escape the clipping and make
        the whole page scroll sideways.
      */}
      <div
        ref={scroller}
        style={mask ? { maskImage: mask, WebkitMaskImage: mask } : undefined}
        className="relative -m-[3px] overflow-x-auto overscroll-x-contain p-[3px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <ul role="list" aria-labelledby={labelId} className="flex w-max gap-2">
          {children}
        </ul>
      </div>
      {arrows && fades.start && <ArrowButton side="start" onClick={() => scrollBy(-1)} />}
      {arrows && fades.end && <ArrowButton side="end" onClick={() => scrollBy(1)} />}
    </div>
  );
}

function ArrowButton({ side, onClick }: { side: "start" | "end"; onClick: () => void }) {
  const Icon = side === "start" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-hidden="true"
      onClick={onClick}
      className={`absolute top-1/2 z-10 hidden h-7 w-7 -translate-y-1/2 place-items-center rounded-full border border-border bg-surface text-strong shadow-lg shadow-black/50 transition-colors hover:bg-border pointer-fine:grid ${
        side === "start" ? "left-0" : "right-0"
      }`}
    >
      <Icon aria-hidden="true" className="h-4 w-4" />
    </button>
  );
}
