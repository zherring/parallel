import { ImageResponse } from "next/og";
import type { Clipping, PairClippings } from "@/lib/clippings";
import { clippingVoices, clippingYear, speakerIndex, truncateQuote } from "@/lib/clippings-view";
import { OG_CACHE_CONTROL, loadImage } from "@/lib/og-render";
import { QUOTE_CARD_MAX_CHARS, QUOTE_TEXT_HEIGHT, quoteCardType, splitQuoteTail } from "@/lib/og-quote";
import { OG, OG_SIZE, ogQuoteFonts, ogWordmark } from "@/lib/og-theme";
import { personHex } from "@/lib/person-colors";
import { initials } from "@/lib/person-labels";
import type { PersonTimeline } from "@/lib/types";

/** "111, 155, 209" for "#6f9bd1": the channels of a palette hex, for the translucent wash behind the card. */
function rgbOf(hex: string): string {
  return [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)).join(", ");
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
  const people = [...timelines].sort((a, b) => Number(b.person.id === speakerId) - Number(a.person.id === speakerId));
  const [images, fonts] = await Promise.all([Promise.all(people.map((p) => loadImage(p.person.profilePath))), ogQuoteFonts()]);

  const quote = truncateQuote(clipping.quote, QUOTE_CARD_MAX_CHARS);
  const { fontSize, lineHeight } = quoteCardType(`${quote}”`);
  // The renderer cannot colour one character of a wrapping line, so the quote is set a word at a time and its last
  // words are one box with the closing mark in the speaker's colour.
  const { words, tail } = splitQuoteTail(quote);
  const year = clippingYear(clipping);
  const source = year === null ? clipping.publication : `${clipping.publication} · ${year}`;

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
            <div style={{ display: "flex", gap: 10 }}>
              {people.map((p, i) => headshot(p.person.name, images[i], i === 0 ? accent : OG.border))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", marginLeft: 24 }}>
              <div style={{ display: "flex", fontSize: 28, lineHeight: 1.2, fontWeight: 600 }}>
                <span style={{ color: OG.muted, whiteSpace: "pre" }}>{"\u2014 "}</span>
                <span style={{ color: OG.strong }}>{clipping.speaker}</span>
                <span style={{ color: OG.muted, whiteSpace: "pre" }}>{` on ${clipping.about}`}</span>
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
