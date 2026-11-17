import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FramesLab } from "./frames-lab";

export const metadata: Metadata = { title: "Portrait overlap frames (development)", robots: { index: false, follow: false } };

/**
 * Spike (zherring/spike-portraits): a shared film's poster framed by two cut-paper shapes, one per person's colour, offset from each other;
 * where the shapes overlap the frame is white, so it reads mostly white with a sliver of each colour. Every pair of the palette, clean
 * rectangles or rough cut paper. Development-only (a 404 in production), like /dev/portraits.
 */
export default function PortraitFramesPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <FramesLab />;
}
