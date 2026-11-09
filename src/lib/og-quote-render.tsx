import { ImageResponse } from "next/og";
import type { Clipping, PairClippings } from "@/lib/clippings";
import { clippingVoices, clippingYear, speakerIndex, truncateQuote } from "@/lib/clippings-view";
import type { Critic, PairCritics } from "@/lib/critics";
import { criticAbout, criticName, criticYear } from "@/lib/critics-view";
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
import { hexChannels, personHex } from "@/lib/person-colors";
import { initials } from "@/lib/person-labels";
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

/** What `drawQuoteCard` draws; the two kinds of quote (an artist's, a critic's) differ only in what they hand it. */
interface QuoteCard {
  /** The colour of the marks, and of the first headshot's ring when it is the speaker's. */
  accent: string;
  /** "r, g, b" of the faint wash behind the quote. */
  glow: string;
  quote: string;
  /** The round headshots, left to right, each with its ring. */
  people: { name: string; profilePath: string | null; ring: string }[];
  speaker: string;
  /** What follows the speaker, in the muted colour: " on John Williams". */
  about: string;
  /** "Variety · 2023". */
  source: string;
}

async function drawQuoteCard({ accent, glow, quote: fullQuote, people, speaker, about, source }: QuoteCard): Promise<ImageResponse> {
  const [images, fonts] = await Promise.all([Promise.all(people.map((p) => loadImage(p.profilePath))), ogQuoteFonts()]);

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
              <div style={{ display: "flex", marginTop: 5, fontSize: 22, lineHeight: 1.2, fontWeight: 600, color: OG.muted }}>{source}</div>
            </div>
          </div>
          {ogWordmark(30)}
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts, headers: { "Cache-Control": OG_CACHE_CONTROL } },
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
  const voices = clippingVoices(set.people, timelines.map((t) => t.person));
  const side = speakerIndex(clipping, voices);
  const accent = side === null ? OG.muted : personHex(voices[side].slot);
  const glow = side === null ? "0, 0, 0" : rgbOf(accent);

  // The speaker first, then the one they are talking about.
  const speakerId = side === null ? null : set.people[side].id;
  const ordered = [...timelines].sort((a, b) => Number(b.person.id === speakerId) - Number(a.person.id === speakerId));

  return drawQuoteCard({
    accent,
    glow,
    quote: clipping.quote,
    people: ordered.map((p, i) => ({ name: p.person.name, profilePath: p.person.profilePath, ring: i === 0 ? accent : OG.border })),
    speaker: clipping.speaker,
    about: ` on ${clipping.about}`,
    source: sourceLine(clipping.publication, clippingYear(clipping)),
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
  return drawQuoteCard({
    accent,
    glow: rgbOf(accent),
    quote: critic.quote,
    people: set.people.map((p) => ({
      name: p.name,
      profilePath: timelines.find((t) => t.person.id === p.id)?.person.profilePath ?? null,
      ring: OG.border,
    })),
    speaker: criticName(critic),
    about: ` on ${criticAbout(set.people)}`,
    source: sourceLine(critic.publication, criticYear(critic)),
  });
}
