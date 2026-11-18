import { preconnect } from "react-dom";
import { HeroCollage } from "@/components/landing/hero-collage";
import { LandingSearch } from "@/components/landing/landing-search";
import { defaultScene, type HeroPairing } from "@/lib/hero-scenes";

export function Hero({ pool }: { pool: readonly HeroPairing[] }) {
  // The collage's first images come from TMDB's image host; open the connection early.
  preconnect("https://image.tmdb.org");
  // The server cannot pick at random (the page is static): it sends this scene in a <noscript>,
  // and the browser picks the one it shows.
  const fallback = defaultScene(pool);

  return (
    <section
      aria-labelledby="hero-heading"
      // The pair's wash (`usePairWash`, in the collage) is this section's background once the collage is up.
      className="relative overflow-x-clip px-4 pb-10 pt-6 sm:pb-12 sm:pt-8 [@media(max-height:820px)]:pb-6 [@media(max-height:820px)]:pt-3"
    >
      {/* Centered above the headline: two people, the films they share, on the timeline line. */}
      {fallback && (
        <div className="mb-5 max-[359px]:mb-10 sm:mb-6 [@media(max-height:820px)]:mb-2 [@media(max-height:620px)]:scale-75 [@media(max-height:620px)]:-my-10">
          <HeroCollage pool={pool} fallback={fallback} />
        </div>
      )}
      <div className="mx-auto max-w-3xl text-center">
        <h1
          id="hero-heading"
          className="text-balance text-4xl font-semibold leading-[1.1] tracking-tight text-strong sm:text-5xl lg:text-6xl"
        >
          Watch filmmakers cross paths
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-balance text-base leading-relaxed text-body sm:text-lg [@media(max-height:820px)]:mt-3">
          Search any actor, director, writer or cinematographer. Line their timelines up. See every
          film they made together.
        </p>
        <div data-hero-search="" className="mx-auto mt-8 max-w-2xl text-left sm:mt-10 [@media(max-height:820px)]:mt-5">
          <LandingSearch />
        </div>
      </div>
    </section>
  );
}
