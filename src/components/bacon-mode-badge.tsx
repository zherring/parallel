"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/components/timeline/cn";
import { BACON_MODE_LABEL, searchWithoutBaconMode } from "@/lib/bacon-mode";

/**
 * What says a `/p/` page is in Kevin Bacon mode (see src/lib/bacon-mode.ts), and the way out of it: a link to the same page, on the
 * same view, without `mode=bacon` in its address. In the page bar it is a capsule the height of the bar's controls (`sheet` false,
 * from `lg` up, where there is room beside the view switcher); in the gear's sheet a row, on the widths that have no capsule.
 */
export function BaconModeBadge({ sheet = false, className }: { sheet?: boolean; className?: string }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  return (
    <Link
      href={`${pathname}${searchWithoutBaconMode(search)}`}
      data-bacon-badge
      aria-label={`Leave ${BACON_MODE_LABEL}`}
      title={`Leave ${BACON_MODE_LABEL}`}
      className={cn(
        "inline-flex items-center gap-2 rounded-(--bar-radius) border border-accent-orange/60 text-sm font-medium text-accent-orange no-underline transition-colors hover:border-accent-orange hover:bg-accent-orange/10 motion-reduce:transition-none",
        sheet ? "h-9 w-full justify-between bg-surface px-3" : "h-(--bar-h) px-3.5",
        className,
      )}
    >
      {BACON_MODE_LABEL}
      <X aria-hidden="true" className="size-4 shrink-0" />
    </Link>
  );
}
