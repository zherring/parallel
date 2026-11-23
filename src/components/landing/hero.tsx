import type { CSSProperties } from "react";
import { preconnect } from "react-dom";
import "@/components/landing/hero-stage.css";
import { HeroStage } from "@/components/landing/hero-stage";
import { defaultScene, type HeroPairing } from "@/lib/hero-scenes";
import { SECTION_GEOMETRY } from "@/lib/stage-geometry";

/**
 * The landing page's first screen, the Featured tab's splash: the stage (two portrait halves, the pair's films on a timeline and the shared ones in a
 * cluster over it) under the top bar, with the headline centred over the seam between the halves (on a phone, across the top of the stage, over the montage and above the figures' heads). The h1 and its copy are the server's markup, static (it is what is painted first, and the page's largest text); the stage
 * is the client's, revealed once its images are in.
 *
 * The section sets the stage's sizes, from the screen, by formula: its height, a gutter and a seam, the headline's and the names' sizes, and on a phone a stage taller than the screen's share (the headline's box and
 * the figure stand on its foot, and the names' row hangs below the halves). They are custom properties on the section, `data-landing-hero`, written one to a line, each with its reasons, in hero-stage.css, which
 * also has the stage's (hero-stage.tsx); the gutter and the seams are the numbers of stage-geometry.ts, which the montage's column count and the tablet figure's size are worked from too, set here as inline style.
 * Text is sized from them (the headline from the stage's width and height) so that nothing needs checking pair by pair.
 */
export function Hero({ pool }: { pool: readonly HeroPairing[] }) {
  // The stage's first images come from TMDB's image host; open the connection early.
  preconnect("https://image.tmdb.org");
  // The server cannot pick at random (the page is static): it sends this scene in a <noscript>,
  // and the browser picks the one it shows.
  const fallback = defaultScene(pool);

  return (
    <section
      aria-labelledby="hero-heading"
      data-landing-hero=""
      className="relative flex flex-col overflow-x-clip"
      style={SECTION_GEOMETRY as CSSProperties}
    >
      {/*
        First in the markup (it is what the section is named by), over the seam on a screen wide enough, across the top of the stage on a phone (its box is `--head-h` high, which the stage's height has room for). Its box lets the pointer through to what is
        under it, and its text does not: the headline and the line under it are plain page text, which can be selected by dragging over them (nothing over them is a link, and
        the stage under them is decoration with no pointer handling that stops a selection). It is the server's markup and never redrawn, so a scene change leaves a selection of it be.
      */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 h-(--head-h) px-4 pt-5 text-center sm:top-[17%] sm:h-auto sm:p-0">
        <h1
          id="hero-heading"
          className="pointer-events-auto mx-auto max-w-[11.5em] text-balance text-[length:var(--h1-fs)] font-semibold leading-[1.05] tracking-[-0.03em] text-white [text-shadow:0_2px_28px_rgb(0_0_0/0.55)]"
        >
          Watch filmmakers cross paths
        </h1>
        <p className="pointer-events-auto mx-auto mt-3 max-w-[34ch] text-balance text-[15px] leading-relaxed text-[#cdd6df] [text-shadow:0_1px_16px_rgb(0_0_0/0.7)] sm:mt-4 sm:text-base">
          Search any actor, director, writer or cinematographer. See every film they made together.
        </p>
      </div>
      {fallback && <HeroStage pool={pool} fallback={fallback} />}
    </section>
  );
}
