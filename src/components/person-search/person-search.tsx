"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
} from "react";
import { PersonAvatar } from "@/components/person-avatar";
import { Spinner } from "@/components/spinner";
import {
  ApiClientError,
  errorMessage,
  getJson,
  isAbortError,
  type ApiErrorKind,
} from "@/lib/api-client";
import {
  MAX_QUERY_LENGTH,
  MIN_QUERY_LENGTH,
  moveActive,
  normalizeQuery,
  type Move,
} from "@/lib/combobox";
import { MAX_PEOPLE, addState, extendedPeopleHref, isTimelineFull } from "@/lib/people-nav";
import { departmentLabel } from "@/lib/person-labels";
import type { PersonSearchResult } from "@/lib/types";

export interface PersonSearchProps {
  /** People already on the timeline. Picking a result appends to them (max 4 total). */
  peopleInView?: { id: number; name: string }[];
  size?: "hero" | "compact";
  autoFocus?: boolean;
}

const DEBOUNCE_MS = 200;
const CACHE_LIMIT = 50;
const NO_PEOPLE: { id: number; name: string }[] = [];

/** Results per normalized query for this tab, so backspacing does not spend rate limit. */
const resultCache = new Map<string, PersonSearchResult[]>();

function remember(query: string, results: PersonSearchResult[]) {
  resultCache.delete(query);
  resultCache.set(query, results);
  if (resultCache.size > CACHE_LIMIT) resultCache.delete(resultCache.keys().next().value!);
}

/** Results (or the failure) for one normalized query. Anything with another query is stale. */
interface SearchData {
  query: string;
  results: PersonSearchResult[];
  error: ApiErrorKind | null;
}

export function PersonSearch({
  peopleInView = NO_PEOPLE,
  size = "compact",
  autoFocus = false,
}: PersonSearchProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const baseId = useId();
  const listId = `${baseId}-listbox`;
  const optionId = (index: number) => `${baseId}-option-${index}`;

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [data, setData] = useState<SearchData | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [isNavigating, startNavigation] = useTransition();

  const hero = size === "hero";
  const q = normalizeQuery(query);
  const searchable = q.length >= MIN_QUERY_LENGTH;
  const full = isTimelineFull(peopleInView);
  // Data is "fresh" only for the query currently typed; older data is shown dimmed and inert.
  const fresh = searchable && data?.query === q;
  const loading = searchable && !fresh;
  const results = searchable && data ? data.results : [];
  const failure = fresh && data ? data.error : null;

  const disabledFlags = results.map(
    (result) => !fresh || addState(peopleInView, result.id) !== "can-add",
  );
  const listVisible = open && results.length > 0;
  const showPanel = open && (searchable || full);
  const activeId = listVisible && activeIndex >= 0 ? optionId(activeIndex) : undefined;

  useEffect(() => {
    if (q.length < MIN_QUERY_LENGTH) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const cached = resultCache.get(q);
      if (cached) {
        setData({ query: q, results: cached, error: null });
        return;
      }
      try {
        const body = await getJson<{ results: PersonSearchResult[] }>(
          `/api/search?q=${encodeURIComponent(q)}`,
          controller.signal,
        );
        // A newer keystroke aborts this controller, so late responses never overwrite newer state.
        if (controller.signal.aborted) return;
        remember(q, body.results);
        setData({ query: q, results: body.results, error: null });
      } catch (error) {
        if (controller.signal.aborted || isAbortError(error)) return;
        const kind = error instanceof ApiClientError ? error.kind : "server";
        setData({ query: q, results: [], error: kind });
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, attempt]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  function move(direction: Move) {
    setActiveIndex((current) => moveActive(disabledFlags, current, direction));
  }

  function select(result: PersonSearchResult) {
    const href = extendedPeopleHref(peopleInView, { id: result.id, name: result.name });
    if (!href) return;
    setOpen(false);
    setQuery("");
    setActiveIndex(-1);
    inputRef.current?.blur();
    startNavigation(() => router.push(href));
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp": {
        event.preventDefault();
        if (!showPanel) {
          setOpen(true);
          return;
        }
        move(event.key === "ArrowDown" ? "next" : "prev");
        return;
      }
      case "Home":
      case "End": {
        if (!listVisible || activeIndex < 0) return;
        event.preventDefault();
        move(event.key === "Home" ? "first" : "last");
        return;
      }
      case "Enter": {
        if (!listVisible || !fresh) return;
        // Enter without an arrowed-to option picks the top selectable result.
        const index = activeIndex >= 0 ? activeIndex : disabledFlags.findIndex((d) => !d);
        if (index < 0) return;
        event.preventDefault();
        select(results[index]);
        return;
      }
      case "Escape": {
        if (open) {
          event.preventDefault();
          setOpen(false);
          setActiveIndex(-1);
        } else if (query) {
          event.preventDefault();
          setQuery("");
        }
        return;
      }
    }
  }

  const status = failure
    ? errorMessage(failure, "search")
    : loading
      ? "Searching"
      : fresh
        ? results.length === 0
          ? "No one found"
          : `${results.length} ${results.length === 1 ? "result" : "results"}`
        : "";

  const busy = loading || isNavigating;

  return (
    <div className="relative w-full">
      <div
        className={`flex items-center gap-2.5 rounded-md border border-border bg-surface transition-colors focus-within:border-accent-green focus-within:ring-2 focus-within:ring-accent-green/50 ${
          hero ? "h-14 px-4 text-lg" : "h-9 px-3 text-sm"
        }`}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className={`shrink-0 text-muted ${hero ? "h-5 w-5" : "h-4 w-4"}`}
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label="Search people"
          aria-expanded={listVisible}
          aria-controls={listVisible ? listId : undefined}
          aria-activedescendant={activeId}
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-busy={busy || undefined}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="search"
          maxLength={MAX_QUERY_LENGTH}
          placeholder={
            full
              ? `Timeline is full (${MAX_PEOPLE} people)`
              : peopleInView.length > 0
                ? "Add a person…"
                : hero
                  ? "Search any film artist…"
                  : "Search people…"
          }
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setOpen(false);
            setActiveIndex(-1);
          }}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 bg-transparent text-strong outline-none! placeholder:text-muted"
        />
        {busy && <Spinner className={`shrink-0 text-muted ${hero ? "h-5 w-5" : "h-4 w-4"}`} />}
      </div>

      <div role="status" aria-live="polite" className="sr-only">
        {open ? status : ""}
      </div>

      {showPanel && (
        <div
          // Keep focus in the input while the pointer interacts with the panel.
          onMouseDown={(event) => event.preventDefault()}
          className="absolute inset-x-0 top-full z-50 mt-2 max-h-[min(28rem,55dvh)] overflow-y-auto overscroll-contain rounded-md border border-border bg-surface text-sm shadow-2xl shadow-black/60"
        >
          {full && (
            <p className="border-b border-border px-3 py-2.5 text-body">
              Up to {MAX_PEOPLE} people on a timeline.
            </p>
          )}

          {searchable && failure && (
            <div className="flex items-center justify-between gap-3 px-3 py-3">
              <p className="text-body">{errorMessage(failure, "search")}</p>
              <button
                type="button"
                onClick={() => {
                  setData(null);
                  setAttempt((n) => n + 1);
                }}
                className="shrink-0 rounded-md border border-border px-3 py-1.5 font-medium text-strong hover:bg-border"
              >
                Try again
              </button>
            </div>
          )}

          {searchable && fresh && !failure && results.length === 0 && (
            <p className="px-3 py-3 text-body">
              No one found for “<span className="text-strong">{q}</span>”.
            </p>
          )}

          {searchable && loading && results.length === 0 && (
            <p className="flex items-center gap-2 px-3 py-3 text-muted">
              <Spinner /> Searching…
            </p>
          )}

          {results.length > 0 && (
            <ul
              id={listId}
              role="listbox"
              aria-label="People"
              className={loading ? "opacity-60" : undefined}
            >
              {results.map((result, index) => {
                const state = addState(peopleInView, result.id);
                const disabled = disabledFlags[index];
                const active = index === activeIndex;
                const department = departmentLabel(result.knownFor);
                return (
                  <li
                    key={result.id}
                    id={optionId(index)}
                    role="option"
                    aria-selected={active}
                    aria-disabled={disabled || undefined}
                    onMouseMove={() => {
                      if (!disabled && !active) setActiveIndex(index);
                    }}
                    onClick={() => {
                      if (!disabled) select(result);
                    }}
                    className={`flex items-start gap-3 px-3 py-2.5 ${
                      disabled ? "cursor-default" : "cursor-pointer"
                    } ${active ? "bg-border shadow-[inset_3px_0_0_0_var(--green)]" : ""} ${
                      disabled && state !== "can-add" ? "opacity-60" : ""
                    }`}
                  >
                    <PersonAvatar name={result.name} profilePath={result.profilePath} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-medium text-strong">{result.name}</span>
                        {state === "in-view" && (
                          <span className="shrink-0 rounded border border-border px-1.5 py-0.5 text-xs text-body">
                            In timeline
                          </span>
                        )}
                      </span>
                      <span className="line-clamp-2 text-xs leading-snug text-muted">
                        {department && <span className="text-body">{department}</span>}
                        {department && result.knownForTitles.length > 0 && " · "}
                        {result.knownForTitles.join(", ")}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
