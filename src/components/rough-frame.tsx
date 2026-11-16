"use client";

import { useSearchParams } from "next/navigation";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { buildFrame, FRAME_MARGIN, FRAME_OFFSET, jitterForWidth, OVERLAP, toPath, type FrameBg } from "@/lib/rough-frame";

/**
 * Spike (zherring/spike-portraits): `?frames=rough` on a pair page draws the rough-cut frame of /dev/portraits/frames behind the posters of the
 * Timeline and the Films (Depth) view, in place of their colour or green ring. Without it, nothing changes.
 */
export function useRoughFrames(): boolean {
  return useSearchParams()?.get("frames") === "rough";
}

interface RoughFrameProps {
  /** One colour (a film one person made) or two (A, nudged up-left, and B, down-right): any CSS colour, `var(--person-1)` too. */
  colors: readonly string[];
  /** Film id + person ids, so the cut stays put from render to render. */
  seed: string;
  /** The poster's size when the caller knows it; otherwise the parent's box is measured (ResizeObserver). */
  width?: number;
  height?: number;
  bg?: FrameBg;
}

/**
 * The frame, as an absolutely positioned SVG over its parent's box (the poster's, which must be positioned), overflowing it on every side.
 * Put it before the poster in the parent so the poster paints over it. It takes no pointer events and does not animate.
 * Stack: shape B in colour B, shape A in colour A, then shape B again in white clipped to shape A (the true intersection). No blend modes.
 */
export function RoughFrame({ colors, seed, width, height, bg = "dark" }: RoughFrameProps) {
  const uid = useId().replace(/:/g, "");
  const ref = useRef<SVGSVGElement>(null);
  const known = width !== undefined && height !== undefined;
  const [measured, setMeasured] = useState<{ w: number; h: number } | null>(null);

  useLayoutEffect(() => {
    if (known) return;
    const parent = ref.current?.parentElement;
    if (!parent) return;
    // The layout size (not the on-screen one under a transform): the SVG lives in the same transformed box.
    const read = () => setMeasured((prev) => (prev && prev.w === parent.offsetWidth && prev.h === parent.offsetHeight ? prev : { w: parent.offsetWidth, h: parent.offsetHeight }));
    read();
    const observer = new ResizeObserver(read);
    observer.observe(parent);
    return () => observer.disconnect();
  }, [known]);

  const w = known ? width : measured?.w ?? 0;
  const h = known ? height : measured?.h ?? 0;
  const svgBase = { position: "absolute", overflow: "visible", pointerEvents: "none" } as const;
  if (w <= 0 || h <= 0 || colors.length === 0) return <svg ref={ref} aria-hidden width={0} height={0} style={{ ...svgBase, left: 0, top: 0 }} />;

  const two = colors.length >= 2;
  const { shapes, view } = buildFrame({
    w,
    h,
    margin: FRAME_MARGIN,
    offset: FRAME_OFFSET,
    jitter: jitterForWidth(w),
    style: "rough",
    seeds: two ? [`${seed}:a`, `${seed}:b`] : [`${seed}:a`],
  });
  const vw = view.x1 - view.x0;
  const vh = view.y1 - view.y0;
  return (
    <svg
      ref={ref}
      aria-hidden
      data-rough-frame={two ? "shared" : "single"}
      width={vw}
      height={vh}
      viewBox={`${view.x0} ${view.y0} ${vw} ${vh}`}
      style={{ ...svgBase, left: view.x0, top: view.y0 }}
    >
      {two ? (
        <>
          <defs>
            <clipPath id={`${uid}a`}>
              <polygon points={toPath(shapes[0])} />
            </clipPath>
          </defs>
          <polygon points={toPath(shapes[1])} style={{ fill: colors[1] }} />
          <polygon points={toPath(shapes[0])} style={{ fill: colors[0] }} />
          <polygon points={toPath(shapes[1])} fill={OVERLAP[bg]} clipPath={`url(#${uid}a)`} data-overlap />
        </>
      ) : (
        <polygon points={toPath(shapes[0])} style={{ fill: colors[0] }} />
      )}
    </svg>
  );
}
