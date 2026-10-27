import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Pairings } from "@/components/landing/pairings";
import { buildGenreSections } from "@/lib/example-cards";

// Static: the pairings, photos and film counts all come from src/lib/examples.generated.json
// (see `npm run examples:refresh`), so this page makes no TMDB calls at build or request time.
export default function Home() {
  return (
    <>
      <Hero />
      <Pairings sections={buildGenreSections()} />
      <HowItWorks />
    </>
  );
}
