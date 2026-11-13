import type { CSSProperties } from "react";
import { tmdbImage } from "@/lib/images";
import {
  CHIP,
  DIM_DOT_SIZE,
  NODE_SIZE,
  OG_ACTIVE_ZONE,
  OG_CENTER_X,
  OG_FAN_WIDTH,
  OG_FAN_ZONE,
  OG_HEIGHT,
  OG_POSTER,
  OG_WIDTH,
  OVERLAY_PAD,
  YEAR_LABEL_HALF,
  composition,
  headshotFan,
  posterRow,
  yearLabelXs,
  type HeadshotCard,
  type OgCard,
  type OgPerson,
  type OgPoster,
} from "@/lib/og-card";

/**
 * The pair's preview card (the 1200 x 630 PNG of `/p/<people>/opengraph-image`, drawn by `OgCardView` in `og-render.tsx`) rebuilt as HTML and CSS,
 * so that its parts can move. It is the first frame of the pair embed: X shows the PNG as the poster until the frame loads, and the frame
 * opens on the same picture, so the hand-off is not seen. Everything is placed by the same functions that place the PNG's (`composition`,
 * `headshotFan`, `posterRow`, `yearLabelXs`, from `og-card.ts`) from the same `OgCard`, in the PNG's own pixels, which `--px` turns into the
 * frame's size: the stage is 1200 x 630 and is fitted into the frame, centred, as a picture would be.
 *
 * Keep the look of the two in step: the colours, type and shadows below are `OgCardView`'s (and `og-theme.ts`'s, which a client file cannot import:
 * it reads the fonts from disk). The parts the animation moves carry `data-part` (wordmark, lane, node, poster, years, chip, caption, accent). The headshots (`person`)
 * are not moved or drawn over at any point: they stay as the PNG draws them, and nothing sits behind them or around them but the card's own canvas.
 */

/** `og-theme.ts`'s palette, which is `globals.css`'s: the canvas, a card's surface and hairline, the text colours, the green and its glow. */
const OG = {
  bg: "#14181c",
  surface: "#202830",
  border: "#2c3440",
  strong: "#ffffff",
  body: "#99aabb",
  muted: "#8899aa",
  green: "#00e054",
  greenGlow: "rgba(0, 224, 84, 0.45)",
} as const;

/** `n` of the card's pixels, in the frame's: `--px` is set on the stage's container (see `POSTER_PX`). */
const px = (n: number) => `calc(${n} * var(--px))`;

/** The card's pixel in the frame: the largest that fits the frame's width and its height. A custom property of the frame, for the stage to use. */
export const POSTER_PX = `min(calc(100cqw / ${OG_WIDTH}), calc(100cqh / ${OG_HEIGHT}))`;

const CARD_BORDER = `${px(2)} solid rgba(255, 255, 255, 0.2)`;
const CARD_RADIUS = px(8);
const LIT_RING = `0 0 0 ${px(3)} ${OG.green}, 0 0 ${px(26)} ${OG.greenGlow}`;
const LANE_RGB = "136, 153, 170";
const LANE_ALPHA = 0.7;
const LANE_WIDTH = 2;
const LANE_GRADIENT = `linear-gradient(to right, rgba(${LANE_RGB}, 0) 0%, rgba(${LANE_RGB}, ${LANE_ALPHA}) ${(OG_ACTIVE_ZONE.left / OG_WIDTH) * 100}%, rgba(${LANE_RGB}, ${LANE_ALPHA}) ${(OG_ACTIVE_ZONE.right / OG_WIDTH) * 100}%, rgba(${LANE_RGB}, 0) 100%)`;

/** Soft green glow centred at (`x`, `y`) percent of the card (`ogGlow`). */
const glow = (x: number, y: number) =>
  `radial-gradient(circle at ${x}% ${y}%, rgba(0, 224, 84, 0.25) 0%, rgba(0, 224, 84, 0.09) 34%, rgba(20, 24, 28, 0) 66%)`;

/** A box at (`left`, `top`) of the card, as `OgCardView` places its parts. */
const at = (left: number, top: number, extra: CSSProperties = {}): CSSProperties => ({
  position: "absolute",
  left: px(left),
  top: px(top),
  display: "flex",
  ...extra,
});

/** A row as wide as the card, centred on its middle: what the chip and the caption sit in, so they share one centre. */
const centredRow = (top: number): CSSProperties =>
  at(OG_CENTER_X - OG_WIDTH / 2, top, { justifyContent: "center", width: px(OG_WIDTH) });

const cover: CSSProperties = { width: "100%", height: "100%", objectFit: "cover" };

/** A headshot card: the photo (or the initials on a plain card), the person's name small over the part of it that shows. */
function Headshot({
  person,
  index,
  fan,
  placed,
  left,
  top,
  fontSize,
}: {
  person: OgPerson;
  index: number;
  fan: { width: number; height: number };
  placed: HeadshotCard;
  left: number;
  top: number;
  fontSize: number;
}) {
  const src = tmdbImage(person.profilePath, "w342");
  return (
    <div
      data-part="person"
      data-index={index}
      style={at(left, top, {
        width: px(fan.width),
        height: px(fan.height),
        borderRadius: CARD_RADIUS,
        border: CARD_BORDER,
        overflow: "hidden",
        backgroundColor: OG.surface,
        boxShadow: `0 ${px(14)} ${px(30)} rgba(0, 0, 0, 0.6)`,
      })}
    >
      {src ? (
        <img src={src} alt="" decoding="async" draggable={false} style={{ ...cover, objectPosition: "50% 18%" }} />
      ) : (
        <div
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: OG.border,
            color: OG.body,
            fontSize: px(64),
          }}
        >
          {person.initials}
        </div>
      )}
      {/* One layer over the whole card, so the shade has no edge of its own to show; the name stands on its bottom. */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          position: "absolute",
          inset: 0,
          paddingBottom: px(12),
          paddingLeft: px(placed.covered + OVERLAY_PAD.left),
          paddingRight: px(OVERLAY_PAD.right),
          backgroundImage: "linear-gradient(to bottom, rgba(0, 0, 0, 0) 52%, rgba(0, 0, 0, 0.84) 100%)",
          fontSize: px(fontSize),
          lineHeight: 1.16,
          color: OG.strong,
        }}
      >
        {person.overlay.map((line, i) => (
          <div key={i} style={{ whiteSpace: "nowrap" }}>
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}

/** A film's poster in the row above the lane, or its title's first letter on a plain card when TMDB has none. */
function Poster({ poster, left, top }: { poster: OgPoster; left: number; top: number }) {
  const src = tmdbImage(poster.posterPath, "w342");
  return (
    <div
      data-part="poster"
      style={at(left, top, {
        width: px(OG_POSTER.width),
        height: px(OG_POSTER.height),
        borderRadius: CARD_RADIUS,
        border: CARD_BORDER,
        overflow: "hidden",
        backgroundColor: OG.surface,
        // The app's shadow-lit, and a shadow cast to the left, onto the poster this one partly covers.
        boxShadow: `${LIT_RING}, ${px(-9)} ${px(6)} ${px(18)} rgba(0, 0, 0, 0.6)`,
        ...(src ? {} : { alignItems: "flex-start", justifyContent: "flex-start", padding: `${px(12)} 0 0 ${px(16)}`, color: OG.muted, fontSize: px(52), lineHeight: 1 }),
      })}
    >
      {src ? (
        <img src={src} alt="" decoding="async" draggable={false} style={cover} />
      ) : (
        (Array.from(poster.title.trim())[0]?.toUpperCase() ?? "?")
      )}
    </div>
  );
}

/**
 * The card, in the frame's pixels: put it in an element that is a size container (`container-type: size`) and set `--px` on it to `POSTER_PX`.
 * `aria-hidden` is the caller's to set (the card is a picture of what the page below it says).
 */
export function PairPoster({ card }: { card: OgCard }) {
  const hasLane = card.posters.length > 0;
  const fan = headshotFan(card.people.length);
  const place = composition(fan.height, hasLane, card.chip !== null);
  const fanLeft = hasLane ? Math.round(OG_FAN_ZONE.left + (OG_FAN_WIDTH - fan.totalWidth) / 2) : Math.round((OG_WIDTH - fan.totalWidth) / 2);
  const lefts = posterRow(card.posters.length);
  const laneY = place.laneY ?? 0;
  // The year labels go under the first and the last green node.
  const greens = card.dots.filter((dot) => dot.featured);
  const labelXs = card.years && greens.length > 0 ? yearLabelXs(greens[0].x, greens[greens.length - 1].x, card.years) : [];
  const glowAt = hasLane ? glow(Math.round(((OG_ACTIVE_ZONE.left + OG_ACTIVE_ZONE.right) / 2 / OG_WIDTH) * 100), Math.round((laneY / OG_HEIGHT) * 100)) : glow(50, 50);

  return (
    <div
      data-part="stage"
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: px(OG_WIDTH),
        height: px(OG_HEIGHT),
        transform: "translate(-50%, -50%)",
        backgroundColor: OG.bg,
        backgroundImage: glowAt,
        color: OG.strong,
        fontWeight: 600,
        overflow: "hidden",
      }}
    >
      <div data-part="wordmark" style={at(60, 44, { alignItems: "center", fontSize: px(44), letterSpacing: px(-1), lineHeight: "normal" })}>
        Para<span style={{ color: OG.green }}>ll</span>el
      </div>

      {hasLane && (
        <>
          {/* The lane: one line from edge to edge, fading out toward both edges. */}
          <div data-part="lane" style={at(0, laneY - LANE_WIDTH / 2, { width: px(OG_WIDTH), height: px(LANE_WIDTH), backgroundImage: LANE_GRADIENT })} />

          {card.dots.map((dot) =>
            dot.featured ? null : (
              <div
                key={dot.id}
                data-part="dot"
                style={at(dot.x - DIM_DOT_SIZE / 2, laneY - DIM_DOT_SIZE / 2, {
                  width: px(DIM_DOT_SIZE),
                  height: px(DIM_DOT_SIZE),
                  borderRadius: "50%",
                  backgroundColor: OG.muted,
                  opacity: dot.opacity,
                })}
              />
            ),
          )}
          {greens.map((dot) => (
            <div
              key={dot.id}
              data-part="node"
              style={at(dot.x - NODE_SIZE / 2, laneY - NODE_SIZE / 2, {
                width: px(NODE_SIZE),
                height: px(NODE_SIZE),
                borderRadius: "50%",
                backgroundColor: OG.green,
                border: `${px(3)} solid ${OG.bg}`,
                boxShadow: `0 0 ${px(10)} ${OG.greenGlow}`,
              })}
            />
          ))}

          {card.posters.map((poster, i) => (
            <Poster key={poster.id} poster={poster} left={lefts[i]} top={place.postersTop} />
          ))}

          {/* The years of the first and last film, small under their green nodes like the app's year ticks. */}
          {card.years &&
            place.yearsTop !== null &&
            labelXs.map((x, i) => (
              <div
                key={i}
                data-part="years"
                style={at(x - YEAR_LABEL_HALF, place.yearsTop ?? 0, { justifyContent: "center", width: px(2 * YEAR_LABEL_HALF), fontSize: px(22), lineHeight: 1, color: OG.muted })}
              >
                {labelXs.length === 1 || i === 1 ? card.years?.last : card.years?.first}
              </div>
            ))}
        </>
      )}

      {/* The headshots rest on the lane: the first person on top, and each card's bottom hangs below the lane's line. */}
      {[...card.people.keys()].reverse().map((i) => (
        <Headshot
          key={card.people[i].name}
          person={card.people[i]}
          index={i}
          fan={fan}
          placed={fan.cards[i]}
          left={fanLeft + fan.cards[i].left}
          top={place.headshotTop}
          fontSize={card.overlayFontSize}
        />
      ))}

      {card.chip && place.chipTop !== null && (
        <div data-part="chip" style={centredRow(place.chipTop)}>
          <div
            style={{ display: "flex", alignItems: "center", height: px(CHIP.height), padding: `0 ${px(20)}`, border: `${px(2)} solid ${OG.border}`, borderRadius: 999, fontSize: px(26), lineHeight: 1, color: OG.body }}
          >
            {card.chip}
          </div>
        </div>
      )}
      {card.caption && (
        <div data-part="caption" style={centredRow(place.captionTop)}>
          <div style={{ display: "flex", alignItems: "baseline", fontSize: px(hasLane ? 34 : 44), lineHeight: 1, letterSpacing: px(-0.5), color: OG.muted, whiteSpace: "pre" }}>
            {card.caption.segments.map((segment, i) => (
              <span key={i} data-part={segment.accent ? "accent" : undefined} style={{ display: "flex", whiteSpace: "pre", color: segment.accent ? OG.green : OG.muted }}>
                {segment.text}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
