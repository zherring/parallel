import { cn } from "@/components/timeline/cn";
import { headlineCount } from "@/lib/films-view";
import { pageHeading } from "@/lib/short-name";

interface PageHeadlineProps {
  people: readonly { id: number; name: string }[];
  /** The films the page lists (the table's count): the films the people share, or one person's films. */
  count: number;
  /** Where the block goes: in the flow of a flat page, or at the top of the Depth view's scroller (see `DepthScene`). */
  className?: string;
}

/**
 * The page's headline ("Akira Kurosawa & Takashi Shimura, 29 films": the names bright, the count muted), the `h1` of every view of a
 * `/p/` page. It sits at the top left, under the page bar (`PeopleBar`, fixed to the top of the screen on every view), and scrolls away
 * with the page; it is the same block, in the same place relative to the bar, on the flat Timeline, Table and Clippings and in the Depth
 * view, where it is at the top of the scroller's content (a plain block there: nothing 3D, nothing fixed). It leaves room at the right
 * for what is there on the Depth view (the year rail), so the headline wraps in the same place on every view. For three or more people
 * it names them by family name, with the full names on hover.
 */
export function PageHeadline({ people, count, className }: PageHeadlineProps) {
  const heading = pageHeading(people);
  const films = headlineCount(count);
  return (
    // Clear of the bar (about 4rem tall), which is over the top of the page. Only the text takes the pointer: the block spans the page's width.
    <div className={cn("pointer-events-none pb-3 pl-3 pr-8 pt-[4.5rem] sm:pr-[3.75rem]", className)}>
      <h1
        title={heading.full ?? undefined}
        className="pointer-events-auto w-fit max-w-full break-words text-2xl font-semibold text-strong sm:text-3xl"
      >
        {heading.text}
        {films && <span className="font-normal text-muted">, {films}</span>}
      </h1>
    </div>
  );
}
