"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { connectionKey, connectionLegend, slotColor } from "@/lib/connections";
import { filmCardContent } from "@/lib/film-credits";
import { joinNames } from "@/lib/format";
import { laneFacts, peopleHref, removePersonHref, yearSpan, type PersonRef } from "@/lib/lanes";
import { laneScrollTop, mostVisibleLane } from "@/lib/lane-dock";
import { isReleased } from "@/lib/released";
import { MINOR_TOGGLE_LABEL, roleSummary } from "@/lib/roles";
import { nodeOnlyIds, rovingIndex, tabStopId } from "@/lib/roving";
import { shortName } from "@/lib/short-name";
import {
  AXIS_HEIGHT,
  DEFAULT_MAX_ROWS,
  DEFAULT_ZOOM,
  DOT_HIT_SIZE,
  LINE_Y,
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
  makeScale,
  nextZoom,
  nodeHitWidths,
  overflowCount,
  packFilms,
  quietFilmIds,
  rowCount,
  scrollLeftForCenter,
  sharedAcrossLanes,
  stackLanes,
  totalHeight,
  trackWidth,
  xForYear,
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
import { MinimapBar, type MinimapFilm } from "./minimap";
import { scrollBehavior } from "./scroll-behavior";
import { useDragPan } from "./use-drag-pan";

export interface LaneData {
  person: PersonSummary;
  /** Films to show, already filtered for the minor toggle. */
  films: Film[];
  /** Films left out because they are minor (only counted while the toggle is off). */
  hiddenMinor: number;
}

interface TimelineProps {
  /** The page title (an h1); the minor-credits toggle sits at the right of its row. */
  heading: ReactNode;
  lanes: LaneData[];
  /** Everyone on the page, in URL order; used for the remove links. */
  people: PersonRef[];
  /** Ids of released films shared by every lane (with the current minor setting). */
  litIds: ReadonlySet<number>;
  includeMinor: boolean;
  onIncludeMinorChange: (next: boolean) => void;
  /**
   * yyyy-mm-dd (UTC), the one date the page computed on the server: a film released after it is
   * upcoming (see `isReleased`) and never connects. It is a prop, never read from the clock here,
   * because it changes the layout and the server and the browser must draw the same one.
   */
  today: string;
  selectedId: number | null;
  onSelect: (id: number, trigger: HTMLElement) => void;
}

/** How long the lane a top-bar avatar jumped to keeps its highlight ring. */
const HIGHLIGHT_MS = 1000;
/** Quiet time after the last scroll event before an avatar jump counts as finished. */
const SETTLE_MS = 160;

const buttonClass =
  "inline-flex size-9 items-center justify-center rounded-md border border-border bg-surface text-strong hover:border-muted disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border";

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
  heading,
  lanes,
  people,
  litIds,
  includeMinor,
  onIncludeMinorChange,
  today,
  selectedId,
  onSelect,
}: TimelineProps) {
  const [pxPerYear, setPxPerYear] = useState(DEFAULT_ZOOM);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [edges, setEdges] = useState({ left: false, right: true });
  // Lanes (by person id) switched to unlimited rows with "Show all".
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<number>>(() => new Set());
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
  const didInitialScroll = useRef(false);
  const scrollFrame = useRef(0);
  const highlightTimer = useRef<number | undefined>(undefined);
  const settleTimer = useRef<number | undefined>(undefined);
  const hoverElement = useRef<HTMLElement | null>(null);
  /**
   * An avatar jump keeps its lane "active" even if the scroller cannot scroll far enough to make
   * it the most visible one (the last lanes), until the visitor scrolls somewhere else.
   */
  const jump = useRef<{ lane: number; settledTop: number | null } | null>(null);

  const multi = lanes.length > 1;

  const layout = useMemo(() => {
    const years = lanes.flatMap((lane) => lane.films.map((film) => film.year));
    const range = axisRange(years, Number(today.slice(0, 4)));
    const scale = makeScale(range, pxPerYear);
    const base = { pxPerYear, axisStartYear: scale.axisStartYear };
    const common = { scale, ticks: axisTicks(scale), width: trackWidth(scale) };

    // A film shown in two or more lanes gets its own poster in each of them, placed first (ahead
    // of the row cap) so it keeps a card, on the lowest row it can have, in every lane that has it.
    // Only released films connect: an announced film both lanes list is an ordinary upcoming poster in each.
    const priorityIds = sharedAcrossLanes(lanes, today);
    // While something is connected, the films that are not get a smaller card (and so pack tighter).
    const quietIds = quietFilmIds(lanes, today);

    // Connector lines run through the poster rows of the lanes above their last node.
    const obstacles = laneObstacles(lanes, base, today);
    const optionsFor = (index: number) => ({ ...base, priorityIds, quietIds, obstacles: obstacles[index] });
    const capped = lanes.map((lane, index) => packFilms(lane.films, { ...optionsFor(index), maxRows: DEFAULT_MAX_ROWS }));
    const overflow = capped.map(overflowCount);
    const items = lanes.map((lane, index) =>
      expandedIds.has(lane.person.id) && overflow[index] > 0 ? packFilms(lane.films, optionsFor(index)) : capped[index],
    );

    const stack = stackLanes(items.map(rowCount));
    const connectorLanes = items.map((laneItems, index) => ({ box: stack[index], items: laneItems }));
    const connectors = buildConnectors(connectorLanes, today);
    const membership = filmMembership(connectorLanes, today);

    // The kind of connection, the colour and the screen-reader note of each film shown in more than one lane.
    const names = lanes.map((lane) => shortName(lane.person.name, lane.person.id));
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
      quietIds,
      overflow,
      hitWidths: items.map(nodeHitWidths),
      boxes: stack,
      height: totalHeight(stack),
      membership,
      connectors,
      legend: connectionLegend(connectors, lanes.length),
      names,
      keys,
      accents,
      notes,
      anchorX: initialAnchorX(items, litIds),
    };
  }, [expandedIds, lanes, litIds, pxPerYear, today]);

  const { scale, width, boxes } = layout;

  // What the minimap marks: green nodes for films every lane shares, else a muted tick per film.
  const minimapFilms = useMemo(() => {
    const toMinimap = (film: Film): MinimapFilm => ({
      id: film.id,
      title: film.title,
      year: film.year,
      releaseDate: film.releaseDate,
    });
    if (multi && litIds.size > 0) {
      const shared = new Map<number, MinimapFilm>();
      for (const lane of lanes) {
        for (const film of lane.films) if (litIds.has(film.id) && !shared.has(film.id)) shared.set(film.id, toMinimap(film));
      }
      return { shared: [...shared.values()], ticks: [] };
    }
    const all = new Map<number, MinimapFilm>();
    for (const lane of lanes) for (const film of lane.films) if (!all.has(film.id)) all.set(film.id, toMinimap(film));
    return { shared: [], ticks: [...all.values()] };
  }, [lanes, litIds, multi]);

  const laneInfo = useMemo(
    () =>
      lanes.map((lane) => {
        const credits = lane.films.flatMap((film) => film.credits.filter((c) => includeMinor || !c.minor));
        const years = lane.films.map((film) => film.year);
        return {
          roles: roleSummary(credits),
          facts: laneFacts(lane.person, years),
          span: yearSpan(years),
          rolesByFilm: new Map(
            lane.films.map((film) => [film.id, roleSummary(film.credits.filter((c) => includeMinor || !c.minor))]),
          ),
        };
      }),
    [lanes, includeMinor],
  );

  // ---- scrolling ----------------------------------------------------------

  const viewportTrackWidth = () => {
    const scroller = scrollerRef.current;
    const corner = cornerRef.current;
    return scroller && corner ? scroller.clientWidth - corner.offsetWidth : 0;
  };

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
    if (scrollFrame.current) return;
    scrollFrame.current = requestAnimationFrame(() => {
      scrollFrame.current = 0;
      updateEdges();
      updateActiveLane();
    });
  }, [updateActiveLane, updateEdges]);

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

  // Start at the first film made together (or at the beginning for one lane).
  const { anchorX } = layout;
  useLayoutEffect(() => {
    if (didInitialScroll.current) return;
    didInitialScroll.current = true;
    const scroller = scrollerRef.current;
    if (scroller) scroller.scrollLeft = initialScrollLeft(anchorX, viewportTrackWidth());
  }, [anchorX]);

  // Zoom and the minor toggle can move the axis; keep whatever year was centred in place.
  const rememberCenter = () => {
    const scroller = scrollerRef.current;
    if (scroller) pendingCenter.current = centerYear(scroller.scrollLeft, viewportTrackWidth(), scale);
  };

  useLayoutEffect(() => {
    const year = pendingCenter.current;
    const scroller = scrollerRef.current;
    if (year === null || !scroller) return;
    pendingCenter.current = null;
    scroller.scrollLeft = scrollLeftForCenter(year, scroller.clientWidth - (cornerRef.current?.offsetWidth ?? 0), scale);
  });

  const zoom = (direction: "in" | "out") => {
    const next = nextZoom(pxPerYear, direction);
    if (next === pxPerYear) return;
    rememberCenter();
    setPxPerYear(next);
  };

  const toggleMinor = (next: boolean) => {
    rememberCenter();
    onIncludeMinorChange(next);
  };

  const toggleExpanded = useCallback((personId: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (!next.delete(personId)) next.add(personId);
      return next;
    });
  }, []);

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
            firstPersonId: lanes[popoverTarget.laneIndex]?.person.id ?? null,
          })
        : null,
    [popoverTarget, lanes, includeMinor],
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

  // Green for a film every lane shows, the colour of its pair for one only some lanes show, grey for the rest.
  const toneFor = (id: number): CardTone => {
    const lanesShowing = layout.membership.get(id)?.length ?? 0;
    if (lanesShowing < 2) return "plain";
    return lanesShowing === lanes.length ? "lit" : "some";
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

  const cardFor = (
    { film, x }: PackedFilm<Film>,
    laneIndex: number,
    top: number,
    roles: string,
  ) => {
    const tone = toneFor(film.id);
    const quiet = layout.quietIds.has(film.id);
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
        note={layout.notes.get(film.id) ?? ""}
        laneIndex={laneIndex}
        upcoming={!isReleased(film.releaseDate, today)}
        emphasized={hoveredId === film.id}
        dimmed={tone !== "plain" && activeKey !== null && layout.keys.get(film.id) !== activeKey}
        selected={selectedId === film.id}
        describedBy={describedByFor(film.id, laneIndex)}
        onSelect={handleSelect}
      />
    );
  };

  return (
    <div ref={rootRef}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        {heading}
        <label className="flex max-w-xl cursor-pointer items-start gap-2 text-sm text-body">
          <input
            type="checkbox"
            checked={includeMinor}
            onChange={(event) => toggleMinor(event.target.checked)}
            className="mt-0.5 size-4 shrink-0 cursor-pointer accent-accent-green"
          />
          <span>
            <span className="text-strong">{MINOR_TOGGLE_LABEL}</span>
          </span>
        </label>
      </div>

      <ConnectionLegend
        entries={layout.legend}
        names={layout.names}
        laneCount={lanes.length}
        activeKey={activeKey}
        pinnedKey={pinnedKey}
        onPreview={setPreviewKey}
        onTogglePin={(key) => setPinnedKey((prev) => (prev === key ? null : key))}
      />

      {/*
        --chrome: what sits above the scroller, the title and the legend, plus the pinned bar below it. The scroller is as
        tall as what is left of the viewport, so that the year axis at its bottom edge shows right above the bar when the page
        is at the top, instead of under it (but never shorter than 26rem; a phone scrolls the page instead).
      */}
      <div
        className={cn(
          "relative isolate [--lane-head:84px] sm:[--lane-head:224px]",
          layout.legend.length > 0 ? "[--chrome:14.5rem]" : "[--chrome:12rem]",
        )}
      >
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
          className="max-h-[clamp(26rem,calc(100dvh-var(--chrome)),1100px)] cursor-grab overflow-auto overscroll-x-contain rounded-lg border border-border bg-canvas [scroll-padding-left:var(--lane-head)] [scroll-padding-bottom:44px] [scrollbar-color:var(--text-muted)_transparent] [scrollbar-width:thin] data-[panning]:select-none [&[data-panning]_*]:cursor-grabbing! [&_[data-lane-head]]:cursor-auto"
        >
          <div className="relative min-w-full" style={{ width: `calc(var(--lane-head) + ${width}px)` }}>
            {/*
              Lane lines, connectors and nodes: pure geometry from the layout, drawn over the poster
              cards of films that are in one lane only (but under the lane headers and under the
              posters of shared films). A connector is one line from a film's node in the first lane
              that shows it to its node in the last. It runs behind the shared posters in its way,
              its own included (so it enters its poster from above and leaves below the caption),
              and over every other poster, 2px wide on a thin dark halo so it stays legible over
              the poster art.
            */}
            <svg
              aria-hidden
              className="pointer-events-none absolute top-0 z-[15]"
              style={{ left: "var(--lane-head)" }}
              width={width}
              height={layout.height}
            >
              {layout.items.map((items, laneIndex) => {
                const y = boxes[laneIndex].top + LINE_Y;
                const first = items[0]?.x ?? width;
                const last = items[items.length - 1]?.x ?? width;
                return (
                  <g key={lanes[laneIndex].person.id}>
                    <line x1={0} x2={first} y1={y} y2={y} strokeDasharray="3 5" className="stroke-muted/40" />
                    {items.length > 0 && <line x1={first} x2={last} y1={y} y2={y} className="stroke-muted/70" />}
                    <line x1={last} x2={width} y1={y} y2={y} strokeDasharray="3 5" className="stroke-muted/40" />
                  </g>
                );
              })}
              {/* Every halo first, so that no film's halo dims the coloured line of a film released days from it. */}
              {layout.connectors.map((c) => {
                const key = connectionKey(c.slot);
                const strokeWidth = hoveredId === c.filmId || activeKey === key ? 3 : 2;
                return (
                  <line
                    key={c.filmId}
                    x1={c.x}
                    x2={c.x}
                    y1={c.y1}
                    y2={c.y2}
                    strokeWidth={strokeWidth + 3}
                    opacity={activeKey !== null && activeKey !== key ? DIMMED : 1}
                    className="stroke-black/70"
                  />
                );
              })}
              {layout.connectors.map((c) => {
                const key = connectionKey(c.slot);
                const strokeWidth = hoveredId === c.filmId || activeKey === key ? 3 : 2;
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
                    opacity={activeKey !== null && activeKey !== key ? DIMMED : 1}
                    style={{ stroke: c.kind === "all" ? "var(--lit)" : slotColor(c.slot ?? 0), ...(c.kind === "all" ? LIT_GLOW : undefined) }}
                  />
                );
              })}
              {layout.items.map((items, laneIndex) => {
                const y = boxes[laneIndex].top + LINE_Y;
                return (
                  <g key={lanes[laneIndex].person.id}>
                    {items.map(({ film, x }) => {
                      const tone = toneFor(film.id);
                      const dimmed = activeKey !== null && tone !== "plain" && layout.keys.get(film.id) !== activeKey;
                      return (
                        <circle
                          key={film.id}
                          cx={x}
                          cy={y}
                          r={NODE_RADIUS[tone]}
                          opacity={dimmed ? DIMMED : 1}
                          stroke={tone === "plain" ? undefined : "var(--bg)"}
                          strokeWidth={tone === "plain" ? undefined : 1.5}
                          style={{
                            ...(tone === "lit" ? LIT_GLOW : undefined),
                            fill: tone === "lit" ? "var(--lit)" : (layout.accents.get(film.id) ?? "var(--text-muted)"),
                          }}
                        />
                      );
                    })}
                  </g>
                );
              })}
            </svg>

            {lanes.map((lane, laneIndex) => {
              const { person } = lane;
              const items = layout.items[laneIndex];
              const info = laneInfo[laneIndex];
              // A film with a poster card in this lane is reached through the card; the films that
              // are only a node share the lane's one roving tab stop.
              const tabStop = tabStopId(nodeOnlyIds(items), tabStops[laneIndex]);
              const nodeFor = (item: PackedFilm<Film>, decorative: boolean) => (
                <FilmNode
                  key={item.film.id}
                  id={item.film.id}
                  title={item.film.title}
                  year={item.film.year}
                  roles={info.rolesByFilm.get(item.film.id) ?? ""}
                  note={layout.notes.get(item.film.id) ?? ""}
                  x={item.x}
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
                    aria-labelledby={`person-${person.id}`}
                    className="flex"
                    style={{ height: boxes[laneIndex].height }}
                  >
                    <LaneHeader
                      person={person}
                      roles={info.roles}
                      facts={info.facts}
                      span={info.span}
                      soloHref={multi ? peopleHref([person]) : null}
                      removeHref={removePersonHref(people, person.id)}
                      overflowCount={layout.overflow[laneIndex]}
                      expanded={expandedIds.has(person.id)}
                      onToggleExpanded={() => toggleExpanded(person.id)}
                      divider={laneIndex < lanes.length - 1}
                    />
                    <div
                      className={cn("relative shrink-0", laneIndex < lanes.length - 1 && "border-b border-border")}
                      style={{ width, ...gridStyle }}
                    >
                      {items.length > 0 ? (
                        <>
                          <ol className="m-0 list-none p-0">
                            {items.map((item) =>
                              item.overflow
                                ? nodeFor(item, false)
                                : cardFor(item, laneIndex, cardTopInLane(item.row), info.rolesByFilm.get(item.film.id) ?? ""),
                            )}
                          </ol>
                          {/* Mouse targets on the nodes of films that have a card: not part of the list or the tab order. */}
                          {items.filter((item) => !item.overflow).map((item) => nodeFor(item, true))}
                        </>
                      ) : (
                        <p className="sticky left-[var(--lane-head)] w-max max-w-xs px-4 pt-8 text-sm text-muted">
                          {lane.hiddenMinor > 0
                            ? `No major credits found on TMDB. Turn on "${MINOR_TOGGLE_LABEL}" to see ${lane.hiddenMinor} more.`
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

            {/* The year axis closes the lanes and stays at the bottom edge of the scroller while the lanes scroll. */}
            <div
              className="sticky bottom-0 z-40 flex border-t border-border bg-canvas"
              style={{ height: AXIS_HEIGHT }}
            >
              <div
                ref={cornerRef}
                className="sticky left-0 z-50 w-[var(--lane-head)] shrink-0 border-r border-border bg-canvas"
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
            "pointer-events-none absolute inset-y-px left-[calc(var(--lane-head)+1px)] z-[60] w-10 bg-linear-to-r from-canvas to-transparent transition-opacity duration-150 motion-reduce:transition-none",
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

      {/* After the timeline, so that the pinned bar follows the lanes in reading and tab order. */}
      <MinimapBar
        scrollerRef={scrollerRef}
        cornerRef={cornerRef}
        scrollerId={scrollerId}
        scale={scale}
        sharedFilms={minimapFilms.shared}
        filmTicks={minimapFilms.ticks}
        leading={
          multi ? (
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
          today={today}
          bottomEdge={barTop}
          onDismiss={hidePopover}
        />
      )}
    </div>
  );
}
