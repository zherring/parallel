import { GenreTablist, type GenrePill } from "@/components/landing/genre-tabs";
import { LandingSearchTrigger } from "@/components/landing/landing-search-trigger";
import { HomeLink } from "@/components/home-link";
import { Wordmark } from "@/components/wordmark";

/**
 * The landing page's top bar, stuck to the top of the screen over the stage (a blurred canvas with a hairline under it): the way home, the search (a field
 * that opens the universal search) and the genre pills, which choose the view under the bar: the splash and a sample of pairings, or one genre's grid. It replaces the site header on this page (globals.css
 * hides that one when this is on it), so it is the first 56px of the first screen, which the stage's height counts on. On a phone it is two rows: the
 * wordmark and the search, then the pills.
 */
export function LandingBar({ pills }: { pills: readonly GenrePill[] }) {
  return (
    <div data-landing-bar="" className="sticky top-0 z-40 border-b border-border bg-canvas/75 backdrop-blur-md">
      <div className="mx-auto grid w-full max-w-[1600px] grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 px-[clamp(12px,5vw,88px)] pt-2 sm:h-14 sm:grid-cols-[auto_clamp(240px,23vw,340px)_minmax(0,1fr)] sm:gap-x-4 sm:pt-0">
        <HomeLink className="shrink-0 no-underline">
          <Wordmark className="text-xl" />
        </HomeLink>
        <LandingSearchTrigger />
        <GenreTablist label="Genres" tabs={pills} className="col-span-2 -mx-1.5 pb-1 sm:col-span-1 sm:mx-0 sm:pb-0 sm:-ml-1.5" />
      </div>
    </div>
  );
}
