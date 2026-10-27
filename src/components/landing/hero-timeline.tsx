import { LINE_Y } from "@/lib/hero-layout";

/**
 * The one timeline line of the product, running across the whole hero and fading out at both
 * ends, with a few small nodes on it. The posters sit on it. It is a plain element in the page's
 * flow of layers (not part of the scaled stage) so it can be as wide as the screen; `top` places
 * it at the posters' middle.
 */
export function TimelineLine() {
  const dot = "radial-gradient(circle, rgb(74 88 106) 0 2px, transparent 2.6px)";
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute left-1/2 h-3 w-[min(100vw,1600px)] -translate-x-1/2 -translate-y-1/2 [mask-image:linear-gradient(to_right,transparent,#000_22%,#000_78%,transparent)]"
      style={{
        top: `calc(var(--s) * ${LINE_Y}px)`,
        backgroundImage: [
          "linear-gradient(rgb(136 153 170 / 0.34), rgb(136 153 170 / 0.34))",
          dot,
          dot,
        ].join(","),
        backgroundSize: "100% 1px, 137px 100%, 211px 100%",
        backgroundPosition: "0 50%, 23px 0, 91px 0",
        backgroundRepeat: "no-repeat, repeat-x, repeat-x",
      }}
    />
  );
}
