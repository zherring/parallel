import type { Metadata } from "next";
import { notFound } from "next/navigation";
import data from "@/lib/portrait-cuts.json";
import testset from "@/lib/portrait-testset.json";
import { PORTRAIT_IDS, type PortraitCut, type PortraitCuts } from "@/lib/portrait-cuts";
import type { PortraitTestArtist } from "@/lib/portrait-tears";
import { PortraitGrid } from "./portrait-grid";

export const metadata: Metadata = { title: "Portrait grid (development)", robots: { index: false, follow: false } };

const CUTS = data as unknown as PortraitCuts;

/**
 * Spike (zherring/spike-portraits): every artist in portrait-cuts.json as a grid of 20-vertex cut-paper cards, with the contact sheet's
 * slide-out panel (edge, outline, background, shape, flagged only), then the test set (`npm run portraits:testset`), artists with no cut, drawn
 * with the tear fallback. Development-only (a 404 in production), like /dev/portraits.
 */
export default function PortraitGridPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const cards = PORTRAIT_IDS.flatMap((id) => (CUTS[id] ? [{ id, cut: CUTS[id] as PortraitCut }] : []));
  return <PortraitGrid cards={cards} testArtists={testset as PortraitTestArtist[]} />;
}
