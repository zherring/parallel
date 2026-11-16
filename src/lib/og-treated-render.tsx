import {
  TREATED_AXIS_WIDTH,
  TREATED_CAPTION_SIZE,
  TREATED_COLUMN,
  TREATED_LEFT,
  TREATED_MARGIN,
  TREATED_NAMES_SIZE,
  TREATED_NODE,
  TREATED_POSTER,
  TREATED_SOLO_DOT,
  TREATED_WIDTH,
  TREATED_WORDMARK,
  treatedAxisGradient,
  treatedPairLayout,
  treatedPosterLefts,
  treatedTile,
  treatedTileTops,
  type TreatedPair,
} from "@/lib/og-treated";
import { OG, ogWordmark } from "@/lib/og-theme";
import type { OgPoster } from "@/lib/og-card";

/**
 * Spike (zherring/spike-portraits): the pair's treated share card as a view, on the grid of `og-treated.ts`: the two portraits down the left edge, the
 * posters of the films they made together, the axis under them, the names and the count at the bottom, the wordmark in the corner. Like `OgCardView`, it
 * takes everything already fetched (the portraits as SVG data URIs, the posters as data URIs) since the renderer throws on an image it cannot load.
 * The embed's first frame (`pair-poster.tsx`) draws the same card in HTML; keep the two in step.
 */

/** "136, 153, 170": `OG.muted`, the axis's line (the plain card's lane is this colour too). */
const AXIS_RGB = "136, 153, 170";
const AXIS_ALPHA = 0.7;
const POSTER_BORDER = "2px solid #ffffff";
const POSTER_RADIUS = 8;

/** The poster of a film, or its title's first letter on a plain card when there is none (or it would not load). */
function treatedPoster(poster: OgPoster, src: string | null, left: number, top: number) {
  const { width, height } = TREATED_POSTER;
  const frame = {
    display: "flex",
    position: "absolute",
    left,
    top,
    width,
    height,
    borderRadius: POSTER_RADIUS,
    border: POSTER_BORDER,
    overflow: "hidden",
    backgroundColor: OG.surface,
  } as const;
  if (src) {
    return (
      <div key={poster.id} data-part="poster" style={frame}>
        <img src={src} alt="" width={width - 4} height={height - 4} style={{ objectFit: "cover" }} />
      </div>
    );
  }
  return (
    <div key={poster.id} data-part="poster" style={{ ...frame, alignItems: "flex-start", justifyContent: "flex-start", padding: "14px 0 0 18px", color: OG.muted, fontSize: 56, lineHeight: 1 }}>
      {Array.from(poster.title.trim())[0]?.toUpperCase() ?? "?"}
    </div>
  );
}

export interface TreatedPairCardProps {
  pair: TreatedPair;
  /** The two portraits (the first on top): SVG data URIs, or null for a person with no photo, whose initials are drawn instead. */
  tiles: (string | null)[];
  people: { name: string; initials: string }[];
  /** The posters' images, by `pair.posters`; null where there is none. */
  posterImages: (string | null)[];
  /** The two people's colours by slot (the URL order), for their solo films on the axis. */
  hexes: readonly [string, string];
}

export function TreatedPairCardView({ pair, tiles, people, posterImages, hexes }: TreatedPairCardProps) {
  const place = treatedPairLayout();
  const lefts = treatedPosterLefts(pair.posters.length);
  const tile = treatedTile(people.length);
  const tops = treatedTileTops(people.length);
  const caption = pair.caption;

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", backgroundColor: OG.bg, fontFamily: "Inter", color: OG.strong }}>
      {people.map((person, i) => (
        <div
          key={person.name}
          data-part="person"
          style={{
            display: "flex",
            position: "absolute",
            left: 0,
            top: tops[i],
            width: TREATED_COLUMN,
            height: tile.height,
            overflow: "hidden",
            backgroundColor: OG.border,
            ...(tiles[i] ? {} : { alignItems: "center", justifyContent: "center", color: OG.body, fontSize: 72, fontWeight: 600 }),
          }}
        >
          {tiles[i] ? <img src={tiles[i]} alt="" width={TREATED_COLUMN} height={tile.height} /> : person.initials}
        </div>
      ))}

      {pair.posters.map((poster, i) => treatedPoster(poster, posterImages[i] ?? null, lefts[i], place.postersTop))}

      {/* The axis: one line the width of the column, fading out at both ends, and a dot for every film. */}
      <div
        data-part="axis"
        style={{ display: "flex", position: "absolute", left: TREATED_LEFT, top: place.axisY - TREATED_AXIS_WIDTH / 2, width: TREATED_WIDTH, height: TREATED_AXIS_WIDTH, backgroundImage: treatedAxisGradient(AXIS_RGB, AXIS_ALPHA) }}
      />
      {pair.dots.map((dot) => {
        const shared = dot.kind === "shared";
        const size = shared ? TREATED_NODE.size : TREATED_SOLO_DOT;
        return (
          <div
            key={`${dot.kind}-${dot.id}`}
            data-part={shared ? "node" : "dot"}
            style={{
              display: "flex",
              position: "absolute",
              left: dot.x - size / 2,
              top: place.axisY - size / 2,
              width: size,
              height: size,
              borderRadius: size,
              backgroundColor: shared ? "#ffffff" : hexes[dot.kind as number],
              opacity: dot.opacity,
              ...(shared ? { border: `${TREATED_NODE.ring}px solid ${OG.bg}` } : {}),
            }}
          />
        );
      })}

      <div data-part="names" style={{ display: "flex", position: "absolute", left: TREATED_LEFT, top: place.namesTop, width: TREATED_WIDTH, fontSize: TREATED_NAMES_SIZE, lineHeight: 1, color: OG.body, whiteSpace: "pre" }}>
        {pair.names}
      </div>
      {caption && (
        <div
          data-part="caption"
          style={{ display: "flex", alignItems: "baseline", position: "absolute", left: TREATED_LEFT, top: place.captionTop, fontSize: TREATED_CAPTION_SIZE, lineHeight: 1, letterSpacing: -1.5, whiteSpace: "pre" }}
        >
          {caption.segments.map((segment, i) => (
            <span key={i} style={{ display: "flex", whiteSpace: "pre", color: segment.accent ? OG.strong : OG.muted }}>
              {segment.text}
            </span>
          ))}
        </div>
      )}

      <div data-part="wordmark" style={{ display: "flex", position: "absolute", right: TREATED_MARGIN, top: place.wordmarkTop, lineHeight: 1 }}>
        {ogWordmark(TREATED_WORDMARK)}
      </div>
    </div>
  );
}
