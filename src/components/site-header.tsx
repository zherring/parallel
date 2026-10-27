import { HeaderSearch } from "@/components/header-search";
import { HomeLink } from "@/components/home-link";
import { Wordmark } from "@/components/wordmark";

export function SiteHeader() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-4 pb-2 pt-2 sm:h-12 sm:flex-nowrap sm:py-0">
        <HomeLink className="shrink-0 no-underline">
          <Wordmark className="text-2xl" />
        </HomeLink>
        <HeaderSearch />
      </div>
    </header>
  );
}
