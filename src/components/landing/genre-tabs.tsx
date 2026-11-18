"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { PanelShownProvider } from "@/components/landing/panel-shown";
import { hashForTab, nextTabIndex, scrollEdges, tabFromHash } from "@/lib/tabs";

/** A pill of the genre tablist (it sits in the landing page's top bar). */
export interface GenrePill {
  /** Also the URL hash that selects it (`/#horror`). */
  id: string;
  label: string;
  /** Decorative icon shown before the label; the pill colors it (muted, or green when selected). */
  icon: ReactNode;
}

/** A panel of the genre tabs (it sits further down the page, in the grid). */
export interface GenrePanel {
  id: string;
  panel: ReactNode;
}

interface GenreTabsState {
  idBase: string;
  fallback: string;
  selected: string;
  /** The panels that have been shown stay drawn when another one is chosen, so going back to one does not draw its faces again. */
  shown: ReadonlySet<string>;
  /** Chooses a tab; `reveal` also brings the panels into view (a pill of the bar was pressed: the grid is not in sight). */
  select: (id: string, reveal?: boolean) => void;
  ids: readonly string[];
}

const GenreTabsContext = createContext<GenreTabsState | null>(null);

function useGenreTabs(): GenreTabsState {
  const state = useContext(GenreTabsContext);
  if (!state) throw new Error("The genre tabs are used outside a GenreTabsProvider");
  return state;
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

/** Brings the element `anchorId` to just under the page's sticky bar, unless it is already well in view. Smooth, but not for a visitor who asked for less motion. */
function revealAnchor(anchorId: string) {
  const anchor = document.getElementById(anchorId);
  if (!anchor) return;
  if (anchor.getBoundingClientRect().top < window.innerHeight * 0.55) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  anchor.scrollIntoView({ behavior: reduced ? "instant" : "smooth", block: "start" });
}

/**
 * The state of the page's genre tabs (WAI-ARIA tabs pattern, automatic activation), shared by the tablist in the top bar (`GenreTablist`) and the panels
 * further down (`GenrePanels`): the selected tab lives in the URL hash (`/#horror`), so it can be linked and survives a reload. The first id is the default.
 * `anchorId` is the element the page scrolls to when a pill of the bar is pressed (the grid's section, whose `scroll-margin-top` clears the bar).
 */
export function GenreTabsProvider({ idBase, ids, anchorId, children }: { idBase: string; ids: readonly string[]; anchorId: string; children: ReactNode }) {
  const fallback = ids[0];
  const hash = useSyncExternalStore(subscribe, getHash, getServerHash);
  const selected = tabFromHash(hash, ids, fallback);
  // What is shown is adjusted during the render, not in an effect, so a panel's first render as the selected one already has its faces.
  const [shown, setShown] = useState<ReadonlySet<string>>(() => new Set());
  if (!shown.has(selected)) setShown(new Set(shown).add(selected));

  const select = (id: string, reveal = false) => {
    writeHash(hashForTab(id, fallback));
    if (reveal) revealAnchor(anchorId);
  };

  return <GenreTabsContext.Provider value={{ idBase, fallback, selected, shown, select, ids }}>{children}</GenreTabsContext.Provider>;
}

/**
 * The genre pills, one row that scrolls sideways when it does not fit (its scrollbar hidden, its edge faded where more pills continue past it): the
 * WAI-ARIA tablist of the panels `GenrePanels` draws. Left and Right move between pills (and wrap), Home and End jump to the ends. Pressing a pill with
 * the pointer (or Enter and Space) also brings the grid into view, as the panels are below the stage; moving with the arrow keys does not scroll.
 */
export function GenreTablist({ label, tabs, className = "" }: { label: string; tabs: readonly GenrePill[]; className?: string }) {
  const { idBase, selected, select } = useGenreTabs();
  const selectedIndex = tabs.findIndex((tab) => tab.id === selected);

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

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const next = nextTabIndex(event.key, index, tabs.length);
    if (next === null) return;
    event.preventDefault();
    select(tabs[next].id);
    tabRefs.current[next]?.focus();
  }

  // The faded edges are a mask, so they are the same over the bar's blurred background as over anything else.
  const mask = `linear-gradient(to right, ${edges.start ? "transparent, #000 28px" : "#000, #000 28px"}, ${edges.end ? "#000 calc(100% - 40px), transparent" : "#000 calc(100% - 40px), #000"})`;

  return (
    <div className={`relative min-w-0 ${className}`}>
      <div
        ref={stripRef}
        className="overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ maskImage: mask, WebkitMaskImage: mask }}
      >
        <div ref={tabListRef} role="tablist" aria-label={label} className="flex w-max gap-0.5 px-1.5">
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
                onClick={() => select(tab.id, true)}
                onKeyDown={(event) => onKeyDown(event, index)}
                className={`group inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
                  isSelected
                    ? "border-accent-green/70 bg-surface text-strong"
                    : "border-transparent text-muted hover:bg-surface/60 hover:text-strong"
                }`}
              >
                <span aria-hidden="true" className={`flex shrink-0 ${isSelected ? "text-accent-green" : "text-muted"}`}>
                  {tab.icon}
                </span>
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * The panels of the genre tabs, all in the markup, so every link stays crawlable and works before JavaScript runs. Hidden panels are display:none, so
 * their lazy images do not load until the panel is shown; and what is heavy in a panel and only for its visitors (the cards' faces) is not drawn at all
 * until it has been shown (`WhenPanelShown`), so the server's markup does not carry nine posters and an SVG for every face of every panel.
 */
export function GenrePanels({ panels }: { panels: readonly GenrePanel[] }) {
  const { idBase, selected, shown } = useGenreTabs();
  return (
    <>
      {panels.map(({ id, panel }) => (
        <div
          key={id}
          role="tabpanel"
          id={panelId(idBase, id)}
          aria-labelledby={tabId(idBase, id)}
          hidden={id !== selected}
          className="pt-5"
        >
          <PanelShownProvider value={id === selected || shown.has(id)}>{panel}</PanelShownProvider>
        </div>
      ))}
    </>
  );
}

/** A link to a genre (`/#horror`) lands on its panels, not on a page that looks the same as the top: brings the grid into view once, on arrival. */
export function RevealLinkedGenre({ anchorId }: { anchorId: string }) {
  const { fallback, ids } = useGenreTabs();
  useEffect(() => {
    if (tabFromHash(window.location.hash, ids, fallback) === fallback) return;
    document.getElementById(anchorId)?.scrollIntoView({ block: "start" });
    // Once, on arrival: a pill pressed later scrolls by itself (`GenreTablist`).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
