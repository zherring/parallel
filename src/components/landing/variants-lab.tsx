"use client";

import { setHeroVariant, useHeroVariants, useShowsLab } from "@/components/landing/use-hero-variants";
import { EDGE_VARIANTS, LAYOUT_VARIANTS, type HeroVariants } from "@/lib/hero-variants";

/**
 * A small floating control for comparing the landing hero's design variants (see hero-variants.ts): two segmented toggles at the screen's bottom right, which
 * sets `?edge=` and `?layout=` in the URL without a reload. It shows while developing, and in production only for a visit with `?lab` in its URL; the
 * bottom left is the dev server's badge. It is a spike's tool, not part of the page.
 */
export function VariantsLab() {
  const shows = useShowsLab();
  const variants = useHeroVariants();
  if (!shows) return null;
  return (
    <div
      role="group"
      aria-label="Variants"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-1.5 rounded-lg border border-border bg-canvas/90 p-2 text-xs shadow-lg backdrop-blur-md max-sm:bottom-2 max-sm:right-2"
    >
      <span className="px-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Variants</span>
      <Segmented label="Edge" name="edge" options={EDGE_VARIANTS} value={variants.edge} />
      <Segmented label="Layout" name="layout" options={LAYOUT_VARIANTS} value={variants.layout} />
    </div>
  );
}

function Segmented({ label, name, options, value }: { label: string; name: keyof HeroVariants; options: readonly string[]; value: string }) {
  return (
    <div role="group" aria-label={label} className="flex items-center gap-2">
      <span aria-hidden="true" className="w-11 text-muted">
        {label}
      </span>
      <div className="flex overflow-hidden rounded-md border border-border">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={option === value}
            onClick={() => setHeroVariant(name, option)}
            className={`px-2.5 py-1 font-medium transition-colors ${
              option === value ? "bg-surface text-strong" : "text-muted hover:bg-surface/60 hover:text-strong"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
