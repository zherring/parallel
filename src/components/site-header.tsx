import { HomeLink } from "@/components/home-link";
import { SearchButton } from "@/components/universal-search";
import { Wordmark } from "@/components/wordmark";

/**
 * The site's header: the wordmark, which is the way home, and the Search button of the universal search. Hidden on a `/p/` page that has its people bar
 * (globals.css), which has the way home and the people search of its own. The landing page keeps its hero field and can also open search with the shortcut.
 */
export function SiteHeader() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-x-4 px-4 py-2 sm:min-h-12 sm:py-1.5">
        <HomeLink className="shrink-0 no-underline">
          <Wordmark className="text-2xl" />
        </HomeLink>
        <SearchButton />
      </div>
    </header>
  );
}
