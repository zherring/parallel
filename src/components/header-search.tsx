"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { PersonSearch } from "@/components/person-search/person-search";
import { peopleFromPathname } from "@/lib/people-nav";

/**
 * Header search on every page but the landing page (which has its own hero search). On a /p/
 * page it adds to the people already in the URL; elsewhere it starts a new timeline.
 */
export function HeaderSearch() {
  const pathname = usePathname();
  const peopleInView = useMemo(() => peopleFromPathname(pathname ?? ""), [pathname]);

  if (pathname === "/") return null;
  return (
    <div className="order-last w-full sm:order-none sm:ml-auto sm:w-80">
      <PersonSearch size="compact" peopleInView={peopleInView} />
    </div>
  );
}
