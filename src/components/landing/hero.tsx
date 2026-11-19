import { preconnect } from "react-dom";
import { HeroStage } from "@/components/landing/hero-stage";
import { defaultScene, type HeroPairing } from "@/lib/hero-scenes";

/**
 * The landing page's first screen, the Featured tab's splash: the stage (two portrait halves, the pair's films on a timeline and the shared ones in a
 * cluster over it) under the top bar, with the headline centred over the seam between the halves. The h1 and its copy are the server's markup, static (it is what is painted first, and the page's largest text); the stage
 * is the client's, revealed once its images are in.
 *
 * The section sets the stage's sizes, from the screen: its height fills what the bar leaves of the first screen, less a sliver of the next section (a
 * phone's is shorter, as the headline is under it there), the panels leave a gutter on each side (in the wide layout the halves run out over it) that the
 * timeline line runs on through, and a narrow seam divides them. Text is sized from these (the headline from the stage's width and height) so that nothing needs checking pair by pair.
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
      className="relative flex flex-col overflow-x-clip [--gutter:clamp(12px,5vw,88px)] [--seam:6px] [--stage-h:max(400px,min(64svh,560px))] sm:[--seam:12px] sm:[--stage-h:clamp(540px,calc(100svh-84px),880px)]"
    >
      {/*
        First in the markup (it is what the section is named by), over the seam on a screen wide enough, under the stage on a phone. It lets clicks through to the stage's
        link under it.
      */}
      <div className="pointer-events-none relative z-30 px-4 pb-8 pt-7 text-center max-sm:order-2 sm:absolute sm:inset-x-0 sm:top-[17%] sm:p-0">
        <h1
          id="hero-heading"
          className="mx-auto max-w-[11.5em] text-balance text-[length:clamp(34px,min(4.6vw,calc(var(--stage-h)*0.105)),68px)] font-semibold leading-[1.05] tracking-[-0.03em] text-white sm:[text-shadow:0_2px_28px_rgb(0_0_0/0.55)]"
        >
          Watch filmmakers cross paths
        </h1>
        <p className="mx-auto mt-3 max-w-[34ch] text-balance text-[15px] leading-relaxed text-[#cdd6df] sm:mt-4 sm:text-base sm:[text-shadow:0_1px_16px_rgb(0_0_0/0.7)]">
          Search any actor, director, writer or cinematographer. Line their timelines up. See every
          film they made together.
        </p>
      </div>
      {fallback && <HeroStage pool={pool} fallback={fallback} />}
    </section>
  );
}
