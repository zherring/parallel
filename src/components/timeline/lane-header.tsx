import Link from "next/link";
import { tmdbImage } from "@/lib/images";
import { initials } from "@/lib/lanes";
import type { PersonSummary } from "@/lib/types";
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
  /** Films this lane shows only as dots on the line while collapsed; the control is hidden at 0. */
  overflowCount: number;
  expanded: boolean;
  onToggleExpanded: () => void;
  /**
   * Short header for the nodes layout, where a lane is only about 130px tall: the facts and
   * year-span lines are left out (they stay in the header's tooltip), the roles shrink to one
   * line, and the biography teaser gives way to just its More/Bio button as the room runs out.
   */
  compact: boolean;
  /**
   * Draws the line under the lane. The header and the track each draw their own half of it
   * (rather than the lane's section drawing one border), so that the timeline's SVG, which runs
   * under the sticky header, cannot show through the one-pixel row between two lanes.
   */
  divider: boolean;
}

function Avatar({ person, compact }: { person: PersonSummary; compact: boolean }) {
  const src = tmdbImage(person.profilePath, "w92");
  const size = compact ? "size-8 sm:size-12" : "size-9 sm:size-12";
  return src ? (
    <img
      src={src}
      alt=""
      width={48}
      height={48}
      loading="lazy"
      decoding="async"
      className={`${size} shrink-0 rounded-full border border-strong/20 object-cover`}
    />
  ) : (
    <span
      aria-hidden
      className={`flex ${size} shrink-0 items-center justify-center rounded-full border border-border bg-surface text-xs font-semibold text-body sm:text-sm`}
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
  overflowCount,
  expanded,
  onToggleExpanded,
  compact,
  divider,
}: LaneHeaderProps) {
  const details = [roles, facts].filter(Boolean).join(". ");

  return (
    <div
      data-lane-head
      title={details ? `${person.name}. ${details}` : person.name}
      className={`sticky left-0 z-20 flex w-[var(--lane-head)] shrink-0 flex-col border-r border-border bg-canvas px-1.5 sm:px-3 ${
        divider ? "border-b" : ""
      } ${compact ? "overflow-hidden pb-2 pt-6 sm:pt-3" : "pb-3 pt-7 sm:pt-4"}`}
    >
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
        <Avatar person={person} compact={compact} />
        <div className="min-w-0 sm:pr-5">
          <h2
            id={`person-${person.id}`}
            className={`break-words text-[11px] font-semibold leading-tight text-strong sm:text-base ${
              compact ? "line-clamp-2" : ""
            }`}
          >
            {soloHref ? (
              <Link href={soloHref} prefetch={false} className="hover:underline">
                {person.name}
              </Link>
            ) : (
              person.name
            )}
          </h2>
          {roles && (
            <p className={`mt-0.5 hidden text-xs leading-snug text-body ${compact ? "sm:line-clamp-1" : "sm:line-clamp-2"}`}>
              {roles}
            </p>
          )}
        </div>
      </div>

      {!compact && facts && <p className="mt-2 hidden shrink-0 text-xs leading-snug text-muted sm:block">{facts}</p>}
      {!compact && span && (
        <p className="mt-1 shrink-0 text-center text-[10px] tabular-nums text-muted sm:hidden">{span}</p>
      )}

      <PersonBio person={person} roles={roles} />

      {overflowCount > 0 && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={onToggleExpanded}
          className="mt-2 flex w-full shrink-0 cursor-pointer flex-col items-center rounded-md border border-border bg-surface px-1 py-1 text-[10px] leading-tight text-body hover:border-muted hover:text-strong sm:flex-row sm:justify-center sm:gap-1 sm:px-2 sm:text-xs"
        >
          {expanded ? (
            "Show fewer"
          ) : (
            <>
              <span>
                +{overflowCount} more<span className="max-sm:sr-only"> films</span>
              </span>
              <span aria-hidden className="max-sm:hidden">
                &middot;
              </span>
              <span className="font-medium text-strong">Show all</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}
