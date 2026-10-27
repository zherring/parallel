"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { hashForTab, nextTabIndex, scrollEdges, tabFromHash } from "@/lib/tabs";

export interface GenreTab {
  /** Also the URL hash that selects it (`/#horror`). */
  id: string;
  label: string;
  /** Decorative icon shown before the label; the pill colors it (muted, or green when selected). */
  icon: ReactNode;
  panel: ReactNode;
}

interface Props {
  /** Prefix for the element ids, so the tabs and panels are unique on the page. */
  idBase: string;
  /** Accessible name of the tab list. */
  label: string;
  /** The first one is the default. Every panel is rendered; only the selected one is visible. */
  tabs: GenreTab[];
}

// The selected tab lives in the URL hash. `replaceState` fires no event, so changes made here
// notify subscribers themselves; `hashchange` covers back/forward and hand-edited URLs.
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("hashchange", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("hashchange", onChange);
  };
}

const getHash = () => window.location.hash;
// Empty on the server and while hydrating, so the first client render matches the server HTML.
const getServerHash = () => "";

function writeHash(hash: string) {
  const { pathname, search } = window.location;
  window.history.replaceState(null, "", `${pathname}${search}${hash}`);
  for (const notify of listeners) notify();
}

const tabId = (idBase: string, id: string) => `${idBase}-tab-${id}`;
const panelId = (idBase: string, id: string) => `${idBase}-panel-${id}`;

/**
 * Pill tabs (WAI-ARIA tabs pattern, automatic activation) whose panels are all in the markup, so
 * every link stays crawlable and works before JavaScript runs. Hidden panels are display:none, so
 * their lazy images do not load until the panel is shown.
 */
export function GenreTabs({ idBase, label, tabs }: Props) {
  const ids = tabs.map((tab) => tab.id);
  const fallback = ids[0];
  const hash = useSyncExternalStore(subscribe, getHash, getServerHash);
  const selected = tabFromHash(hash, ids, fallback);
  const selectedIndex = ids.indexOf(selected);

  const stripRef = useRef<HTMLDivElement>(null);
  const tabListRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [edges, setEdges] = useState({ start: false, end: false });

  // Fade the strip's edges only where more pills continue past them.
  useEffect(() => {
    const strip = stripRef.current;
    const tabList = tabListRef.current;
    if (!strip || !tabList) return;
    const update = () => {
      const next = scrollEdges(strip.scrollLeft, strip.clientWidth, strip.scrollWidth);
      setEdges((prev) => (prev.start === next.start && prev.end === next.end ? prev : next));
    };
    strip.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update); // also runs once when observing starts
    observer.observe(strip);
    observer.observe(tabList);
    return () => {
      strip.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, []);

  // Keep the selected pill in view (a deep link to a genre off to the side, or a keyboard move).
  useEffect(() => {
    const strip = stripRef.current;
    const tab = tabRefs.current[selectedIndex];
    if (!strip || !tab) return;
    const stripBox = strip.getBoundingClientRect();
    const tabBox = tab.getBoundingClientRect();
    const centered = tabBox.left - stripBox.left + strip.scrollLeft - (stripBox.width - tabBox.width) / 2;
    strip.scrollTo({ left: centered });
  }, [selectedIndex]);

  function select(id: string) {
    writeHash(hashForTab(id, fallback));
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const next = nextTabIndex(event.key, index, tabs.length);
    if (next === null) return;
    event.preventDefault();
    select(tabs[next].id);
    tabRefs.current[next]?.focus();
  }

  return (
    <div>
      {/* Full-bleed on phones so pills scroll under the page gutter. */}
      <div className="relative -mx-4">
        <div
          ref={stripRef}
          className="overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <div ref={tabListRef} role="tablist" aria-label={label} className="flex w-max gap-1 px-4">
            {tabs.map((tab, index) => {
              const isSelected = tab.id === selected;
              return (
                <button
                  key={tab.id}
                  ref={(element) => {
                    tabRefs.current[index] = element;
                  }}
                  type="button"
                  role="tab"
                  id={tabId(idBase, tab.id)}
                  aria-selected={isSelected}
                  aria-controls={panelId(idBase, tab.id)}
                  tabIndex={isSelected ? 0 : -1}
                  onClick={() => select(tab.id)}
                  onKeyDown={(event) => onKeyDown(event, index)}
                  className={`group inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
                    isSelected
                      ? "border-accent-green/70 bg-surface text-strong"
                      : "border-transparent text-muted hover:bg-surface/60 hover:text-strong"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`flex shrink-0 ${isSelected ? "text-accent-green" : "text-muted"}`}
                  >
                    {tab.icon}
                  </span>
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-y-0 left-0 w-10 bg-linear-to-r from-canvas to-transparent transition-opacity ${
            edges.start ? "opacity-100" : "opacity-0"
          }`}
        />
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-y-0 right-0 w-10 bg-linear-to-l from-canvas to-transparent transition-opacity ${
            edges.end ? "opacity-100" : "opacity-0"
          }`}
        />
      </div>

      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={panelId(idBase, tab.id)}
          aria-labelledby={tabId(idBase, tab.id)}
          hidden={tab.id !== selected}
          className="pt-5"
        >
          {tab.panel}
        </div>
      ))}
    </div>
  );
}
