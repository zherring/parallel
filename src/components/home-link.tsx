import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The link to the landing page: the site header's wordmark, and the page bar's back arrow. (The landing page's own bar has none: there it would only link to the
 * page itself, and the site's header is hidden there.) `label` is the link's accessible name ("Parallel home" unless the link is an icon that says more, like the page bar's back arrow).
 */
export function HomeLink({ className, title, label = "Parallel home", children }: { className?: string; title?: string; label?: string; children: ReactNode }) {
  return (
    <Link href="/" aria-label={label} title={title} className={className}>
      {children}
    </Link>
  );
}
