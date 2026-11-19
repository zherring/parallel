import type { AxisTick } from "@/lib/timeline-layout";
import { cn } from "./cn";

/**
 * One year of a timeline's axis: a tick, and under it the year when it has a label (a decade's in bold, the others quiet), centred on the tick. `above` turns
 * it over, so the year stands over its tick, which is at the bottom, next to the line below; the landing page's timeline has its years above the line.
 * Without `mark` it is only the year (the landing page's, which has the line itself under it). Positioned in a `relative` row: `x` is px, or a percentage of its width.
 */
export function YearTick({
  tick,
  x,
  above = false,
  mark = true,
}: {
  tick: Pick<AxisTick, "kind" | "label">;
  x: number | string;
  above?: boolean;
  mark?: boolean;
}) {
  return (
    <span
      className={cn("absolute flex -translate-x-1/2 items-center", above ? "bottom-0 flex-col-reverse" : "top-0 flex-col")}
      style={{ left: x }}
    >
      {mark && <span className={cn("w-px", tick.kind === "decade" ? "h-3 bg-muted" : "h-1.5 bg-border")} />}
      {tick.label && (
        <span
          className={cn(
            mark && (above ? "mb-0.5" : "mt-0.5"),
            "tabular-nums",
            tick.kind === "decade" ? "text-xs font-semibold text-strong" : "text-[10px] text-muted",
          )}
        >
          {tick.label}
        </span>
      )}
    </span>
  );
}
