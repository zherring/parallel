import { ImageResponse } from "next/og";
import { tmdbImage } from "@/lib/images";
import { buildOgCard, fanWidth, peopleLayout, posterSlots, type OgCard, type OgPerson } from "@/lib/og-card";
import { fetchImageDataUri } from "@/lib/og-image";
import { OG, OG_SIZE, ogFonts, ogGlow, ogWordmark } from "@/lib/og-theme";
import { loadPeople } from "@/lib/people";

export const alt = "Film collaborations on Parallel";
export const size = OG_SIZE;
export const contentType = "image/png";

/**
 * Cards are cached by whatever sits in front of the app (browsers, a CDN, the crawlers' own
 * caches): a day fresh, a week stale-while-revalidate. Next itself draws one on every request that
 * reaches it, which the proxy's per-client budget keeps affordable. (A `revalidate` export would
 * not change that in production, and in `next dev` it pins the first render of a card.)
 */
const CACHE_CONTROL = "public, s-maxage=86400, stale-while-revalidate=604800";

/** A TMDB image as a data URI; null when TMDB has none or it cannot be fetched. */
async function loadImage(path: string | null): Promise<string | null> {
  const url = tmdbImage(path, "w342");
  return url ? fetchImageDataUri(url) : null;
}

function portrait(person: OgPerson, src: string | null, diameter: number) {
  const ring = { border: `5px solid ${OG.bg}`, borderRadius: diameter } as const;
  if (src) {
    return <img src={src} alt="" width={diameter} height={diameter} style={{ ...ring, objectFit: "cover", flexShrink: 0 }} />;
  }
  return (
    <div
      style={{
        ...ring,
        width: diameter,
        height: diameter,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: OG.border,
        color: OG.body,
        fontSize: Math.round(diameter * 0.34),
        fontWeight: 600,
      }}
    >
      {person.initials}
    </div>
  );
}

function peopleBlock(card: OgCard, avatars: (string | null)[]) {
  const layout = peopleLayout(card.people.length);

  if (card.kind === "solo") {
    const person = card.people[0];
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 28, width: layout.width }}>
        {portrait(person, avatars[0], layout.diameter)}
        <div style={{ display: "flex", maxWidth: layout.labelWidth, fontSize: person.fontSize, lineHeight: 1.08, color: OG.strong }}>
          {person.label}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", width: layout.width }}>
      {card.people.map((person, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: layout.pitch }}>
          {portrait(person, avatars[i], layout.diameter)}
          <div
            style={{
              display: "flex",
              marginTop: 14,
              width: layout.pitch,
              justifyContent: "center",
              textAlign: "center",
              fontSize: person.fontSize,
              lineHeight: 1.12,
              color: OG.strong,
            }}
          >
            {person.label}
          </div>
        </div>
      ))}
    </div>
  );
}

function posterFan(srcs: string[], available: number) {
  const slots = posterSlots(available, srcs.length);
  return (
    <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", marginLeft: 36 }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        {srcs.map((src, i) => {
          const slot = slots[i];
          return (
            <div
              key={i}
              style={{
                display: "flex",
                width: slot.width,
                height: slot.height,
                marginLeft: i === 0 ? 0 : slot.pitch - slots[i - 1].width,
                marginTop: slot.dy,
                transform: `rotate(${slot.rotate}deg)`,
                border: `2px solid ${OG.green}`,
                borderRadius: 10,
                overflow: "hidden",
                backgroundColor: OG.surface,
                boxShadow: `0 0 30px ${OG.greenGlow}, 0 14px 28px rgba(0, 0, 0, 0.55)`,
              }}
            >
              <img src={src} alt="" width={slot.width - 4} height={slot.height - 4} style={{ objectFit: "cover" }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default async function Image({ params }: { params: Promise<{ people: string }> }) {
  const { people } = await params;
  // Bad slugs and unknown people end in notFound(), so they answer 404 rather than 500.
  const { timelines } = await loadPeople(people);
  const card = buildOgCard(timelines, new Date().toISOString().slice(0, 10));

  // Every image is fetched up front: the renderer throws on one it cannot load, and a missing
  // portrait or poster should only mean initials or a smaller fan.
  const [avatars, posterImages, fonts] = await Promise.all([
    Promise.all(card.people.map((person) => loadImage(person.profilePath))),
    Promise.all(card.posters.map((poster) => loadImage(poster.posterPath))),
    ogFonts(),
  ]);
  const posters = posterImages.filter((src): src is string => src !== null);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "44px 60px",
          backgroundColor: OG.bg,
          // Without posters the people sit in the middle, and so does the glow.
          backgroundImage: posters.length > 0 ? ogGlow(72, 48) : ogGlow(50, 50),
          fontFamily: "Inter",
          color: OG.strong,
        }}
      >
        {ogWordmark(44)}

        <div
          style={{
            display: "flex",
            flex: 1,
            alignItems: "center",
            justifyContent: posters.length > 0 ? "flex-start" : "center",
            paddingTop: 8,
          }}
        >
          {peopleBlock(card, avatars)}
          {posters.length > 0 && posterFan(posters, fanWidth(card.people.length))}
        </div>

        <div style={{ display: "flex", alignItems: "baseline", fontSize: 92, lineHeight: 1, letterSpacing: -2 }}>
          {card.headline.figure && <span style={{ color: OG.green, marginRight: 26 }}>{card.headline.figure}</span>}
          <span>{card.headline.text}</span>
          {card.subline && (
            <span style={{ marginLeft: 32, fontSize: 34, letterSpacing: 0, color: OG.muted }}>{card.subline}</span>
          )}
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts, headers: { "Cache-Control": CACHE_CONTROL } },
  );
}
