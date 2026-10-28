import { ArrowLeft, ArrowRight } from "lucide-react";
import type { CSSProperties, FocusEvent } from "react";
import type { NavDirection } from "@/lib/hero-history";

/**
 * Previous or Next beside the hero collage, drawn as a keyboard arrow keycap: a rounded square cap
 * with an arrow on it, sitting on a darker edge that gives it depth (outlined with the border colour, so it shows on the dark page). It says what the keyboard
 * does too (ArrowLeft and ArrowRight step the hero from anywhere on the page, see hero-keys.ts).
 *
 * Like the round buttons (RoundButton in hero-collage.tsx) the button is 44px square so it is easy
 * to hit; the cap drawn in it is 32px, with a 3px edge under it. It is quiet (a little faded) until
 * the collage is hovered or the button is focused, and a touch screen, which has no hover, keeps it
 * at full strength.
 *
 * The press is driven by `pressed` (a click or an arrow key, see keycap-press.ts): the cap moves
 * down 2px, so only 1px of its edge shows, and comes back up. `:active` does the same while a
 * pointer is held on the button. Only the movement is a transition and only without a reduced
 * motion preference; with one, the cap just changes colour, at once.
 */
export function KeycapButton({
  direction,
  label,
  pressed,
  className,
  style,
  onClick,
  onFocus,
  onBlur,
}: {
  direction: NavDirection;
  label: string;
  /** This cap is down right now. */
  pressed: boolean;
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
      {/* The key: the darker edge is this element, the cap rests on it. The focus ring goes round both. */}
      <span
        aria-hidden="true"
        data-keycap={direction}
        data-pressed={pressed ? "true" : "false"}
        className="relative block h-[35px] w-8 rounded-[9px] bg-canvas opacity-80 shadow-[0_0_0_1px_var(--border)] transition-opacity duration-200 group-hover/btn:opacity-100 group-hover/collage:opacity-100 group-focus-visible/btn:opacity-100 group-focus-visible/btn:outline-2 group-focus-visible/btn:outline-offset-2 group-focus-visible/btn:outline-focus [@media(hover:none)]:opacity-100"
      >
        <span
          className={`absolute inset-x-0 top-0 flex h-8 items-center justify-center rounded-[9px] border border-strong/10 bg-border shadow-[inset_0_1px_0_rgb(255_255_255/0.06)] motion-safe:transition-[translate,color,border-color] motion-safe:ease-out group-hover/btn:border-accent-green/60 group-hover/btn:text-strong group-focus-visible/btn:text-strong group-active/btn:text-strong motion-safe:group-active/btn:translate-y-0.5 [@media(hover:none)]:text-body ${
            pressed
              ? "text-strong motion-safe:translate-y-0.5 motion-safe:duration-[50ms]"
              : "text-muted motion-safe:duration-[90ms]"
          }`}
        >
          <Icon size={16} strokeWidth={2.25} aria-hidden="true" />
        </span>
      </span>
    </button>
  );
}
