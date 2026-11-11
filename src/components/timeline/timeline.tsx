"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type Ref,
} from "react";
import { combineLanes, combinedMinimapFilms, describeCombined } from "@/lib/combined-track";
import { connectionKey, connectionLegend, slotColor } from "@/lib/connections";
import { filmCardContent } from "@/lib/film-credits";
import { joinNames } from "@/lib/format";
import { outsidePeriodIds, type Period, type YearSpan } from "@/lib/period";
import { laneSummary, peopleHref, removePersonHref, type PersonRef } from "@/lib/lanes";
import { laneScrollTop, mostVisibleLane } from "@/lib/lane-dock";
import { separateMinimapFilms } from "@/lib/minimap-films";
import { personColor, personGlow, personSlots, type PersonTint } from "@/lib/person-colors";
import { isReleased } from "@/lib/released";
import { MINOR_TOGGLE_LABEL } from "@/lib/roles";
import { nodeOnlyIds, rovingIndex, tabStopId } from "@/lib/roving";
import { shortName } from "@/lib/short-name";
import {
  AXIS_HEIGHT,
  DEFAULT_MAX_ROWS,
  DEFAULT_ZOOM,
  DOT_HIT_SIZE,
  MAX_ZOOM,
  MIN_ZOOM,
  NODE_RADIUS,
  axisRange,
  axisTicks,
  buildConnectors,
  cardTopInLane,
  cardWidthOf,
  centerYear,
  filmMembership,
  initialAnchorX,
  initialScrollLeft,
  laneObstacles,
  lineYInLane,
  makeScale,
  nextZoom,
  nodeHitWidths,
  nodeY,
  overflowCount,
  packFilms,
  quietFilmIds,
  rowCount,
  scrollLeftForCenter,
  scrollLeftForYearStart,
  sharedAcrossLanes,
  stackLanes,
  totalHeight,
  trackWidth,
  xForYear,
  zoomForPeriod,
  type PackedFilm,
} from "@/lib/timeline-layout";
import type { Film, PersonSummary } from "@/lib/types";
import { cn } from "./cn";
import { ConnectionLegend } from "./connection-legend";
import { FilmCard, type CardTone } from "./film-card";
import { FilmNode } from "./film-node";
import { FilmPopover, useFilmPopover, type PopoverTarget } from "./film-popover";
import { LaneAvatars } from "./lane-avatars";
import { LaneHeader } from "./lane-header";
import { MinimapBar } from "./minimap";
import type { OpenPerson } from "@/lib/side-panel";
import { isSenderPeriod } from "./use-period";
import { scrollBehavior } from "./scroll-behavior";
import { useDragPan } from "./use-drag-pan";

export interface LaneData {
  person: PersonSummary;
  /** Films to show, already filtered for the minor toggle. */
  films: Film[];
  /** Ids of the films left out because they are minor (empty while the toggle is on). */
  hiddenMinorIds: readonly number[];
}

/** What the page can ask of the timeline from outside. */
export interface TimelineHandle {
  /**
   * Call before the people or credit preferences change the axis: the year in the middle
   * of the view stays in the middle.
   */
  rememberCenter: () => void;
}

interface TimelineProps {
  /**
   * Whether the timeline is on screen (its tab is selected). A hidden timeline has no size, so
   * it cannot place its scroll position: it does so when it is first shown, and puts it back
   * (the browser forgets it of a hidden element) every time it is shown again.
   */
  active: boolean;
  ref?: Ref<TimelineHandle>;
  /** One lane per person to draw (the visible people). */
  lanes: LaneData[];
  /** Draw the lanes as one track instead of one lane each. */
  combined?: boolean;
  /** Shared with both layouts and the table's settings gear: give every film a poster. */
  showAll: boolean;
  /** The gear containing the poster-row and minor-credit preferences. */
  settingsControl: ReactNode;
  /** The layout toggle, fixed over the track's top-right corner rather than scrolling with the films. */
  layoutToggle?: ReactNode;
  /** The people column: floating over the timeline on desktop, above it below md, in both layouts. */
  sidebar?: ReactNode;
  /** Dock a fully expanded people panel flush to the timeline instead of floating it with an inset. */
  sidebarExpanded?: boolean;
  /**
   * Everyone on the page, in URL order: the remove links, and their palette slots (see
   * `personSlots`), which colour the combined track and, in the separate layout, each lane's films
   * and the minimap. A one-person page has no colours to tell apart.
   */
  people: PersonRef[];
  includeMinor: boolean;
  /**
   * yyyy-mm-dd (UTC), the one date the page computed on the server: a film released after it is
   * upcoming (see `isReleased`) and never connects. It is a prop, never read from the clock here,
   * because it changes the layout and the server and the browser must draw the same one.
   */
  today: string;
  selectedId: number | null;
  onSelect: (id: number, trigger: HTMLElement) => void;
  /** A lane header's More button was pressed (a page without the people column): open the person's details. */
  onOpenPerson: OpenPerson;
  /**
   * The period in the page's URL (`?from=1978&to=1993`), already resolved against the films: the years of a link
   * someone shared, or the ones chosen in the Share menu's Period selects. Films outside it are dimmed. A period that
   * came with the link is also opened on: once the timeline is on screen it zooms to the nearest step that fits it and
   * scrolls to its first year (a period that appears later, as the address bar is read after hydration, is applied the
   * same way). One chosen in the Share menu is not scrolled to: it only dims, and the view stays where it is. Null
   * shows the usual start.
   */
  period?: Period | null;
  /** First and last year of the films a period is cut from. Only the minimap's brush uses it (parked, see `MINIMAP_BRUSH_ENABLED`). Null: no brush. */
  periodSpan?: YearSpan | null;
  /** The year of each film the preview card shows, for the brush's live film count (parked, see `MINIMAP_BRUSH_ENABLED`). */
  periodYears?: readonly number[];
  /** Writes the period the minimap's brush ends on (null: none). The brush is parked behind `MINIMAP_BRUSH_ENABLED`, so nothing calls it for now; see `useUrlPeriod`. */
  onPeriodChange?: (next: Period | null) => void;
}

/** How long the lane a top-bar avatar jumped to keeps its highlight ring. */
const HIGHLIGHT_MS = 1000;
/** Quiet time after the last scroll event before an avatar jump counts as finished. */
const SETTLE_MS = 160;

const buttonClass =
  "inline-flex size-9 items-center justify-center rounded-md border border-border bg-surface text-strong hover:border-muted disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border";

/** Stands for the one track of the combined timeline where a lane's person goes. */
const COMBINED_PERSON: PersonSummary = {
  id: 0,
  name: "Everyone",
  profilePath: null,
  knownFor: null,
  birthday: null,
  deathday: null,
  biography: null,
};

const LIT_GLOW = { filter: "drop-shadow(0 0 3px var(--lit-glow))" };
/** Opacity of the connections the legend is not pointing at. */
const DIMMED = 0.2;

/** The element of a delegated pointer or focus event that stands for a film (a card or a node), if any. */
function filmElement(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element ? target.closest<HTMLElement>("[data-film]") : null;
}

function popoverTargetOf(element: HTMLElement): PopoverTarget {
  return {
    trigger: element,
    filmId: Number(element.dataset.film),
    laneIndex: Number(element.dataset.lane),
  };
}

/** Whether the browser would draw a focus ring on the element: keyboard focus, not a mouse click. */
function focusIsVisible(element: HTMLElement): boolean {
  try {
    return element.matches(":focus-visible");
  } catch {
    return true;
  }
}

export function Timeline({
  active,
  ref,
  lanes,
  combined = false,
  showAll,
  settingsControl,
  layoutToggle,
  sidebar,
  sidebarExpanded = false,
  people,
  includeMinor,
  today,
  selectedId,
  onSelect,
  onOpenPerson,
  period = null,
  periodSpan = null,
  periodYears = [],
  onPeriodChange,
}: TimelineProps) {
  const [pxPerYear, setPxPerYear] = useState(DEFAULT_ZOOM);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [edges, setEdges] = useState({ left: false, right: true });
  // The one card-less node per lane (by lane index) that is a tab stop: the one last focused.
  const [tabStops, setTabStops] = useState<Readonly<Record<number, number>>>({});
  // The kind of connection (a legend chip's key) the lines emphasise: hovered or focused, or pressed to keep.
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [pinnedKey, setPinnedKey] = useState<string | null>(null);

  // Lane most in view (green ring on its top-bar avatar) and the lane just jumped to (ring on the lane).
  const [activeLane, setActiveLane] = useState(0);
  const [highlightLane, setHighlightLane] = useState<number | null>(null);

  const scrollerId = useId();
  const popoverId = useId();
  const { target: popoverTarget, show: showPopover, hide: hidePopover } = useFilmPopover();
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const cornerRef = useRef<HTMLDivElement>(null);
  // Click-and-drag on the empty surface pans the scroller; starting one closes the hover card.
  const { isPanning } = useDragPan(scrollerRef, hidePopover);
  const pendingCenter = useRef<number | null>(null);
  /** A period link's first year and the zoom it needs: scrolled to once that zoom is the one on screen. */
  const pendingStart = useRef<{ from: number; zoom: number } | null>(null);
  /** The period (as "from-to") the timeline last opened on, so each one is applied once. */
  const appliedPeriod = useRef<string | null>(null);
  const didInitialScroll = useRef(false);
  const wasActive = useRef(false);
  /** Where the scroller was last seen on screen: a hidden scroller reads (and forgets) zero. */
  const lastSeen = useRef<{ left: number; top: number; viewport: number } | null>(null);
  const scrollFrame = useRef(0);
  const highlightTimer = useRef<number | undefined>(undefined);
  const settleTimer = useRef<number | undefined>(undefined);
  const hoverElement = useRef<HTMLElement | null>(null);
  /**
   * An avatar jump keeps its lane "active" even if the scroller cannot scroll far enough to make
   * it the most visible one (the last lanes), until the visitor scrolls somewhere else.
   */
  const jump = useRef<{ lane: number; settledTop: number | null } | null>(null);

  // Combined: every visible person's films merged into the one lane the track draws; `lanes` stays
  // the people (the hover card has a row for each of them).
  const isCombined = combined;
  const slots = useMemo(() => personSlots(people), [people]);
  const entries = useMemo(
    () => (isCombined ? combineLanes(lanes, slots, today) : []),
    [isCombined, lanes, slots, today],
  );
  const trackLanes: LaneData[] = useMemo(
    () =>
      isCombined
        ? [
            {
              person: COMBINED_PERSON,
              films: entries.map((entry) => entry.film),
              // The same film is hidden once, however many of the people list it.
              hiddenMinorIds: [...new Set(lanes.flatMap((lane) => lane.hiddenMinorIds))],
            },
          ]
        : lanes,
    [entries, isCombined, lanes],
  );

  const multi = lanes.length > 1;
  // Person colours: on a page of several people, whatever number of them is visible.
  const colored = people.length > 1;
  // Films outside the period the page was opened on or the brush chose: shared or not, their cards, connectors and nodes fade.
  const outsideIds = useMemo(() => outsidePeriodIds(lanes.flatMap((lane) => lane.films), period), [lanes, period]);

  const layout = useMemo(() => {
    const years = trackLanes.flatMap((lane) => lane.films.map((film) => film.year));
    const range = axisRange(years, Number(today.slice(0, 4)));
    const scale = makeScale(range, pxPerYear);
    const base = { pxPerYear, axisStartYear: scale.axisStartYear };
    const common = { scale, ticks: axisTicks(scale), width: trackWidth(scale) };

    // A film shown in two or more lanes gets its own poster in each of them, placed first (ahead
    // of the row cap) so it keeps a card, on the lowest row it can have, in every lane that has it.
    // Only released films connect: an announced film both lanes list is an ordinary upcoming poster in each.
    // On the combined track the films everyone visible made are the ones placed first.
    const priorityIds = isCombined
      ? new Set(entries.filter((entry) => entry.shared).map((entry) => entry.film.id))
      : sharedAcrossLanes(trackLanes, today);
    // While something is connected, the films that are not get a smaller card (and so pack tighter).
    // Always the people's lanes: the combined track is one lane, and cannot tell what is shared.
    const quietIds = quietFilmIds(lanes, today);

    // Connector lines run through the poster rows of the lanes below their first node.
    const obstacles = laneObstacles(trackLanes, base, today);
    const optionsFor = (index: number) => ({ ...base, priorityIds, quietIds, obstacles: obstacles[index] });
    const capped = trackLanes.map((lane, index) =>
      packFilms(lane.films, { ...optionsFor(index), maxRows: DEFAULT_MAX_ROWS }),
    );
    const overflow = capped.map(overflowCount);
    const items = trackLanes.map((lane, index) =>
      showAll && overflow[index] > 0 ? packFilms(lane.films, optionsFor(index)) : capped[index],
    );

    const stack = stackLanes(items.map(rowCount));
    const connectorLanes = items.map((laneItems, index) => ({ box: stack[index], items: laneItems }));
    const connectors = buildConnectors(connectorLanes, today);
    const membership = filmMembership(connectorLanes, today);
    // Released films every lane shows. With people hidden that is shared among the visible ones
    // only, like the green treatment; the page's own all-people set would anchor on a film a
    // hidden person was part of.
    const litNow = new Set([...membership].filter(([, shownIn]) => shownIn.length === trackLanes.length).map(([id]) => id));

    // The kind of connection, the colour and the screen-reader note of each film shown in more than one lane.
    const names = trackLanes.map((lane) => shortName(lane.person.name, lane.person.id));
    const keys = new Map<number, string>();
    const accents = new Map<number, string>();
    const notes = new Map<number, string>();
    for (const connector of connectors) {
      keys.set(connector.filmId, connectionKey(connector.slot));
      if (connector.slot === null) {
        notes.set(connector.filmId, "Made together");
      } else {
        accents.set(connector.filmId, slotColor(connector.slot));
        notes.set(connector.filmId, `Shared by ${joinNames(connector.lanes.map((lane) => names[lane]))}`);
      }
    }

    return {
      ...common,
      items,
      priorityIds,
      quietIds,
      // Per lane, the films that are only a node while the rows are capped: the ones "Show all films" gives a poster.
      uncappedIds: capped.map((laneItems) => new Set(laneItems.filter((item) => item.overflow).map((item) => item.film.id))),
      hitWidths: items.map(nodeHitWidths),
      boxes: stack,
      height: totalHeight(stack),
      membership,
      connectors,
      legend: connectionLegend(connectors, trackLanes.length),
      names,
      keys,
      accents,
      notes,
      // The combined track starts at the first film everyone visible made, when there is one;
      // the separate lanes at the first film every visible lane shows.
      anchorX: isCombined
        ? (items[0].find((item) => priorityIds.has(item.film.id))?.x ?? null)
        : initialAnchorX(items, litNow),
    };
  }, [entries, showAll, isCombined, lanes, pxPerYear, today, trackLanes]);

  const { scale, width, boxes } = layout;

  // What the combined track tells about each film: the colour of its node, of its card's ring and
  // dots, and what a screen reader hears (who made it, and what each of them did).
  const combinedInfo = useMemo(
    () => (isCombined ? describeCombined(entries, lanes, includeMinor) : null),
    [entries, includeMinor, isCombined, lanes],
  );

  // What the minimap marks: green nodes for films every lane shares, and a tick for every other
  // film, in the colour it has on the track (its person's, or its connection's), or muted when the
  // page has only one person.
  const { membership, accents } = layout;
  const minimapFilms = useMemo(
    () =>
      isCombined
        ? combinedMinimapFilms(entries, today)
        : separateMinimapFilms(lanes, membership, accents, slots, colored),
    [accents, colored, entries, isCombined, lanes, membership, slots, today],
  );

  // The People panel's rows say the same of each person; the combined lane stands for no one, so it has none.
  const laneInfo = useMemo(
    () => (isCombined ? [] : trackLanes.map((lane) => laneSummary(lane.films, lane.person, includeMinor))),
    [isCombined, trackLanes, includeMinor],
  );

  // ---- scrolling ----------------------------------------------------------

  const viewportTrackWidth = () => {
    const scroller = scrollerRef.current;
    const corner = cornerRef.current;
    return scroller && corner ? scroller.clientWidth - corner.offsetWidth : 0;
  };

  /**
   * Notes where the scroller is, but only while it is on screen: a hidden (display: none) element
   * reads zero and, once shown again, starts from zero too, so the last real position is what a
   * tab switch has to put back.
   */
  const remember = useCallback(() => {
    const scroller = scrollerRef.current;
    const corner = cornerRef.current;
    if (!scroller || !corner || scroller.clientWidth === 0) return;
    lastSeen.current = {
      left: scroller.scrollLeft,
      top: scroller.scrollTop,
      viewport: scroller.clientWidth - corner.offsetWidth,
    };
  }, []);

  const updateEdges = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const left = scroller.scrollLeft > 2;
    const right = scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 2;
    setEdges((prev) => (prev.left === left && prev.right === right ? prev : { left, right }));
  }, []);

  const armSettle = useCallback(() => {
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      const scroller = scrollerRef.current;
      if (jump.current && scroller) jump.current.settledTop = scroller.scrollTop;
    }, SETTLE_MS);
  }, []);

  const updateActiveLane = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const current = jump.current;
    if (current) {
      if (current.settledTop !== null && Math.abs(scroller.scrollTop - current.settledTop) > 4) {
        jump.current = null; // the visitor scrolled on their own
      } else {
        if (current.settledTop === null) armSettle(); // still moving: wait for it to stop
        setActiveLane(current.lane);
        return;
      }
    }
    const index = mostVisibleLane(boxes, scroller.scrollTop, scroller.clientHeight);
    setActiveLane(index < 0 ? 0 : index);
  }, [armSettle, boxes]);

  // Scroll events can arrive faster than frames; do the (cheap, usually no-op) state checks once per frame.
  const handleScroll = useCallback(() => {
    remember(); // not throttled: a tab switch can come right after the last scroll event
    if (scrollFrame.current) return;
    scrollFrame.current = requestAnimationFrame(() => {
      scrollFrame.current = 0;
      updateEdges();
      updateActiveLane();
    });
  }, [remember, updateActiveLane, updateEdges]);

  useEffect(
    () => () => {
      cancelAnimationFrame(scrollFrame.current);
      window.clearTimeout(highlightTimer.current);
      window.clearTimeout(settleTimer.current);
    },
    [],
  );

  // Lane heights change with "Show all" and the minor toggle.
  useLayoutEffect(() => {
    updateActiveLane();
  }, [updateActiveLane]);

  // Only the track changes layout: keep the panel mounted and its lowest poster rows in view.
  // A tall expanded lane starts at its line, not at potentially empty rows far above the matches.
  const previousCombined = useRef(isCombined);
  const previousShowAll = useRef(showAll);
  const previousIncludeMinor = useRef(includeMinor);
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const changed = previousCombined.current !== isCombined;
    const rowsChanged = previousShowAll.current !== showAll;
    const creditsChanged = previousIncludeMinor.current !== includeMinor;
    previousCombined.current = isCombined;
    previousShowAll.current = showAll;
    previousIncludeMinor.current = includeMinor;
    if (changed) {
      hidePopover();
      hoverElement.current = null;
      jump.current = null;
    }
    if (scroller && rowsChanged && showAll) {
      // The old icon could appear to do nothing: the posters it adds often sit above the
      // viewport. Reveal a new poster in the current year window without changing the years.
      const left = scroller.scrollLeft;
      const right = left + scroller.clientWidth - (cornerRef.current?.offsetWidth ?? 0);
      const laneOrder = isCombined ? [0] : [activeLane, ...layout.items.map((_, index) => index).filter((index) => index !== activeLane)];
      for (const laneIndex of laneOrder) {
        const box = boxes[laneIndex];
        const candidates = layout.items[laneIndex]?.filter((item) =>
          layout.uncappedIds[laneIndex].has(item.film.id) && item.x >= left && item.x <= right,
        ) ?? [];
        const revealed = candidates.reduce<PackedFilm<Film> | null>((nearest, item) =>
          nearest === null || item.row < nearest.row ? item : nearest, null,
        );
        if (box && revealed) {
          scroller.scrollTop = Math.max(0, box.top + cardTopInLane(revealed.row, box.height) - 18);
          return;
        }
      }
    }
    if (!isCombined && scroller && (changed || rowsChanged || creditsChanged)) {
      const box = boxes[changed ? 0 : activeLane] ?? boxes[0];
      if (box) scroller.scrollTop = Math.max(box.top, box.top + box.height + AXIS_HEIGHT - scroller.clientHeight);
    }
    // The combined track's lowest rows are the ones next to its line. Only a change of layout or of
    // rows puts them back in view: a zoom or a credits toggle leaves the visitor where they scrolled.
    if (isCombined && scroller && (changed || rowsChanged)) scroller.scrollTop = scroller.scrollHeight;
  }, [activeLane, boxes, hidePopover, includeMinor, isCombined, layout.items, layout.uncappedIds, showAll]);

  const jumpToLane = useCallback(
    (index: number) => {
      const scroller = scrollerRef.current;
      if (!scroller) return;
      jump.current = { lane: index, settledTop: null };
      armSettle();
      setActiveLane(index);
      scroller.scrollTo({ top: laneScrollTop(boxes, index), behavior: scrollBehavior() });
      window.clearTimeout(highlightTimer.current);
      setHighlightLane(index);
      highlightTimer.current = window.setTimeout(() => setHighlightLane(null), HIGHLIGHT_MS);
    },
    [armSettle, boxes],
  );

  // Edge fades follow the content size (zoom, minor toggle) and the container size.
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateEdges);
    observer.observe(scroller);
    if (scroller.firstElementChild) observer.observe(scroller.firstElementChild);
    return () => observer.disconnect();
  }, [updateEdges]);

  // When the timeline is first shown it starts at the first film made together (or at the beginning
  // for one lane). Every later time it is shown (its tab was hidden: display none forgets the
  // scroll position) it is put back where it was; see `lastSeen`. A year queued by `rememberCenter`
  // while it was hidden wins over the pixel position, because the axis may have moved meanwhile.
  const { anchorX } = layout;
  useLayoutEffect(() => {
    const shown = active && !wasActive.current;
    wasActive.current = active;
    if (!shown) return;
    const scroller = scrollerRef.current;
    if (!scroller) return;

    if (!didInitialScroll.current) {
      didInitialScroll.current = true;
      scroller.scrollLeft = initialScrollLeft(anchorX, viewportTrackWidth());
      // Initial Combined views should stand on their baseline, even when shared posters force
      // more rows than fit. Keep this one-time placement separate from later manual zooms.
      if (isCombined) scroller.scrollTop = scroller.scrollHeight;
    } else if (lastSeen.current) {
      if (pendingCenter.current === null) scroller.scrollLeft = lastSeen.current.left;
      scroller.scrollTop = lastSeen.current.top;
    }
    remember();
    updateEdges();
    updateActiveLane();
  }, [active, anchorX, isCombined, remember, updateActiveLane, updateEdges]);

  // Zoom and the minor toggle can move the axis; keep whatever year was centred in place. While the
  // timeline is hidden the year comes from where it was last seen, and is placed once it is shown.
  const rememberCenter = () => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    if (active) pendingCenter.current = centerYear(scroller.scrollLeft, viewportTrackWidth(), scale);
    else if (lastSeen.current) pendingCenter.current = centerYear(lastSeen.current.left, lastSeen.current.viewport, scale);
  };
  useImperativeHandle(ref, () => ({ rememberCenter }));

  useLayoutEffect(() => {
    if (!active) return; // a hidden scroller has no width: the queued year waits until it is shown
    const year = pendingCenter.current;
    const scroller = scrollerRef.current;
    if (year === null || !scroller) return;
    pendingCenter.current = null;
    scroller.scrollLeft = scrollLeftForCenter(year, scroller.clientWidth - (cornerRef.current?.offsetWidth ?? 0), scale);
    remember();
  });

  // A link to a period: zoom to the years and show them from their first one. Applied once per
  // period, when the timeline is on screen (a hidden scroller has no width to fit them to).
  const periodKey = period ? `${period.from}-${period.to}` : null;
  const openOnPeriod = useCallback(
    (target: Period) => {
      // One the visitor chose here, with the brush or the Share menu, is not a link to open on: stay where we are.
      if (isSenderPeriod(target)) {
        appliedPeriod.current = `${target.from}-${target.to}`;
        return;
      }
      const width = viewportTrackWidth();
      if (width <= 0) return;
      appliedPeriod.current = `${target.from}-${target.to}`;
      const zoomStep = zoomForPeriod(target, width);
      pendingStart.current = { from: target.from, zoom: zoomStep };
      setPxPerYear(zoomStep);
    },
    // viewportTrackWidth only reads refs.
    [],
  );
  useLayoutEffect(() => {
    if (active && period && periodKey !== appliedPeriod.current) openOnPeriod(period);
  }, [active, period, periodKey, openOnPeriod]);

  useLayoutEffect(() => {
    const pending = pendingStart.current;
    const scroller = scrollerRef.current;
    if (!active || !pending || !scroller || pending.zoom !== pxPerYear) return;
    pendingStart.current = null;
    scroller.scrollLeft = scrollLeftForYearStart(pending.from, scale);
    // Fitting a linked period can add rows after the first placement. This is a deliberate
    // programmatic navigation, not a manual zoom, so finish it at the Combined baseline too.
    if (isCombined) scroller.scrollTop = scroller.scrollHeight;
    remember();
    updateEdges();
  });

  const zoom = (direction: "in" | "out") => {
    const next = nextZoom(pxPerYear, direction);
    if (next === pxPerYear) return;
    rememberCenter();
    setPxPerYear(next);
  };

  // ---- hover, focus and keyboard ------------------------------------------
  //
  // One set of handlers on the scroller instead of per card and node: a lane can have a hundred
  // nodes. Cards and nodes carry `data-film` (and `data-lane`) for these to read.

  const handlePointerOver = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === "touch" || isPanning()) return;
    const element = filmElement(event.target);
    if (!element || element === hoverElement.current) return;
    hoverElement.current = element;
    setHoveredId(Number(element.dataset.film));
    showPopover(popoverTargetOf(element), "hover");
  };

  const handlePointerOut = (event: PointerEvent<HTMLElement>) => {
    const element = filmElement(event.target);
    if (!element || element !== hoverElement.current) return;
    if (event.relatedTarget instanceof Node && element.contains(event.relatedTarget)) return;
    hoverElement.current = null;
    setHoveredId(null);
    hidePopover(element);
  };

  const handleFocus = (event: FocusEvent<HTMLElement>) => {
    const element = filmElement(event.target);
    if (!element) return;
    setHoveredId(Number(element.dataset.film));
    if (focusIsVisible(element)) showPopover(popoverTargetOf(element), "focus");
    // The focused node becomes its lane's tab stop, so Shift+Tab and Tab return to it.
    if (element.hasAttribute("data-film-node")) {
      const lane = Number(element.dataset.lane);
      const film = Number(element.dataset.film);
      setTabStops((prev) => (prev[lane] === film ? prev : { ...prev, [lane]: film }));
    }
  };

  const handleBlur = (event: FocusEvent<HTMLElement>) => {
    const element = filmElement(event.target);
    if (!element) return;
    setHoveredId(null);
    hidePopover(element);
  };

  // The hover card keeps clear of the control bar pinned to the bottom of the viewport.
  const barTop = useCallback(
    () => rootRef.current?.querySelector("[data-minimap-bar]")?.getBoundingClientRect().top ?? window.innerHeight,
    [],
  );

  // Opening the film panel closes the hover card, whether it was a click or Enter.
  const handleSelect = useCallback(
    (id: number, trigger: HTMLElement) => {
      hidePopover();
      onSelect(id, trigger);
    },
    [hidePopover, onSelect],
  );

  const popoverContent = useMemo(
    () =>
      popoverTarget
        ? filmCardContent(popoverTarget.filmId, lanes, {
            includeMinor,
            firstPersonId: isCombined ? null : (lanes[popoverTarget.laneIndex]?.person.id ?? null),
          })
        : null,
    [popoverTarget, lanes, includeMinor, isCombined],
  );
  const describedByFor = (filmId: number, laneIndex: number | null) =>
    popoverTarget && popoverContent && popoverTarget.filmId === filmId && popoverTarget.laneIndex === laneIndex
      ? popoverId
      : undefined;

  // Left/Right/Home/End move between the nodes of a lane; Enter and Space press the button as usual.
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.hasAttribute("data-film-node")) return;
    const nodes = [...event.currentTarget.querySelectorAll<HTMLElement>(`[data-film-node][data-lane="${target.dataset.lane}"]`)];
    const next = rovingIndex(event.key, nodes.indexOf(target), nodes.length);
    if (next === null) return;
    event.preventDefault();
    nodes[next]?.focus();
  };

  // ---- render -------------------------------------------------------------

  // Green for a film every lane shows, the colour of its pair for one only some lanes show, its
  // person's colour (through the tint) for one lane only.
  // On the combined track, green for a film every visible person made and plain for the rest.
  const toneFor = (id: number): CardTone => {
    if (isCombined) return layout.priorityIds.has(id) ? "lit" : "plain";
    const lanesShowing = layout.membership.get(id)?.length ?? 0;
    if (lanesShowing < 2) return "plain";
    return lanesShowing === trackLanes.length ? "lit" : "some";
  };

  // The kind of connection the lines emphasise now; ignored when the toggles left nothing of that kind.
  const wanted = previewKey ?? pinnedKey;
  const activeKey = wanted !== null && layout.legend.some((entry) => entry.key === wanted) ? wanted : null;

  const firstDecade = Math.ceil(scale.axisStartYear / 10) * 10;
  const gridStyle = {
    backgroundImage:
      "linear-gradient(to right, color-mix(in srgb, var(--border) 70%, transparent) 1px, transparent 1px)",
    backgroundSize: `${10 * pxPerYear}px 100%`,
    backgroundPosition: `${xForYear(scale, firstDecade)}px 0`,
  };

  const zoomPercent = Math.round((pxPerYear / DEFAULT_ZOOM) * 100);

  // The colour ring of a "plain" film: its one contributor's colour, on both layouts. On the
  // combined track that comes from the merged entries; on a separate lane from the lane's person.
  const tintFor = (filmId: number, laneIndex: number): PersonTint | null => {
    if (!colored) return null;
    if (isCombined) return combinedInfo?.get(filmId)?.tint ?? null;
    if (toneFor(filmId) !== "plain") return null;
    const slot = slots.get(trackLanes[laneIndex].person.id);
    return slot === undefined ? null : { color: personColor(slot), glow: personGlow(slot) };
  };

  const cardFor = (
    { film, x }: PackedFilm<Film>,
    laneIndex: number,
    top: number,
    roles: string,
  ) => {
    const tone = toneFor(film.id);
    const quiet = layout.quietIds.has(film.id);
    const tint = tintFor(film.id, laneIndex);
    return (
      <FilmCard
        key={film.id}
        id={film.id}
        title={film.title}
        year={film.year}
        posterPath={film.posterPath}
        roles={roles}
        left={x - cardWidthOf(quiet) / 2}
        top={top}
        tone={tone}
        quiet={quiet}
        accent={layout.accents.get(film.id) ?? null}
        note={combinedInfo?.get(film.id)?.note ?? layout.notes.get(film.id) ?? ""}
        tint={tint}
        dots={combinedInfo?.get(film.id)?.dots}
        laneIndex={laneIndex}
        upcoming={!isReleased(film.releaseDate, today)}
        emphasized={hoveredId === film.id}
        dimmed={tone !== "plain" && activeKey !== null && layout.keys.get(film.id) !== activeKey}
        outside={outsideIds.has(film.id)}
        selected={selectedId === film.id}
        describedBy={describedByFor(film.id, laneIndex)}
        onSelect={handleSelect}
      />
    );
  };

  return (
    <div ref={rootRef}>
      {/*
        --chrome: what sits above the timeline (the site header, the title row and the tabs row), plus the pinned
        bar below it. The scroller is as tall as what is left of the viewport, so that the year axis at its bottom edge shows
        right above the bar when the page is at the top, instead of under it (but never shorter than 26rem; a phone scrolls
        the page instead).

        On desktop the people column and timeline share a grid cell: the expanded panel docks flush to the
        edges, while the compact panel floats with an inset. The track's left spacer (--lane-head) is scrollable, not
        sticky, so the earliest films can be reached clear of the panel and later films pass underneath it.
        The same inset tells the scroll/zoom and minimap math how much of the viewport is unobstructed.
        Below md the panel sits above the track. (The contents are not indented further to keep merges small.)
      */}
      <div className={cn(sidebar ? "flex flex-col gap-3 md:grid md:grid-cols-[minmax(0,1fr)] md:gap-0" : "contents", "[--chrome:15.5rem]")}>
      {sidebar && (
        <div className={cn(
          "min-w-0 md:pointer-events-none md:z-[65] md:col-start-1 md:row-start-1 md:grid md:w-[17rem]",
          !sidebarExpanded && "md:m-3",
        )}>
          {sidebar}
        </div>
      )}
      <div
        className={cn(
          "relative isolate",
          sidebar ? "flex w-full min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-canvas [--lane-head:0px] md:col-start-1 md:row-start-1 md:h-[clamp(26rem,calc(100dvh-var(--chrome)),1100px)]" : "[--lane-head:84px] sm:[--lane-head:224px]",
          sidebar ? (sidebarExpanded ? "md:[--lane-head:17rem]" : "md:[--lane-head:18.5rem]") : undefined,
        )}
      >
        {(settingsControl || layoutToggle) && (
          <div role="group" aria-label="Timeline settings" className="absolute right-2 top-2 z-[70] flex items-center gap-1 rounded-md bg-canvas/90">
            {layoutToggle}
            {settingsControl}
          </div>
        )}
        {layout.legend.length > 0 && (
          // The legend belongs to the track, not the People panel's sizing or position.
          <div className={cn("relative z-[65] shrink-0 pl-3 pr-20 pt-2", sidebar ? "md:pl-[var(--lane-head)]" : undefined)}>
            <ConnectionLegend
              entries={layout.legend}
              names={layout.names}
              laneCount={trackLanes.length}
              activeKey={activeKey}
              pinnedKey={pinnedKey}
              onPreview={setPreviewKey}
              onTogglePin={(key) => setPinnedKey((prev) => (prev === key ? null : key))}
            />
          </div>
        )}
        {/*
          The empty surface (lane tracks and the year axis) can be dragged to pan, see useDragPan: `grab` over it, `grabbing` and no
          text selection on everything while a drag runs (data-panning). Films, buttons and links keep their cursor, the lane
          headers (data-lane-head) are not part of the surface.
        */}
        <div
          ref={scrollerRef}
          id={scrollerId}
          role="region"
          aria-label="Film timeline. Scroll sideways to see more years."
          tabIndex={0}
          onScroll={handleScroll}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className={cn(
            "max-h-[clamp(26rem,calc(100dvh-var(--chrome)),1100px)] cursor-grab overflow-auto overscroll-x-contain [scroll-padding-left:var(--lane-head)] [scroll-padding-bottom:44px] [scrollbar-color:var(--text-muted)_transparent] [scrollbar-width:thin] data-[panning]:select-none [&[data-panning]_*]:cursor-grabbing! [&_[data-lane-head]]:cursor-auto",
            sidebar ? "min-h-0 flex-1" : "rounded-lg border border-border bg-canvas",
          )}
        >
          <div className="relative flex min-h-full min-w-full flex-col" style={{ width: `calc(var(--lane-head) + ${width}px)` }}>
            {/* Keep the films and their SVG together above the bottom-aligned year axis when the sidebar is taller. */}
            <div className="relative mt-auto shrink-0">
            {/*
              Lane lines, connectors and nodes: pure geometry from the layout, drawn over the poster
              cards of films that are in one lane only (but under the lane headers and under the
              posters of shared films). A connector is one line from a film's node in the first lane
              that shows it to its node in the last. It runs behind the shared posters in its way,
              its own included (so it is hidden behind its poster and shows again between the caption
              and the node), and over every other poster, 2px wide on a thin dark halo so it stays
              legible over the poster art. Each lane's line is at the bottom of its lane, with the posters above it.
            */}
            <svg
              aria-hidden
              className="pointer-events-none absolute top-0 z-[15]"
              style={{ left: "var(--lane-head)" }}
              width={width}
              height={layout.height}
            >
              {layout.items.map((items, laneIndex) => {
                const y = nodeY(boxes[laneIndex]);
                const first = items[0]?.x ?? width;
                const last = items[items.length - 1]?.x ?? width;
                return (
                  <g key={trackLanes[laneIndex].person.id}>
                    <line x1={0} x2={first} y1={y} y2={y} strokeDasharray="3 5" className="stroke-muted/40" />
                    {items.length > 0 && <line x1={first} x2={last} y1={y} y2={y} className="stroke-muted/70" />}
                    <line x1={last} x2={width} y1={y} y2={y} strokeDasharray="3 5" className="stroke-muted/40" />
                  </g>
                );
              })}
              {/* Every halo first, so that no film's halo dims the coloured line of a film released days from it. */}
              {layout.connectors.map((c) => {
                const key = connectionKey(c.slot);
                const strokeWidth = (c.kind === "all" ? 3 : 2) + (hoveredId === c.filmId || activeKey === key ? 1 : 0);
                return (
                  <line
                    key={c.filmId}
                    x1={c.x}
                    x2={c.x}
                    y1={c.y1}
                    y2={c.y2}
                    strokeWidth={strokeWidth + 3}
                    opacity={(activeKey !== null && activeKey !== key) || outsideIds.has(c.filmId) ? DIMMED : 1}
                    className="stroke-black/70"
                  />
                );
              })}
              {layout.connectors.map((c) => {
                const key = connectionKey(c.slot);
                const strokeWidth = (c.kind === "all" ? 3 : 2) + (hoveredId === c.filmId || activeKey === key ? 1 : 0);
                return (
                  <line
                    key={c.filmId}
                    data-connector={c.filmId}
                    data-connection={key}
                    x1={c.x}
                    x2={c.x}
                    y1={c.y1}
                    y2={c.y2}
                    strokeWidth={strokeWidth}
                    opacity={(activeKey !== null && activeKey !== key) || outsideIds.has(c.filmId) ? DIMMED : 1}
                    style={{ stroke: c.kind === "all" ? "var(--lit)" : slotColor(c.slot ?? 0), ...(c.kind === "all" ? LIT_GLOW : undefined) }}
                  />
                );
              })}
              {layout.items.map((items, laneIndex) => {
                const y = nodeY(boxes[laneIndex]);
                return (
                  <g key={trackLanes[laneIndex].person.id}>
                    {items.map(({ film, x }) => {
                      const tone = toneFor(film.id);
                      const dimmed = activeKey !== null && tone !== "plain" && layout.keys.get(film.id) !== activeKey;
                      const tint = tintFor(film.id, laneIndex);
                      return (
                        <circle
                          key={film.id}
                          cx={x}
                          cy={y}
                          r={colored && tone === "plain" ? NODE_RADIUS.some - 0.5 : NODE_RADIUS[tone]}
                          opacity={dimmed || outsideIds.has(film.id) ? DIMMED : 1}
                          stroke={tone === "plain" ? undefined : "var(--bg)"}
                          strokeWidth={tone === "plain" ? undefined : 1.5}
                          style={{
                            ...(tone === "lit" ? LIT_GLOW : undefined),
                            fill:
                              tone === "lit"
                                ? "var(--lit)"
                                : (layout.accents.get(film.id) ?? tint?.color ?? "var(--text-muted)"),
                          }}
                        />
                      );
                    })}
                  </g>
                );
              })}
            </svg>

            {trackLanes.map((lane, laneIndex) => {
              const { person } = lane;
              const items = layout.items[laneIndex];
              // Undefined on the combined track: its one lane has no person to sum up.
              const info: (typeof laneInfo)[number] | undefined = laneInfo[laneIndex];
              // A film with a poster card in this lane is reached through the card; the films that
              // are only a node share the lane's one roving tab stop.
              const tabStop = tabStopId(nodeOnlyIds(items), tabStops[laneIndex]);
              const rolesOf = (filmId: number) =>
                combinedInfo?.get(filmId)?.roles ?? info?.rolesByFilm.get(filmId) ?? "";
              const nodeFor = (item: PackedFilm<Film>, decorative: boolean) => (
                <FilmNode
                  key={item.film.id}
                  id={item.film.id}
                  title={item.film.title}
                  year={item.film.year}
                  roles={rolesOf(item.film.id)}
                  note={combinedInfo?.get(item.film.id)?.note ?? layout.notes.get(item.film.id) ?? ""}
                  x={item.x}
                  lineY={lineYInLane(boxes[laneIndex].height)}
                  hitWidth={layout.hitWidths[laneIndex].get(item.film.id) ?? DOT_HIT_SIZE}
                  tone={toneFor(item.film.id)}
                  laneIndex={laneIndex}
                  decorative={decorative}
                  tabbable={item.film.id === tabStop}
                  selected={selectedId === item.film.id}
                  describedBy={describedByFor(item.film.id, laneIndex)}
                  onSelect={handleSelect}
                />
              );
              return (
                <Fragment key={person.id}>
                  <section
                    // With a people column the panel's row names the lane (both layouts); without one, the lane header does.
                    aria-labelledby={isCombined ? undefined : `person-${person.id}`}
                    aria-label={isCombined ? "Films of everyone shown" : undefined}
                    className="flex"
                    style={{ height: boxes[laneIndex].height }}
                  >
                    {!sidebar && !isCombined && info && (
                      <LaneHeader
                        person={person}
                        roles={info.roles}
                        facts={info.facts}
                        span={info.span}
                        soloHref={multi ? peopleHref([person]) : null}
                        removeHref={removePersonHref(people, person.id)}
                        divider={laneIndex < trackLanes.length - 1}
                        onOpenPerson={onOpenPerson}
                      />
                    )}
                    {(sidebar || isCombined) && <div aria-hidden className="w-[var(--lane-head)] shrink-0" />}
                    <div
                      className={cn(
                        "relative shrink-0",
                        laneIndex < trackLanes.length - 1 && "border-b border-border",
                        // The empty-lane note sits right above the line.
                        items.length === 0 && "flex flex-col justify-end",
                      )}
                      style={{ width, ...gridStyle }}
                    >
                      {items.length > 0 ? (
                        <>
                          <ol className="m-0 list-none p-0">
                            {items.map((item) =>
                              item.overflow
                                ? nodeFor(item, false)
                                : cardFor(item, laneIndex, cardTopInLane(item.row, boxes[laneIndex].height), rolesOf(item.film.id)),
                            )}
                          </ol>
                          {/* Mouse targets on the nodes of films that have a card: not part of the list or the tab order. */}
                          {items.filter((item) => !item.overflow).map((item) => nodeFor(item, true))}
                        </>
                      ) : (
                        <p className="sticky left-[var(--lane-head)] w-max max-w-xs px-4 text-sm text-muted pb-9">
                          {lane.hiddenMinorIds.length > 0
                            ? `No major credits found on TMDB. Turn on "${MINOR_TOGGLE_LABEL}" to see ${lane.hiddenMinorIds.length} more.`
                            : "No films found on TMDB."}
                        </p>
                      )}
                    </div>
                  </section>

                </Fragment>
              );
            })}

            {highlightLane !== null && boxes[highlightLane] && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 z-[35] bg-lit/5 ring-2 ring-inset ring-lit"
                style={{ top: boxes[highlightLane].top, height: boxes[highlightLane].height }}
              />
            )}

            </div>

            {/* The year axis closes the lanes and stays at the bottom edge of the scroller while the lanes scroll. */}
            <div
              className="sticky bottom-0 z-40 flex shrink-0 border-t border-border bg-canvas"
              style={{ height: AXIS_HEIGHT }}
            >
              <div
                ref={cornerRef}
                className={cn("w-[var(--lane-head)] shrink-0", !sidebar && "sticky left-0 z-50 border-r border-border bg-canvas")}
              />
              <div aria-hidden className="relative shrink-0" style={{ width }}>
                {layout.ticks.map((tick) => (
                  <span
                    key={tick.year}
                    className="absolute top-0 flex -translate-x-1/2 flex-col items-center"
                    style={{ left: tick.x }}
                  >
                    <span className={cn("w-px", tick.kind === "decade" ? "h-3 bg-muted" : "h-1.5 bg-border")} />
                    {tick.label && (
                      <span
                        className={cn(
                          "mt-0.5 tabular-nums",
                          tick.kind === "decade" ? "text-xs font-semibold text-strong" : "text-[10px] text-muted",
                        )}
                      >
                        {tick.label}
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-px z-[60] w-10 bg-linear-to-r from-canvas to-transparent transition-opacity duration-150 motion-reduce:transition-none",
            sidebar ? "left-px" : "left-[calc(var(--lane-head)+1px)]",
            edges.left ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-px right-px z-[60] w-12 rounded-r-lg bg-linear-to-l from-canvas to-transparent transition-opacity duration-150 motion-reduce:transition-none",
            edges.right ? "opacity-100" : "opacity-0",
          )}
        />
      </div>
      </div>

      {/* After the timeline, so that the pinned bar follows the lanes in reading and tab order. */}
      <MinimapBar
        scrollerRef={scrollerRef}
        cornerRef={cornerRef}
        scrollerId={scrollerId}
        scale={scale}
        sharedFilms={minimapFilms.shared}
        filmTicks={minimapFilms.ticks}
        brush={onPeriodChange ? { span: periodSpan, period, years: periodYears, onChange: onPeriodChange } : undefined}
        leading={
          multi && !isCombined ? (
            <LaneAvatars people={lanes.map((lane) => lane.person)} activeIndex={activeLane} onJump={jumpToLane} />
          ) : null
        }
      >
        <div role="group" aria-label="Zoom" className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            className={buttonClass}
            aria-label="Zoom out"
            disabled={pxPerYear <= MIN_ZOOM}
            onClick={() => zoom("out")}
          >
            <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              <path d="M3.5 8h9" />
            </svg>
          </button>
          <span aria-live="polite" className="w-12 text-center text-xs tabular-nums text-muted max-sm:sr-only">
            <span className="sr-only">Zoom </span>
            {zoomPercent}%
          </span>
          <button
            type="button"
            className={buttonClass}
            aria-label="Zoom in"
            disabled={pxPerYear >= MAX_ZOOM}
            onClick={() => zoom("in")}
          >
            <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              <path d="M3.5 8h9M8 3.5v9" />
            </svg>
          </button>
        </div>
      </MinimapBar>

      {popoverTarget && popoverContent && (
        <FilmPopover
          id={popoverId}
          target={popoverTarget}
          content={popoverContent}
          lit={toneFor(popoverTarget.filmId) === "lit"}
          colorOf={colored ? (personId) => personColor(slots.get(personId) ?? 0) : undefined}
          today={today}
          bottomEdge={barTop}
          onDismiss={hidePopover}
        />
      )}
    </div>
  );
}
