import { ImageResponse } from "next/og";
import type { Clipping, PairClippings } from "@/lib/clippings";
import { clippingVoices, clippingYear, speakerIndex, translatedFrom, truncateQuote } from "@/lib/clippings-view";
import type { Critic, PairCritics } from "@/lib/critics";
import { criticAbout, criticName, criticYear } from "@/lib/critics-view";
import { loadOgTreatment, ogPersonHexes, ogPortraitTreatment, treatedHeadshotSvg, type OgTreatmentMode } from "@/lib/og-portrait";
import { OG_CACHE_CONTROL, loadImage } from "@/lib/og-render";
import {
  ATTRIBUTION_WIDTH,
  QUOTE_CARD_MAX_CHARS,
  QUOTE_TEXT_HEIGHT,
  attributionFontSize,
  quoteCardType,
  splitQuoteTail,
} from "@/lib/og-quote";
import { OG, OG_SIZE, ogQuoteFonts, ogWordmark } from "@/lib/og-theme";
import {
  INTER_BASELINE_DROP,
  TREATED_COLUMN,
  TREATED_LEFT,
  TREATED_MARGIN,
  TREATED_WIDTH,
  TREATED_WORDMARK,
  treatedTile,
  treatedTileTops,
} from "@/lib/og-treated";
import { hexChannels, personHex } from "@/lib/person-colors";
import { initials } from "@/lib/person-labels";
import { headCrop } from "@/lib/portrait-treatment";
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
 * Spike (zherring/spike-portraits): with the treatment on, the card is on the grid of `og-treated.ts`: the portraits stacked down the left edge, the
 * quote in the column to their right at the largest of `TREATED_FONT_SIZES` that fits it, its attribution as plain text under it, at the column's left edge,
 * and the wordmark at its bottom right (`drawTreatedQuoteCard`).
 */
const TREATED_TEXT_HEIGHT = 386;
const TREATED_FONT_SIZES = [56, 50, 45, 41, 37, 34, 31, 28] as const;
/** What the attribution leaves of the column for the wordmark beside it. */
const TREATED_WORDMARK_ROOM = 160;
/** The gap between the quote and its attribution, and the source line's size and line height (its baseline is put on the bottom margin, as the wordmark's is). */
const TREATED_ATTRIBUTION_GAP = 28;
const TREATED_SOURCE_SIZE = 22;
const TREATED_SOURCE_LINE = 1.2;

export interface QuoteOgImageInput {
  /** The two people of the page, in the order of its URL: for their headshots, and for the colour each has on the page. */
  timelines: PersonTimeline[];
  /** The pair's clippings, which say which of the two is the speaker. */
  set: PairClippings;
  clipping: Clipping;
}

export interface CriticOgImageInput {
  /** The two people of the page: for their headshots. */
  timelines: PersonTimeline[];
  /** The pair's critics, which name the two people (and the order they are written in). */
  set: PairCritics;
  critic: Critic;
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
 * Spike: the words of a treated card's quote, the marks inline in `accent`, at the size of the words: the opening one set with the first word, the
 * closing one with the tail (`splitQuoteTail`), so neither starts or ends a line alone.
 */
function inlineQuoteWords(quote: string, accent: string) {
  const { words, tail } = splitQuoteTail(quote);
  const open = <span style={{ color: accent }}>{"“"}</span>;
  // An array, not a fragment: the renderer lays out only the wrapping box's own children as its items.
  return [
    ...words.map((word, i) => (
      <div key={i} style={{ display: "flex", whiteSpace: "pre" }}>
        {i === 0 && open}
        {`${word} `}
      </div>
    )),
    <div key="tail" style={{ display: "flex" }}>
      {words.length === 0 && open}
      <div style={{ display: "flex", whiteSpace: "pre" }}>{tail}</div>
      <div style={{ display: "flex", color: accent }}>{"”"}</div>
    </div>,
  ];
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
  /** Spike: whether the portraits after the first are greyed when the treatment is on (an artist's quote: all but the speaker are; a critic's, with no speaker, none is). */
  dimSecond?: boolean;
}

async function drawQuoteCard({ accent, glow, quote: fullQuote, people, speaker, about, source, mode, hexes, dimSecond = false }: QuoteCard): Promise<ImageResponse> {
  const [images, fonts, treatments] = await Promise.all([
    Promise.all(people.map((p) => loadImage(p.profilePath))),
    ogQuoteFonts(),
    mode ? Promise.all(people.map((p) => loadOgTreatment(p.id, p.profilePath, p.slot, mode, hexes))) : null,
  ]);
  if (treatments) {
    const tile = treatedTile(people.length);
    const tiles = treatments.map((t, i) => {
      const photo = images[i];
      return t && photo
        ? treatedHeadshotSvg(t, photo, tile.width, tile.height, { crop: headCrop(t.shape, tile.width / tile.height), grey: dimSecond && i >= 1 })
        : null;
    });
    return drawTreatedQuoteCard({ accent, quote: fullQuote, people, speaker, about, source }, tiles, fonts);
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
 * Spike: the card with the treatment on, on the grid of `og-treated.ts`. The people's portraits (`tiles`, SVG data URIs of the head crops, the speaker's first
 * and in colour, the others greyed; null for one with no photo, initials) stacked down the left edge; in the column to their right the quote, at the largest
 * of `TREATED_FONT_SIZES` that fits it, its marks inline in `accent` (`inlineQuoteWords`), centred in what the attribution leaves; under it, at the column's
 * left, the attribution and the source as plain text (no box: the quote's own words, smaller), and, at its right, the wordmark on the source line's baseline,
 * which is the bottom margin. No glow: the canvas is plain.
 */
function drawTreatedQuoteCard(
  { accent, quote: fullQuote, people, speaker, about, source }: Pick<QuoteCard, "accent" | "quote" | "people" | "speaker" | "about" | "source">,
  tiles: (string | null)[],
  fonts: Awaited<ReturnType<typeof ogQuoteFonts>>,
): ImageResponse {
  const tile = treatedTile(people.length);
  const tops = treatedTileTops(people.length);
  const quote = truncateQuote(fullQuote, QUOTE_CARD_MAX_CHARS);
  const { fontSize, lineHeight } = quoteCardType(`“${quote}”`, { width: TREATED_WIDTH, height: TREATED_TEXT_HEIGHT, sizes: TREATED_FONT_SIZES });
  const attributionWidth = TREATED_WIDTH - TREATED_WORDMARK_ROOM;
  const attributionSize = attributionFontSize(`\u2014 ${speaker}${about}`, attributionWidth);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", backgroundColor: OG.bg, fontFamily: "Inter", color: OG.strong }}>
        {people.map((p, i) => (
          <div
            key={p.name}
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
            {tiles[i] ? <img src={tiles[i]} alt="" width={TREATED_COLUMN} height={tile.height} /> : initials(p.name)}
          </div>
        ))}

        <div style={{ display: "flex", flexDirection: "column", position: "absolute", left: TREATED_LEFT, top: TREATED_MARGIN, width: TREATED_WIDTH, height: OG_SIZE.height - 2 * TREATED_MARGIN }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
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
              {inlineQuoteWords(quote, accent)}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: TREATED_ATTRIBUTION_GAP }}>
            {/* Plain text on the canvas, left-aligned with the quote: no box, no border. Its last line's baseline is on the bottom margin, as the wordmark's. */}
            <div
              data-part="attribution"
              style={{ display: "flex", flexDirection: "column", maxWidth: attributionWidth, marginBottom: -Math.round(TREATED_SOURCE_SIZE * ((TREATED_SOURCE_LINE - 1) / 2 + INTER_BASELINE_DROP)) }}
            >
              <div style={{ display: "flex", flexWrap: "wrap", fontSize: attributionSize, lineHeight: 1.2, fontWeight: 600 }}>
                <span style={{ color: OG.muted, whiteSpace: "pre" }}>{"\u2014 "}</span>
                <span style={{ color: OG.strong }}>{speaker}</span>
                <span style={{ color: OG.muted, whiteSpace: "pre" }}>{about}</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", marginTop: 5, fontSize: TREATED_SOURCE_SIZE, lineHeight: TREATED_SOURCE_LINE, fontWeight: 600, color: OG.muted }}>
                {source.split(" \u00b7 ").map((part, i) => (
                  <span key={i} style={{ whiteSpace: "pre" }}>
                    {i === 0 ? part : ` \u00b7 ${part}`}
                  </span>
                ))}
              </div>
            </div>
            {/* Its baseline on the bottom margin, as the pair's card sets its wordmark. */}
            <div style={{ display: "flex", lineHeight: 1, marginBottom: -Math.round(TREATED_WORDMARK * INTER_BASELINE_DROP) }}>{ogWordmark(TREATED_WORDMARK)}</div>
          </div>
        </div>
      </div>
    ),
    // A treated card is a spike's preview: never cached, so turning the flag off shows the card as it is.
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
export async function renderQuoteOgImage({ timelines, set, clipping }: QuoteOgImageInput): Promise<ImageResponse> {
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
export async function renderCriticOgImage({ timelines, set, critic }: CriticOgImageInput): Promise<ImageResponse> {
  const accent = OG.muted;
  // Spike: off unless `PORTRAIT_TREATMENT=1` (or, outside production, the flag's cookie); null leaves the card as it was.
  const mode = await ogPortraitTreatment();
  return drawQuoteCard({
    mode,
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
