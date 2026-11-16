import { ImageResponse } from "next/og";
import type { Clipping, PairClippings } from "@/lib/clippings";
import { clippingVoices, clippingYear, speakerIndex, translatedFrom, truncateQuote } from "@/lib/clippings-view";
import type { Critic, PairCritics } from "@/lib/critics";
import { criticAbout, criticName, criticYear } from "@/lib/critics-view";
import { headCrop, loadOgTreatment, ogPersonHexes, ogPortraitTreatment, treatedHeadshotSvg, type OgTreatmentMode } from "@/lib/og-portrait";
import { OG_CACHE_CONTROL, loadImage } from "@/lib/og-render";
import {
  ATTRIBUTION_WIDTH,
  QUOTE_CARD_MAX_CHARS,
  QUOTE_TEXT_HEIGHT,
  QUOTE_TEXT_WIDTH,
  attributionFontSize,
  quoteCardType,
  splitQuoteTail,
  type QuoteLayout,
} from "@/lib/og-quote";
import { OG, OG_SIZE, ogQuoteFonts, ogWordmark } from "@/lib/og-theme";
import { hexChannels, personHex } from "@/lib/person-colors";
import { initials } from "@/lib/person-labels";
import { CARD_RADIUS_RATIO } from "@/lib/portrait-cuts";
import type { PersonTimeline } from "@/lib/types";

/** "111, 155, 209" for "#6f9bd1": the channels of a palette hex, for the translucent wash behind the card. */
function rgbOf(hex: string): string {
  return hexChannels(hex).join(", ");
}

const PAD_X = 80;
const PAD_TOP = 52;
const PAD_BOTTOM = 50;
const HEADSHOT = 72;
const RING = 3;
/**
 * Spike (zherring/spike-portraits): with the treatment on, the two people are 2:3 cards side by side on the left, large, and the quote is in a column
 * to their right (`drawTreatedQuoteCard`).
 */
const TREATED_CARD = { width: 110, height: 165 } as const;
const TREATED_RING = 3;
const TREATED_CARD_GAP = 12;
/** The gap between the cards and the quote's column, and the column's room for the quote (under its mark, above the attribution). */
const TREATED_COLUMN_GAP = 56;
const TREATED_TEXT_HEIGHT = 330;
const TREATED_FONT_SIZES = [56, 50, 45, 41, 37, 34, 31, 28] as const;
/** What the attribution leaves of the column for the wordmark beside it. */
const TREATED_WORDMARK_ROOM = 160;

/**
 * Spike: the tiles layout (`qlayout=tiles`, `drawTilesQuoteCard`), a collage on navy: the two portraits as tiles stacked in a column on the left, each a
 * crop of the head, and three panels to their right, square-cornered as cut-out cards: the quote, the attribution and the wordmark. Every box is
 * placed on the 1200 x 630 card: `left`, `top`, `width`, `height`.
 */
const TILES = {
  bg: "#0f1626",
  panel: "#1c1f24",
  /** The hairline between the two tiles: the navy showing through. */
  hairline: 3,
  column: { left: 36, top: 36, width: 324, height: 558 },
  quote: { left: 384, top: 36, width: 780, height: 392 },
  attribution: { left: 400, top: 446, width: 580, height: 136 },
  wordmark: { left: 1000, top: 458, width: 164, height: 136 },
} as const;
const TILES_QUOTE_PAD = { x: 44, top: 34, bottom: 34 } as const;
const TILES_MARK_HEIGHT = 50;
const TILES_FONT_SIZES = [54, 50, 46, 42, 38, 35, 32, 29, 27] as const;
const TILES_ATTRIBUTION_PAD = 30;
const TILE = { width: TILES.column.width, height: (TILES.column.height - TILES.hairline) / 2 };

export interface QuoteOgImageInput {
  /** The two people of the page, in the order of its URL: for their headshots, and for the colour each has on the page. */
  timelines: PersonTimeline[];
  /** The pair's clippings, which say which of the two is the speaker. */
  set: PairClippings;
  clipping: Clipping;
  /** Spike: the tiles layout of the treated card (`parseQuoteLayout`, development only); null or absent for the card as it is. */
  layout?: QuoteLayout | null;
}

export interface CriticOgImageInput {
  /** The two people of the page: for their headshots. */
  timelines: PersonTimeline[];
  /** The pair's critics, which name the two people (and the order they are written in). */
  set: PairCritics;
  critic: Critic;
  /** Spike: as `QuoteOgImageInput.layout`. */
  layout?: QuoteLayout | null;
}

function headshot(name: string, src: string | null, ring: string) {
  return (
    <div
      key={name}
      style={{
        display: "flex",
        width: HEADSHOT,
        height: HEADSHOT,
        borderRadius: HEADSHOT,
        border: `${RING}px solid ${ring}`,
        overflow: "hidden",
        backgroundColor: OG.border,
        alignItems: "center",
        justifyContent: "center",
        color: OG.body,
        fontSize: 26,
        fontWeight: 600,
      }}
    >
      {src ? (
        <img src={src} alt="" width={HEADSHOT - 2 * RING} height={HEADSHOT - 2 * RING} style={{ objectFit: "cover", objectPosition: "50% 18%" }} />
      ) : (
        initials(name)
      )}
    </div>
  );
}

/**
 * Spike: the 2:3 card of a treated headshot (`treated`, an SVG data URI of the card's inside, see `og-portrait.ts`), ringed as the round one is. With no
 * `treated` (a person with no photo), their initials.
 */
function treatedHeadshot(name: string, treated: string | null, ring: string) {
  const { width, height } = TREATED_CARD;
  const ringWidth = TREATED_RING;
  return (
    <div
      key={name}
      style={{
        display: "flex",
        width,
        height,
        borderRadius: Math.round(width * CARD_RADIUS_RATIO),
        border: `${ringWidth}px solid ${ring}`,
        overflow: "hidden",
        backgroundColor: OG.border,
        ...(treated ? {} : { alignItems: "center", justifyContent: "center", color: OG.body, fontSize: Math.round(width * 0.3), fontWeight: 600 }),
      }}
    >
      {treated ? <img src={treated} alt="" width={width - 2 * ringWidth} height={height - 2 * ringWidth} /> : initials(name)}
    </div>
  );
}

/** What `drawQuoteCard` draws; the two kinds of quote (an artist's, a critic's) differ only in what they hand it. */
interface QuoteCard {
  /** The colour of the marks, and of the first headshot's ring when it is the speaker's. */
  accent: string;
  /** "r, g, b" of the faint wash behind the quote. */
  glow: string;
  quote: string;
  /** The round headshots, left to right, each with its ring; `id` and `slot` (their colour on the page) are for the spike's treatment. */
  people: { id: number; slot: number; name: string; profilePath: string | null; ring: string }[];
  speaker: string;
  /** Spike: the treatment (`ogPortraitTreatment`) and the people's colours with it (`ogPersonHexes`), by slot; null for the card as it was. */
  mode: OgTreatmentMode | null;
  hexes: readonly string[] | null;
  /** What follows the speaker, in the muted colour: " on John Williams". */
  about: string;
  /** "Variety · 2023". */
  source: string;
  /** Spike: the tiles layout (with the treatment on only), and whether its second person is greyed (an artist's quote: the one not speaking). */
  layout?: QuoteLayout | null;
  dimSecond?: boolean;
}

async function drawQuoteCard({ accent, glow, quote: fullQuote, people, speaker, about, source, mode, hexes, layout = null, dimSecond = false }: QuoteCard): Promise<ImageResponse> {
  const [images, fonts, treatments] = await Promise.all([
    Promise.all(people.map((p) => loadImage(p.profilePath))),
    ogQuoteFonts(),
    mode ? Promise.all(people.map((p) => loadOgTreatment(p.id, p.profilePath, p.slot, mode, hexes))) : null,
  ]);
  if (treatments && layout === "tiles") {
    const tiles = treatments.map((t, i) => {
      const photo = images[i];
      return t && photo
        ? treatedHeadshotSvg(t, photo, TILE.width, TILE.height, { crop: headCrop(t.shape, TILE.width / TILE.height), grey: dimSecond && i === 1 })
        : null;
    });
    return drawTilesQuoteCard({ accent, quote: fullQuote, people, speaker, about, source }, tiles, fonts);
  }
  if (treatments) {
    const treated = treatments.map((t, i) => {
      const photo = images[i];
      return t && photo ? treatedHeadshotSvg(t, photo, TREATED_CARD.width - 2 * TREATED_RING, TREATED_CARD.height - 2 * TREATED_RING) : null;
    });
    // Two washes, as the landing's hero: the first person's colour (the speaker's; a critic's card, the first named) from the top left, the other's from
    // the bottom right.
    const glows = people.map((p) => rgbOf(personHex(p.slot, hexes)));
    return drawTreatedQuoteCard({ accent, quote: fullQuote, people, speaker, about, source }, glows, treated, fonts);
  }

  const quote = truncateQuote(fullQuote, QUOTE_CARD_MAX_CHARS);
  const { fontSize, lineHeight } = quoteCardType(`${quote}”`);
  // The renderer cannot colour one character of a wrapping line, so the quote is set a word at a time and its last
  // words are one box with the closing mark in the speaker's colour.
  const { words, tail } = splitQuoteTail(quote);
  // A long credit shrinks, and wraps if it must, rather than run into the wordmark.
  const attributionSize = attributionFontSize(`\u2014 ${speaker}${about}`);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: OG.bg,
          // A faint wash of the speaker's colour from the corner the quote mark sits in.
          backgroundImage: `radial-gradient(circle at 10% 14%, rgba(${glow}, 0.13) 0%, rgba(${glow}, 0.04) 36%, rgba(20, 24, 28, 0) 66%)`,
          padding: `${PAD_TOP}px ${PAD_X}px ${PAD_BOTTOM}px`,
          fontFamily: "Inter",
          color: OG.strong,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
          <div style={{ display: "flex", height: 70, marginLeft: -6, fontFamily: "Newsreader", fontSize: 150, lineHeight: 1, color: accent }}>
            {"“"}
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignContent: "flex-start",
              maxHeight: QUOTE_TEXT_HEIGHT + 40,
              fontFamily: "Newsreader",
              fontSize,
              lineHeight,
              letterSpacing: -0.4,
              color: OG.strong,
            }}
          >
            {words.map((word, i) => (
              <div key={i} style={{ display: "flex", whiteSpace: "pre" }}>
                {`${word} `}
              </div>
            ))}
            <div style={{ display: "flex" }}>
              <div style={{ display: "flex", whiteSpace: "pre" }}>{tail}</div>
              <div style={{ display: "flex", color: accent }}>{"”"}</div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 22 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 10 }}>{people.map((p, i) => headshot(p.name, images[i], p.ring))}</div>
            <div style={{ display: "flex", flexDirection: "column", marginLeft: 24, maxWidth: ATTRIBUTION_WIDTH }}>
              <div style={{ display: "flex", flexWrap: "wrap", fontSize: attributionSize, lineHeight: 1.2, fontWeight: 600 }}>
                <span style={{ color: OG.muted, whiteSpace: "pre" }}>{"\u2014 "}</span>
                <span style={{ color: OG.strong }}>{speaker}</span>
                <span style={{ color: OG.muted, whiteSpace: "pre" }}>{about}</span>
              </div>
              {/* Wraps like the attribution, so "Publication · Year · Translated from Italian" stays inside the column. */}
              <div style={{ display: "flex", flexWrap: "wrap", marginTop: 5, fontSize: 22, lineHeight: 1.2, fontWeight: 600, color: OG.muted }}>
                {source.split(" · ").map((part, i) => (
                  <span key={i}>{i === 0 ? part : ` · ${part}`}</span>
                ))}
              </div>
            </div>
          </div>
          {ogWordmark(30)}
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts, headers: { "Cache-Control": OG_CACHE_CONTROL } },
  );
}

/**
 * Spike: the card with the treatment on. The two treated portraits (`treated`, by person; null for one with no photo) side by side on the left, the
 * speaker's first, and the quote, its attribution and the wordmark in a column to their right, the quote set at the largest of `TREATED_FONT_SIZES`
 * that fits the narrower column. Marks and rings as the card's; the wash is two (`glows`, "r, g, b" by person): the first's from the top left, the
 * second's from the bottom right, each as faint as the card's one.
 */
function drawTreatedQuoteCard(
  { accent, quote: fullQuote, people, speaker, about, source }: Pick<QuoteCard, "accent" | "quote" | "people" | "speaker" | "about" | "source">,
  glows: string[],
  treated: (string | null)[],
  fonts: Awaited<ReturnType<typeof ogQuoteFonts>>,
): ImageResponse {
  const cardsWidth = people.length * TREATED_CARD.width + (people.length - 1) * TREATED_CARD_GAP;
  const textWidth = QUOTE_TEXT_WIDTH - cardsWidth - TREATED_COLUMN_GAP;
  const quote = truncateQuote(fullQuote, QUOTE_CARD_MAX_CHARS);
  const { fontSize, lineHeight } = quoteCardType(`${quote}”`, { width: textWidth, height: TREATED_TEXT_HEIGHT, sizes: TREATED_FONT_SIZES });
  const { words, tail } = splitQuoteTail(quote);
  const attributionSize = attributionFontSize(`\u2014 ${speaker}${about}`, textWidth - TREATED_WORDMARK_ROOM);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          backgroundColor: OG.bg,
          backgroundImage: [
            ["10% 14%", glows[0]],
            ["90% 86%", glows[1] ?? glows[0]],
          ]
            .map(([at, rgb]) => `radial-gradient(circle at ${at}, rgba(${rgb}, 0.13) 0%, rgba(${rgb}, 0.04) 36%, rgba(20, 24, 28, 0) 66%)`)
            .join(", "),
          padding: `${PAD_TOP}px ${PAD_X}px ${PAD_BOTTOM}px`,
          fontFamily: "Inter",
          color: OG.strong,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: TREATED_CARD_GAP, width: cardsWidth, marginRight: TREATED_COLUMN_GAP }}>
          {people.map((p, i) => treatedHeadshot(p.name, treated[i] ?? null, p.ring))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", width: textWidth }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
            <div style={{ display: "flex", height: 56, marginLeft: -5, fontFamily: "Newsreader", fontSize: 120, lineHeight: 1, color: accent }}>{"“"}</div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignContent: "flex-start",
                maxHeight: TREATED_TEXT_HEIGHT + 40,
                fontFamily: "Newsreader",
                fontSize,
                lineHeight,
                letterSpacing: -0.4,
                color: OG.strong,
              }}
            >
              {words.map((word, i) => (
                <div key={i} style={{ display: "flex", whiteSpace: "pre" }}>
                  {`${word} `}
                </div>
              ))}
              <div style={{ display: "flex" }}>
                <div style={{ display: "flex", whiteSpace: "pre" }}>{tail}</div>
                <div style={{ display: "flex", color: accent }}>{"”"}</div>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 22 }}>
            <div style={{ display: "flex", flexDirection: "column", maxWidth: textWidth - TREATED_WORDMARK_ROOM }}>
              <div style={{ display: "flex", flexWrap: "wrap", fontSize: attributionSize, lineHeight: 1.2, fontWeight: 600 }}>
                <span style={{ color: OG.muted, whiteSpace: "pre" }}>{"\u2014 "}</span>
                <span style={{ color: OG.strong }}>{speaker}</span>
                <span style={{ color: OG.muted, whiteSpace: "pre" }}>{about}</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", marginTop: 5, fontSize: 22, lineHeight: 1.2, fontWeight: 600, color: OG.muted }}>
                {source.split(" · ").map((part, i) => (
                  <span key={i} style={{ whiteSpace: "pre" }}>
                    {i === 0 ? part : ` · ${part}`}
                  </span>
                ))}
              </div>
            </div>
            {ogWordmark(30)}
          </div>
        </div>
      </div>
    ),
    // A treated card is a spike's preview: never cached, so turning the flag off shows the card as it is.
    { ...OG_SIZE, fonts, headers: { "Cache-Control": "no-store" } },
  );
}

/** A box placed on the card (see `TILES`). */
const placed = (box: { left: number; top: number; width: number; height: number }) => ({ position: "absolute", display: "flex", ...box }) as const;

/**
 * Spike: the tiles layout of the treated card (`TILES`). The people's tiles (`tiles`, the SVG data URIs of their head crops; null for one with no
 * photo, initials) top to bottom, the speaker's first; the quote in its panel at the largest of `TILES_FONT_SIZES` that fits, marks in `accent`; the
 * attribution and source in theirs; the wordmark in its own. No wash: the navy and the panels are the look.
 */
function drawTilesQuoteCard(
  { accent, quote: fullQuote, people, speaker, about, source }: Pick<QuoteCard, "accent" | "quote" | "people" | "speaker" | "about" | "source">,
  tiles: (string | null)[],
  fonts: Awaited<ReturnType<typeof ogQuoteFonts>>,
): ImageResponse {
  const textWidth = TILES.quote.width - 2 * TILES_QUOTE_PAD.x;
  const textHeight = TILES.quote.height - TILES_QUOTE_PAD.top - TILES_QUOTE_PAD.bottom - TILES_MARK_HEIGHT;
  const quote = truncateQuote(fullQuote, QUOTE_CARD_MAX_CHARS);
  const { fontSize, lineHeight } = quoteCardType(`${quote}”`, { width: textWidth, height: textHeight, sizes: TILES_FONT_SIZES });
  const { words, tail } = splitQuoteTail(quote);
  const attributionWidth = TILES.attribution.width - 2 * TILES_ATTRIBUTION_PAD;
  const attributionSize = attributionFontSize(`\u2014 ${speaker}${about}`, attributionWidth);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", backgroundColor: TILES.bg, fontFamily: "Inter", color: OG.strong }}>
        <div style={{ ...placed(TILES.column), flexDirection: "column", justifyContent: "space-between" }}>
          {people.map((p, i) => (
            <div
              key={p.name}
              style={{
                display: "flex",
                width: TILE.width,
                height: TILE.height,
                overflow: "hidden",
                backgroundColor: TILES.panel,
                ...(tiles[i] ? {} : { alignItems: "center", justifyContent: "center", color: OG.body, fontSize: 72, fontWeight: 600 }),
              }}
            >
              {tiles[i] ? <img src={tiles[i]} alt="" width={TILE.width} height={TILE.height} /> : initials(p.name)}
            </div>
          ))}
        </div>

        <div
          style={{
            ...placed(TILES.quote),
            flexDirection: "column",
            backgroundColor: TILES.panel,
            padding: `${TILES_QUOTE_PAD.top}px ${TILES_QUOTE_PAD.x}px ${TILES_QUOTE_PAD.bottom}px`,
          }}
        >
          <div style={{ display: "flex", height: TILES_MARK_HEIGHT, marginLeft: -5, fontFamily: "Newsreader", fontSize: 110, lineHeight: 1, color: accent }}>{"“"}</div>
          <div style={{ display: "flex", flex: 1, alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignContent: "flex-start",
                maxHeight: textHeight + 30,
                fontFamily: "Newsreader",
                fontSize,
                lineHeight,
                letterSpacing: -0.4,
                color: OG.strong,
              }}
            >
              {words.map((word, i) => (
                <div key={i} style={{ display: "flex", whiteSpace: "pre" }}>
                  {`${word} `}
                </div>
              ))}
              <div style={{ display: "flex" }}>
                <div style={{ display: "flex", whiteSpace: "pre" }}>{tail}</div>
                <div style={{ display: "flex", color: accent }}>{"”"}</div>
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            ...placed(TILES.attribution),
            flexDirection: "column",
            justifyContent: "center",
            backgroundColor: TILES.panel,
            padding: `0 ${TILES_ATTRIBUTION_PAD}px`,
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", fontSize: attributionSize, lineHeight: 1.2, fontWeight: 600 }}>
            <span style={{ color: OG.muted, whiteSpace: "pre" }}>{"\u2014 "}</span>
            <span style={{ color: OG.strong }}>{speaker}</span>
            <span style={{ color: OG.muted, whiteSpace: "pre" }}>{about}</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", marginTop: 6, fontSize: 21, lineHeight: 1.2, fontWeight: 600, color: OG.muted }}>
            {source.split(" · ").map((part, i) => (
              <span key={i} style={{ whiteSpace: "pre" }}>
                {i === 0 ? part : ` · ${part}`}
              </span>
            ))}
          </div>
        </div>

        <div style={{ ...placed(TILES.wordmark), alignItems: "center", justifyContent: "center", backgroundColor: TILES.panel }}>{ogWordmark(30)}</div>
      </div>
    ),
    // A spike's preview, as the treated card: never cached.
    { ...OG_SIZE, fonts, headers: { "Cache-Control": "no-store" } },
  );
}

/** "Publication · 2023", or the publication alone when the year is not known. */
const sourceLine = (publication: string, year: number | null) => (year === null ? publication : `${publication} · ${year}`);

/**
 * Draws the 1200x630 card of one quote, in the manner of a quote restacked on Substack and quietly typographic: the
 * site's dark canvas, a large opening mark in the speaker's colour, the quote set large in Newsreader at the biggest
 * size that fits (see `quoteCardType`; a quote past `QUOTE_CARD_MAX_CHARS` is cut with an ellipsis) and closed by a
 * mark in the same colour, then, small, "Speaker on About", the source and year, the two people's round headshots
 * (the speaker first, ringed in their colour) and the Parallel wordmark in the corner. The headshots are fetched up
 * front, since the renderer throws on an image it cannot load; a missing one is initials.
 *
 * The speaker's colour is the one they have on the page's Timeline (`person-colors.ts`), which depends on their
 * position in the page's URL. `timelines` is in the order of the address the card was asked for (`loadPeople`, and the
 * route redirects any other spelling of it to the canonical one, which keeps the order), so a card shared from
 * `/p/491-john-williams+488-steven-spielberg` colours the two the other way round from one shared from the reverse.
 */
export async function renderQuoteOgImage({ timelines, set, clipping, layout = null }: QuoteOgImageInput): Promise<ImageResponse> {
  // Spike: off unless `PORTRAIT_TREATMENT=1` (or, outside production, the flag's cookie); null leaves the card as it was.
  const mode = await ogPortraitTreatment();
  const hexes = ogPersonHexes(timelines.map((t) => t.person.id), mode);
  const voices = clippingVoices(set.people, timelines.map((t) => t.person));
  const side = speakerIndex(clipping, voices);
  const accent = side === null ? OG.muted : personHex(voices[side].slot, hexes);
  const glow = side === null ? "0, 0, 0" : rgbOf(accent);

  // The speaker first, then the one they are talking about.
  const speakerId = side === null ? null : set.people[side].id;
  const ordered = [...timelines].sort((a, b) => Number(b.person.id === speakerId) - Number(a.person.id === speakerId));

  return drawQuoteCard({
    accent,
    glow,
    quote: clipping.quote,
    people: ordered.map((p, i) => ({
      id: p.person.id,
      // The colour each has on the page: their position in the URL (as the pair's card).
      slot: timelines.indexOf(p),
      name: p.person.name,
      profilePath: p.person.profilePath,
      ring: i === 0 ? accent : OG.border,
    })),
    speaker: clipping.speaker,
    mode,
    hexes,
    layout,
    // The one spoken about is greyed, as in the Quotes view; with no known speaker, neither.
    dimSecond: side !== null,
    about: ` on ${clipping.about}`,
    source: [sourceLine(clipping.publication, clippingYear(clipping)), translatedFrom(clipping)].filter(Boolean).join(" · "),
  });
}

/**
 * The card of one critic's quote: the artist's card (`renderQuoteOgImage`) made quiet. The marks and the wash are the
 * neutral grey, not a person's colour; both artists' headshots are there, in the order the attribution names them, in
 * neutral rings; the attribution is "— {critic} on {A} & {B}" (the publication when the piece is unsigned), the source
 * the publication and the year.
 */
export async function renderCriticOgImage({ timelines, set, critic, layout = null }: CriticOgImageInput): Promise<ImageResponse> {
  const accent = OG.muted;
  // Spike: off unless `PORTRAIT_TREATMENT=1` (or, outside production, the flag's cookie); null leaves the card as it was.
  const mode = await ogPortraitTreatment();
  return drawQuoteCard({
    mode,
    layout,
    hexes: ogPersonHexes(timelines.map((t) => t.person.id), mode),
    accent,
    glow: rgbOf(accent),
    quote: critic.quote,
    people: set.people.map((p) => ({
      id: p.id,
      slot: Math.max(0, timelines.findIndex((t) => t.person.id === p.id)),
      name: p.name,
      profilePath: timelines.find((t) => t.person.id === p.id)?.person.profilePath ?? null,
      ring: OG.border,
    })),
    speaker: criticName(critic),
    about: ` on ${criticAbout(set.people)}`,
    source: sourceLine(critic.publication, criticYear(critic)),
  });
}
