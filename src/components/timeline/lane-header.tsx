import Link from "next/link";
import { tmdbImage } from "@/lib/images";
import { initials } from "@/lib/person-labels";
import type { PersonSummary } from "@/lib/types";
import type { OpenPerson } from "@/lib/side-panel";
import { PersonBio } from "./person-bio";
interface LaneHeaderProps {
  person: PersonSummary;
  /** Union of the person's roles across the films shown, e.g. "Director, Writer". */
  roles: string;
  /** "Born 1962 · first film 1992 · latest 2026". */
  facts: string;
  /** Compact "1992–2026" for the narrow header. */
  span: string;
  /** Link to the person's solo page; null when they are the only person. */
  soloHref: string | null;
  /** Page without this person; `/` when they are the last one. */
  removeHref: string;
  /**
   * Draws the line under the lane. The header and the track each draw their own half of it
   * (rather than the lane's section drawing one border), so that the timeline's SVG, which runs
   * under the sticky header, cannot show through the one-pixel row between two lanes.
   */
  divider: boolean;
  /** The More button was pressed: open the person's details in the slide-out panel. */
  onOpenPerson: OpenPerson;
  /**
   * Where the header's content sticks while the track scrolls down (a CSS length from the top of the scroller): the page bar's bottom edge, less the room the
   * header has above its content. The header is as tall as its lane, and the track opens scrolled to its baseline, so without this the top of the header, the
   * person's name, is above the screen, and what is left of it is under the page bar. Without it the content is the lane's height and scrolls with it.
   */
  pinTop?: string;
}

function Avatar({ person }: { person: PersonSummary }) {
  const src = tmdbImage(person.profilePath, "w92");
  return src ? (
    <img
      src={src}
      alt=""
      width={48}
      height={48}
      loading="lazy"
      decoding="async"
      className="size-9 shrink-0 rounded-full border border-strong/20 object-cover sm:size-12"
    />
  ) : (
    <span
      aria-hidden
      className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-xs font-semibold text-body sm:size-12 sm:text-sm"
    >
      {initials(person.name)}
    </span>
  );
}

export function LaneHeader({
  person,
  roles,
  facts,
  span,
  soloHref,
  removeHref,
  divider,
  onOpenPerson,
  pinTop,
}: LaneHeaderProps) {
  const details = [roles, facts].filter(Boolean).join(". ");

  return (
    <div
      data-lane-head
      title={details ? `${person.name}. ${details}` : person.name}
      className={`sticky left-0 z-20 w-[var(--lane-head)] shrink-0 border-r border-border bg-canvas pb-3 ${divider ? "border-b" : ""}`}
    >
      {/* Everything the header says is one block that stays under the page bar while the track scrolls down (see `pinTop`); the header itself is the lane's height, and draws its borders. */}
      <div data-lane-head-pin className={`sticky flex flex-col px-1.5 pt-7 sm:px-3 sm:pt-4 ${pinTop === undefined ? "h-full" : ""}`} style={{ top: pinTop }}>
        <Link
          href={removeHref}
          prefetch={false}
          aria-label={`Remove ${person.name}`}
          title={`Remove ${person.name}`}
          className="absolute right-0.5 top-0.5 inline-flex size-7 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-strong sm:right-1.5 sm:top-1.5"
        >
          <svg aria-hidden viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
            <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
          </svg>
        </Link>

        <div className="flex shrink-0 flex-col items-center gap-1.5 text-center sm:flex-row sm:items-start sm:gap-3 sm:text-left">
          <Avatar person={person} />
          <div className="min-w-0 sm:pr-5">
            <h2
              id={`person-${person.id}`}
              className="break-words text-[11px] font-semibold leading-tight text-strong sm:text-base"
            >
              {soloHref ? (
                <Link href={soloHref} prefetch={false} className="hover:underline">
                  {person.name}
                </Link>
              ) : (
                person.name
              )}
            </h2>
            {roles && <p className="mt-0.5 hidden text-xs leading-snug text-body sm:line-clamp-2">{roles}</p>}
          </div>
        </div>

        {facts && <p className="mt-2 hidden shrink-0 text-xs leading-snug text-muted sm:block">{facts}</p>}
        {span && <p className="mt-1 shrink-0 text-center text-[10px] tabular-nums text-muted sm:hidden">{span}</p>}

        <PersonBio person={person} onOpen={onOpenPerson} />
      </div>
    </div>
  );
}
