"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";

/**
 * The wordmark's link to the landing page. Elsewhere it navigates as a normal link. On the landing
 * page it would only reload what is already there (and drop the `#genre` hash that selects a
 * tab), so a plain click scrolls smoothly to the top instead, or instantly for visitors who prefer
 * reduced motion. Clicks with a modifier key or a non-primary button keep the browser's behavior.
 */
export function HomeLink({ className, children }: { className?: string; children: ReactNode }) {
  const pathname = usePathname();

  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    if (pathname !== "/") return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduced ? "instant" : "smooth" });
  }

  return (
    <Link href="/" aria-label="Parallel home" onClick={onClick} className={className}>
      {children}
    </Link>
  );
}
