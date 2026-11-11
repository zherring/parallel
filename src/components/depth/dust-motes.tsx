"use client";

import { useEffect, useRef, type RefObject } from "react";
import { REDUCED_MOTION, useMediaQuery } from "@/components/depth/use-media";
import { createMotes, moteCount, stepMotes, type Mote } from "@/lib/dust";

/** The seed of the field: the same dust on every visit. */
const SEED = 20_261_106;
/** The canvas is drawn at most this many device pixels per CSS pixel: motes are soft, and a third pixel per pixel buys nothing. A phone's gets one: it is a full-screen layer redrawn every frame, and that is what its GPU is short of. */
const MAX_DPR = { desktop: 2, phone: 1 };
/** Width (px) below which the screen is a phone's: Tailwind's `sm`. */
const PHONE_WIDTH = 640;
/** The least time (ms) between two frames on a phone: the dust is slow, and half the frames are half the cost. */
const PHONE_FRAME_MS = 30;
/** Side (px) of the pre-drawn sprites. */
const SPRITE = 64;

/** A soft dot: a warm core fading to nothing (white-hot in the middle, amber at the edge). */
function dotSprite(): HTMLCanvasElement | null {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SPRITE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const c = SPRITE / 2;
  const gradient = ctx.createRadialGradient(c, c, 0, c, c, c);
  gradient.addColorStop(0, "rgba(255, 244, 224, 1)");
  gradient.addColorStop(0.16, "rgba(255, 228, 188, 0.85)");
  gradient.addColorStop(0.42, "rgba(255, 206, 150, 0.22)");
  gradient.addColorStop(1, "rgba(255, 196, 130, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SPRITE, SPRITE);
  return canvas;
}

/** An out-of-focus disc: even in the middle, a little brighter at the rim, with a soft edge, as a lens blurs a point of light. */
function bokehSprite(): HTMLCanvasElement | null {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SPRITE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const c = SPRITE / 2;
  const gradient = ctx.createRadialGradient(c, c, 0, c, c, c);
  gradient.addColorStop(0, "rgba(255, 226, 184, 0.55)");
  gradient.addColorStop(0.7, "rgba(255, 218, 170, 0.62)");
  gradient.addColorStop(0.9, "rgba(255, 212, 160, 0.85)");
  gradient.addColorStop(1, "rgba(255, 206, 150, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SPRITE, SPRITE);
  return canvas;
}

/**
 * Warm dust motes drifting behind the scene: a canvas on a wrapper that is `fixed inset-0 z-0 bg-canvas`, under the scroller
 * (which is transparent), so a mote is never drawn over a poster. Each is a soft radial-gradient dot, with a few large,
 * faint, out-of-focus discs; they drift, wobble and twinkle, and slide up with the scroll by their depth (see
 * `src/lib/dust.ts`). The canvas is sized in device pixels (up to 2 per CSS pixel; 1 on a phone, at half the frame rate: it is
 * a full-screen layer redrawn on every frame), the loop stops while the tab is hidden, and a visitor who asked for less motion gets one still picture of sparse dots, drawn once.
 *
 * The wrapper's background is the page's, so the page is the right colour from the first paint, before this runs.
 */
export function DustMotes({ scrollerRef }: { scrollerRef: RefObject<HTMLDivElement | null> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useMediaQuery(REDUCED_MOTION);

  useEffect(() => {
    const canvas = canvasRef.current;
    const scroller = scrollerRef.current;
    const ctx = canvas?.getContext("2d");
    const dot = dotSprite();
    const bokeh = bokehSprite();
    if (!canvas || !scroller || !ctx || !dot || !bokeh) return;

    const phone = window.innerWidth < PHONE_WIDTH;
    let field = { w: 0, h: 0 };
    let dpr = 1;
    let motes: Mote[] = [];
    let frame = 0;
    let last = 0;

    const draw = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, field.w, field.h);
      for (const mote of motes) {
        // A dot's glow reaches further than the radius it is given.
        const size = mote.bokeh ? mote.r * 2 : mote.r * 6;
        ctx.globalAlpha = mote.a;
        ctx.drawImage(mote.bokeh ? bokeh : dot, mote.sx - size / 2, mote.sy - size / 2, size, size);
      }
      ctx.globalAlpha = 1;
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      dpr = Math.min(phone ? MAX_DPR.phone : MAX_DPR.desktop, window.devicePixelRatio || 1);
      field = { w: rect.width, h: rect.height };
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      // Fewer, sparser dots for a still picture.
      const count = reduced ? Math.round(moteCount(field) / 3) : moteCount(field);
      motes = createMotes(count, SEED, field);
      stepMotes(motes, 0, scroller.scrollTop, field);
      draw();
    };

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (phone && last && now - last < PHONE_FRAME_MS) return;
      stepMotes(motes, last ? (now - last) / 1000 : 0, scroller.scrollTop, field);
      last = now;
      draw();
    };
    const start = () => {
      if (frame || reduced || document.hidden) return;
      last = 0;
      canvas.dataset.state = "running";
      frame = requestAnimationFrame(tick);
    };
    const stop = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      canvas.dataset.state = reduced ? "static" : "paused";
    };
    const onVisibility = () => (document.hidden ? stop() : start());

    resize();
    canvas.dataset.state = reduced ? "static" : "paused";
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(resize);
    observer?.observe(canvas);
    if (!reduced) {
      document.addEventListener("visibilitychange", onVisibility);
      start();
    }

    return () => {
      stop();
      observer?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [scrollerRef, reduced]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 bg-canvas">
      <canvas ref={canvasRef} className="size-full" />
    </div>
  );
}
