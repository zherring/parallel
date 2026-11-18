/**
 * The one timeline line of the product, a 1px white line at the stage's `--line-y`, running over both panels and on through the gutters to the stage's
 * edges (the stage is at most 1600px wide), fading to nothing at both ends: its mask is opaque from just inside the gutter, so over the panels it reads
 * against the montage and only the gutters carry the fade. The first reveal draws it outward from the middle (`drawLine`, which finds it by `data-line`).
 * It never moves after that. Its parent is the stage's link, whose box is the panels' (inset by the gutter), hence the negative inset.
 */
export function TimelineLine() {
  return (
    <div
      data-line=""
      aria-hidden="true"
      className="pointer-events-none absolute -inset-x-(--gutter) top-(--line-y) h-px -translate-y-1/2 bg-white/60 [mask-image:linear-gradient(to_right,transparent,#000_calc(var(--gutter)+14px),#000_calc(100%-var(--gutter)-14px),transparent)]"
    />
  );
}
