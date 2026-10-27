import { preconnect } from "react-dom";
import { HeroCollage } from "@/components/landing/hero-collage";
import { LandingSearch } from "@/components/landing/landing-search";
import { firstScene, type HeroPairing } from "@/lib/hero-scenes";

export function Hero({ pool }: { pool: readonly HeroPairing[] }) {
  // The collage's first images come from TMDB's image host; open the connection early.
  preconnect("https://image.tmdb.org");
  const initial = firstScene(pool);

  return (
    <section
      aria-labelledby="hero-heading"
      className="relative overflow-x-clip bg-[radial-gradient(60%_70%_at_50%_0%,rgb(0_224_84/0.10),transparent_70%)] px-4 pb-10 pt-6 sm:pb-12 sm:pt-8"
    >
      {/* Centered above the headline: two people, the films they share, on the timeline line. */}
      {initial && (
        <div className="mb-5 max-[359px]:mb-10 sm:mb-6">
          <HeroCollage pool={pool} initial={initial} />
        </div>
      )}
      <div className="mx-auto max-w-3xl text-center">
        <h1
          id="hero-heading"
          className="text-balance text-4xl font-semibold leading-[1.1] tracking-tight text-strong sm:text-5xl lg:text-6xl"
        >
          Follow the careers behind the movies.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-balance text-base leading-relaxed text-body sm:text-lg">
          Search any actor, director, writer or cinematographer. Line their timelines up. See every
          film they made together.
        </p>
        <div data-hero-search="" className="mx-auto mt-8 max-w-2xl text-left sm:mt-10">
          <LandingSearch />
        </div>
      </div>
    </section>
  );
}
