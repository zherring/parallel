import { LandingSearch } from "@/components/landing/landing-search";

export function Hero() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="bg-[radial-gradient(60%_70%_at_50%_0%,rgb(0_224_84/0.10),transparent_70%)] px-4 pb-14 pt-14 sm:pb-20 sm:pt-24"
    >
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
        <div className="mx-auto mt-8 max-w-2xl text-left sm:mt-10">
          <LandingSearch />
        </div>
      </div>
    </section>
  );
}
