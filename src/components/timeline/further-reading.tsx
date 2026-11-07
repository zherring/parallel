import { ExternalLink } from "lucide-react";
import { Fragment, useId } from "react";
import type { Essay } from "@/lib/essays";
import { essayByline, essayKindLabel } from "@/lib/essays-view";
import { cn } from "./cn";

/** The column the quotes above set their lines in (see `clippings-panel.tsx`): the list keeps to the same measure. */
const COLUMN = "max-w-[44rem]";

/** A small tag after the byline ("Book chapter", "Paywalled"): quiet text, not a badge. */
const TAG = "whitespace-nowrap text-[11px] font-medium uppercase tracking-wide text-muted/90";

interface FurtherReadingProps {
  essays: readonly Essay[];
  /** Whether quotes come before this section, which then sets itself off from them with a rule. */
  afterQuotes: boolean;
}

/**
 * "Further reading", under the Clippings' quotes: what critics and scholars have written about the pair's
 * collaboration (not the artists' own words), best first as `essays.json` has them. Deliberately calmer and
 * smaller than the quotes it follows: a title in the serif as the link, a quiet byline, and the essay's own
 * line (italic, between quotation marks) or else our summary of it. No headshots, colours or share buttons.
 */
export function FurtherReading({ essays, afterQuotes }: FurtherReadingProps) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className={afterQuotes ? "mt-12 border-t border-border/70 pt-8 sm:mt-14 sm:pt-10" : "pt-2"}
    >
      <h3 id={headingId} className="text-xs font-medium uppercase tracking-wide text-muted">
        Further reading
      </h3>
      <p className="mt-1.5 text-sm text-muted">Critics and scholars on the collaboration.</p>
      <ul className="mt-2 divide-y divide-border/70">
        {essays.map((essay) => (
          <li key={essay.url} className="py-5 first:pt-4 last:pb-0 sm:py-6 sm:first:pt-5">
            <EssayItem essay={essay} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The title with the external-link icon, which stays with the title's last word so that it never starts a line. */
function TitleLink({ essay }: { essay: Essay }) {
  const title = essay.title.trim();
  const split = title.lastIndexOf(" ");
  const head = split === -1 ? "" : title.slice(0, split + 1);
  const last = split === -1 ? title : title.slice(split + 1);
  return (
    <a
      href={essay.url}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded underline decoration-border underline-offset-4 transition-colors hover:text-accent-blue hover:decoration-accent-blue motion-reduce:transition-none"
    >
      {head}
      <span className="whitespace-nowrap">
        {last}
        <ExternalLink aria-hidden="true" className="ml-1 inline size-3.5 align-[-0.1em] text-muted" />
        <span className="sr-only">(opens in a new tab)</span>
      </span>
    </a>
  );
}

function EssayItem({ essay }: { essay: Essay }) {
  const { pull, summary, via, kind, paywalled } = essay;
  // The author, the publication and the year, then where a reprint came from: one run of text that wraps after a dot
  // (the no-break space keeps each dot with the word before it).
  const byline = essayByline(essay);
  const parts = via ? [...byline, `via ${via}`] : byline;

  return (
    <div className={COLUMN}>
      <p className="font-serif text-[18px] leading-snug text-strong text-pretty sm:text-[20px]">
        <TitleLink essay={essay} />
      </p>
      <p className="mt-1.5 text-[13px] leading-6 text-muted">
        {parts.map((part, index) => (
          <Fragment key={index}>
            {index > 0 && <span aria-hidden="true">&nbsp;&middot; </span>}
            {part}
          </Fragment>
        ))}
        {/* The tags follow the byline in the same run, a space before each so that they wrap rather than overflow. */}
        {parts.length > 0 && " "}
        <span className={cn(parts.length > 0 && "ml-1.5", TAG)}>{essayKindLabel(kind)}</span>
        {paywalled && (
          <>
            {" "}
            <span className={cn("ml-1.5", TAG)}>Paywalled</span>
          </>
        )}
      </p>
      {pull ? (
        <blockquote cite={essay.url} className="mt-2.5 font-serif text-base italic leading-relaxed text-muted text-pretty">
          <p>
            &ldquo;{pull}&rdquo;
          </p>
        </blockquote>
      ) : (
        // Our own words about the piece, so no quotation marks.
        <p className="mt-2.5 text-sm leading-6 text-muted text-pretty">{summary}</p>
      )}
    </div>
  );
}
