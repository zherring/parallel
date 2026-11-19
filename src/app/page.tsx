import type { Metadata } from "next";
import { GenreTabsProvider } from "@/components/landing/genre-tabs";
import { genrePills } from "@/components/landing/genre-pills";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { LandingBar } from "@/components/landing/landing-bar";
import { Pairings } from "@/components/landing/pairings";
import { VariantsLab } from "@/components/landing/variants-lab";
import { buildGenreSections, buildHeroPairings } from "@/lib/example-cards";
import { GENRE_ROOT } from "@/lib/genre-deep-link";
import { heroPool } from "@/lib/hero-scenes";

const title = "Parallel — Filmographies & Film Collaborations";
const description = "Explore filmographies on a timeline. Compare actors, directors, writers and cinematographers to discover every film they made together, with sourced quotes about their collaborations.";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: "/" },
  openGraph: { title, description, url: "/", siteName: "Parallel", type: "website" },
  twitter: { card: "summary_large_image", title, description },
};

// Static: the pairings, photos, film counts and hero posters all come from
// src/lib/examples.generated.json (see `npm run examples:refresh`), so this page makes no TMDB
// calls at build or request time.
export default function Home() {
  const sections = buildGenreSections();
  const pills = genrePills(sections);
  return (
    // The genre pills are in the top bar and their panels under it (the splash and its cards are Featured's): one provider holds the choice for both.
    <GenreTabsProvider idBase="pairings" ids={pills.map((pill) => pill.id)}>
      {/* The root of the page, which the deep-link script marks with the genre before hydration (genre-deep-link.ts): hence the suppressed warning. */}
      <div {...{ [GENRE_ROOT]: "" }} suppressHydrationWarning>
        <LandingBar pills={pills} />
        <Pairings sections={sections} hero={<Hero pool={heroPool(buildHeroPairings())} />} />
        <HowItWorks />
        <VariantsLab />
      </div>
    </GenreTabsProvider>
  );
}
