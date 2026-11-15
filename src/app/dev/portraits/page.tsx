import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import data from "@/lib/portrait-cuts.json";
import { PORTRAIT_IDS, type PortraitCut, type PortraitCuts } from "@/lib/portrait-cuts";
import { ContactSheet } from "./contact-sheet";

export const metadata: Metadata = { title: "Portrait cuts (development)", robots: { index: false, follow: false } };

const CUTS = data as unknown as PortraitCuts;
/** The app's global link colour is light, unreadable on this cream sheet. */
const contactLink = { color: "#1d4ed8", textDecoration: "underline" } as const;

/**
 * Spike (zherring/spike-portraits): a contact sheet of the "cut-paper polygon" treatment on TMDB portraits, for judging the look. A
 * development-only page (a 404 in production), like /dev/x-preview. Points come from portrait-cuts.json (`npm run portraits:cut`); the
 * image is always the original TMDB URL, clipped in the browser. The sheet and its slide-out panel (edge position, outline colour) are
 * client-side (`ContactSheet`).
 */
export default function PortraitsPage() {
  if (process.env.NODE_ENV === "production") notFound();

  // Every artist in portrait-cuts.json, in the grid's order.
  const rows = PORTRAIT_IDS.flatMap((id) => (CUTS[id] ? [{ id, cut: CUTS[id] as PortraitCut }] : []));
  const flaggedCount = rows.filter(({ cut }) => cut.flagged).length;

  return (
    <main style={{ background: "#f4f1ea", color: "#111", minHeight: "100vh", padding: 16, fontFamily: "system-ui, sans-serif", fontSize: 12 }}>
      <h1 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 4px" }}>Portrait cuts (spike)</h1>
      <p style={{ margin: "0 0 12px", color: "#555" }}>
        {rows.length} artists · {flaggedCount} flagged · 20-vertex cut · {rows[0]?.cut.model ?? "no data"} · regenerate with <code>npm run portraits:cut</code> · <Link href="/dev/portraits/grid" style={contactLink}>
          grid view →
        </Link>{" "}
        ·{" "}
        <Link href="/dev/portraits/stroke" style={contactLink}>
          stroke tuning →
        </Link>
      </p>
      <ContactSheet rows={rows} />
    </main>
  );
}
