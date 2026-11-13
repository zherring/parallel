"use client";

import { RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { EMBED_BUTTON, EXTERNAL, EmbedWordmark, OpenInParallel, FRAME_STYLE, embedSize as size } from "@/components/embed/embed-shell";
import { PairPoster, POSTER_PX } from "@/components/embed/pair-poster";
import { springEasing } from "@/components/landing/hero-motion";
import { PersonAvatar } from "@/components/person-avatar";
import { cn } from "@/components/timeline/cn";
import { Timeline, type LaneData, type TimelineHandle } from "@/components/timeline/timeline";
import { joinNames } from "@/lib/format";
import { peopleHref } from "@/lib/lanes";
import { captionText, type OgCard } from "@/lib/og-card";
import { personColor, personColorCss } from "@/lib/person-colors";
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
  const spans = filmIds.flatMap((id) => {
    const rect = scroller.querySelector<HTMLElement>(`[data-film="${id}"]`)?.getBoundingClientRect();
    return rect ? [{ left: rect.left - box.left + scroller.scrollLeft, right: rect.right - box.left + scroller.scrollLeft }] : [];
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
 * the pictures are in and the first frame has been held a moment: the posters lift one after another along the lane and each person's card takes their colour on the
 * timeline (the ring round their card); the card gives way to the timeline (it settles up from below on the site's spring while the card lifts and blurs away), which
 * glides into the years the pair worked together, and the count of their films counts in. A visitor who asked for less motion gets the timeline with a plain fade, no
 * sequence. Replay starts it again. With no script the first frame stays, with its link to the page.
 *
 * The timeline is the page's own (`Timeline`, in its `embed` mode: the combined track, the same cards, nodes, connections and hover card), so panning, zooming by the
 * browser, and hovering or pressing a film work as they do on the site; the pressed film's card replaces its panel, which a frame has no room for. The people's names and
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
  const posterRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<TimelineHandle>(null);

  const people = useMemo(() => timelines.map((t) => ({ id: t.person.id, name: t.person.name })), [timelines]);
  const multi = timelines.length > 1;
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
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
        // 2. Each person's card takes their colour on the timeline (the ring), and nods, the way the landing page's card does when its pair changes.
        parts("person").forEach((el, i) => {
          play(el, [{ transform: "scale(1)" }, { transform: "scale(1.025)", offset: 0.4 }, { transform: "scale(1)" }], { duration: 520, delay: 250 + i * 130, easing: "ease-in-out" });
        });
        parts("ring").forEach((el, i) => play(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 420, delay: 250 + i * 130, easing: "ease-out" }));
        // 3. The numbers of the caption tick.
        parts("accent").forEach((el, i) =>
          play(el, [{ transform: "scale(1)" }, { transform: "scale(1.16)", offset: 0.4 }, { transform: "scale(1)" }], { duration: 460, delay: 700 + i * 120, easing: "ease-in-out" }),
        );
      }, hold);

      // 4. The card gives way to the timeline: the card lifts, blurs and fades; the timeline rises into place on the site's spring.
      later(() => {
        play(poster, [{ opacity: 1, transform: "translate3d(0, 0, 0) scale(1)", filter: "blur(0px)" }, { opacity: 0, transform: "translate3d(0, -3%, 0) scale(0.97)", filter: "blur(2px)" }], {
          duration: OPEN,
          easing: "cubic-bezier(0.4, 0, 0.2, 1)",
        });
        play(layer, [{ transform: "translate3d(0, 6%, 0)" }, { transform: "translate3d(0, 0, 0)" }], { duration: RISE, easing: springEasing() });
        play(layer, [{ opacity: 0 }, { opacity: 1 }], { duration: OPEN * 0.8, easing: "cubic-bezier(0.22, 1, 0.36, 1)" });
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

  const barHeight = size(36, 4.6);
  const timelineVisible = phase === "timeline";
  const pairHref = `/p/${slug}`;

  return (
    <div
      className="fixed inset-0 overflow-hidden bg-canvas text-body"
      style={{ ...FRAME_STYLE, "--px": POSTER_PX } as CSSProperties}
    >
      {/* The palette's custom properties: the page's own view sets them (see `PeopleView`), and a frame has no page. */}
      <style>{personColorCss()}</style>
      <h1 className="sr-only">{summary ? `${names}: ${summary}` : names}</h1>

      {/* The bar over both (first in the page, so that the way to the page is the first stop of the keyboard, not the last after every film): the people and their count on the left once the timeline is up, and always, on the right, the way to the page. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-3" style={{ height: barHeight, padding: `0 ${size(14, 2.4)}` }}>
        <div
          inert={!timelineVisible}
          className={cn("flex min-w-0 items-center transition-opacity duration-300 motion-reduce:duration-300", timelineVisible ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0")}
          style={{ gap: size(10, 1.2) }}
        >
          <EmbedWordmark href="/" title="Parallel" label="Parallel: home" external />
          <ul className="flex shrink-0 items-center" style={{ gap: size(8, 0.8) }} aria-label="The people">
            {timelines.map(({ person }, i) => (
              <li key={person.id}>
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

      {/* The timeline, under a bar of its own: built in the browser only, and shown when the card has given way to it. */}
      {mounted && (
        <div
          ref={layerRef}
          inert={!timelineVisible}
          className={cn("absolute inset-0 flex flex-col transition-opacity duration-300 motion-reduce:duration-300", timelineVisible ? "opacity-100" : "pointer-events-none opacity-0")}
          style={{ paddingTop: barHeight, "--bar-h": "0px" } as CSSProperties}
        >
          <div className="min-h-0 flex-1">
            <Timeline
              ref={timelineRef}
              active
              embed
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
