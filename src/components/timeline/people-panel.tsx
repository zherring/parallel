"use client";

import { ChevronDown, Eye, EyeOff, Maximize2, Minimize2, X } from "lucide-react";
import Link from "next/link";
import { useId } from "react";
import { PersonAvatar } from "@/components/person-avatar";
import { filmCountLabel } from "@/lib/format";
import { personColor } from "@/lib/person-colors";
import type { PersonSummary } from "@/lib/types";
import { cn } from "./cn";
import { PersonBio } from "./person-bio";

/** Condense: one compact row per person, opened one by one. Stack: every person's full panel, one under the other. */
export type PanelLayout = "condense" | "stack";

/** One person of the page as the people column shows them. */
export interface PanelPerson {
  person: PersonSummary;
  /** Palette slot: their position in the URL (see `personSlots`). */
  slot: number;
  /** "Director, Writer" over the films shown. */
  roles: string;
  /** "Born 1954 · first film 1985 · latest 2021". */
  facts: string;
  /** Films of theirs on the timeline (with the minor toggle as it is). */
  filmCount: number;
  /** Their films are on the track. */
  visible: boolean;
  /** The page without them. */
  removeHref: string;
}

interface PeoplePanelProps {
  people: PanelPerson[];
  layout: PanelLayout;
  onLayoutChange: (layout: PanelLayout) => void;
  /** People whose details are open; the top control fills or clears this same set. */
  openIds: ReadonlySet<number>;
  onToggleOpen: (personId: number) => void;
  onToggleVisible: (personId: number) => void;
}

const iconButtonClass =
  "inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-surface hover:text-strong disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted";

/**
 * The people column of the timeline, in the place of the lane headers in both the combined and
 * the separate layout. Each person is a row (avatar ringed in their colour, name, film count, an
 * eye that shows or hides their films and a row-wide control that unfurls their details); the
 * arrows-out / arrows-in control (expand and condense) opens every panel at once and closes
 * them again. On desktop the compact panel floats at its content height, capped by the track;
 * the fully expanded panel docks flush as a full-height column and scrolls its details independently.
 */
export function PeoplePanel({
  people,
  layout,
  onLayoutChange,
  openIds,
  onToggleOpen,
  onToggleVisible,
}: PeoplePanelProps) {
  const stacked = layout === "stack";
  const visibleCount = people.filter((entry) => entry.visible).length;

  return (
    <aside
      aria-label="People"
      className={cn(
        "flex max-h-[min(28rem,70dvh)] w-full min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-canvas md:pointer-events-auto md:backdrop-blur-md md:supports-[backdrop-filter]:bg-canvas/90",
        stacked
          ? "md:max-h-[clamp(26rem,calc(100dvh-var(--chrome)),1100px)] md:self-stretch md:rounded-r-none md:shadow-none"
          : "md:max-h-[calc(clamp(26rem,100dvh-var(--chrome),1100px)-1.5rem)] md:self-start md:shadow-lg md:shadow-black/30",
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border py-2 pl-3 pr-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted">People</h2>
        <button
          type="button"
          aria-pressed={stacked}
          aria-label={stacked ? "Condense the people list" : "Expand every person's details"}
          title={stacked ? "Condense" : "Expand"}
          onClick={() => onLayoutChange(stacked ? "condense" : "stack")}
          className={iconButtonClass}
        >
          {stacked ? (
            <Minimize2 aria-hidden="true" className="size-4" />
          ) : (
            <Maximize2 aria-hidden="true" className="size-4" />
          )}
        </button>
      </div>

      <ul className="m-0 min-h-0 flex-1 list-none overflow-y-auto overscroll-contain p-0 [scrollbar-color:var(--text-muted)_transparent] [scrollbar-width:thin]">
        {people.map((entry) => (
          <PersonRow
            key={entry.person.id}
            entry={entry}
            open={openIds.has(entry.person.id)}
            onlyVisible={entry.visible && visibleCount === 1}
            onToggleOpen={onToggleOpen}
            onToggleVisible={onToggleVisible}
          />
        ))}
      </ul>

      {visibleCount > 1 && (
        <p className="flex shrink-0 items-center gap-1.5 border-t border-border px-3 py-2 text-xs text-muted">
          <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-lit shadow-[0_0_6px_var(--lit-glow)]" />
          Green: made together
        </p>
      )}
    </aside>
  );
}

interface PersonRowProps {
  entry: PanelPerson;
  open: boolean;
  /** The last person on the track: their eye cannot be turned off. */
  onlyVisible: boolean;
  onToggleOpen: (personId: number) => void;
  onToggleVisible: (personId: number) => void;
}

function PersonRow({ entry, open, onlyVisible, onToggleOpen, onToggleVisible }: PersonRowProps) {
  const { person, slot, roles, facts, filmCount, visible, removeHref } = entry;
  const detailsId = useId();
  const color = personColor(slot);

  return (
    <li className="border-b border-border last:border-b-0">
      <div className="relative">
        {/* Three separate targets: row/portrait unfurls, name opens the bio, eye hides. No nested controls. */}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={detailsId}
          aria-label={`${open ? "Collapse" : "Expand"} ${person.name}`}
          title={open ? "Collapse" : "Expand"}
          onClick={() => onToggleOpen(person.id)}
          className="absolute inset-y-0 left-0 right-10 cursor-pointer rounded-sm text-muted hover:bg-surface/40 hover:text-strong"
        >
          <ChevronDown
            aria-hidden="true"
            className={cn("absolute left-2 top-1/2 -mt-2 size-4 transition-transform duration-150 motion-reduce:transition-none", open && "rotate-180")}
          />
        </button>
        <div className="pointer-events-none flex items-center gap-3 py-2.5 pl-10 pr-11">
          <PersonAvatar
            name={person.name}
            profilePath={person.profilePath}
            size={32}
            // A hidden person keeps a faint ring, so their colour is still how you find them again.
            ringColor={visible ? color : `color-mix(in srgb, ${color} 35%, transparent)`}
            className={cn(!visible && "opacity-50 grayscale")}
          />
          <div className={cn("min-w-0 flex-1", !visible && "opacity-60")}>
            <h3 id={`person-${person.id}`} title={person.name} className="line-clamp-2 break-words text-sm font-semibold leading-tight text-strong">
              <span className="pointer-events-auto relative inline-block max-w-full align-top">
                <PersonBio person={person} roles={roles} nameTrigger />
              </span>
            </h3>
            <p className="mt-0.5 text-xs tabular-nums text-muted">
              {visible ? filmCountLabel(filmCount) : `${filmCountLabel(filmCount)}, hidden`}
            </p>
          </div>
        </div>
        <button
          type="button"
          aria-pressed={visible}
          aria-label={`Show ${person.name}'s films on the timeline`}
          title={onlyVisible ? "At least one person has to stay on the timeline" : visible ? "Hide their films" : "Show their films"}
          disabled={onlyVisible}
          onClick={() => onToggleVisible(person.id)}
          className="absolute inset-y-0 right-0 inline-flex w-10 cursor-pointer items-center justify-center text-muted hover:bg-surface/40 hover:text-strong disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted"
        >
          {visible ? <Eye aria-hidden="true" className="size-4" /> : <EyeOff aria-hidden="true" className="size-4" />}
        </button>
      </div>

      {open && (
        <div id={detailsId} className={cn("px-3.5 pb-3", !visible && "opacity-60")}>
          {roles && <p className="text-xs leading-snug text-body">{roles}</p>}
          {facts && <p className="mt-1.5 text-xs leading-snug text-muted">{facts}</p>}
          <PersonBio person={person} roles={roles} flow />
          <div className="mt-1 flex justify-end">
            <Link
              href={removeHref}
              prefetch={false}
              aria-label={`Remove ${person.name}`}
              title={`Remove ${person.name} from the page`}
              className="inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-xs text-muted hover:bg-surface hover:text-strong"
            >
              <X aria-hidden="true" className="size-3.5" />
              Remove
            </Link>
          </div>
        </div>
      )}
    </li>
  );
}
