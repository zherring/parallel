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
import { GENRE_MARK, GENRE_ROOT, deepLinkCss, deepLinkScript } from "@/lib/genre-deep-link";
import { hashForTab, nextTabIndex, scrollEdges, tabFromHash } from "@/lib/tabs";

/** A pill of the genre tablist (it sits in the landing page's top bar). */
export interface GenrePill {
  /** Also the URL hash that selects it (`/#horror`). */
  id: string;
  label: string;
  /** Decorative icon shown before the label; the pill colors it (muted, or black on the selected pill's white). */
  icon: ReactNode;
}

/** A panel of the genre tabs: Featured's is the splash alone, a genre's is its grid of cards (each under the bar, in place of the others). */
export interface GenrePanel {
  id: string;
  panel: ReactNode;
}

interface GenreTabsState {
  idBase: string;
  fallback: string;
  selected: string;
  /** The panels that have been shown stay drawn when another one is chosen, so going back to one does not draw its faces again (nor start its splash over). */
  shown: ReadonlySet<string>;
  /** Chooses a tab, and brings the page back to its top if it is scrolled: the panels are views, each under the bar. */
  select: (id: string) => void;
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

const subscribeNever = () => () => {};

/** Back to the top of the page, at once (the view under the bar has just been replaced, so a smooth scroll would only show the old view's place in the new one). */
function scrollToTop() {
  if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: "instant" });
}

/**
 * The state of the page's genre tabs (WAI-ARIA tabs pattern, automatic activation), shared by the tablist in the top bar (`GenreTablist`) and the panels
 * (`GenrePanels`): the selected tab lives in the URL hash (`/#horror`), so it can be linked and survives a reload. The first id is the default (Featured, whose
 * panel holds the splash); any other tab's panel takes the splash's place, directly under the bar.
 *
 * A page opened on `/#horror` is first the server's markup, which cannot know the hash and shows the default; until the page is live `GenreDeepLink` (an inline
 * script, in the markup before the panels) has already marked the page's root, and its CSS shows the right panel and pill, so the splash is never painted. Once live
 * the state is the hash's and the mark is taken off.
 */
export function GenreTabsProvider({ idBase, ids, children }: { idBase: string; ids: readonly string[]; children: ReactNode }) {
  const fallback = ids[0];
  const hash = useSyncExternalStore(subscribe, getHash, getServerHash);
  const selected = tabFromHash(hash, ids, fallback);
  // False on the server and for the hydrating render, when `selected` is only the server's guess (the default).
  const live = useSyncExternalStore(subscribeNever, () => true, () => false);
  // What is shown is adjusted during the render, not in an effect, so a panel's first render as the selected one already has its faces. The guess is not recorded:
  // a page opened on a genre never shows the splash, and so never starts it.
  const [shown, setShown] = useState<ReadonlySet<string>>(() => new Set());
  if (live && !shown.has(selected)) setShown(new Set(shown).add(selected));

  useEffect(() => {
    if (live) document.querySelector(`[${GENRE_ROOT}]`)?.removeAttribute(GENRE_MARK);
  }, [live]);

  const select = (id: string) => {
    writeHash(hashForTab(id, fallback));
    scrollToTop();
  };

  return <GenreTabsContext.Provider value={{ idBase, fallback, selected, shown, select, ids }}>{children}</GenreTabsContext.Provider>;
}

/**
 * What a link to a genre needs to open on its grid without the splash painted first (see genre-deep-link.ts): the style, and the inline script that marks the
 * page's root. The script is in the server's markup (where it runs, before anything under it is painted) and in the hydrating render that must match it, and not
 * after: a script rendered by the browser is never run, and React says so, as it would when the page is reached by a client-side navigation. `ids` is the tabs' ids, the default first.
 */
export function GenreDeepLink({ ids }: { ids: readonly string[] }) {
  // True on the server and for the hydrating render, false from the next one (and for a render that is never hydrated, a client-side navigation to the page).
  const serverMarkup = useSyncExternalStore(subscribeNever, () => false, () => true);
  return (
    <>
      <style>{deepLinkCss(ids)}</style>
      {serverMarkup && <script dangerouslySetInnerHTML={{ __html: deepLinkScript(ids) }} />}
    </>
  );
}

/** Whether the page shows a genre's grid in place of the splash (what the hero's rotation holds still for); false outside the tabs. */
export function useSplashHidden(): boolean {
  const state = useContext(GenreTabsContext);
  return state !== null && state.selected !== state.fallback;
}

/**
 * What goes under a genre's grid and not under the splash (the page's "How it works"): hidden while the default tab, Featured, is the view, which is all of
 * the server's markup too; a link to a genre shows it before the page is live, with the grid (genre-deep-link.ts).
 */
export function GenreOnly({ children }: { children: ReactNode }) {
  const splash = !useSplashHidden();
  return (
    <div data-genre-only="" className={splash ? "hidden" : undefined}>
      {children}
    </div>
  );
}

/**
 * The genre pills, one row that scrolls sideways when it does not fit (its scrollbar hidden, its edge faded where more pills continue past it): the
 * WAI-ARIA tablist of the panels `GenrePanels` draws. Left and Right move between pills (and wrap), Home and End jump to the ends. Choosing a pill, by
 * pointer or by key, swaps the view under the bar and brings the page back to its top. The selected pill is a solid white pill with black text and a black icon (no
 * green; its border is transparent, so it is the size of the others), and its focus ring is the page's own (`--focus`, a 2px outline 2px outside the pill, over the bar's dark).
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
                data-genre-tab={tab.id}
                aria-selected={isSelected}
                aria-controls={panelId(idBase, tab.id)}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => select(tab.id)}
                onKeyDown={(event) => onKeyDown(event, index)}
                className={`group inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
                  isSelected
                    ? "border-transparent bg-white text-black"
                    : "border-transparent text-muted hover:bg-surface/60 hover:text-strong"
                }`}
              >
                <span aria-hidden="true" data-genre-icon="" className={`flex shrink-0 ${isSelected ? "text-black" : "text-muted"}`}>
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
 * their lazy images do not load until the panel is shown; and what is heavy in a panel and only for its visitors (the cards' faces, the splash) is not drawn at all
 * until it has been shown (`WhenPanelShown`, `usePanelShown`), so the server's markup does not carry nine posters and an SVG for every face of every panel.
 * The default panel (Featured) holds the splash alone, the page's first screen; the cards are the genres' panels'.
 */
export function GenrePanels({ panels }: { panels: readonly GenrePanel[] }) {
  const { idBase, selected, shown } = useGenreTabs();
  return (
    <>
      {panels.map(({ id, panel }) => (
        // Hidden by the `hidden` class (display:none), not the attribute: the attribute is `!important` in the base styles, which the deep link's style (genre-deep-link.ts) could not then show a panel over.
        <div key={id} role="tabpanel" id={panelId(idBase, id)} data-genre-panel={id} aria-labelledby={tabId(idBase, id)} className={id === selected ? undefined : "hidden"}>
          <PanelShownProvider value={id === selected || shown.has(id)}>{panel}</PanelShownProvider>
        </div>
      ))}
    </>
  );
}
