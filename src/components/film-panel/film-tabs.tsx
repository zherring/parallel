"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import type { CrewGroup, PersonRow } from "@/lib/film-people";
import {
  FILM_TABS,
  nextTabIndex,
  rememberFilmTab,
  rememberedFilmTab,
  scrollTopAfterTabChange,
  type FilmTab,
} from "@/lib/tabs";

interface Props {
  /** Prefix for the element ids, so the tabs and panels are unique on the page. */
  idBase: string;
  /** By billing, one row per person. */
  cast: PersonRow[];
  crew: CrewGroup[];
  renderRow: (person: PersonRow) => ReactNode;
  /** The panel's scroll container, so a tab switch can bring the new list back into view. */
  scrollRef: RefObject<HTMLElement | null>;
}

const TAB_LABELS: Record<FilmTab, string> = { cast: "Cast", crew: "Crew" };
const EMPTY_TEXT: Record<FilmTab, string> = {
  cast: "No cast listed for this film.",
  crew: "No crew listed for this film.",
};

const tabId = (idBase: string, tab: FilmTab) => `${idBase}-tab-${tab}`;
const panelId = (idBase: string, tab: FilmTab) => `${idBase}-panel-${tab}`;

/** Cast and Crew tabs (WAI-ARIA tabs pattern, automatic activation) with a sticky tab bar. */
export function FilmTabs({ idBase, cast, crew, renderRow, scrollRef }: Props) {
  const [tab, setTab] = useState<FilmTab>(rememberedFilmTab);
  const sectionRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const scrollPending = useRef(false);

  function select(next: FilmTab) {
    if (next === tab) return;
    rememberFilmTab(next);
    scrollPending.current = true;
    setTab(next);
  }

  // After the new list is in the DOM: if the tab bar has stuck to the top, scroll back to the
  // point where it sticks, so the new list starts right under it instead of wherever the old,
  // possibly longer, list was scrolled to. Above that point (film header in view) nothing moves.
  useLayoutEffect(() => {
    if (!scrollPending.current) return;
    scrollPending.current = false;
    const container = scrollRef.current;
    const section = sectionRef.current;
    if (!container || !section) return;
    const barTop =
      section.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
    const next = scrollTopAfterTabChange(container.scrollTop, barTop);
    if (next !== container.scrollTop) container.scrollTop = next;
  }, [tab, scrollRef]);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const next = nextTabIndex(event.key, index, FILM_TABS.length);
    if (next === null) return;
    event.preventDefault();
    select(FILM_TABS[next]);
    tabRefs.current[next]?.focus();
  }

  return (
    <div ref={sectionRef} className="mt-6">
      {/* Sticky offsets start inside the scroll container's padding, so -top-5 cancels its pt-5
          and the bar sits flush against the top edge (nothing peeks out above it). */}
      <div
        role="tablist"
        aria-label="Cast and crew"
        className="sticky -top-5 z-10 -mx-4 flex gap-6 border-b border-border bg-canvas px-4"
      >
        {FILM_TABS.map((key, index) => {
          const selected = key === tab;
          return (
            <button
              key={key}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              type="button"
              role="tab"
              id={tabId(idBase, key)}
              aria-selected={selected}
              aria-controls={panelId(idBase, key)}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(key)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={`-mb-px border-b-2 px-0.5 pb-2.5 pt-3 text-[13px] font-medium uppercase tracking-[0.075em] -outline-offset-2 hover:text-strong ${
                selected ? "border-accent-green text-strong" : "border-transparent text-muted"
              }`}
            >
              {TAB_LABELS[key]}
            </button>
          );
        })}
      </div>

      {/* Both panels exist so every aria-controls resolves; only the selected one has content. */}
      {FILM_TABS.map((key) => (
        <div
          key={key}
          role="tabpanel"
          id={panelId(idBase, key)}
          aria-labelledby={tabId(idBase, key)}
          hidden={key !== tab}
          className="pt-1"
        >
          {key === tab && key === "cast" && <CastList cast={cast} renderRow={renderRow} />}
          {key === tab && key === "crew" && <CrewList crew={crew} renderRow={renderRow} />}
        </div>
      ))}
    </div>
  );
}

function CastList({ cast, renderRow }: Pick<Props, "cast" | "renderRow">) {
  if (cast.length === 0) return <Empty tab="cast" />;
  return <ul className="mt-2">{cast.map((person) => renderRow(person))}</ul>;
}

function CrewList({ crew, renderRow }: Pick<Props, "crew" | "renderRow">) {
  if (crew.length === 0) return <Empty tab="crew" />;
  return (
    <>
      {crew.map((group) => (
        <div key={group.role} className="mt-3">
          <h3 className="text-xs font-medium text-muted">{group.label}</h3>
          <ul className="mt-0.5">{group.people.map((person) => renderRow(person))}</ul>
        </div>
      ))}
    </>
  );
}

function Empty({ tab }: { tab: FilmTab }) {
  return <p className="py-6 text-center text-sm text-muted">{EMPTY_TEXT[tab]}</p>;
}
