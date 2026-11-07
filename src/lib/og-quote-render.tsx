import { ImageResponse } from "next/og";
import type { Clipping, PairClippings } from "@/lib/clippings";
import { clippingYear, speakerIndex, truncateQuote } from "@/lib/clippings-view";
import { OG_CACHE_CONTROL, loadImage } from "@/lib/og-render";
import { QUOTE_CARD_MAX_CHARS, QUOTE_TEXT_HEIGHT, quoteCardType } from "@/lib/og-quote";
import { OG, OG_SIZE, ogQuoteFonts, ogWordmark } from "@/lib/og-theme";
import { initials } from "@/lib/person-labels";
import type { PersonTimeline } from "@/lib/types";

/** The accent of each of the pair, as on the Clippings tab: the first of the pair is green, the second orange. */
const SIDE_COLORS = [OG.green, OG.orange] as const;
const SIDE_RGB = ["0, 224, 84", "255, 128, 0"] as const;

const PAD_X = 80;
const PAD_TOP = 52;
const PAD_BOTTOM = 50;
const HEADSHOT = 72;
const RING = 3;

export interface QuoteOgImageInput {
  /** The two people of the page, for their headshots. */
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
 * site's dark canvas, a large opening mark in the speaker's colour (green for the first of the pair, orange for the
 * second, as on the tab), the quote set large in Newsreader at the biggest size that fits (see `quoteCardType`; a quote
 * past `QUOTE_CARD_MAX_CHARS` is cut with an ellipsis), then, small, "Speaker on About", the source and year, the
 * two people's round headshots (the speaker first) and the Parallel wordmark in the corner. The headshots are fetched
 * up front, since the renderer throws on an image it cannot load; a missing one is initials.
 */
export async function renderQuoteOgImage({ timelines, set, clipping }: QuoteOgImageInput): Promise<ImageResponse> {
  const side = speakerIndex(clipping, set.people);
  const accent = side === null ? OG.muted : SIDE_COLORS[side];
  const glow = side === null ? "0, 0, 0" : SIDE_RGB[side];

  // The speaker first, then the one they are talking about.
  const speakerId = side === null ? null : set.people[side].id;
  const people = [...timelines].sort((a, b) => Number(b.person.id === speakerId) - Number(a.person.id === speakerId));
  const [images, fonts] = await Promise.all([Promise.all(people.map((p) => loadImage(p.person.profilePath))), ogQuoteFonts()]);

  const text = `${truncateQuote(clipping.quote, QUOTE_CARD_MAX_CHARS)}”`;
  const { fontSize, lineHeight } = quoteCardType(text);
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
              maxHeight: QUOTE_TEXT_HEIGHT + 40,
              fontFamily: "Newsreader",
              fontSize,
              lineHeight,
              letterSpacing: -0.4,
              color: OG.strong,
              textWrap: "balance",
            }}
          >
            {text}
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
