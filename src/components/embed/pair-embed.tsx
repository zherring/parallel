"use client";

import { RotateCcw } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { EMBED_BUTTON, EXTERNAL, EmbedWordmark, OpenInParallel, FRAME_STYLE, embedSize as size } from "@/components/embed/embed-shell";
import { PairPoster, POSTER_PX } from "@/components/embed/pair-poster";
import { springEasing } from "@/components/landing/hero-motion";
import { PersonAvatar } from "@/components/person-avatar";
import { cn } from "@/components/timeline/cn";
import { COMPACT_MINIMAP_HEIGHT } from "@/components/timeline/minimap";
import { Timeline, type LaneData, type TimelineHandle } from "@/components/timeline/timeline";
import { joinNames } from "@/lib/format";
import { peopleHref } from "@/lib/lanes";
import { captionText, type OgCard } from "@/lib/og-card";
import { personColor, personColorCss } from "@/lib/person-colors";
import { embedRowsFor, embedTrackHeight } from "@/lib/timeline-layout";
import type { PersonTimeline } from "@/lib/types";

interface PairEmbedProps {
  /** The pair's canonical slug (`/p/<slug>`), what every link of the frame is built from. */
  slug: string;
  timelines: PersonTimeline[];
  /** yyyy-mm-dd (UTC), computed once on the server, as the page's: the timeline lays out the same here. */
  today: string;
  /** The preview card's content (`buildOgCard`): what the first frame draws, the picture X shows as the poster. */
  card: OgCard;
  /** The films they made together ("11 films together"), or one person's films; null when there is no number to say. */
  count: number | null;
}

/** The sequence's beats, in milliseconds. The first frame is held (`HOLD`) so that the picture X showed is seen as it was before it moves. */
const HOLD = 650;
/** Replaying holds the picture for less: the visitor asked for it. */
const REPLAY_HOLD = 250;
/** The posters lift one after another along the lane, this far apart, each for `LIFT`. */
const LIFT_STAGGER = 105;
const LIFT = 640;
/** The picture gives way to the timeline this long after the sequence starts, over `OPEN`. */
const OPEN_AT = 1500;
const OPEN = 560;
/** The timeline rises into place (a spring, see `springEasing`) and the count is counted, as it opens. */
const RISE = 720;
const COUNT = 800;
/** The timeline's track glides this far (px) into the years the pair made films in, as it opens. */
const GLIDE = 220;
const GLIDE_MS = 900;
/** The picture is waited for this long before the sequence starts without the images that did not come (a slow connection shows initials, as the card does). */
const IMAGES_MS = 2500;
/** Reduced motion: the picture is held this long on a replay before the plain fade to the timeline. */
const REDUCED_REPLAY_HOLD = 700;
/**
 * The bar's room from the frame's edges: the top and the sides (the unit follows the frame, never under these pixels), and the height of its row under the top.
 * The compact minimap's gutter is the sides'.
 */
const INSET_TOP = size(12, 1.8);
const INSET_X = size(16, 2.6);
const BAR_ROW = 34;
/**
 * A frame shorter than this (px) has no minimap strip: with it the track would have to be drawn under three quarters of its size (a 390 x 253 panel draws it at
 * about four fifths, and the strip is there), and the strip is only a second way to scrub: the track is still dragged, swiped and sent sideways by a sideways
 * wheel. The 600 x 315 an inline card is, and everything above it, always has the strip.
 */
const MINIMAP_MIN_FRAME_HEIGHT = 240;

/** `?motion=reduce` plays the reduced-motion sequence in a development build (the X preview page's toggle): production reads only the visitor's own setting. */
function wantsReducedMotion(): boolean {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return true;
  if (process.env.NODE_ENV === "production") return false;
  try {
    return new URLSearchParams(window.location.search).get("motion") === "reduce";
  } catch {
    return false;
  }
}

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/** Resolves when every image under `root` is decoded (or failed), or after `ms`: whichever is first. */
function imagesReady(root: HTMLElement, ms: number): Promise<void> {
  const decodes = [...root.querySelectorAll("img")].map((img) => (img.decode ? img.decode().catch(() => undefined) : Promise.resolve()));
  return Promise.race([Promise.all(decodes).then(() => undefined), new Promise<void>((resolve) => window.setTimeout(resolve, ms))]);
}

/**
 * Where the track scrolls to (px) so that the pair's films are in view: the middle of the films from the first to the last of the card's posters when they
 * fit the track, else the first of them near the left edge. Read from the cards on the track, which is where they are; null when none is on it.
 */
function pairScrollLeft(scroller: HTMLElement, filmIds: readonly number[]): number | null {
  const box = scroller.getBoundingClientRect();
  // The timeline is drawn smaller than its layout in a short frame (see `fit`): what is read from the screen is in the drawn size, the track's scrolling in its own.
  const drawn = scroller.offsetWidth > 0 && box.width > 0 ? box.width / scroller.offsetWidth : 1;
  const spans = filmIds.flatMap((id) => {
    const rect = scroller.querySelector<HTMLElement>(`[data-film="${id}"]`)?.getBoundingClientRect();
    return rect ? [{ left: (rect.left - box.left) / drawn + scroller.scrollLeft, right: (rect.right - box.left) / drawn + scroller.scrollLeft }] : [];
  });
  if (spans.length === 0) return null;
  const left = Math.min(...spans.map((s) => s.left));
  const right = Math.max(...spans.map((s) => s.right));
  const margin = 32;
  const wanted = right - left <= scroller.clientWidth - 2 * margin ? (left + right) / 2 - scroller.clientWidth / 2 : left - margin;
  return Math.max(0, Math.min(wanted, scroller.scrollWidth - scroller.clientWidth));
}

/**
 * Counts from 0 to `to` when `start` changes to a number past 0 (a token: the sequence's run), and shows `to` otherwise: first frames and no-JS see the number
 * itself. (It starts in the frame after the bar begins to fade in, so that the number is not seen whole before it counts.)
 */
function CountUp({ to, start }: { to: number; start: number }) {
  const [shown, setShown] = useState(to);
  useEffect(() => {
    if (start === 0) return;
    const begin = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - begin) / COUNT);
      setShown(Math.round(to * easeOutCubic(t)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [start, to]);
  return <span className="tabular-nums">{shown}</span>;
}

const subscribeNever = () => () => {};
const onTheClient = () => true;
const onTheServer = () => false;

/**
 * What X shows inside a post for a link to a pair (`twitter:card=player`, the page at `/embed/p/<people>`): the pair's preview card, which comes alive and opens up
 * into the pair's timeline, so that the post itself is the first look at their films.
 *
 * It opens on the preview card exactly (`PairPoster`: the same picture as the PNG X shows as the poster until this frame loads, so the hand-off is not seen). Then, once
 * the pictures are in and the first frame has been held a moment: the posters lift one after another along the lane, their green nodes swelling; the headshots do not
 * move (they stay as the picture shows them, with nothing drawn round them); the card gives way to the timeline (it settles up from below on the site's spring while the
 * card lifts and blurs away), which glides into the years the pair worked together, and the count of their films counts in. A visitor who asked for less motion gets the timeline with a plain fade, no
 * sequence. Replay starts it again. With no script the first frame stays, with its link to the page.
 *
 * The timeline is the page's own (`Timeline`, in its `embed` mode: the combined track, the same cards, nodes, connections and hover card), so panning, zooming by the
 * browser, and hovering or pressing a film work as they do on the site; the pressed film's card replaces its panel, which a frame has no room for. The frame never scrolls
 * up or down (that is the feed's gesture): the timeline is one or two rows of cards over the year axis and the compact minimap, drawn at the size that fits the frame's height (`fit`),
 * and pans sideways only. The people's names and
 * pictures lead to their pages (a bio is the person's own page, which opens in a new tab: X sandboxes the frame, so nothing here navigates it or needs a cookie or a request).
 */
export function PairEmbed({ slug, timelines, today, card, count }: PairEmbedProps) {
  const [phase, setPhase] = useState<"poster" | "timeline">("poster");
  /** Counts up with each Replay; the sequence runs once for each. */
  const [run, setRun] = useState(0);
  /** The timeline is built after the first render, in the browser only: the server's HTML (and the browser's first render, which must match it) is the first frame and nothing else. */
  const mounted = useSyncExternalStore(subscribeNever, onTheClient, onTheServer);
  /** The run the count was last asked to count in for; 0 before the first. */
  const [counted, setCounted] = useState(0);
  const frameRef = useRef<HTMLDivElement>(null);
  const posterRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  /** The frame's height and the room under the bar (px), measured in the browser: what the timeline is fitted to (see `fit`). */
  const [room, setRoom] = useState<{ frame: number; width: number; height: number } | null>(null);
  const timelineRef = useRef<TimelineHandle>(null);

  const people = useMemo(() => timelines.map((t) => ({ id: t.person.id, name: t.person.name })), [timelines]);
  const multi = timelines.length > 1;
  // Three or four people crowd the bar in a narrow frame (the panel X opens over a phone): there the wordmark gives way to the people (the way to the site is
  // still the pill's). Two fit with the wordmark down to a very small phone, and then it goes too. On the smallest phones (under 22rem) the people's
  // pictures overlap a little, as the site's own lane avatars do, each still a target of its own.
  const crowded = timelines.length > 2;
  const wordmarkHides = crowded ? "@max-[30rem]:hidden" : multi ? "@max-[22rem]:hidden" : "";
  const lanes: LaneData[] = useMemo(
    () =>
      timelines.map(({ person, films }) => ({
        person,
        films: films.filter((film) => !film.minor),
        hiddenMinorIds: films.filter((film) => film.minor).map((film) => film.id),
      })),
    [timelines],
  );
  const posterFilmIds = useMemo(() => card.posters.map((poster) => poster.id), [card.posters]);
  const names = joinNames(people.map((p) => p.name));
  const summary = card.caption ? captionText(card.caption) : null;

  // The first frame's pictures are the card's; the timeline's own are fetched from TMDB as it scrolls to them.
  const open = useCallback(() => {
    const scroller = timelineRef.current?.getScroller();
    const left = scroller ? pairScrollLeft(scroller, posterFilmIds) : null;
    return { scroller, left };
  }, [posterFilmIds]);

  // The sequence: once per run, from the first frame. Everything it moves is a plain element animated with the Web Animations API, and all of it is undone when the run is.
  useEffect(() => {
    if (!mounted) return;
    const reduced = wantsReducedMotion();
    const poster = posterRef.current;
    const layer = layerRef.current;
    if (!poster || !layer) return;
    const animations: Animation[] = [];
    const timers: number[] = [];
    let frame = 0;
    let cancelled = false;
    const later = (fn: () => void, ms: number) => timers.push(window.setTimeout(() => !cancelled && fn(), ms));
    const parts = (name: string) => [...poster.querySelectorAll<HTMLElement>(`[data-part="${name}"]`)];
    const play = (el: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions) => animations.push(el.animate(keyframes, { fill: "both", ...options }));

    // Under reduced motion the card is only a first frame: the timeline fades in over it (at once on the first run; after a moment's look on a replay).
    if (reduced) {
      const { scroller, left } = open();
      if (scroller && left !== null) scroller.scrollLeft = left;
      later(() => setPhase("timeline"), run === 0 ? 0 : REDUCED_REPLAY_HOLD);
      return () => {
        cancelled = true;
        timers.forEach(window.clearTimeout);
      };
    }

    void imagesReady(poster, IMAGES_MS).then(() => {
      if (cancelled) return;
      const { scroller, left } = open();
      // The track starts where the pair's films are (a little before them, to glide into place as the timeline opens).
      const start = scroller && left !== null ? Math.max(0, left - GLIDE) : null;
      if (scroller && start !== null) scroller.scrollLeft = start;
      // The first frame is held first: the picture X showed is seen as it was before it moves (a replay holds it for less).
      const hold = run === 0 ? HOLD : REPLAY_HOLD;

      later(() => {
        // 1. The posters lift one after another along the lane, and each film's green node swells as its poster comes up.
        const posters = parts("poster");
        const nodes = parts("node");
        posters.forEach((el, i) =>
          play(el, [{ transform: "translate3d(0, 0, 0) scale(1)" }, { transform: "translate3d(0, -9%, 0) scale(1.06)", offset: 0.42 }, { transform: "translate3d(0, 0, 0) scale(1)" }], {
            duration: LIFT,
            delay: i * LIFT_STAGGER,
            easing: "ease-in-out",
          }),
        );
        nodes.forEach((el, i) =>
          play(el, [{ transform: "scale(1)" }, { transform: "scale(1.7)", offset: 0.42 }, { transform: "scale(1)" }], { duration: LIFT, delay: i * LIFT_STAGGER, easing: "ease-in-out" }),
        );
        // 2. The numbers of the caption tick. (The headshots do not move, and nothing is drawn round them: they stay as the first frame shows them.)
        parts("accent").forEach((el, i) =>
          play(el, [{ transform: "scale(1)" }, { transform: "scale(1.16)", offset: 0.4 }, { transform: "scale(1)" }], { duration: 460, delay: 700 + i * 120, easing: "ease-in-out" }),
        );
      }, hold);

      // 4. The card gives way to the timeline: the card lifts, blurs and fades; the timeline rises into place on the site's spring.
      later(() => {
        // The card is gone (past 60% of the way) before the timeline is more than a shadow of itself (from 40%): at no point is a card of the timeline seen through the headshots.
        play(poster, [{ opacity: 1, transform: "translate3d(0, 0, 0) scale(1)", filter: "blur(0px)" }, { opacity: 0, transform: "translate3d(0, -3%, 0) scale(0.97)", filter: "blur(2px)" }], {
          duration: OPEN,
          easing: "cubic-bezier(0.4, 0, 0.2, 1)",
        });
        play(layer, [{ transform: "translate3d(0, 6%, 0)" }, { transform: "translate3d(0, 0, 0)" }], { duration: RISE, easing: springEasing() });
        play(layer, [{ opacity: 0 }, { opacity: 1 }], { duration: OPEN * 0.6, delay: OPEN * 0.4, easing: "cubic-bezier(0.22, 1, 0.36, 1)" });
        setCounted(run + 1);
        // The track glides the last stretch into the pair's years.
        if (scroller && start !== null && left !== null && left !== start) {
          const begin = performance.now();
          const tick = (now: number) => {
            const t = Math.min(1, (now - begin) / GLIDE_MS);
            scroller.scrollLeft = start + (left - start) * easeOutCubic(t);
            if (t < 1 && !cancelled) frame = requestAnimationFrame(tick);
          };
          frame = requestAnimationFrame(tick);
        }
      }, hold + OPEN_AT);

      later(() => setPhase("timeline"), hold + OPEN_AT + Math.max(OPEN, RISE));
    });

    return () => {
      cancelled = true;
      timers.forEach(window.clearTimeout);
      cancelAnimationFrame(frame);
      animations.forEach((animation) => animation.cancel());
    };
    // `run` is the dependency that restarts it; `open` only reads refs.
  }, [mounted, run, open]);

  const replay = useCallback(() => {
    setPhase("poster");
    setRun((r) => r + 1);
  }, []);

  // The room: measured in the browser, from the frame (the minimap strip's threshold) and from the layer under the bar (what the timeline is fitted to).
  useLayoutEffect(() => {
    const frame = frameRef.current;
    const layer = layerRef.current;
    if (!frame || !layer) return;
    const measure = () => setRoom((was) => (was && was.frame === frame.clientHeight && was.width === layer.clientWidth && was.height === layer.clientHeight ? was : { frame: frame.clientHeight, width: layer.clientWidth, height: layer.clientHeight }));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [mounted]);
  const minimap = room !== null && room.frame >= MINIMAP_MIN_FRAME_HEIGHT;
  /**
   * The timeline is laid out at its own full size (`rows` rows of cards (the most the room holds, one in a short frame), the year axis and the minimap strip) and drawn at `fit` of it: the largest
   * size, up to its own, at which all of it is in the room under the bar, so that it never needs to scroll up or down. A layout that is `1 / fit` as large (in both axes) is
   * drawn into the room, so everything inside is in its own pixels: the scroll, the pan and the minimap are as they are on the site.
   */
  const strip = minimap ? COMPACT_MINIMAP_HEIGHT : 0;
  const rows = room ? embedRowsFor(room.height - strip) : 1;
  const fit = room && room.height > 0 ? Math.min(1, room.height / (embedTrackHeight(rows) + strip)) : 1;

  const barHeight = `calc(${INSET_TOP} + ${BAR_ROW}px)`;
  const timelineVisible = phase === "timeline";
  const pairHref = `/p/${slug}`;

  return (
    <div
      ref={frameRef}
      className="fixed inset-0 overflow-hidden bg-canvas text-body"
      style={{ ...FRAME_STYLE, "--px": POSTER_PX } as CSSProperties}
    >
      {/* The palette's custom properties: the page's own view sets them (see `PeopleView`), and a frame has no page. */}
      <style>{personColorCss()}</style>
      <h1 className="sr-only">{summary ? `${names}: ${summary}` : names}</h1>

      {/* The bar over both (first in the page, so that the way to the page is the first stop of the keyboard, not the last after every film): the people and their count on the left once the timeline is up, and always, on the right, the way to the page. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-3" style={{ height: barHeight, padding: `${INSET_TOP} ${INSET_X} 0` }}>
        <div
          inert={!timelineVisible}
          className={cn("flex min-w-0 items-center transition-opacity duration-300 motion-reduce:duration-300", timelineVisible ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0")}
          style={{ gap: size(10, 1.2) }}
        >
          <span className={cn("flex shrink-0", wordmarkHides)}>
            <EmbedWordmark href="/" title="Parallel" label="Parallel: home" external />
          </span>
          <ul className="flex shrink-0 items-center" style={{ gap: size(8, 0.8) }} aria-label="The people">
            {timelines.map(({ person }, i) => (
              // Overlapped by 4px (the gap is 8px) in the smallest frames: the one on the right is over the one on the left, and the one pressed or focused comes up.
              <li key={person.id} className={cn("relative", crowded && i > 0 && "@max-[22rem]:-ml-3", "hover:z-10 focus-within:z-10")}>
                <a href={peopleHref([person])} {...EXTERNAL} title={`${person.name} on Parallel`} className="inline-flex rounded-full no-underline">
                  <PersonAvatar name={person.name} profilePath={person.profilePath} size={26} imageSize="w185" ringColor={multi ? personColor(i) : undefined} />
                  <span className="sr-only">
                    {person.name} (opens in a new tab)
                  </span>
                </a>
              </li>
            ))}
          </ul>
          <div className="hidden min-w-0 leading-tight @[34rem]:block">
            <p className="truncate font-medium text-strong" style={{ fontSize: size(13, 1.5) }}>
              {names}
            </p>
            {count !== null && (
              <p className="truncate text-muted" style={{ fontSize: size(11, 1.3) }}>
                <span className="text-lit">
                  <CountUp to={count} start={counted} />
                </span>{" "}
                {count === 1 ? "film" : "films"}
                {multi ? " together" : ""}
              </p>
            )}
          </div>
        </div>
        <div className="pointer-events-auto flex shrink-0 items-center" style={{ gap: size(8, 0.8) }}>
          {timelineVisible && (
            <button type="button" onClick={replay} aria-label="Replay" title="Replay" className={EMBED_BUTTON} style={{ width: size(30, 3.2), height: size(30, 3.2) }}>
              <RotateCcw aria-hidden="true" className="size-1/2" />
            </button>
          )}
          <OpenInParallel href={pairHref} external />
        </div>
      </div>

      {/* The first frame: the preview card, the picture X shows until this page loads. It is a picture of what the timeline then says. */}
      <div ref={posterRef} aria-hidden="true" inert={timelineVisible} className={cn("absolute inset-0 transition-opacity duration-300 motion-reduce:duration-300", timelineVisible && "opacity-0")}>
        <PairPoster card={card} />
      </div>

      {/* The timeline, under a bar of its own: built in the browser only, and shown when the card has given way to it. It is laid out `1 / fit` as large as the room it
          has under the bar and drawn at `fit` (see above), so that it fits whatever the frame's height; the clip is the room's, and nothing in it scrolls up or down. */}
      {mounted && (
        <div
          ref={layerRef}
          inert={!timelineVisible}
          className={cn("absolute inset-x-0 bottom-0 overflow-hidden transition-opacity duration-300 motion-reduce:duration-300", timelineVisible ? "opacity-100" : "pointer-events-none opacity-0")}
          style={{ top: barHeight }}
        >
          <div
            data-part="fit"
            className="absolute left-0 top-0 origin-top-left"
            style={
              {
                width: room ? room.width / fit : "100%",
                height: room ? room.height / fit : "100%",
                transform: fit < 1 ? `scale(${fit})` : undefined,
                "--bar-h": "0px",
                "--embed-gutter": `calc(${INSET_X} / ${fit})`,
              } as CSSProperties
            }
          >
            <Timeline
              ref={timelineRef}
              active
              embed
              embedMinimap={minimap}
              embedRows={rows}
              lanes={lanes}
              combined={multi}
              showAll={false}
              people={people}
              includeMinor={false}
              today={today}
              selectedId={null}
              onSelect={() => {}}
              onOpenPerson={() => {}}
            />
          </div>
        </div>
      )}
    </div>
  );
}
