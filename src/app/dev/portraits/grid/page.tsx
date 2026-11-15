import type { Metadata } from "next";
import { notFound } from "next/navigation";
import data from "@/lib/portrait-cuts.json";
import { PORTRAIT_IDS, type PortraitCut, type PortraitCuts } from "@/lib/portrait-cuts";
import { PortraitGrid } from "./portrait-grid";

export const metadata: Metadata = { title: "Portrait grid (development)", robots: { index: false, follow: false } };

const CUTS = data as unknown as PortraitCuts;

/**
 * Spike (zherring/spike-portraits): every artist in portrait-cuts.json as a grid of 20-vertex cut-paper cards, with a Color | Montage | Mix
 * toggle for the background. Development-only (a 404 in production), like /dev/portraits.
 */
export default function PortraitGridPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const cards = PORTRAIT_IDS.flatMap((id) => (CUTS[id] ? [{ id, cut: CUTS[id] as PortraitCut }] : []));
  return <PortraitGrid cards={cards} />;
}
