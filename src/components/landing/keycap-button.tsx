import { ArrowLeft, ArrowRight } from "lucide-react";
import type { CSSProperties, FocusEvent } from "react";
import type { NavDirection } from "@/lib/hero-history";

/**
 * Previous or Next beside the hero stage's panels, drawn as a keyboard arrow keycap in outline only: a
 * 32px rounded square with a 1px border and an arrow in it, no fill, no edge, no shadow. It says
 * what the keyboard does too (ArrowLeft and ArrowRight step the hero from anywhere on the page,
 * see hero-keys.ts).
 *
 * The colours are those of the round buttons these replaced: a muted border and arrow; the arrow
 * brightens when the stage is hovered; the button itself hovered or focused takes the green
 * border and the strong arrow, and a touch screen, which has no hover, keeps the arrow at the
 * stronger colour (the strong arrow is `!important` so it wins over the stage-hover arrow when
 * the pointer is on both). The button is 44px square so it is easy to hit; the one bordered square
 * drawn in it carries the focus ring.
 *
 * The press is driven by `pressed` (a click or an arrow key, see keycap-press.ts): the square
 * dips 1px and its border and arrow flash to the hover colours, then it comes back, about 150ms in
 * all. `:active` does the same while a pointer is held on the button. Only the dip is a transition
 * and only without a reduced motion preference; with one, the colours change at once and nothing
 * moves.
 */
export function KeycapButton({
  direction,
  label,
  pressed,
  onPhoto = false,
  className,
  style,
  onClick,
  onFocus,
  onBlur,
}: {
  direction: NavDirection;
  label: string;
  /** This key is down right now. */
  pressed: boolean;
  /** The keycap sits over a photograph (the hero stage's panels), not the page: the same outline, with a dark glass behind it and a lighter border and arrow so it reads on any montage. */
  onPhoto?: boolean;
  className: string;
  style?: CSSProperties;
  onClick: () => void;
  onFocus?: (event: FocusEvent<HTMLButtonElement>) => void;
  onBlur?: (event: FocusEvent<HTMLButtonElement>) => void;
}) {
  const Icon = direction === "prev" ? ArrowLeft : ArrowRight;
  return (
    <button
      type="button"
      onClick={onClick}
      onFocus={onFocus}
      onBlur={onBlur}
      aria-label={label}
      style={style}
      className={`group/btn absolute flex size-11 items-center justify-center outline-none! ${className}`}
    >
      <span
        aria-hidden="true"
        data-keycap={direction}
        data-pressed={pressed ? "true" : "false"}
        className={`flex size-8 items-center justify-center rounded-[9px] border motion-safe:transition-[translate,color,border-color] motion-safe:ease-out group-hover/stage:text-body group-hover/btn:border-accent-green/60 group-hover/btn:text-strong! group-focus-visible/btn:text-strong! group-focus-visible/btn:outline-2 group-focus-visible/btn:outline-offset-2 group-focus-visible/btn:outline-focus group-active/btn:border-accent-green/60 group-active/btn:text-strong! motion-safe:group-active/btn:translate-y-px [@media(hover:none)]:text-body ${
          pressed
            ? "border-accent-green/60 text-strong! motion-safe:translate-y-px motion-safe:duration-[40ms]"
            : onPhoto
              ? "border-white/35 bg-black/45 text-white/80 backdrop-blur-sm group-hover/stage:text-white! motion-safe:duration-[90ms]"
              : "border-border text-muted/70 motion-safe:duration-[90ms]"
        }`}
      >
        <Icon size={16} strokeWidth={2.25} aria-hidden="true" />
      </span>
    </button>
  );
}
