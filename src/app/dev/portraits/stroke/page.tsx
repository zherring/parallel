import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import data from "@/lib/portrait-cuts.json";
import { PORTRAIT_IDS, type PortraitCuts } from "@/lib/portrait-cuts";
import { StrokeTuner, type TunerArtist } from "./stroke-tuner";

export const metadata: Metadata = { title: "Portrait stroke tuning (development)", robots: { index: false, follow: false } };

const CUTS = data as unknown as PortraitCuts;

/**
 * Spike (zherring/spike-portraits): pick the cut edge's and the hero ring's width by eye at every size the portrait is drawn at, then fit
 * a rule to the picks. Development-only (a 404 in production), like /dev/portraits.
 */
export default function PortraitStrokePage() {
  if (process.env.NODE_ENV === "production") notFound();
  const artists: TunerArtist[] = PORTRAIT_IDS.flatMap((id) => {
    const cut = CUTS[id];
    return cut ? [{ id, name: cut.name, profilePath: cut.profilePath }] : [];
  });
  // TreatedPortrait reads the search params, so it sits under a Suspense boundary.
  return (
    <Suspense>
      <StrokeTuner artists={artists} />
    </Suspense>
  );
}
