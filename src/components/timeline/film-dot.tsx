import type { SVGProps } from "react";
import { NODE_RADIUS } from "@/lib/timeline-layout";
import type { NodeTone } from "./film-node";

export const LIT_GLOW = { filter: "drop-shadow(0 0 3px var(--lit-glow))" };
/** On a pair's page (its palette) the films made together are white (`--together`; orange in Kevin Bacon mode), with no glow, where the app's are green (`--lit`). */
export const MADE_TOGETHER_WHITE = "var(--together)";

interface FilmDotProps extends Omit<SVGProps<SVGCircleElement>, "cx" | "cy" | "r" | "fill" | "stroke" | "strokeWidth"> {
  /** Centre, in the SVG's units, or a percentage of its width. */
  x: number | string;
  y: number | string;
  tone: NodeTone;
  /** The page has several people (their colours tell the films apart): a film of one lane is as large as one shared by some. */
  colored: boolean;
  /** The page has person colours: a film made together is white, with no glow. */
  palette: boolean;
  /** The colour of a film that is not shared by every lane (the person's, or its connection's). */
  fill: string;
  /** A multiple of the node's size, 1 on a pair's page; the landing page's timeline makes them smaller where its axis is crowded. */
  scale?: number;
}

/**
 * A film's node on a track line, the way the pair page's timeline draws it (and the landing page's timeline, in its own width): a dot in its person's colour, and
 * one shared by every lane larger, white on a pair's page (green with a glow elsewhere) and ringed in the page's colour, so it reads over the line and the
 * dots beside it. Place it in an `<svg>`, over the line.
 */
export function FilmDot({ x, y, tone, colored, palette, fill, scale = 1, ...rest }: FilmDotProps) {
  const lit = tone === "lit";
  return (
    <circle
      {...rest}
      cx={x}
      cy={y}
      r={(colored && tone === "plain" ? NODE_RADIUS.some - 0.5 : NODE_RADIUS[tone]) * scale}
      stroke={tone === "plain" ? undefined : "var(--bg)"}
      strokeWidth={tone === "plain" ? undefined : 1.5 * scale}
      style={{ ...(lit && !palette ? LIT_GLOW : undefined), fill: lit ? (palette ? MADE_TOGETHER_WHITE : "var(--lit)") : fill }}
    />
  );
}
