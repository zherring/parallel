import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Pairings } from "@/components/landing/pairings";
import { loadExampleCards } from "@/lib/load-example-cards";

// Rendered per request: the build environment may not have a TMDB token, and the example
// photos and counts must never be baked into the build.
export const dynamic = "force-dynamic";

export default async function Home() {
  const cards = await loadExampleCards();
  return (
    <>
      <Hero />
      <Pairings cards={cards} />
      <HowItWorks />
    </>
  );
}
