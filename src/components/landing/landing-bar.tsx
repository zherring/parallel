import { GenreTablist, type GenrePill } from "@/components/landing/genre-tabs";
import { LandingSearchTrigger } from "@/components/landing/landing-search-trigger";
import { HomeLink } from "@/components/home-link";
import { Wordmark } from "@/components/wordmark";

/**
 * The landing page's top bar, stuck to the top of the screen over the stage (a blurred canvas with a hairline under it): the way home, the genre pills, which
 * choose the view under the bar (the splash, or one genre's grid), taking the width the rest leaves, and at the right end the search (a field that opens the
 * universal search). The pills scroll sideways under a fade at the edge nearest the search, so they never run under it. It replaces the site header on this page (globals.css
 * hides that one when this is on it), so it is the first 56px of the first screen, which the stage's height counts on. On a phone it is two rows: the
 * wordmark and the search, then the pills.
 */
export function LandingBar({ pills }: { pills: readonly GenrePill[] }) {
  return (
    <div data-landing-bar="" className="sticky top-0 z-40 border-b border-border bg-canvas/75 backdrop-blur-md">
      <div className="mx-auto grid w-full max-w-[1600px] grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 px-[clamp(12px,5vw,88px)] pt-2 sm:h-14 sm:grid-cols-[auto_minmax(0,1fr)_clamp(240px,23vw,340px)] sm:gap-x-4 sm:pt-0">
        <HomeLink className="shrink-0 no-underline">
          <Wordmark className="text-xl" />
        </HomeLink>
        {/* The pills come before the search in the markup (the tab order follows the bar's), and a phone puts the search in the first row beside the wordmark. */}
        <GenreTablist label="Genres" tabs={pills} className="col-span-2 row-start-2 -mx-1.5 pb-1 sm:col-span-1 sm:row-start-auto sm:mx-0 sm:pb-0 sm:-ml-1.5" />
        <LandingSearchTrigger className="max-sm:col-start-2 max-sm:row-start-1" />
      </div>
    </div>
  );
}
