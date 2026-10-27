import { memo } from "react";
import { DOT_HIT_SIZE, LINE_Y } from "@/lib/timeline-layout";
import { cn } from "./cn";

interface FilmDotProps {
  id: number;
  title: string;
  year: number;
  /** Centre of the dot inside the lane's track. */
  x: number;
  /** Width of the invisible hit area; narrower than DOT_HIT_SIZE where dots are crowded. */
  hitWidth: number;
  selected: boolean;
  onSelect: (id: number, trigger: HTMLElement) => void;
}

/**
 * A film that lost its poster card to the lane's row cap. The visible dot is already
 * drawn on the lane line by the timeline's SVG; this is only the real, focusable
 * button over it (an invisible hit area, with a ring on hover, focus and selection).
 */
function FilmDotImpl({ id, title, year, x, hitWidth, selected, onSelect }: FilmDotProps) {
  return (
    <li className="absolute z-10" style={{ left: x - hitWidth / 2, top: LINE_Y - DOT_HIT_SIZE / 2, width: hitWidth, height: DOT_HIT_SIZE }}>
      <button
        type="button"
        title={`${title} (${year})`}
        aria-label={`${title}, ${year}. Open details.`}
        aria-current={selected ? "true" : undefined}
        onClick={(event) => onSelect(id, event.currentTarget)}
        // The ring lives on the inner span so a squeezed hit area still shows a round focus mark.
        className="group relative block size-full cursor-pointer focus-visible:outline-none"
      >
        <span
          aria-hidden
          className={cn(
            "absolute left-1/2 top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full transition-shadow duration-150 motion-reduce:transition-none",
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

export const FilmDot = memo(FilmDotImpl);
