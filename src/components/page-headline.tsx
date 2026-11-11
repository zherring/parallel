import { headlineCount } from "@/lib/films-view";
import { pageHeading } from "@/lib/short-name";

interface PageHeadlineProps {
  people: readonly { id: number; name: string }[];
  /** The films the page lists (the table's count): the films the people share, or one person's films. */
  count: number;
}

/**
 * The page's headline ("Akira Kurosawa & Takashi Shimura, 29 films"), the `h1` of every view of a `/p/` page, for screen readers and search
 * engines only: it is visually hidden (`sr-only`) on every view. What a sighted visitor sees of it is in the page bar: the people pill has
 * the names, and the pill after it the count. For three or more people it names them by family name, as it always did.
 *
 * Not in the Depth view's scroller: nothing in there is placed by the scene (see `DepthScene`), so it is a sibling of it.
 */
export function PageHeadline({ people, count }: PageHeadlineProps) {
  const heading = pageHeading(people);
  const films = headlineCount(count);
  return (
    <h1 className="sr-only">
      {heading.text}
      {films && `, ${films}`}
    </h1>
  );
}
