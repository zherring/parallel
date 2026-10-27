import Link from "next/link";
import { HeaderSearch } from "@/components/header-search";
import { Wordmark } from "@/components/wordmark";

export function SiteHeader() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-4 pb-2 pt-2 sm:h-12 sm:flex-nowrap sm:py-0">
        <Link href="/" aria-label="Parallel home" className="shrink-0 no-underline">
          <Wordmark className="text-2xl" />
        </Link>
        <HeaderSearch />
      </div>
    </header>
  );
}
