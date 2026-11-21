import { preconnect } from "react-dom";
import { HeroStage } from "@/components/landing/hero-stage";
import { defaultScene, type HeroPairing } from "@/lib/hero-scenes";

/**
 * The landing page's first screen, the Featured tab's splash: the stage (two portrait halves, the pair's films on a timeline and the shared ones in a
 * cluster over it) under the top bar, with the headline centred over the seam between the halves (on a phone, across the top of the stage, over the montage and above the figures' heads). The h1 and its copy are the server's markup, static (it is what is painted first, and the page's largest text); the stage
 * is the client's, revealed once its images are in.
 *
 * The section sets the stage's sizes, from the screen: its height fills what the bar leaves of the first screen, less a sliver of the next section, a gutter on each side that the halves and the timeline line run out over to the screen's edge, and a narrow
 * seam divides them. Text is sized from these (the headline from the stage's width and height) so that nothing needs checking pair by pair.
 *
 * A phone's stage is taller than that, by formula: the headline's box (`--head-h`: its padding, the h1's two lines, the gap, the copy's three and a gap under them, the same from
 * 320px to `sm`, as the h1 is 34px there and the copy's box is 34ch; below 320px the h1 takes three lines, 220px in all, and the copy is still three down to about 260px) and the figure (`--fig-h`: 1.5 times what the figure was, `min(90%, 165cqw)` of its core, from the screen's width:
 * the core is the half less the gutter, `50vw - seam / 2 - gutter`, and a phone has no scrollbar to make `vw` and `cqw` differ) stand on the stage's foot, 3% past it, with the
 * figure's top at the headline's bottom: `scene = (head + figure) / 1.03`, never less than the stage was (`--stage-h0`). So the heads clear the headline whatever the width. The scene is
 * the halves' height (`--scene-h`: the line is 82% of it, and the halves end there); on a phone the stage is the scene and, if it has not room for them under the line, the names row
 * too, which hangs below the halves on the page's own colour (`--stage-h`: `--row-h` is that row, from the names' size, `--name-fs`: a third of the screen's width over 8em, up to 18px, 8em
 * being the widest word of a family name in the pool, "Schwarzenegger" (7.96em of the font), so that a name wraps in its third but never inside a word (its "&" beside it, 0.97em, reaches a little
 * past the third into the room before the keycap); and the room for the longest wrap: three lines of names, "Lana", "& Lilly", "Wachowski", and the cue's one line, `--cue-fs`: 0.85 of the names', whose "See all 25 films together →" is 12.75em of the font, so
 * about 11.3px at 320 and 13.8px at 390, and between the keycaps, 18px or more clear of them at any phone width from 320px).
 * From `sm` up the stage is the scene, as before.
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
      className="relative flex flex-col overflow-x-clip [--gutter:clamp(12px,5vw,88px)] [--seam:6px] [--stage-h0:max(400px,min(64svh,560px))] [--head-h:calc(20px+2*1.05*34px+12px+3*1.625*15px+8px)] max-[319px]:[--head-h:calc(20px+3*1.05*34px+12px+3*1.625*15px+8px)] [--fig-h:calc(1.5*min(0.9*var(--stage-h0),1.65*(50vw-var(--seam)/2-var(--gutter))))] [--scene-h:max(var(--stage-h0),calc((var(--head-h)+var(--fig-h))/1.03))] [--name-fs:clamp(11px,calc(100vw/24),18px)] [--cue-fs:calc(var(--name-fs)*0.85)] [--row-gap:6px] [--row-body:calc(3*1.15*var(--name-fs)+var(--row-gap)+1.25*var(--cue-fs))] [--row-h:calc(22px+var(--row-body)+10px)] [--stage-h:max(var(--scene-h),calc(0.82*var(--scene-h)+var(--row-h)))] sm:[--seam:12px] sm:[--scene-h:var(--stage-h)] sm:[--stage-h:clamp(540px,calc(100svh-84px),880px)]"
    >
      {/*
        First in the markup (it is what the section is named by), over the seam on a screen wide enough, across the top of the stage on a phone (its box is `--head-h` high, which the stage's height has room for). Its box lets the pointer through to what is
        under it, and its text does not: the headline and the line under it are plain page text, which can be selected by dragging over them (nothing over them is a link, and
        the stage under them is decoration with no pointer handling that stops a selection). It is the server's markup and never redrawn, so a scene change leaves a selection of it be.
      */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 h-(--head-h) px-4 pt-5 text-center sm:top-[17%] sm:h-auto sm:p-0">
        <h1
          id="hero-heading"
          className="pointer-events-auto mx-auto max-w-[11.5em] text-balance text-[length:clamp(34px,min(4.6vw,calc(var(--stage-h)*0.105)),68px)] font-semibold leading-[1.05] tracking-[-0.03em] text-white [text-shadow:0_2px_28px_rgb(0_0_0/0.55)]"
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
