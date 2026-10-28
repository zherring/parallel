"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { PersonSearch } from "@/components/person-search/person-search";
import { searchModeForPathname, showsHeaderSearch } from "@/lib/chip-input";
import { peopleFromPathname } from "@/lib/people-nav";

/**
 * Header search on every page but the landing page (which has its own hero search) and the
 * timeline pages (which have the Add a person field beside their headline, so the header does not
 * offer a second one): see `showsHeaderSearch`. Elsewhere (404 and any other page without a
 * timeline) it is the chip field that starts a new timeline.
 */
export function HeaderSearch() {
  const pathname = usePathname();
  const peopleInView = useMemo(() => peopleFromPathname(pathname ?? ""), [pathname]);

  if (!showsHeaderSearch(pathname)) return null;
  const mode = searchModeForPathname(pathname);
  return (
    <div
      className={`order-last w-full sm:order-none sm:ml-auto ${mode === "chips" ? "sm:w-96 lg:w-[30rem]" : "sm:w-80"}`}
    >
      {/* Keyed by mode: leaving the chip field for a timeline page starts the new field empty. */}
      <PersonSearch key={mode} size="compact" mode={mode} peopleInView={peopleInView} />
    </div>
  );
}
