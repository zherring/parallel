import { useId } from "react";
import type { ReadingItem } from "@/lib/critics";
import { readingByline } from "@/lib/critics-view";

interface MoreReadingProps {
  reading: readonly ReadingItem[];
  /** Whether quotes come before this section, which then sets itself off from them with a rule. */
  afterQuotes: boolean;
}

/**
 * "More reading", at the bottom of the Clippings tab: pieces about the pair's collaboration that are only linked
 * (they are behind a paywall, or have no line worth setting as a quote), best first as `essays.json` has them. A
 * plain bulleted list in small type, one line-ish each: the title as the link, then the author, the publication
 * and the year, and "(paywall)" where the link leads to one. No quotes, summaries or tags.
 */
export function MoreReading({ reading, afterQuotes }: MoreReadingProps) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className={afterQuotes ? "mt-12 border-t border-border/70 pt-8 sm:mt-14 sm:pt-10" : "pt-2"}
    >
      <h3 id={headingId} className="text-xs font-medium uppercase tracking-wide text-muted">
        More reading
      </h3>
      <ul className="mt-4 max-w-[44rem] list-disc space-y-2.5 pl-5 text-sm leading-6 marker:text-muted/60">
        {reading.map((item) => {
          const byline = readingByline(item).join(", ");
          return (
            <li key={item.url} className="pl-1 text-pretty">
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded text-body underline decoration-border underline-offset-4 transition-colors hover:text-accent-blue hover:decoration-accent-blue motion-reduce:transition-none"
              >
                {item.title.trim()}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
              {byline && <span className="text-muted"> &mdash; {byline}</span>}
              {item.paywalled && <span className="text-xs text-muted"> (paywall)</span>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
