"use client";

import { useEffect, useState } from "react";
import { cutEdgePath, cutEdgeStroke, type CutPoint, type EdgePosition } from "@/lib/portrait-cuts";

interface Props {
  /** The photo, drawn over the whole w × h viewBox; null draws nothing yet (a card not yet near the viewport). */
  src: string | null;
  points: readonly CutPoint[];
  w: number;
  h: number;
  /** The id of the caller's `<clipPath>` holding the polygon. */
  clipId: string;
  strokeColor?: string;
  /** Tuning override: the visible line's width in screen px (or a CSS length), instead of the rule. */
  strokePx?: number | string;
  edgePosition?: EdgePosition;
  /** "open" (the default, and what the app's portraits are) draws the edge along the polygon's segments that are not on the photo's own frame edge, so the figure reads as bleeding off the frame; "none" draws no edge at all. */
  edgeShape?: "open" | "none";
  /** The photo could not be loaded (a 404, a blocked or broken file): what the caller draws instead. Called once per failure, from the probe or the `<image>`, whichever sees it. */
  onError?: () => void;
}

/**
 * The clipped photo and its cut edge, inside the caller's `<svg>` (which must sit in a size container, see
 * `STROKE_CSS`). The edge is the open path of `cutEdgePath` (the frame's edges left out; `edgeShape` drops it) in all three positions:
 * - center: a plain stroke over the photo, straddling the polygon;
 * - outside: a stroke of twice the width under the photo, whose clipped edge hides the inner half;
 * - inside: a stroke of twice the width over the photo, clipped by the same polygon, so only the inner half shows.
 * The edge waits for the photo to load, so outside mode never shows its doubled stroke uncovered. A photo that fails to load is reported (`onError`), not left as an empty clip.
 */
export function CutPortraitImage({ src, points, w, h, clipId, strokeColor, strokePx, edgePosition = "center", edgeShape = "open", onError }: Props) {
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  // `onLoad` misses a photo that finished before hydration, and SVG `<image>` has no `complete`: an HTML image of the same URL (from the
  // cache when it is) tells either way.
  useEffect(() => {
    if (!src) return;
    let live = true;
    const probe = new Image();
    probe.onload = () => live && setLoadedSrc(src);
    // A request that failed before hydration is not seen by the `<image>`'s own `onError`, so the probe asks again.
    probe.onerror = () => live && onError?.();
    probe.src = src;
    return () => {
      live = false;
      probe.onload = null;
      probe.onerror = null;
    };
    // `onError` is the caller's setter of the failed url: a new function each render must not run the probe again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  const clip = `url(#${clipId})`;
  const loaded = src !== null && loadedSrc === src;
  const edge = loaded && edgeShape !== "none" ? <path d={cutEdgePath(points, w, h)} {...cutEdgeStroke(strokeColor, strokePx, edgePosition)} /> : null;
  const image = src ? <image href={src} width={w} height={h} preserveAspectRatio="none" clipPath={clip} onLoad={() => setLoadedSrc(src)} onError={onError} /> : null;
  if (edgePosition === "outside") {
    return (
      <>
        {edge}
        {image}
      </>
    );
  }
  return (
    <>
      {image}
      {edge && (edgePosition === "inside" ? <g clipPath={clip}>{edge}</g> : edge)}
    </>
  );
}
