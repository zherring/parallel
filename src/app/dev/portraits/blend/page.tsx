import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlendLab } from "./blend-lab";

export const metadata: Metadata = { title: "Portrait colour blends (development)", robots: { index: false, follow: false } };

/**
 * Spike (zherring/spike-portraits): could a pair's two portrait colours, mixed, stand in for the app's "shared" green? Every pair and triple
 * of the palette as overlapping circles, with a mix method to switch (each CSS blend mode, or color-mix in a few spaces). Development-only
 * (a 404 in production), like /dev/portraits.
 */
export default function PortraitBlendPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <BlendLab />;
}
