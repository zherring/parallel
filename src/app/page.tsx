import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Pairings } from "@/components/landing/pairings";
import { buildGenreSections, buildHeroPairings } from "@/lib/example-cards";
import { heroPool } from "@/lib/hero-scenes";

// Static: the pairings, photos, film counts and hero posters all come from
// src/lib/examples.generated.json (see `npm run examples:refresh`), so this page makes no TMDB
// calls at build or request time.
export default function Home() {
  return (
    <>
      <Hero pool={heroPool(buildHeroPairings())} />
      <Pairings sections={buildGenreSections()} />
      <HowItWorks />
    </>
  );
}
