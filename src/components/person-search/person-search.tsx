"use client";

import { ArrowRight, X } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { useCollaborators } from "@/components/collaborators/use-collaborators";
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
  CHIPS_HINT,
  FULL_MESSAGE,
  addChip,
  addedMessage,
  chipsHref,
  commitTarget,
  decideKey,
  placeholderCopy,
  refusedMessage,
  removeChip,
  removeLastChip,
  removedMessage,
  type ChipPerson,
  type KeyContext,
  type SearchMode,
} from "@/lib/chip-input";
import {
  SKELETON_ROWS,
  SUGGESTIONS_LABEL,
  listedSuggestions,
  panelSection,
  suggestionDetail,
  suggestionTitle,
  suggestionsAnnouncement,
} from "@/lib/collaborator-suggest";
import {
  MAX_QUERY_LENGTH,
  MIN_QUERY_LENGTH,
  moveActive,
  normalizeQuery,
  type Move,
} from "@/lib/combobox";
import {
  MAX_PEOPLE,
  addState,
  dedupePeople,
  extendedPeopleHref,
  isTimelineFull,
} from "@/lib/people-nav";
import { departmentLabel } from "@/lib/person-labels";
import type { PersonSearchResult } from "@/lib/types";

export interface PersonSearchProps {
  /**
   * People already on the timeline. In "navigate" mode, picking a result appends to them (max 4
   * total). Chips mode starts from an empty field and ignores this.
   */
  peopleInView?: { id: number; name: string }[];
  size?: "hero" | "compact";
  autoFocus?: boolean;
  /**
   * "navigate" (default): picking a result goes straight to the extended timeline.
   * "chips": picking a result adds a chip to the field (like email recipients) and the timeline
   * opens from the chips, with Enter on an empty field or the Go button.
   */
  mode?: SearchMode;
  /** The field's accessible name. Defaults to "Search people"; a field whose visible label is gone names its job ("Add a person"). */
  ariaLabel?: string;
  /**
   * The id of the page's one person. Only the Add a person field of a one-person page sets it (in
   * "navigate" mode): while the field is empty its dropdown then offers that person's frequent
   * collaborators (loaded when the field is first focused), and typing brings the usual search back.
   * Without it the field never offers suggestions.
   */
  suggestFor?: number;
  /**
   * Let the dropdown be wider than the field from lg up (right-aligned with it), for a field that
   * sits at the right end of a row and is narrower than its rows want to be.
   */
  wideMenu?: boolean;
}

/** What picking an option needs, whether it is a search result or a suggested collaborator. */
type PickedPerson = Pick<PersonSearchResult, "id" | "name" | "profilePath">;

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
  mode = "navigate",
  ariaLabel = "Search people",
  suggestFor,
  wideMenu = false,
}: PersonSearchProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const announcementId = useRef(0);
  const baseId = useId();
  const listId = `${baseId}-listbox`;
  const hintId = `${baseId}-hint`;
  const groupLabelId = `${baseId}-group`;
  const optionId = (index: number) => `${baseId}-option-${index}`;

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [data, setData] = useState<SearchData | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [chips, setChips] = useState<ChipPerson[]>([]);
  const [announcement, setAnnouncement] = useState<{ id: number; text: string } | null>(null);
  const [isNavigating, startNavigation] = useTransition();
  // The suggestions are asked for the first time the field is focused, never before.
  const [asked, setAsked] = useState(false);
  const collaborators = useCollaborators(suggestFor ?? null, asked);

  const hero = size === "hero";
  const chipsMode = mode === "chips";
  // Who counts as "already added": the chips in chips mode, the people on the page otherwise.
  const added = chipsMode ? chips : peopleInView;
  const q = normalizeQuery(query);
  const searchable = q.length >= MIN_QUERY_LENGTH;
  const full = isTimelineFull(added);
  // Data is "fresh" only for the query currently typed; older data is shown dimmed and inert.
  const fresh = searchable && data?.query === q;
  const loading = searchable && !fresh;
  const results = searchable && data ? data.results : [];
  const failure = fresh && data ? data.error : null;

  // With no text, a one-person page's field offers the frequent collaborators; any text is a search.
  const onSuggestions =
    panelSection(suggestFor !== undefined && !chipsMode, q, collaborators.status) === "suggestions";
  const suggestions = collaborators.status === "ready" ? listedSuggestions(collaborators.results) : [];
  // The options on screen, whichever list they belong to: the keyboard rows (activeIndex) index this one.
  const options: readonly PickedPerson[] = onSuggestions ? suggestions : results;

  const disabledFlags = options.map(
    (option) => (!onSuggestions && !fresh) || addState(added, option.id) !== "can-add",
  );
  const listVisible = open && options.length > 0;
  const showPanel = open && (searchable || full || onSuggestions);
  const activeId = listVisible && activeIndex >= 0 ? optionId(activeIndex) : undefined;

  const keyContext: KeyContext = {
    mode,
    chipCount: chips.length,
    text: query,
    open,
    panelShown: showPanel,
    listVisible,
    fresh: onSuggestions || fresh,
    activeIndex,
    disabled: disabledFlags,
  };
  // The row a commit key (Tab or Enter) would add right now; it gets a "Tab" key hint.
  const target = chipsMode ? commitTarget(keyContext) : null;

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

  function announce(text: string) {
    announcementId.current += 1;
    setAnnouncement({ id: announcementId.current, text });
  }

  /** Chips mode: turn a suggestion into a chip. The input clears and keeps focus. */
  function addPerson(result: PickedPerson) {
    const outcome = addChip(chips, {
      id: result.id,
      name: result.name,
      profilePath: result.profilePath,
    });
    if (!outcome.ok) {
      announce(refusedMessage(outcome.reason, result.name));
      return;
    }
    setChips(outcome.chips);
    setQuery("");
    setOpen(false);
    setActiveIndex(-1);
    announce(addedMessage(result.name, outcome.chips.length));
    inputRef.current?.focus({ preventScroll: true });
  }

  function removePerson(outcome: { chips: ChipPerson[]; removed: ChipPerson | null }) {
    if (!outcome.removed) return;
    setChips(outcome.chips);
    announce(removedMessage(outcome.removed.name, outcome.chips.length));
    inputRef.current?.focus({ preventScroll: true });
  }

  /** Chips mode: open the timeline built from the chips. */
  function submit() {
    const href = chipsHref(chips);
    if (!href || isNavigating) return;
    setOpen(false);
    setActiveIndex(-1);
    inputRef.current?.blur();
    startNavigation(() => router.push(href));
  }

  function select(result: PickedPerson) {
    if (chipsMode) {
      addPerson(result);
      return;
    }
    // The query of this page, read now: the new page opens on the tab (Timeline or Table) this one shows.
    const href = extendedPeopleHref(peopleInView, { id: result.id, name: result.name }, window.location.search);
    if (!href) return;
    setOpen(false);
    setQuery("");
    setActiveIndex(-1);
    inputRef.current?.blur();
    startNavigation(() => router.push(href));
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const action = decideKey(keyContext, {
      key: event.key,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      isComposing: event.nativeEvent.isComposing,
      repeat: event.repeat,
    });
    // Anything but "none" is ours; "none" leaves the browser alone (so Tab and Shift+Tab move
    // focus unless Tab is committing a suggestion).
    if (action.type === "none") {
      // Enter on a name when there is no room left: say why nothing happened.
      if (chipsMode && event.key === "Enter" && full && q) announce(refusedMessage("full", ""));
      return;
    }
    event.preventDefault();

    switch (action.type) {
      case "open":
        setOpen(true);
        return;
      case "move":
        move(action.direction);
        return;
      case "commit":
        select(options[action.index]);
        return;
      case "submit":
        submit();
        return;
      case "remove-last":
        removePerson(removeLastChip(chips));
        return;
      case "close":
        setOpen(false);
        setActiveIndex(-1);
        return;
      case "clear":
        setQuery("");
        setActiveIndex(-1);
        return;
    }
  }

  /** Chips mode: a click on the field's padding, icon or gaps puts the cursor in the input. */
  function focusFromField(event: MouseEvent<HTMLDivElement>) {
    if ((event.target as Element).closest("input, button")) return;
    event.preventDefault();
    inputRef.current?.focus();
  }

  const searchStatus = onSuggestions
    ? suggestionsAnnouncement(collaborators.status, suggestions.length)
    : failure
      ? errorMessage(failure, "search")
      : loading
        ? "Searching"
        : fresh
          ? results.length === 0
            ? "No one found"
            : `${results.length} ${results.length === 1 ? "result" : "results"}`
          : "";
  // The panel shows "Up to 4 people." when the field is full; say it too.
  const status = chipsMode && full ? `${FULL_MESSAGE}. ${searchStatus}`.trim() : searchStatus;

  const busy = loading || isNavigating;

  // One text line: the input and chips sit on rows this tall, so a one-row field is exactly as
  // tall as the old single-line input (h-14 hero, h-9 compact) and wrapped rows stay even.
  const rowHeight = hero ? "h-10" : "h-7";
  const copy = placeholderCopy({
    mode,
    size,
    peopleInViewCount: dedupePeople(peopleInView).length,
    chipCount: chips.length,
  });
  // With chips the input shares its row, so the hint swaps wording by the input's own width
  // (container queries) instead of being cut off mid-sentence by a native placeholder.
  const overlayPlaceholder = chipsMode && chips.length > 0;
  const iconSize = hero ? "h-5 w-5" : "h-4 w-4";

  return (
    <div className="relative w-full">
      <div
        onMouseDown={chipsMode ? focusFromField : undefined}
        className={`flex items-start gap-2.5 rounded-md border border-border bg-surface transition-colors focus-within:border-accent-green focus-within:ring-2 focus-within:ring-accent-green/50 ${
          hero
            ? `min-h-14 py-[7px] text-lg ${chipsMode ? "px-3 sm:px-4" : "px-4"}`
            : "min-h-9 px-3 py-[3px] text-sm"
        }`}
      >
        {/* On a phone the icon yields its width to the chips once there are any. */}
        <span
          className={`shrink-0 items-center ${rowHeight} ${
            chipsMode && chips.length > 0 ? "hidden sm:flex" : "flex"
          }`}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className={`text-muted ${iconSize}`}
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
        </span>

        {/*
          Chips wrap and the input takes the rest of the last row. In the DOM the input comes
          first and the chips (with their remove buttons) after it, so Tab from the previous
          control lands in the input, not on a chip; `order` puts the chips visually first.
        */}
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-1">
          <div
            className={`@container relative order-2 flex-1 ${rowHeight} ${
              chipsMode ? (hero ? "min-w-52" : "min-w-36") : "min-w-0"
            }`}
          >
            <input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-label={ariaLabel}
              aria-expanded={listVisible}
              aria-controls={listVisible ? listId : undefined}
              aria-activedescendant={activeId}
              aria-autocomplete="list"
              aria-haspopup="listbox"
              aria-describedby={chipsMode ? hintId : undefined}
              aria-busy={busy || undefined}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              enterKeyHint={
                chipsMode ? (chips.length > 0 && query === "" ? "go" : "next") : "search"
              }
              maxLength={MAX_QUERY_LENGTH}
              placeholder={overlayPlaceholder ? undefined : copy.long}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setOpen(true);
                setActiveIndex(-1);
              }}
              onFocus={() => {
                setOpen(true);
                if (suggestFor !== undefined) setAsked(true);
              }}
              onBlur={() => {
                setOpen(false);
                setActiveIndex(-1);
              }}
              onKeyDown={onKeyDown}
              className="h-full w-full min-w-0 bg-transparent text-strong outline-none! placeholder:text-muted"
            />
            {overlayPlaceholder && query === "" && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 flex items-center text-muted"
              >
                <span className="truncate">
                  <span className={hero ? "@sm:hidden" : "@xs:hidden"}>{copy.short}</span>
                  <span className={hero ? "hidden @sm:inline" : "hidden @xs:inline"}>
                    {copy.long}
                  </span>
                </span>
              </span>
            )}
          </div>

          {chipsMode && chips.length > 0 && (
            <ul role="list" aria-label="Selected people" className="contents">
              {chips.map((chip) => (
                <li
                  key={chip.id}
                  role="listitem"
                  className={`order-1 inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full bg-border text-strong ${
                    hero ? "h-8 pl-1 pr-1 text-sm sm:text-base" : "h-6 pl-0.5 pr-0.5 text-xs"
                  }`}
                >
                  <PersonAvatar
                    name={chip.name}
                    profilePath={chip.profilePath}
                    size={hero ? 24 : 20}
                  />
                  <span className="min-w-0 truncate font-medium">{chip.name}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${chip.name}`}
                    // Pointer clicks must not pull focus out of the input and close the list.
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => removePerson(removeChip(chips, chip.id))}
                    className={`grid shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface hover:text-strong ${
                      hero ? "h-6 w-6" : "h-5 w-5"
                    }`}
                  >
                    <X aria-hidden="true" className={hero ? "h-4 w-4" : "h-3.5 w-3.5"} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {(chipsMode || busy) && (
          <div className={`flex shrink-0 items-center gap-2.5 ${rowHeight} ${chipsMode ? "self-end" : ""}`}>
            {(chipsMode ? loading : busy) && <Spinner className={`text-muted ${iconSize}`} />}
            {chipsMode && (
              <button
                type="button"
                aria-label="Show timeline"
                aria-busy={isNavigating || undefined}
                disabled={chips.length === 0 || isNavigating}
                onClick={submit}
                className={`grid shrink-0 place-items-center rounded-md bg-accent-green text-on-accent transition-colors hover:bg-accent-green-hover disabled:opacity-40 disabled:hover:bg-accent-green ${
                  hero ? "h-8 w-8" : "h-6 w-6"
                }`}
              >
                {isNavigating ? (
                  <Spinner className={iconSize} />
                ) : (
                  <ArrowRight aria-hidden="true" className={iconSize} />
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {chipsMode && (
        <p id={hintId} className="sr-only">
          {CHIPS_HINT}
        </p>
      )}

      <div role="status" aria-live="polite" className="sr-only">
        {open ? status : ""}
      </div>
      {chipsMode && (
        <div role="status" aria-live="polite" className="sr-only">
          {announcement && <span key={announcement.id}>{announcement.text}</span>}
        </div>
      )}

      {showPanel && (
        <div
          // Keep focus in the input while the pointer interacts with the panel.
          onMouseDown={(event) => event.preventDefault()}
          className={`absolute inset-x-0 top-full z-50 mt-2 max-h-[min(28rem,55dvh)] overflow-y-auto overscroll-contain rounded-md border border-border bg-surface text-sm shadow-2xl shadow-black/60 ${
            wideMenu ? "lg:left-auto lg:w-[22rem]" : ""
          }`}
        >
          {full && (
            <p className="border-b border-border px-3 py-2.5 text-body">
              Up to {MAX_PEOPLE} people{chipsMode ? "." : " on a timeline."}
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

          {onSuggestions && collaborators.status === "loading" && (
            // Skeleton rows hold the place of the first request's answer; they are not options.
            <div aria-hidden="true" className="py-1">
              <p className="px-3 pb-1 pt-2 text-xs font-medium text-muted">{SUGGESTIONS_LABEL}</p>
              {Array.from({ length: SKELETON_ROWS }, (_, row) => (
                <div key={row} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="size-10 shrink-0 rounded-full bg-border motion-safe:animate-pulse" />
                  <span className="flex flex-1 flex-col gap-2">
                    <span className="h-3 w-2/5 rounded bg-border motion-safe:animate-pulse" />
                    <span className="h-2.5 w-3/5 rounded bg-border/70 motion-safe:animate-pulse" />
                  </span>
                </div>
              ))}
            </div>
          )}

          {onSuggestions && suggestions.length > 0 && (
            <div id={listId} role="listbox" aria-label="People">
              <div role="group" aria-labelledby={groupLabelId}>
                <p id={groupLabelId} className="px-3 pb-1 pt-2.5 text-xs font-medium text-muted">
                  {SUGGESTIONS_LABEL}
                </p>
                {suggestions.map((suggestion, index) => {
                  const disabled = disabledFlags[index];
                  const active = index === activeIndex;
                  return (
                    <div
                      key={suggestion.id}
                      id={optionId(index)}
                      role="option"
                      aria-selected={active}
                      aria-disabled={disabled || undefined}
                      title={suggestionTitle(suggestion) ?? undefined}
                      onMouseMove={() => {
                        if (!disabled && !active) setActiveIndex(index);
                      }}
                      onClick={() => {
                        if (!disabled) select(suggestion);
                      }}
                      className={`flex items-center gap-3 px-3 py-2.5 ${
                        disabled ? "cursor-default opacity-60" : "cursor-pointer"
                      } ${active ? "bg-border shadow-[inset_3px_0_0_0_var(--green)]" : ""}`}
                    >
                      <PersonAvatar name={suggestion.name} profilePath={suggestion.profilePath} size={40} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-strong">{suggestion.name}</span>
                        <span className="line-clamp-2 text-xs leading-snug text-muted">
                          {suggestionDetail(suggestion)}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {results.length > 0 && (
            <ul
              id={listId}
              role="listbox"
              aria-label="People"
              className={loading ? "opacity-60" : undefined}
            >
              {results.map((result, index) => {
                const state = addState(added, result.id);
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
                            {chipsMode ? "Added" : "In timeline"}
                          </span>
                        )}
                      </span>
                      <span className="line-clamp-2 text-xs leading-snug text-muted">
                        {department && <span className="text-body">{department}</span>}
                        {department && result.knownForTitles.length > 0 && " · "}
                        {result.knownForTitles.join(", ")}
                      </span>
                    </span>
                    {target?.index === index && (
                      // Only where a keyboard is likely; touch users just tap the row.
                      <kbd
                        aria-hidden="true"
                        className="mt-0.5 hidden shrink-0 rounded border border-border px-1.5 py-0.5 font-sans text-[11px] font-medium text-muted pointer-fine:inline-block"
                      >
                        Tab
                      </kbd>
                    )}
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
