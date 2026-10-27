import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Shared look of the generated preview cards (home page and /p/ pages), in the same palette as
 * `globals.css`: near-black canvas, white and slate text, Letterboxd green. Satori (the engine
 * behind `ImageResponse`) cannot read CSS variables or Tailwind classes, so the values are repeated here.
 */
export const OG = {
  bg: "#14181c",
  surface: "#202830",
  border: "#2c3440",
  strong: "#ffffff",
  body: "#99aabb",
  muted: "#8899aa",
  green: "#00e054",
  greenGlow: "rgba(0, 224, 84, 0.45)",
} as const;

export const OG_SIZE = { width: 1200, height: 630 } as const;

/**
 * Inter SemiBold (SIL Open Font License, see src/assets/fonts/OFL.txt): the Latin file covers
 * English and Western European names, the Latin Extended file Polish, Czech, Turkish and the
 * like. Satori falls back from the first to the second for glyphs the first lacks.
 */
let fonts: Promise<{ name: string; data: Buffer; weight: 600; style: "normal" }[]> | undefined;

/** Read once per server process. The paths are literal so Next's file tracing finds the files. */
export function ogFonts() {
  fonts ??= Promise.all([
    readFile(join(process.cwd(), "src/assets/fonts/inter-latin-600-normal.woff")),
    readFile(join(process.cwd(), "src/assets/fonts/inter-latin-ext-600-normal.woff")),
  ]).then((files) => files.map((data) => ({ name: "Inter", data, weight: 600 as const, style: "normal" as const })));
  return fonts;
}

/** Soft green glow centered at (`x`, `y`) percent of the card. */
export function ogGlow(x: number, y: number): string {
  return `radial-gradient(circle at ${x}% ${y}%, rgba(0, 224, 84, 0.25) 0%, rgba(0, 224, 84, 0.09) 34%, rgba(20, 24, 28, 0) 66%)`;
}

/** "Parallel" with the "ll" in green, as the site's wordmark. */
export function ogWordmark(fontSize: number) {
  return (
    <div style={{ display: "flex", fontSize, fontWeight: 600, letterSpacing: -1, color: OG.strong }}>
      <span>Para</span>
      <span style={{ color: OG.green }}>ll</span>
      <span>el</span>
    </div>
  );
}
