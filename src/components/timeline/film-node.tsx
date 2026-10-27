import { memo } from "react";
import { LINE_Y, NODE_HIT_HEIGHT } from "@/lib/timeline-layout";
import { cn } from "./cn";

/**
 * plain - a film of this lane only (grey)
 * some  - shown in some lanes but not all, 3+ lanes (the colour of its connection)
 * lit   - shared by every lane (green, larger, with a glow)
 */
export type NodeTone = "plain" | "some" | "lit";

interface FilmNodeProps {
  id: number;
  title: string;
  year: number;
  /** "Director, Writer" for this person on this film. */
  roles: string;
  /** Read after the roles ("Made together", "Shared by Fincher and Pitt"); empty for a film of one lane. */
  note: string;
  /** Centre of the node inside the lane's track; the lane's line is at LINE_Y. */
  x: number;
  /** Width of the invisible hit area; narrower than DOT_HIT_SIZE where nodes are crowded. */
  hitWidth: number;
  tone: NodeTone;
  /** Index of the lane the node belongs to; read by the timeline's delegated hover handlers. */
  laneIndex: number;
  /**
   * The film has a poster card (in this lane or in the shared strip), which is its keyboard and
   * screen-reader control. The node is then only a mouse target for the hover card and a click:
   * hidden from assistive technology, out of the tab order and the roving set, with no text.
   */
  decorative: boolean;
  /** The lane's one tab stop (roving tabindex) among the nodes that are not decorative; the arrow keys move between them. */
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

function accessibleName({ title, year, roles, note }: FilmNodeProps): string {
  return [`${title}, ${year}`, roles, note, "Open details"].filter(Boolean).join(". ").concat(".");
}

/**
 * The button of a film's node on a lane line. The visible node is already drawn by the
 * timeline's SVG; this is an invisible hit area over it, with a ring on hover, focus and
 * selection. A film without a poster card gets the real, focusable button (a lane can have a
 * hundred of these, so only one is a tab stop at a time, see `tabbable`); a film with a
 * poster gets a decorative one.
 */
function FilmNodeImpl(props: FilmNodeProps) {
  const { id, title, year, x, hitWidth, tone, laneIndex, decorative, tabbable, selected, describedBy, onSelect } = props;
  const style = { left: x - hitWidth / 2, top: LINE_Y - NODE_HIT_HEIGHT / 2, width: hitWidth, height: NODE_HIT_HEIGHT };
  const button = (
    <button
      type="button"
      data-film={id}
      data-lane={laneIndex}
      data-film-node={decorative ? undefined : ""}
      tabIndex={decorative || !tabbable ? -1 : 0}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : accessibleName(props)}
      aria-describedby={decorative ? undefined : describedBy}
      aria-current={selected && !decorative ? "true" : undefined}
      onClick={(event) => onSelect(id, event.currentTarget)}
      // The ring lives on the inner span so a squeezed hit area still shows a round focus mark.
      // Important: the global :focus-visible outline is unlayered CSS and would beat a plain utility.
      // scroll-mb: keyboard focus scrolls the page far enough to clear the control bar pinned to the viewport's bottom.
      className="group relative block size-full scroll-mb-20 cursor-pointer focus-visible:outline-none!"
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
      {!decorative && (
        <span className="sr-only">
          {title} ({year})
        </span>
      )}
    </button>
  );

  // Decorative nodes stay out of the lane's list: they are not items of it.
  return decorative ? (
    <div aria-hidden className="absolute z-10" style={style}>
      {button}
    </div>
  ) : (
    <li className="absolute z-10" style={style}>
      {button}
    </li>
  );
}

export const FilmNode = memo(FilmNodeImpl);
