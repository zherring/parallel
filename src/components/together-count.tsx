import { cn } from "@/components/timeline/cn";
import { filmCountLabel } from "@/lib/format";

interface TogetherCountProps {
  /** Several people on the page: the count is the films they made together. One person has just their films. */
  several: boolean;
  /** The films the page lists: the headline's count (the table's rows), so every view and the Table agree. */
  count: number;
  /** Where the bar puts it, and what it does while the people pill is open (it steps aside). */
  className?: string;
  /** The pill's box, for the people who made films together or not: the bar's hairline and canvas. Not on the plain text of a one-person page. */
  pillClassName?: string;
}

/**
 * How many films the page has, in the page bar, right after the people pill. For a pair (or more) it is a small pill: a green dot, the green
 * of the films made together in the scene and the timeline (`lit`), and "30 films made together"; with none it has a muted grey dot and says
 * "No films made together". On a phone it shrinks to the dot and the number, the full words being its accessible name. For one person it is
 * plain muted text, "30 films". It is not interactive, and takes no pointer events: the page under the bar stays draggable up to it.
 *
 * The number is the headline's count (the table's rows, see `PageHeadline`), passed in: the page works it out once, and the Timeline, Focus
 * and Table all show the same one, which is also the number of green films a pair has in the scene.
 */
export function TogetherCount({ several, count, className, pillClassName }: TogetherCountProps) {
  if (!several) {
    return <p className={cn("flex h-(--bar-h) items-center whitespace-nowrap text-sm tabular-nums text-muted", className)}>{filmCountLabel(count)}</p>;
  }
  const label = count > 0 ? `${filmCountLabel(count)} made together` : "No films made together";
  return (
    <p
      role="img"
      aria-label={label}
      data-together-pill
      className={cn("inline-flex h-(--bar-h) shrink-0 items-center gap-2 whitespace-nowrap rounded-(--bar-radius) px-3 text-sm max-sm:gap-1.5 max-sm:px-2.5", pillClassName, className)}
    >
      <span
        aria-hidden="true"
        className={cn("size-2.5 shrink-0 rounded-full", count > 0 ? "bg-lit shadow-[0_0_6px_var(--lit-glow)]" : "bg-muted/60")}
      />
      <span aria-hidden="true" className={count > 0 ? "text-strong" : "text-muted"}>
        {count > 0 ? (
          <>
            <span className="tabular-nums">{count}</span>
            <span className="max-sm:hidden"> {count === 1 ? "film" : "films"} made together</span>
          </>
        ) : (
          <>
            <span className="sm:hidden">0</span>
            <span className="max-sm:hidden">No films made together</span>
          </>
        )}
      </span>
    </p>
  );
}
