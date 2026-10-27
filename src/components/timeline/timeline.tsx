"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { laneFacts, peopleHref, removePersonHref, yearSpan, type PersonRef } from "@/lib/lanes";
import { roleSummary } from "@/lib/roles";
import {
  AXIS_HEIGHT,
  CARD_WIDTH,
  DEFAULT_ZOOM,
  LINE_Y,
  MAX_ZOOM,
  MIN_ZOOM,
  axisRange,
  axisTicks,
  buildConnectors,
  cardTopInLane,
  centerYear,
  filmMembership,
  initialAnchorX,
  initialScrollLeft,
  makeScale,
  nextZoom,
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
import { LaneHeader } from "./lane-header";

export interface LaneData {
  person: PersonSummary;
  /** Films to show, already filtered for the minor toggle. */
  films: Film[];
  /** Films left out because they are minor (only counted while the toggle is off). */
  hiddenMinor: number;
}

interface TimelineProps {
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

const buttonClass =
  "inline-flex size-9 items-center justify-center rounded-md border border-border bg-surface text-strong hover:border-muted disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border";

export function Timeline({
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

  const scrollerRef = useRef<HTMLDivElement>(null);
  const cornerRef = useRef<HTMLDivElement>(null);
  const pendingCenter = useRef<number | null>(null);
  const didInitialScroll = useRef(false);

  const multi = lanes.length > 1;

  const layout = useMemo(() => {
    const years = lanes.flatMap((lane) => lane.films.map((film) => film.year));
    const range = axisRange(years, Number(today.slice(0, 4)));
    const scale = makeScale(range, pxPerYear);

    const packed = lanes.map((lane) =>
      packFilms(lane.films, { pxPerYear, axisStartYear: scale.axisStartYear, priorityIds: litIds }),
    );
    const boxes = stackLanes(packed.map(rowCount));
    const connectorLanes = packed.map((items, index) => ({ box: boxes[index], items }));
    const membership = filmMembership(connectorLanes);

    return {
      scale,
      ticks: axisTicks(scale),
      width: trackWidth(scale),
      packed,
      boxes,
      height: totalHeight(boxes),
      membership,
      connectors: multi ? buildConnectors(connectorLanes) : [],
      anchorX: initialAnchorX(packed, litIds),
    };
  }, [lanes, litIds, multi, pxPerYear, today]);

  const { scale, width, boxes } = layout;

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
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <label className="flex max-w-xl cursor-pointer items-start gap-2 text-sm text-body">
          <input
            type="checkbox"
            checked={includeMinor}
            onChange={(event) => toggleMinor(event.target.checked)}
            className="mt-0.5 size-4 shrink-0 cursor-pointer accent-accent-green"
          />
          <span>
            <span className="text-strong">Include minor credits</span> (cameos, uncredited, shorts, extras)
          </span>
        </label>

        <div role="group" aria-label="Zoom" className="flex items-center gap-1.5">
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
          <span aria-live="polite" className="w-12 text-center text-xs tabular-nums text-muted">
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
      </div>

      <div className="relative isolate [--lane-head:84px] sm:[--lane-head:224px]">
        <div
          ref={scrollerRef}
          role="region"
          aria-label="Film timeline. Scroll sideways to see more years."
          tabIndex={0}
          onScroll={updateEdges}
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
                  />
                  <div className="relative shrink-0" style={{ width, ...gridStyle }}>
                    {items.length > 0 ? (
                      <ol className="m-0 list-none p-0">
                        {items.map(({ film, x, row }) => (
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
                        ))}
                      </ol>
                    ) : (
                      <p className="sticky left-[var(--lane-head)] w-max max-w-xs px-4 pt-8 text-sm text-muted">
                        {lane.hiddenMinor > 0
                          ? `No major credits found on TMDB. Turn on minor credits to see ${lane.hiddenMinor} more.`
                          : "No films found on TMDB."}
                      </p>
                    )}
                  </div>
                </section>
              );
            })}
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
