import { ImageResponse } from "next/og";
import { tmdbImage } from "@/lib/images";
import {
  DIM_DOT_SIZE,
  CHIP,
  NODE_SIZE,
  OG_ACTIVE_ZONE,
  OG_CENTER_X,
  OG_FAN_WIDTH,
  OG_FAN_ZONE,
  OG_POSTER,
  OVERLAY_PAD,
  YEAR_LABEL_HALF,
  buildOgCard,
  composition,
  headshotFan,
  posterRow,
  yearLabelXs,
  type HeadshotCard,
  type OgCaption,
  type OgCard,
  type OgPerson,
  type OgPoster,
} from "@/lib/og-card";
import { fetchImageDataUri } from "@/lib/og-image";
import { OG, OG_SIZE, ogFonts, ogGlow, ogWordmark } from "@/lib/og-theme";
import type { Period } from "@/lib/period";
import { todayIso } from "@/lib/released";
import type { PersonTimeline } from "@/lib/types";

/**
 * Cards are cached by whatever sits in front of the app (browsers, a CDN, the crawlers' own
 * caches): a day fresh, a week stale-while-revalidate. Next itself draws one on every request that
 * reaches it, which the proxy's per-client budget keeps affordable. (A `revalidate` export would
 * not change that in production, and in `next dev` it pins the first render of a card.)
 */
export const OG_CACHE_CONTROL = "public, s-maxage=86400, stale-while-revalidate=604800";
/** For a card drawn from a timeline whose short-film lookup was cut short (`shortsIncomplete`): its counts may be off, so it is kept for a minute only. */
export const OG_PARTIAL_CACHE_CONTROL = "public, s-maxage=60, stale-while-revalidate=60";

/** A TMDB image as a data URI; null when TMDB has none or it cannot be fetched. */
export async function loadImage(path: string | null): Promise<string | null> {
  const url = tmdbImage(path, "w342");
  return url ? fetchImageDataUri(url) : null;
}

/*
 * The look of the app's own timeline (see timeline.tsx, film-card.tsx and globals.css), drawn with inline styles
 * because the renderer cannot read Tailwind classes or CSS variables. The app draws its cards at 64px wide; here a
 * poster is 120px, so the app's 4px radius, 1px outline and 2px ring are scaled up by about the same factor.
 *   card:      rounded-[4px], border strong/20, shadow-lit (2px --lit ring, 24px --lit-glow) on a shared film
 *   lane:      stroke muted/70, 2px (here fading out toward the card's edges, see `laneFade`)
 *   dim dot:   r=3, --text-muted
 *   node:      r=6, --lit, --bg outline, drop-shadow(0 0 3px --lit-glow)
 */
const CARD_RADIUS = 8;
const CARD_BORDER = "2px solid rgba(255, 255, 255, 0.2)";
const LIT_RING = `0 0 0 3px ${OG.green}, 0 0 26px ${OG.greenGlow}`;
const LANE_RGB = "136, 153, 170";
const LANE_ALPHA = 0.7;
const LANE_WIDTH = 2;
/** The lane's line: opaque across the active zone, fading to nothing at the card's edges, as a horizontal gradient. */
const LANE_GRADIENT = `linear-gradient(to right, rgba(${LANE_RGB}, 0) 0%, rgba(${LANE_RGB}, ${LANE_ALPHA}) ${(OG_ACTIVE_ZONE.left / 1200) * 100}%, rgba(${LANE_RGB}, ${LANE_ALPHA}) ${(OG_ACTIVE_ZONE.right / 1200) * 100}%, rgba(${LANE_RGB}, 0) 100%)`;

function initialsOnCard(person: OgPerson) {
  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: OG.border,
        color: OG.body,
        fontSize: 64,
        fontWeight: 600,
      }}
    >
      {person.initials}
    </div>
  );
}

/**
 * A person's headshot card: a straight rounded card with the name small over the bottom of it, left-aligned in the part
 * of the card that shows (the first card is on top and shows all of it; the others start where the card before them ends).
 */
function headshotCard(person: OgPerson, src: string | null, fan: { width: number; height: number }, placed: HeadshotCard, left: number, top: number, fontSize: number) {
  const { width, height } = fan;
  return (
    <div
      key={person.name}
      style={{
        display: "flex",
        position: "absolute",
        left,
        top,
        width,
        height,
        borderRadius: CARD_RADIUS,
        border: CARD_BORDER,
        overflow: "hidden",
        backgroundColor: OG.surface,
        boxShadow: "0 14px 30px rgba(0, 0, 0, 0.6)",
      }}
    >
      {src ? (
        <img src={src} alt="" width={width - 4} height={height - 4} style={{ objectFit: "cover", objectPosition: "50% 18%" }} />
      ) : (
        initialsOnCard(person)
      )}
      {/* One layer over the whole card, so the shade has no edge of its own to show; the name stands on its bottom. */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          position: "absolute",
          left: 0,
          top: 0,
          right: 0,
          bottom: 0,
          paddingBottom: 12,
          paddingLeft: placed.covered + OVERLAY_PAD.left,
          paddingRight: OVERLAY_PAD.right,
          backgroundImage: "linear-gradient(to bottom, rgba(0, 0, 0, 0) 52%, rgba(0, 0, 0, 0.84) 100%)",
          fontSize,
          lineHeight: 1.16,
          color: OG.strong,
        }}
      >
        {person.overlay.map((line, i) => (
          <div key={i} style={{ display: "flex", whiteSpace: "nowrap" }}>
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}

/** The poster of a film, or its title's first letter on a plain card when there is none (or it would not load). */
function posterCard(poster: OgPoster, src: string | null, left: number, top: number) {
  const { width, height } = OG_POSTER;
  const frame = {
    display: "flex",
    position: "absolute",
    left,
    top,
    width,
    height,
    borderRadius: CARD_RADIUS,
    border: CARD_BORDER,
    overflow: "hidden",
    backgroundColor: OG.surface,
    // The app's shadow-lit, and a shadow cast to the left, onto the poster this one partly covers.
    boxShadow: `${LIT_RING}, -9px 6px 18px rgba(0, 0, 0, 0.6)`,
  } as const;
  if (src) {
    return (
      <div key={poster.id} style={frame}>
        <img src={src} alt="" width={width - 4} height={height - 4} style={{ objectFit: "cover" }} />
      </div>
    );
  }
  return (
    // The letter sits at the top left: the part of the poster the next one leaves showing.
    <div key={poster.id} style={{ ...frame, alignItems: "flex-start", justifyContent: "flex-start", padding: "12px 0 0 16px", color: OG.muted, fontSize: 52, lineHeight: 1 }}>
      {Array.from(poster.title.trim())[0]?.toUpperCase() ?? "?"}
    </div>
  );
}

/** The caption in the muted color, its numbers in the accent color. The spaces between the words are kept by `whiteSpace: pre`. */
function caption(value: OgCaption, fontSize: number) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", fontSize, lineHeight: 1, letterSpacing: -0.5, color: OG.muted, whiteSpace: "pre" }}>
      {value.segments.map((segment, i) => (
        <span key={i} style={{ display: "flex", whiteSpace: "pre", color: segment.accent ? OG.green : OG.muted }}>
          {segment.text}
        </span>
      ))}
    </div>
  );
}

/** A row as wide as the card, centred on its middle: what the chip and the caption sit in, so they share one centre. */
const centredRow = (top: number) =>
  ({
    display: "flex",
    justifyContent: "center",
    position: "absolute",
    left: OG_CENTER_X - OG_SIZE.width / 2,
    top,
    width: OG_SIZE.width,
  }) as const;

/** The years-active chip: the pill that used to sit beside the wordmark on period cards, now under the lane on every card. */
function yearsChip(label: string) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        height: CHIP.height,
        padding: "0 20px",
        border: `2px solid ${OG.border}`,
        borderRadius: 999,
        fontSize: 26,
        lineHeight: 1,
        color: OG.body,
      }}
    >
      {label}
    </div>
  );
}

export interface PairOgImageInput {
  timelines: PersonTimeline[];
  /** Only the films of these years (already resolved against the page's films, see `resolvePeriod`); the whole career without. */
  period?: Period | null;
}

/**
 * Draws the 1200x630 preview card of a /p/ page, in the look of the app's own timeline. Top to bottom, centred
 * on the card: a row of cards, the headshots of the people (straight, rounded, overlapping, each with its name
 * small over the part of it that shows) on the left and the posters (overlapping, each a shared film's green ring
 * and glow) on the right; the lane, a line across the whole card with a small grey dot for every film and a green
 * node for each poster's film, placed by release date (see `OG_LANE_SCOPE` for which films); the years of the first
 * and last film under their green nodes; and the caption ("11 films over 20 years", its numbers in green). Shared
 * by the page's `opengraph-image` and the `/og` route that draws a card for a shared period. Every image is fetched up
 * front: the renderer throws on one it cannot load, and a missing headshot only means initials, a missing poster a
 * plain card with the title's first letter.
 */
export async function renderPairOgImage({ timelines, period = null }: PairOgImageInput): Promise<ImageResponse> {
  const card = buildOgCard(timelines, todayIso(), period);
  const [avatars, posterImages, fonts] = await Promise.all([
    Promise.all(card.people.map((person) => loadImage(person.profilePath))),
    Promise.all(card.posters.map((poster) => loadImage(poster.posterPath))),
    ogFonts(),
  ]);
  const hasLane = card.posters.length > 0;
  const fan = headshotFan(card.people.length);
  const place = composition(fan.height, hasLane, card.chip !== null);
  const fanLeft = hasLane
    ? Math.round(OG_FAN_ZONE.left + (OG_FAN_WIDTH - fan.totalWidth) / 2)
    : Math.round((OG_SIZE.width - fan.totalWidth) / 2);

  return new ImageResponse(
    <OgCardView card={card} avatars={avatars} posterImages={posterImages} hasLane={hasLane} place={place} fan={fan} fanLeft={fanLeft} />,
    {
      ...OG_SIZE,
      fonts,
      headers: {
        "Cache-Control": timelines.some((t) => t.shortsIncomplete) ? OG_PARTIAL_CACHE_CONTROL : OG_CACHE_CONTROL,
      },
    },
  );
}

interface CardProps {
  card: OgCard;
  avatars: (string | null)[];
  posterImages: (string | null)[];
  hasLane: boolean;
  place: ReturnType<typeof composition>;
  fan: ReturnType<typeof headshotFan>;
  fanLeft: number;
}

export function OgCardView({ card, avatars, posterImages, hasLane, place, fan, fanLeft }: CardProps) {
  const lefts = posterRow(card.posters.length);
  const laneY = place.laneY ?? 0;
  // The year labels go under the first and the last green node.
  const greens = card.dots.filter((dot) => dot.featured);
  const labelXs = card.years && greens.length > 0 ? yearLabelXs(greens[0].x, greens[greens.length - 1].x, card.years) : [];

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        backgroundColor: OG.bg,
        // Without a lane the people sit in the middle, and so does the glow; with one it is over the active years.
        backgroundImage: hasLane ? ogGlow(Math.round(((OG_ACTIVE_ZONE.left + OG_ACTIVE_ZONE.right) / 2 / OG_SIZE.width) * 100), Math.round((laneY / OG_SIZE.height) * 100)) : ogGlow(50, 50),
        fontFamily: "Inter",
        color: OG.strong,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", position: "absolute", left: 60, top: 44 }}>{ogWordmark(44)}</div>

      {hasLane && (
        <>
          {/* The lane: one line from edge to edge, as the app draws a lane's line, fading out toward both edges. */}
          <div style={{ display: "flex", position: "absolute", left: 0, top: laneY - LANE_WIDTH / 2, width: OG_SIZE.width, height: LANE_WIDTH, backgroundImage: LANE_GRADIENT }} />

          {card.dots.map((dot) =>
            dot.featured ? null : (
              <div
                key={dot.id}
                style={{
                  display: "flex",
                  position: "absolute",
                  left: dot.x - DIM_DOT_SIZE / 2,
                  top: laneY - DIM_DOT_SIZE / 2,
                  width: DIM_DOT_SIZE,
                  height: DIM_DOT_SIZE,
                  borderRadius: DIM_DOT_SIZE,
                  backgroundColor: OG.muted,
                  opacity: dot.opacity,
                }}
              />
            ),
          )}
          {greens.map((dot) => (
            <div
              key={dot.id}
              style={{
                display: "flex",
                position: "absolute",
                left: dot.x - NODE_SIZE / 2,
                top: laneY - NODE_SIZE / 2,
                width: NODE_SIZE,
                height: NODE_SIZE,
                borderRadius: NODE_SIZE,
                backgroundColor: OG.green,
                border: `3px solid ${OG.bg}`,
                boxShadow: `0 0 10px ${OG.greenGlow}`,
              }}
            />
          ))}

          {card.posters.map((poster, i) => posterCard(poster, posterImages[i], lefts[i], place.postersTop))}

          {/* The years of the first and last film, small under their green nodes like the app's year ticks. */}
          {card.years && place.yearsTop !== null &&
            labelXs.map((x, i) => (
              <div
                key={i}
                style={{ display: "flex", justifyContent: "center", position: "absolute", left: x - YEAR_LABEL_HALF, top: place.yearsTop ?? 0, width: 2 * YEAR_LABEL_HALF, fontSize: 22, lineHeight: 1, color: OG.muted }}
              >
                {labelXs.length === 1 || i === 1 ? card.years?.last : card.years?.first}
              </div>
            ))}
        </>
      )}

      {/* The headshots rest on the lane: the first person on top, and each card's bottom hangs below the lane's line. */}
      {[...card.people.keys()].reverse().map((i) =>
        headshotCard(card.people[i], avatars[i], fan, fan.cards[i], fanLeft + fan.cards[i].left, place.headshotTop, card.overlayFontSize),
      )}

      {card.chip && place.chipTop !== null && (
        <div data-part="chip" style={centredRow(place.chipTop)}>
          {yearsChip(card.chip)}
        </div>
      )}
      {card.caption && (
        <div data-part="caption" style={centredRow(place.captionTop)}>
          {caption(card.caption, hasLane ? 34 : 44)}
        </div>
      )}
    </div>
  );
}
