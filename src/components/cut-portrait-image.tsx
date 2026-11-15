import { cutEdgePath, cutEdgeStroke, type CutPoint, type EdgePosition } from "@/lib/portrait-cuts";

interface Props {
  /** The photo, drawn over the whole w × h viewBox; null draws the edge alone (a card not yet near the viewport). */
  src: string | null;
  points: readonly CutPoint[];
  w: number;
  h: number;
  /** The id of the caller's `<clipPath>` holding the polygon. */
  clipId: string;
  strokeColor?: string;
  /** Tuning override: the visible line's width in screen px, instead of the rule. */
  strokePx?: number;
  edgePosition?: EdgePosition;
}

/**
 * Spike (zherring/spike-portraits): the clipped photo and its cut edge, inside the caller's `<svg>` (which must sit in a size container, see
 * `STROKE_CSS`). The edge is the open path of `cutEdgePath` (the frame's edges left out) in all three positions:
 * - center: a plain stroke over the photo, straddling the polygon;
 * - outside: a stroke of twice the width under the photo, whose clipped edge hides the inner half;
 * - inside: a stroke of twice the width over the photo, clipped by the same polygon, so only the inner half shows.
 */
export function CutPortraitImage({ src, points, w, h, clipId, strokeColor, strokePx, edgePosition = "center" }: Props) {
  const clip = `url(#${clipId})`;
  const edge = <path d={cutEdgePath(points, w, h)} {...cutEdgeStroke(strokeColor, strokePx, edgePosition)} />;
  const image = src ? <image href={src} width={w} height={h} preserveAspectRatio="none" clipPath={clip} /> : null;
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
      {edgePosition === "inside" ? <g clipPath={clip}>{edge}</g> : edge}
    </>
  );
}
