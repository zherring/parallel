import { memo } from "react";
import { NODE_HIT_HEIGHT } from "@/lib/timeline-layout";
import { cn } from "./cn";

/**
 * plain - a film of this lane only (grey)
 * some  - shown in some lanes but not all, 3+ lanes (blue)
 * lit   - shared by every lane (green, larger, with a glow)
 */
export type NodeTone = "plain" | "some" | "lit";

interface FilmNodeProps {
  id: number;
  title: string;
  year: number;
  /** "Director, Writer" for this person on this film. */
  roles: string;
  /** Centre of the node inside the lane's track, and y of the lane's line inside the lane. */
  x: number;
  lineY: number;
  /** Width of the invisible hit area; narrower than DOT_HIT_SIZE where nodes are crowded. */
  hitWidth: number;
  tone: NodeTone;
  /** Index of the lane the node belongs to; read by the timeline's delegated hover handlers. */
  laneIndex: number;
  /** The lane's one tab stop (roving tabindex); the arrow keys move focus between the others. */
  tabbable: boolean;
  selected: boolean;
  /** id of the hover card while it is open for this node. */
  describedBy: string | undefined;
  onSelect: (id: number, trigger: HTMLElement) => void;
}

const RING: Record<NodeTone, string> = {
  plain: "size-4",
  some: "size-[18px]",
  lit: "size-6",
};

function accessibleName({ title, year, roles, tone }: FilmNodeProps): string {
  return [`${title}, ${year}`, roles, tone === "lit" ? "Made together" : "", "Open details"]
    .filter(Boolean)
    .join(". ")
    .concat(".");
}

/**
 * The real, focusable button of a film's node on a lane line. The visible node is already
 * drawn by the timeline's SVG; this is an invisible hit area over it, with a ring on hover,
 * focus and selection. A lane can have a hundred of these, so only one is a tab stop at a
 * time (see `tabbable`).
 */
function FilmNodeImpl(props: FilmNodeProps) {
  const { id, title, year, x, lineY, hitWidth, tone, laneIndex, tabbable, selected, describedBy, onSelect } = props;
  return (
    <li className="absolute z-10" style={{ left: x - hitWidth / 2, top: lineY - NODE_HIT_HEIGHT / 2, width: hitWidth, height: NODE_HIT_HEIGHT }}>
      <button
        type="button"
        data-film={id}
        data-lane={laneIndex}
        data-film-node=""
        tabIndex={tabbable ? 0 : -1}
        aria-label={accessibleName(props)}
        aria-describedby={describedBy}
        aria-current={selected ? "true" : undefined}
        onClick={(event) => onSelect(id, event.currentTarget)}
        // The ring lives on the inner span so a squeezed hit area still shows a round focus mark.
        className="group relative block size-full cursor-pointer focus-visible:outline-none"
      >
        <span
          aria-hidden
          className={cn(
            "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-shadow duration-150 motion-reduce:transition-none",
            RING[tone],
            "group-hover:ring-2 group-hover:ring-strong/80 group-focus-visible:ring-2 group-focus-visible:ring-focus",
            selected && "ring-2 ring-strong",
          )}
        />
        {/* Real text for crawlers and find-in-page; the accessible name comes from aria-label. */}
        <span className="sr-only">
          {title} ({year})
        </span>
      </button>
    </li>
  );
}

export const FilmNode = memo(FilmNodeImpl);
