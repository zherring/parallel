"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffectEvent, useLayoutEffect, useMemo, useRef, useSyncExternalStore, type MouseEvent, type ReactNode } from "react";
import { rememberOpener, takeOpener, useRememberPressed } from "@/components/side-panel/side-panel";
import type { ElementLike } from "@/lib/hero-keys";
import { describeShortcutTarget, isApplePlatform, peopleKeyAction, platformName, shortcutKeys } from "@/lib/people-shortcut";

type SearchScope = "site" | "page";

interface SearchSurface {
  open: boolean;
  dialogAttribute: string;
  show: (opener: Element | null) => void;
  hide: () => void;
}

interface RegisteredSurface extends SearchSurface {
  pathname: string;
}

interface SearchContextValue {
  show: (opener: Element | null) => void;
  register: (scope: SearchScope, surface: RegisteredSurface) => () => void;
}

const SearchContext = createContext<SearchContextValue | null>(null);

/** One shortcut listener for the whole site. A page can supply its contextual search without owning another listener. */
export function SearchProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const surfaces = useRef<Partial<Record<SearchScope, RegisteredSurface>>>({});
  useRememberPressed();

  const register = useCallback((scope: SearchScope, surface: RegisteredSurface) => {
    surfaces.current[scope] = surface;
    return () => {
      // A retiring page must not unregister the new page's search during a view transition.
      if (surfaces.current[scope] === surface) delete surfaces.current[scope];
    };
  }, []);

  const activeSurface = useCallback(() => {
    return [surfaces.current.page, surfaces.current.site].find((surface) => surface?.pathname === pathname);
  }, [pathname]);
  const show = useCallback((opener: Element | null) => activeSurface()?.show(opener), [activeSurface]);

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    const surface = activeSurface();
    if (!surface) return;
    const target = event.target instanceof Element ? (event.target as ElementLike) : null;
    const action = peopleKeyAction(
      event,
      {
        mac: isApplePlatform(platformName()),
        open: surface.open,
        target: describeShortcutTarget(target, surface.dialogAttribute),
      },
    );
    if (!action) return;
    event.preventDefault();
    if (action === "swallow") return;
    if (action === "toggle" && !surface.open) surface.show(takeOpener());
    else surface.hide();
  });

  useLayoutEffect(() => {
    const listener = (event: KeyboardEvent) => onKeyDown(event);
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, []);

  const value = useMemo(() => ({ show, register }), [show, register]);
  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
}

export function useSearch() {
  const context = useContext(SearchContext);
  if (!context) throw new Error("useSearch is used outside a SearchProvider");
  return context;
}

const subscribeNothing = () => () => {};

/**
 * What a button that opens the universal search needs (the site header's `SearchButton`, the landing bar's field): whether the page is live yet, which platform's shortcut to
 * name, and the attributes of the button itself (`buttonProps`, spread on it; `open` is its click).
 */
export function useSearchTrigger() {
  const { show } = useSearch();
  // A hard navigation (including back to a 404) can show a trigger before its click handler is hydrated: until then a click does nothing.
  const hydrated = useSyncExternalStore(subscribeNothing, () => true, () => false);
  // The platform is known in the browser only: the server's markup and the hydrating render say Ctrl K, and the render after says the real one.
  const mac = useSyncExternalStore(subscribeNothing, () => isApplePlatform(platformName()), () => false);
  const open = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      // The control itself, which no browser gets wrong (a pointer's click and a key's alike).
      rememberOpener(event.currentTarget);
      show(takeOpener());
    },
    [show],
  );
  const buttonProps = { type: "button", disabled: !hydrated, "aria-haspopup": "dialog", "aria-keyshortcuts": shortcutKeys(mac), onClick: open } as const;
  return { hydrated, mac, open, buttonProps };
}

/** Page search takes precedence over the site's new-timeline search. Registration expires with its route. */
export function useSearchSurface(scope: SearchScope, { open, dialogAttribute, show, hide }: SearchSurface) {
  const pathname = usePathname();
  const { register } = useSearch();
  useLayoutEffect(
    () => register(scope, { pathname, open, dialogAttribute, show, hide }),
    [register, scope, pathname, open, dialogAttribute, show, hide],
  );
}
