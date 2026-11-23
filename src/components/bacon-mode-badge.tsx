"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/components/timeline/cn";
import { BACON_MODE_LABEL, searchWithoutBaconMode } from "@/lib/bacon-mode";

/**
 * What says a `/p/` page is in Kevin Bacon mode (see src/lib/bacon-mode.ts), and the way out of it: a link to the same page, on the
 * same view, without `mode=bacon` in its address. In the page bar it is a capsule the height of the bar's controls (`sheet` false,
 * from `lg` up, where there is room beside the view switcher); in the gear's sheet a row (`sheet`), on the widths that have no capsule; and,
 * on those widths too, the plaque set into the edge of the screen's frame (`plaque`, see `BaconFrame`): the same link as a small tab on its side, which
 * slides in when it is `enter`.
 */
export function BaconModeBadge({ sheet = false, plaque = false, enter = false, className }: { sheet?: boolean; plaque?: boolean; enter?: boolean; className?: string }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  return (
    <Link
      href={`${pathname}${searchWithoutBaconMode(search)}`}
      data-bacon-badge
      data-bacon-plaque={plaque ? "" : undefined}
      data-enter={enter ? "" : undefined}
      aria-label={`Leave ${BACON_MODE_LABEL}`}
      title={`Leave ${BACON_MODE_LABEL}`}
      className={cn(
        "inline-flex items-center text-accent-orange no-underline transition-colors hover:border-accent-orange hover:bg-accent-orange/10 motion-reduce:transition-none",
        plaque
          ? "justify-center rounded-r-md border-2 border-l-0 border-accent-orange bg-canvas text-[0.625rem] font-semibold uppercase leading-none tracking-[0.16em]"
          : cn("gap-2 rounded-(--bar-radius) border border-accent-orange/60 text-sm font-medium", sheet ? "h-9 w-full justify-between bg-surface px-3" : "h-(--bar-h) px-3.5"),
        className,
      )}
    >
      {plaque ? (
        // On its side, reading from the bottom up, as the tab of a folder does at the edge of a page.
        <span className="flex items-center gap-1.5 rotate-180 [writing-mode:vertical-rl]">
          {BACON_MODE_LABEL}
          <X aria-hidden="true" className="size-2.5 shrink-0" />
        </span>
      ) : (
        <>
          {BACON_MODE_LABEL}
          <X aria-hidden="true" className="size-4 shrink-0" />
        </>
      )}
    </Link>
  );
}
