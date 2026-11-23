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
import { useTeams } from "@/components/collaborators/use-teams";
import { PersonAvatar } from "@/components/person-avatar";
import { SearchCategoryTabs } from "@/components/person-search/search-category-tabs";
import { SearchResultOption } from "@/components/person-search/search-result-option";
import { Spinner } from "@/components/spinner";
import {
  ApiClientError,
  errorMessage,
  getJson,
  isAbortError,
  type ApiErrorKind,
} from "@/lib/api-client";
import {
  BACON,
  BACON_ENTERED_MESSAGE,
  BACON_FULL_MESSAGE,
  BACON_LEFT_MESSAGE,
  BACON_MODE_LABEL,
  BACON_MODE_MAX,
  BACON_MODE_RULE,
  BACON_SUGGESTIONS_LABEL,
  BACON_TEAMS_ERROR,
  BACON_TEAMS_LABEL,
  allCheckedForMode,
  baconAddedMessage,
  baconFullRule,
  baconModeOffer,
  baconPageHref,
  baconPlaceholder,
  carryBaconMode,
  teamOption,
  orderForMode,
  togetherNote,
  workedWithBacon,
  type ModeOption,
} from "@/lib/bacon-mode";
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
  SUGGESTION_LIMIT,
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
import { searchSections, type SearchCategory } from "@/lib/search-sections";
import type { PairingSearchResult, PeopleSearchResponse, PersonSearchResult } from "@/lib/types";

export interface PersonSearchProps {
  /**
   * People already on the timeline. In "navigate" mode, picking a result appends to them (max 4
   * total). Chips mode starts from an empty field and ignores this.
   */
  peopleInView?: readonly { id: number; name: string }[];
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
  /**
   * The page the field is on is in Kevin Bacon mode (see `bacon-mode.ts`), in "navigate" mode: the field keeps the mode's rules, as
   * the landing field does once the mode is chosen there. Only people who share a film with him can be picked, and the page holds two.
   */
  baconMode?: boolean;
  /**
   * Called when Escape is pressed with nothing in the field to dismiss: no text and no dropdown on screen. The key is
   * then the owner's (it is consumed here, so a document-level Escape listener does not also run); with text or a
   * dropdown, Escape clears or closes those first, as ever.
   */
  onIdleEscape?: () => void;
  /**
   * In "navigate" mode: called with the person picked, in place of going to the page that has them. The field keeps focus, clears and closes its list, and
   * says what happened; the owner stages the change and the page changes later (see `PeopleStagingProvider`: the people pill's card and the ⌘K search,
   * which would otherwise redraw the screen behind them as soon as someone was picked). `peopleInView` is then the people as the owner will have them.
   */
  onPick?: (person: PickedPerson) => void;
  /** Called after a timeline navigation starts (e.g. to dismiss a search dialog). */
  onNavigate?: () => void;
}

/** What picking an option needs, whether it is a search result or a suggested collaborator. */
export type PickedPerson = Pick<PersonSearchResult, "id" | "name" | "profilePath">;
type SearchOption = PickedPerson | PairingSearchResult | ModeOption;

const DEBOUNCE_MS = 200;
const CACHE_LIMIT = 50;
const NO_PEOPLE: { id: number; name: string }[] = [];

/** Results per normalized query for this tab, so backspacing does not spend rate limit. */
const resultCache = new Map<string, PeopleSearchResponse>();

function remember(query: string, results: PeopleSearchResponse) {
  resultCache.delete(query);
  resultCache.set(query, results);
  if (resultCache.size > CACHE_LIMIT) resultCache.delete(resultCache.keys().next().value!);
}

/** Results (or the failure) for one normalized query. Anything with another query is stale. */
interface SearchData extends PeopleSearchResponse {
  query: string;
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
  baconMode = false,
  onIdleEscape,
  onPick,
  onNavigate,
}: PersonSearchProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLUListElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const announcementId = useRef(0);
  const baseId = useId();
  const listId = `${baseId}-listbox`;
  const hintId = `${baseId}-hint`;
  const groupLabelId = `${baseId}-group`;
  const optionId = (index: number) => `${baseId}-option-${index}`;

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [category, setCategory] = useState<SearchCategory>("all");
  const [data, setData] = useState<SearchData | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [chips, setChips] = useState<ChipPerson[]>([]);
  // Kevin Bacon mode (src/lib/bacon-mode.ts): entered from the row a search for him offers, left by removing his chip. On a page that is in the mode, it is the page's.
  const [entered, setEntered] = useState(false);
  const bacon = entered || baconMode;
  const [announcement, setAnnouncement] = useState<{ id: number; text: string } | null>(null);
  const [isNavigating, startNavigation] = useTransition();
  // The suggestions are asked for the first time the field is focused, never before.
  const [asked, setAsked] = useState(false);
  // In the mode the empty field offers the people he works with most, as a one-person page's field does. His graph row is thin (3), so the mode asks for
  // the list to be filled to what the dropdown shows; nobody else's list is, and neither is his outside the mode.
  const suggestionsFor = suggestFor ?? (bacon ? BACON.id : null);
  const collaborators = useCollaborators(suggestionsFor, asked || entered, bacon && suggestionsFor === BACON.id ? SUGGESTION_LIMIT : undefined);
  // The teams (two people who made films with him together) are the landing field's, with him alone in it: a team opens the page of the three.
  const teams = useTeams(entered ? BACON.id : null, entered);

  const hero = size === "hero";
  const chipsMode = mode === "chips";
  // Who counts as "already added": the chips in chips mode, the people on the page otherwise.
  const added = chipsMode ? chips : peopleInView;
  const q = normalizeQuery(query);
  const searchable = q.length >= MIN_QUERY_LENGTH;
  const cap = bacon ? BACON_MODE_MAX : MAX_PEOPLE;
  const full = isTimelineFull(added, cap);
  const fullMessage = bacon ? BACON_FULL_MESSAGE : FULL_MESSAGE;
  // Data is "fresh" only for the query currently typed; older data is shown dimmed and inert.
  const fresh = searchable && data?.query === q;
  const loading = searchable && !fresh;
  // In the mode, the people who have worked with him come first; the others are listed but cannot be added.
  const results = searchable && data ? (bacon ? orderForMode(data.results) : data.results) : [];
  // A search for Kevin Bacon offers the mode, straight after him.
  const modeOffer = chipsMode && searchable ? baconModeOffer(results, { chipCount: chips.length, active: bacon }) : null;
  // Pairing shortcuts start a new timeline; never replace chips or a page's staged people.
  const availablePairings = searchable && data && chipsMode && chips.length === 0 ? data.pairings : [];
  const hasCategories = chipsMode && chips.length === 0 && searchable;
  // Keep stale rows in their old order, inert, until the new query's response replaces them.
  const sections = searchSections(data?.query ?? q, results, availablePairings, hasCategories ? category : "all", modeOffer);
  const searchOptions = sections.flatMap((section) => section.options);
  const pairingCount = searchOptions.filter((option) => "href" in option).length;
  const artistCount = searchOptions.filter((option) => !("href" in option) && !("mode" in option)).length;
  const failure = fresh && data ? data.error : null;

  // With no text, a one-person page's field offers the frequent collaborators; any text is a search.
  const onSuggestions =
    panelSection((suggestFor !== undefined && !chipsMode) || (bacon && !full), q, collaborators.status) === "suggestions";
  const suggestionsLabel = bacon ? BACON_SUGGESTIONS_LABEL : SUGGESTIONS_LABEL;
  const suggestions = collaborators.status === "ready" ? listedSuggestions(collaborators.results) : [];
  const teamsListed = onSuggestions && entered && chips.length === 1;
  const teamOptions = teamsListed && teams.status === "ready" ? teams.results.map(teamOption) : [];
  // The options on screen, whichever list they belong to: the keyboard rows (activeIndex) index this one. The teams follow the suggestions.
  const options: readonly SearchOption[] = onSuggestions ? [...suggestions, ...teamOptions] : searchOptions;

  /** Why a person's row cannot be picked, if it cannot: no room or already added, or (a search result in the mode) no film with him. */
  const blocked = (option: PickedPerson) =>
    addState(added, option.id, cap) !== "can-add" || (bacon && !onSuggestions && !workedWithBacon(option as PersonSearchResult));
  const disabledFlags = options.map(
    (option) => (!onSuggestions && !fresh) || (!("href" in option) && !("mode" in option) && blocked(option)),
  );
  const listVisible = open && options.length > 0;
  // The mode's dropdown always has its rule to show.
  const showPanel = open && (searchable || full || onSuggestions || bacon);
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
  // The row Enter would choose right now; it gets an "Enter" key hint.
  const target = chipsMode ? commitTarget(keyContext) : null;

  useEffect(() => {
    if (q.length < MIN_QUERY_LENGTH) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      // The mode's answers are their own: each result says whether it has a film with him.
      const cacheKey = bacon ? `with:${BACON.id}:${q}` : q;
      const cached = resultCache.get(cacheKey);
      if (cached) {
        setData({ query: q, ...cached, error: null });
        return;
      }
      try {
        const body = await getJson<PeopleSearchResponse>(
          `/api/search?q=${encodeURIComponent(q)}${bacon ? `&with=${BACON.id}` : ""}`,
          controller.signal,
        );
        // A newer keystroke aborts this controller, so late responses never overwrite newer state.
        if (controller.signal.aborted) return;
        const response = { results: body.results, pairings: body.pairings ?? [] };
        // A mode's answer with a result that could not be checked is shown but not kept: typing it again asks again.
        if (!bacon || allCheckedForMode(body.results)) remember(cacheKey, response);
        setData({ query: q, ...response, error: null });
      } catch (error) {
        if (controller.signal.aborted || isAbortError(error)) return;
        const kind = error instanceof ApiClientError ? error.kind : "server";
        setData({ query: q, results: [], pairings: [], error: kind });
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, attempt, bacon]);

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
    const outcome = addChip(chips, { id: result.id, name: result.name, profilePath: result.profilePath }, cap);
    if (!outcome.ok) {
      announce(bacon && outcome.reason === "full" ? `${BACON_FULL_MESSAGE}.` : refusedMessage(outcome.reason, result.name));
      return;
    }
    setChips(outcome.chips);
    setCategory("all");
    setQuery("");
    setOpen(false);
    setActiveIndex(-1);
    announce(bacon ? baconAddedMessage(result.name) : addedMessage(result.name, outcome.chips.length));
    inputRef.current?.focus({ preventScroll: true });
  }

  function removePerson(outcome: { chips: ChipPerson[]; removed: ChipPerson | null }) {
    if (!outcome.removed) return;
    setChips(outcome.chips);
    if (bacon && outcome.removed.id === BACON.id) {
      // Without him there is no mode: the field is the ordinary one again, with whoever else was in it.
      setEntered(false);
      setData(null);
      announce(BACON_LEFT_MESSAGE);
    } else {
      announce(removedMessage(outcome.removed.name, outcome.chips.length));
    }
    inputRef.current?.focus({ preventScroll: true });
  }

  /** Chips mode: Kevin Bacon mode starts with him in the field, and the list open on the people he works with most. */
  function enterBaconMode(option: ModeOption) {
    setEntered(true);
    setChips([{ ...option.person }]);
    setData(null);
    setCategory("all");
    setQuery("");
    setOpen(true);
    setActiveIndex(-1);
    announce(BACON_ENTERED_MESSAGE);
    inputRef.current?.focus({ preventScroll: true });
  }

  /** Chips mode: open the timeline built from the chips. */
  function submit() {
    // The mode goes on to the page it opens.
    const href = entered ? baconPageHref(chips) : chipsHref(chips);
    if (!href || isNavigating) return;
    setOpen(false);
    setActiveIndex(-1);
    inputRef.current?.blur();
    startNavigation(() => {
      router.push(href);
      onNavigate?.();
    });
  }

  function select(result: PickedPerson) {
    if (chipsMode) {
      addPerson(result);
      return;
    }
    if (onPick) {
      onPick({ id: result.id, name: result.name, profilePath: result.profilePath });
      setOpen(false);
      setQuery("");
      setActiveIndex(-1);
      announce(`Added ${result.name}. The page changes when you close this.`);
      // Focus stays in the field: another person can be added.
      return;
    }
    // The query of this page, read now: the new page opens on the tab (Timeline or Table) this one shows.
    const extended = extendedPeopleHref(peopleInView, { id: result.id, name: result.name }, window.location.search);
    if (!extended) return;
    const href = carryBaconMode(extended, window.location.search, peopleInView.map((person) => person.id));
    setOpen(false);
    setQuery("");
    setActiveIndex(-1);
    inputRef.current?.blur();
    startNavigation(() => {
      router.push(href);
      onNavigate?.();
    });
  }

  function selectOption(option: SearchOption) {
    if ("mode" in option) {
      enterBaconMode(option);
      return;
    }
    if (!("href" in option)) {
      select(option);
      return;
    }
    if (isNavigating) return;
    setOpen(false);
    setQuery("");
    setActiveIndex(-1);
    inputRef.current?.blur();
    startNavigation(() => {
      router.push(option.href);
      onNavigate?.();
    });
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    // The "popup wanted" flag is set by focus alone, so an empty field that shows nothing still counts as open to
    // `decideKey` and would swallow this Escape; the owner gets it instead.
    if (event.key === "Escape" && onIdleEscape && !query && !showPanel) {
      event.preventDefault();
      setOpen(false);
      setActiveIndex(-1);
      onIdleEscape();
      return;
    }
    const action = decideKey(keyContext, {
      key: event.key,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      isComposing: event.nativeEvent.isComposing,
      repeat: event.repeat,
    });
    // Anything but "none" is ours; Tab and Shift+Tab always move focus without selecting.
    if (action.type === "none") {
      // Enter on a name when there is no room left: say why nothing happened.
      if (chipsMode && event.key === "Enter" && full && q) announce(`${fullMessage}.`);
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
        selectOption(options[action.index]);
        return;
      case "submit":
        submit();
        return;
      case "remove-last":
        removePerson(removeLastChip(chips));
        return;
      case "close":
        inputRef.current?.focus({ preventScroll: true });
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
    ? [suggestionsAnnouncement(collaborators.status, suggestions.length), teamsListed && teams.status === "error" ? `${BACON_TEAMS_ERROR}.` : ""].filter(Boolean).join(" ")
    : failure
      ? errorMessage(failure, "search")
      : loading
        ? "Searching"
        : fresh
          ? results.length === 0
            ? "No one found"
            : hasCategories && category === "pairings" && pairingCount === 0
              ? "No curated pairings for this search"
              : [artistCount ? `${artistCount} ${artistCount === 1 ? "artist" : "artists"}` : "", pairingCount ? `${pairingCount} ${pairingCount === 1 ? "pairing" : "pairings"}` : ""].filter(Boolean).join(" and ")
          : "";
  // The panel shows "Up to 4 people." when the field is full; say it too.
  const status = chipsMode && full ? `${fullMessage}. ${searchStatus}`.trim() : searchStatus;

  const busy = loading || isNavigating;

  // One text line: the input and chips sit on rows this tall, so a one-row field is exactly as
  // tall as the old single-line input (h-14 hero, h-9 compact) and wrapped rows stay even.
  const rowHeight = hero ? "h-10" : "h-7";
  const copy = bacon
    ? baconPlaceholder(added.length, !chipsMode)
    : placeholderCopy({ mode, size, peopleInViewCount: dedupePeople(peopleInView).length, chipCount: chips.length });
  // With chips the input shares its row, so the hint swaps wording by the input's own width
  // (container queries) instead of being cut off mid-sentence by a native placeholder.
  const overlayPlaceholder = chipsMode && chips.length > 0;
  const iconSize = hero ? "h-5 w-5" : "h-4 w-4";

  return (
    <div
      className="relative w-full"
      // The mode's colours: inside this element the action colour is the orange (globals.css).
      data-bacon-mode={bacon ? "" : undefined}
      onBlur={(event) => {
        if (event.currentTarget.contains(event.relatedTarget)) return;
        setOpen(false);
        setActiveIndex(-1);
      }}
    >
      <div
        data-search-box
        onMouseDown={chipsMode ? focusFromField : undefined}
        // `--search-radius` is the host's to set (the open people pill gives it the page bar's radius, `--bar-radius`); the usual box is `rounded-md`.
        className={`flex items-start gap-2.5 rounded-[var(--search-radius,var(--radius-md))] border border-border bg-surface transition-colors focus-within:border-focus focus-within:ring-2 focus-within:ring-focus/50 ${
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
          {/* With chips the input keeps a usable width and drops to its own row when the row is too narrow; the minimum is capped at the row's own width, so on a narrow screen (or a 320px reflow) it never runs past the field into the Show timeline button. */}
          <div
            className={`@container relative order-2 flex-1 ${rowHeight} ${
              chipsMode ? (hero ? "min-w-[min(13rem,100%)]" : "min-w-[min(9rem,100%)]") : "min-w-0"
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
                if (panelRef.current) panelRef.current.scrollTop = 0;
              }}
              onFocus={() => {
                setOpen(true);
                if (suggestFor !== undefined) setAsked(true);
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
              {chips.map((chip) => {
                // His chip is the mode's own: orange, and removing it leaves the mode.
                const modeChip = bacon && chip.id === BACON.id;
                return (
                <li
                  key={chip.id}
                  role="listitem"
                  data-mode-chip={modeChip ? "" : undefined}
                  className={`order-1 inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full ${modeChip ? "bg-accent-orange text-on-accent" : "bg-border text-strong"} ${
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
                    aria-label={modeChip ? `Remove ${chip.name} and leave ${BACON_MODE_LABEL}` : `Remove ${chip.name}`}
                    // Pointer clicks must not pull focus out of the input and close the list.
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => removePerson(removeChip(chips, chip.id))}
                    // The hero's 24px button gets a 44px-wide hit area; it is 36px tall because
                    // chip rows are 36px apart (32px chip + 4px gap), so each reaches only the
                    // middle of the gap and wrapped chips' hit areas never overlap.
                    className={`grid shrink-0 place-items-center rounded-full transition-colors ${
                      modeChip ? "text-on-accent hover:bg-on-accent/15" : "text-muted hover:bg-surface hover:text-strong"
                    } ${
                      hero
                        ? "relative h-6 w-6 before:absolute before:-inset-x-2.5 before:-inset-y-1.5"
                        : "h-5 w-5"
                    }`}
                  >
                    <X aria-hidden="true" className={hero ? "h-4 w-4" : "h-3.5 w-3.5"} />
                  </button>
                </li>
                );
              })}
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
                title="Show timeline"
                aria-busy={isNavigating || undefined}
                disabled={chips.length === 0 || isNavigating}
                onClick={submit}
                className={`grid shrink-0 place-items-center rounded-md bg-accent-green text-on-accent transition-colors hover:bg-accent-green-hover disabled:opacity-40 disabled:hover:bg-accent-green ${
                  // The hero's 32px arrow gets a 44px hit area, as the keycaps have.
                  hero ? "relative h-8 w-8 before:absolute before:-inset-1.5" : "h-6 w-6"
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
      {(chipsMode || onPick) && (
        <div role="status" aria-live="polite" className="sr-only">
          {announcement && <span key={announcement.id}>{announcement.text}</span>}
        </div>
      )}

      {showPanel && (
        <div
          ref={panelRef}
          // Options keep the current focus; category tabs are real focusable controls.
          onMouseDown={(event) => {
            if (!(event.target as Element).closest("[role=tab]")) event.preventDefault();
          }}
          className={`absolute inset-x-0 top-full z-50 mt-2 max-h-[min(28rem,55dvh)] overflow-y-auto overscroll-contain rounded-md border border-border bg-surface text-sm shadow-2xl shadow-black/60 ${
            wideMenu ? "lg:left-auto lg:w-[22rem]" : ""
          }`}
        >
          {hasCategories && (
            <SearchCategoryTabs
              value={category}
              baseId={baseId}
              onChange={(value) => {
                setCategory(value);
                setActiveIndex(-1);
                if (panelRef.current) panelRef.current.scrollTop = 0;
              }}
              onResults={() => resultsRef.current?.focus()}
              onDismiss={() => {
                inputRef.current?.focus({ preventScroll: true });
                setOpen(false);
                setActiveIndex(-1);
              }}
            />
          )}
          <div
            id={hasCategories ? `${baseId}-results` : undefined}
            role={hasCategories ? "tabpanel" : undefined}
            aria-labelledby={hasCategories ? `${baseId}-tab-${category}` : undefined}
          >
            {bacon && (
              <p data-mode-rule className="border-b border-border px-3 py-2.5 text-body">
                <span className="font-medium text-accent-orange">{BACON_MODE_LABEL}</span>
                <span aria-hidden="true"> · </span>
                {full ? baconFullRule(!chipsMode) : BACON_MODE_RULE}
              </p>
            )}

            {full && !bacon && (
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

            {hasCategories && category === "pairings" && fresh && !failure && results.length > 0 && pairingCount === 0 && (
              <p className="px-3 py-3 text-body">No curated pairings for this search.</p>
            )}

            {searchable && loading && results.length === 0 && (
              <p className="flex items-center gap-2 px-3 py-3 text-muted">
                <Spinner /> Searching…
              </p>
            )}

            {onSuggestions && collaborators.status === "loading" && (
              // Skeleton rows hold the place of the first request's answer; they are not options.
              <div aria-hidden="true" className="py-1">
                <p className="px-3 pb-1 pt-2 text-xs font-medium text-muted">{suggestionsLabel}</p>
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

            {onSuggestions && options.length > 0 && (
              <div id={listId} role="listbox" aria-label={teamOptions.length > 0 ? "People and teams" : "People"}>
                {suggestions.length > 0 && (
                <div role="group" aria-labelledby={groupLabelId}>
                  <p id={groupLabelId} className="px-3 pb-1 pt-2.5 text-xs font-medium text-muted">
                    {suggestionsLabel}
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
                )}
                {teamOptions.length > 0 && (
                  <ul role="group" aria-labelledby={`${baseId}-teams`} className="m-0 list-none p-0">
                    <li role="presentation" id={`${baseId}-teams`} className="border-t border-border px-3 pb-1 pt-2.5 text-xs font-medium text-muted">
                      {BACON_TEAMS_LABEL}
                    </li>
                    {teamOptions.map((team, row) => {
                      const index = suggestions.length + row;
                      return (
                        <SearchResultOption
                          key={team.href}
                          option={team}
                          id={optionId(index)}
                          active={index === activeIndex}
                          disabled={false}
                          state="can-add"
                          chipsMode={chipsMode}
                          keyHint={false}
                          note={togetherNote(team.sharedCount)}
                          onHighlight={() => setActiveIndex(index)}
                          onSelect={() => selectOption(team)}
                        />
                      );
                    })}
                  </ul>
                )}
              </div>
            )}

            {teamsListed && teams.status === "error" && (
              <div data-teams-error role="group" aria-label={BACON_TEAMS_LABEL} className="border-t border-border">
                <p className="px-3 pb-1 pt-2.5 text-xs font-medium text-muted">{BACON_TEAMS_LABEL}</p>
                <div className="flex items-center justify-between gap-3 px-3 pb-3 pt-1">
                  <p className="text-body">{BACON_TEAMS_ERROR}</p>
                  <button
                    type="button"
                    onClick={teams.retry}
                    className="shrink-0 rounded-md border border-border px-3 py-1.5 font-medium text-strong hover:bg-border"
                  >
                    Retry
                  </button>
                </div>
              </div>
            )}

            {teamsListed && teams.status === "loading" && collaborators.status !== "loading" && (
              <p data-teams-loading className="flex items-center gap-2 border-t border-border px-3 py-2.5 text-xs text-muted">
                <Spinner /> Finding the teams he has worked with most…
              </p>
            )}

            {searchOptions.length > 0 && (
              <ul
                ref={resultsRef}
                id={listId}
                role="listbox"
                aria-label={pairingCount ? (artistCount ? "People and pairings" : "Pairings") : "People"}
                aria-activedescendant={hasCategories ? activeId : undefined}
                tabIndex={hasCategories ? 0 : undefined}
                onFocus={() => {
                  if (hasCategories && activeIndex < 0) setActiveIndex(moveActive(disabledFlags, -1, "first"));
                }}
                onKeyDown={onKeyDown}
                className={`outline-none ${loading ? "opacity-60" : ""}`}
              >
                {sections.map((section) => {
                  const rows = section.options.map((option, row) => {
                    const index = section.startIndex + row;
                    return (
                      <SearchResultOption
                        key={"href" in option ? option.href : "mode" in option ? "mode" : option.id}
                        option={option}
                        id={optionId(index)}
                        active={index === activeIndex}
                        disabled={disabledFlags[index]}
                        state={"href" in option || "mode" in option ? "can-add" : addState(added, option.id, cap)}
                        note={bacon && !("href" in option) && !("mode" in option) && option.id !== BACON.id ? togetherNote(option.together) : undefined}
                        chipsMode={chipsMode}
                        keyHint={target?.index === index}
                        onHighlight={() => setActiveIndex(index)}
                        onSelect={() => selectOption(option)}
                      />
                    );
                  });
                  if (!section.label) return rows;
                  const labelId = `${baseId}-${section.key}`;
                  return (
                    <li key={section.key} role="group" aria-labelledby={labelId}>
                      <p id={labelId} className="border-t border-border px-3 pb-1 pt-2.5 text-xs font-medium text-muted">
                        {section.label}
                      </p>
                      <ul role="presentation">{rows}</ul>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
