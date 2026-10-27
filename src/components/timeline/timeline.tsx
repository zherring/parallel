"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { laneFacts, peopleHref, removePersonHref, yearSpan, type PersonRef } from "@/lib/lanes";
import { laneScrollTop, mostVisibleLane } from "@/lib/lane-dock";
import { MINOR_TOGGLE_LABEL, roleSummary } from "@/lib/roles";
import {
  AXIS_HEIGHT,
  CARD_WIDTH,
  DEFAULT_MAX_ROWS,
  DEFAULT_ZOOM,
  DOT_HIT_SIZE,
  LINE_Y,
  MAX_ZOOM,
  MIN_ZOOM,
  axisRange,
  axisTicks,
  buildConnectors,
  cardTopInLane,
  centerYear,
  dotHitWidths,
  filmMembership,
  initialAnchorX,
  initialScrollLeft,
  makeScale,
  nextZoom,
  overflowCount,
  packFilms,
  rowCount,
  scrollLeftForCenter,
  stackLanes,
  totalHeight,
  trackWidth,
  xForYear,
} from "@/lib/timeline-layout";
import type { Film, PersonSummary } from "@/lib/types";
import { cn } from "./cn";
import { FilmCard, type CardTone } from "./film-card";
import { FilmDot } from "./film-dot";
import { LaneDock, DOCK_HEIGHT } from "./lane-dock";
import { LaneHeader } from "./lane-header";
import { MinimapBar, type MinimapFilm } from "./minimap";
import { scrollBehavior } from "./scroll-behavior";

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
  /** Ids of films shared by every lane (with the current minor setting). */
  litIds: ReadonlySet<number>;
  includeMinor: boolean;
  onIncludeMinorChange: (next: boolean) => void;
  /** yyyy-mm-dd; anything later is upcoming. */
  today: string;
  selectedId: number | null;
  onSelect: (id: number, trigger: HTMLElement) => void;
}

const END_INSET = 5;
/** How long the lane a dock avatar jumped to keeps its highlight ring. */
const HIGHLIGHT_MS = 1000;
/** Quiet time after the last scroll event before a dock jump counts as finished. */
const SETTLE_MS = 160;

const buttonClass =
  "inline-flex size-9 items-center justify-center rounded-md border border-border bg-surface text-strong hover:border-muted disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border";

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

  // Lane most in view (green ring on its dock avatar) and the lane just jumped to (ring on the lane).
  const [activeLane, setActiveLane] = useState(0);
  const [highlightLane, setHighlightLane] = useState<number | null>(null);

  const scrollerId = useId();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const cornerRef = useRef<HTMLDivElement>(null);
  const pendingCenter = useRef<number | null>(null);
  const didInitialScroll = useRef(false);
  const scrollFrame = useRef(0);
  const highlightTimer = useRef<number | undefined>(undefined);
  const settleTimer = useRef<number | undefined>(undefined);
  /**
   * A dock jump keeps its lane "active" even if the scroller cannot scroll far enough to make
   * it the most visible one (the last lanes), until the visitor scrolls somewhere else.
   */
  const jump = useRef<{ lane: number; settledTop: number | null } | null>(null);

  const multi = lanes.length > 1;

  const layout = useMemo(() => {
    const years = lanes.flatMap((lane) => lane.films.map((film) => film.year));
    const range = axisRange(years, Number(today.slice(0, 4)));
    const scale = makeScale(range, pxPerYear);

    // Films shown in two or more lanes always keep a poster card (so their connector has
    // both ends); those shared by every lane (litIds) are also placed first.
    const lanesShowing = new Map<number, number>();
    for (const lane of lanes) {
      for (const film of lane.films) lanesShowing.set(film.id, (lanesShowing.get(film.id) ?? 0) + 1);
    }
    const exemptIds = new Set<number>();
    for (const [id, count] of lanesShowing) if (count > 1 && !litIds.has(id)) exemptIds.add(id);

    const options = { pxPerYear, axisStartYear: scale.axisStartYear, priorityIds: litIds, exemptIds };
    const capped = lanes.map((lane) => packFilms(lane.films, { ...options, maxRows: DEFAULT_MAX_ROWS }));
    const overflow = capped.map(overflowCount);
    const packed = lanes.map((lane, index) =>
      expandedIds.has(lane.person.id) && overflow[index] > 0 ? packFilms(lane.films, options) : capped[index],
    );
    const boxes = stackLanes(packed.map(rowCount));
    const connectorLanes = packed.map((items, index) => ({ box: boxes[index], items }));
    const membership = filmMembership(connectorLanes);

    return {
      scale,
      ticks: axisTicks(scale),
      width: trackWidth(scale),
      packed,
      overflow,
      dotWidths: packed.map(dotHitWidths),
      boxes,
      height: totalHeight(boxes),
      membership,
      connectors: multi ? buildConnectors(connectorLanes) : [],
      anchorX: initialAnchorX(packed, litIds),
    };
  }, [expandedIds, lanes, litIds, multi, pxPerYear, today]);

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

  const handleHover = useCallback((id: number | null) => setHoveredId(id), []);

  const toggleExpanded = useCallback((personId: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (!next.delete(personId)) next.add(personId);
      return next;
    });
  }, []);

  // ---- render -------------------------------------------------------------

  const dimUnlit = multi && litIds.size > 0;
  const toneFor = (id: number): CardTone => {
    if (!multi) return "plain";
    if (litIds.has(id)) return "lit";
    if ((layout.membership.get(id)?.length ?? 0) > 1) return "some";
    return dimUnlit ? "dim" : "plain";
  };

  const firstDecade = Math.ceil(scale.axisStartYear / 10) * 10;
  const gridStyle = {
    backgroundImage:
      "linear-gradient(to right, color-mix(in srgb, var(--border) 70%, transparent) 1px, transparent 1px)",
    backgroundSize: `${10 * pxPerYear}px 100%`,
    backgroundPosition: `${xForYear(scale, firstDecade)}px 0`,
  };

  const zoomPercent = Math.round((pxPerYear / DEFAULT_ZOOM) * 100);

  return (
    <div>
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

      <MinimapBar
        scrollerRef={scrollerRef}
        cornerRef={cornerRef}
        scrollerId={scrollerId}
        scale={scale}
        sharedFilms={minimapFilms.shared}
        filmTicks={minimapFilms.ticks}
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

      <div className="relative isolate [--lane-head:84px] sm:[--lane-head:224px]">
        <div
          ref={scrollerRef}
          id={scrollerId}
          role="region"
          aria-label="Film timeline. Scroll sideways to see more years."
          tabIndex={0}
          onScroll={handleScroll}
          className="max-h-[min(85dvh,1100px)] overflow-auto overscroll-x-contain rounded-lg border border-border bg-canvas [scroll-padding-left:var(--lane-head)] [scroll-padding-top:44px] [scrollbar-color:var(--text-muted)_transparent] [scrollbar-width:thin]"
        >
          <div className="relative min-w-full" style={{ width: `calc(var(--lane-head) + ${width}px)` }}>
            <div
              className="sticky top-0 z-40 flex border-b border-border bg-canvas"
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
                    className="absolute bottom-0 flex -translate-x-1/2 flex-col items-center"
                    style={{ left: tick.x }}
                  >
                    {tick.label && (
                      <span
                        className={cn(
                          "mb-0.5 tabular-nums",
                          tick.kind === "decade" ? "text-xs font-semibold text-strong" : "text-[10px] text-muted",
                        )}
                      >
                        {tick.label}
                      </span>
                    )}
                    <span className={cn("w-px", tick.kind === "decade" ? "h-3 bg-muted" : "h-1.5 bg-border")} />
                  </span>
                ))}
              </div>
            </div>

            {/* Track lines, dots and connectors: pure geometry from the layout, drawn under the cards. */}
            <svg
              aria-hidden
              className="pointer-events-none absolute z-[5]"
              style={{ left: "var(--lane-head)", top: AXIS_HEIGHT }}
              width={width}
              height={layout.height}
            >
              {layout.packed.map((items, laneIndex) => {
                const y = boxes[laneIndex].top + LINE_Y;
                const first = items[0]?.x ?? width;
                const last = items[items.length - 1]?.x ?? width;
                return (
                  <g key={lanes[laneIndex].person.id}>
                    <line x1={0} x2={first} y1={y} y2={y} strokeDasharray="3 5" className="stroke-muted/40" />
                    {items.length > 0 && (
                      <line x1={first} x2={last} y1={y} y2={y} className="stroke-muted/70" />
                    )}
                    <line x1={last} x2={width} y1={y} y2={y} strokeDasharray="3 5" className="stroke-muted/40" />
                    {items.map(({ film, x }) => (
                      <circle
                        key={film.id}
                        cx={x}
                        cy={y}
                        r={litIds.has(film.id) && multi ? 3.5 : 2.5}
                        className={litIds.has(film.id) && multi ? "fill-lit" : "fill-muted"}
                      />
                    ))}
                  </g>
                );
              })}
              {layout.connectors.map((c) => {
                const all = c.kind === "all";
                const active = hoveredId === c.filmId;
                const stroke = all ? "stroke-lit" : "stroke-accent-blue";
                const fill = all ? "fill-lit" : "fill-accent-blue";
                return (
                  <g
                    key={`${c.filmId}-${c.fromLane}-${c.toLane}`}
                    style={all ? { filter: "drop-shadow(0 0 3px var(--lit-glow))" } : undefined}
                    opacity={active || all ? 1 : 0.75}
                  >
                    <line
                      x1={c.x}
                      x2={c.x}
                      y1={c.y1 + END_INSET}
                      y2={c.y2 - END_INSET}
                      strokeWidth={all ? (active ? 3 : 2) : active ? 2 : 1.25}
                      className={stroke}
                    />
                    <circle cx={c.x} cy={c.y1 + END_INSET} r={all ? 3 : 2.25} className={fill} />
                    <circle cx={c.x} cy={c.y2 - END_INSET} r={all ? 3 : 2.25} className={fill} />
                  </g>
                );
              })}
            </svg>

            {lanes.map((lane, laneIndex) => {
              const { person } = lane;
              const items = layout.packed[laneIndex];
              const info = laneInfo[laneIndex];
              return (
                <section
                  key={person.id}
                  aria-labelledby={`person-${person.id}`}
                  className="flex border-b border-border last:border-b-0"
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
                  />
                  <div className="relative shrink-0" style={{ width, ...gridStyle }}>
                    {items.length > 0 ? (
                      <ol className="m-0 list-none p-0">
                        {items.map(({ film, x, row, overflow }) =>
                          overflow ? (
                            <FilmDot
                              key={film.id}
                              id={film.id}
                              title={film.title}
                              year={film.year}
                              x={x}
                              hitWidth={layout.dotWidths[laneIndex].get(film.id) ?? DOT_HIT_SIZE}
                              selected={selectedId === film.id}
                              onSelect={onSelect}
                            />
                          ) : (
                            <FilmCard
                              key={film.id}
                              id={film.id}
                              title={film.title}
                              year={film.year}
                              posterPath={film.posterPath}
                              roles={info.rolesByFilm.get(film.id) ?? ""}
                              left={x - CARD_WIDTH / 2}
                              top={cardTopInLane(row)}
                              tone={toneFor(film.id)}
                              upcoming={film.releaseDate > today}
                              emphasized={hoveredId === film.id}
                              selected={selectedId === film.id}
                              onSelect={onSelect}
                              onHover={handleHover}
                            />
                          ),
                        )}
                      </ol>
                    ) : (
                      <p className="sticky left-[var(--lane-head)] w-max max-w-xs px-4 pt-8 text-sm text-muted">
                        {lane.hiddenMinor > 0
                          ? `No major credits found on TMDB. Turn on "${MINOR_TOGGLE_LABEL}" to see ${lane.hiddenMinor} more.`
                          : "No films found on TMDB."}
                      </p>
                    )}
                  </div>
                </section>
              );
            })}

            {highlightLane !== null && boxes[highlightLane] && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 z-[35] bg-lit/5 ring-2 ring-inset ring-lit"
                style={{ top: AXIS_HEIGHT + boxes[highlightLane].top, height: boxes[highlightLane].height }}
              />
            )}

            {multi && (
              <>
                {/* Room under the last lane for the dock, so it never sits on a lane header. */}
                <div aria-hidden style={{ height: DOCK_HEIGHT }} />
                <div className="sticky bottom-0 left-0 z-30 h-0 w-[var(--lane-head)]">
                  <LaneDock
                    people={lanes.map((lane) => lane.person)}
                    activeIndex={activeLane}
                    onJump={jumpToLane}
                  />
                </div>
              </>
            )}
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
    </div>
  );
}
