"use client";

import { useSearchParams } from "next/navigation";
import { useId } from "react";
import { PersonPortrait } from "@/components/person-portrait";
import { cn } from "@/components/timeline/cn";
import type { PortraitMode } from "@/components/use-portrait-mode";
import { tmdbImage, type ImageSize } from "@/lib/images";
import { PERSON_COLORS } from "@/lib/person-colors";
import cuts from "@/lib/portrait-cuts.json";
import { CARD_RADIUS_RATIO, CUT_STROKE_RATIO, cutEdgePath, cutEdgeStroke, polygonPoints, type PortraitCuts } from "@/lib/portrait-cuts";

const CUTS = cuts as unknown as PortraitCuts;

interface Props {
  /** TMDB person id, the key of `portrait-cuts.json`. */
  personId: number;
  name: string;
  profilePath: string | null;
  imageSize?: ImageSize;
  /** The box's size, as `PersonPortrait`'s. */
  className?: string;
  /** The person's slot on the page: their colour, for the ring, the flat background and the montage's tint. */
  slot: number;
  /** A CSS colour for the ring, as `PersonPortrait`'s. */
  ringColor?: string;
  /** The treatment; null renders `PersonPortrait` exactly as the app does today. */
  mode: PortraitMode | null;
  /** The montage's poster size: w92 for the small hero card, larger where the portrait is large (the Quotes). */
  posterSize?: ImageSize;
  /** Round the corners (`CARD_RADIUS_RATIO`); false for a portrait that fills a square-cornered panel. */
  rounded?: boolean;
  /** Tuning override (/dev/portraits/stroke): the cut edge's width in screen px, instead of `CUT_STROKE_RATIO` of the card's width. */
  strokePx?: number;
  /** Tuning override: the ring's band (and the gap inside it) in screen px, instead of `CUT_STROKE_RATIO` of the card's width each. */
  ringPx?: number;
  /** Tuning override: the edge's colour, instead of the `?outline=color` flag. */
  outline?: "white" | "color";
}

/** Whether `TreatedPortrait` would cut this person out (a cut exists, made from this very photo), so a caller can keep its own fallback. */
export function hasPortraitCut(personId: number, profilePath: string | null): boolean {
  const cut = CUTS[String(personId)];
  return Boolean(cut && profilePath && cut.profilePath === profilePath);
}

/**
 * Spike (zherring/spike-portraits): a portrait cut out along the 20-vertex polygon of `portrait-cuts.json` with a white edge (the frame's edges
 * left open), over a flat colour or a montage of the artist's posters, duotoned dark so the face reads. A person with no cut, or whose TMDB photo
 * has changed since it was cut, gets the plain `PersonPortrait`. The edge, the ring and the corners scale with the card's width (`CUT_STROKE_RATIO`,
 * `CARD_RADIUS_RATIO`), through container units, so a small card gets a thin line. `?outline=color` draws the edge in the person's colour.
 */
export function TreatedPortrait({ personId, name, profilePath, imageSize = "w185", className, slot, ringColor, mode, posterSize = "w92", rounded = true, strokePx, ringPx, outline }: Props) {
  const rawId = useId();
  const outlineFlag = useSearchParams()?.get("outline") === "color";
  const outlineColor = outline ? outline === "color" : outlineFlag;
  const cut = CUTS[String(personId)];
  const src = tmdbImage(profilePath, imageSize);
  if (!mode || !cut || !src || cut.profilePath !== profilePath) {
    return <PersonPortrait name={name} profilePath={profilePath} imageSize={imageSize} className={className} ringColor={ringColor} />;
  }

  const id = `portrait-${personId}-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const hex = PERSON_COLORS[((Math.trunc(slot) % PERSON_COLORS.length) + PERSON_COLORS.length) % PERSON_COLORS.length].hex;
  const [w, h] = cut.size;
  const points = cut.variants["20"];
  const montage = mode === "montage";

  // Shares of the card's width, as container units: the outer span is the container, the inner one draws the ring and clips the picture.
  const unit = (ratio: number) => `calc(100cqw * ${ratio})`;
  const radius = rounded ? unit(CARD_RADIUS_RATIO) : undefined;
  const ringGap = ringPx === undefined ? unit(CUT_STROKE_RATIO) : `${ringPx}px`;
  const ringOuter = ringPx === undefined ? unit(2 * CUT_STROKE_RATIO) : `${2 * ringPx}px`;
  const edge = cutEdgeStroke(w, outlineColor ? hex : undefined);

  return (
    <span aria-hidden="true" data-treated-portrait className={cn("relative inline-flex shrink-0 select-none", className)} style={{ containerType: "inline-size", borderRadius: radius }}>
      <span
        className="absolute inset-0 overflow-hidden"
        style={{
          borderRadius: radius,
          background: montage ? "#111" : hex,
          boxShadow: ringColor ? `0 0 0 ${ringGap} var(--bg), 0 0 0 ${ringOuter} ${ringColor}` : undefined,
        }}
      >
        {montage && (
          <span className="absolute inset-0 grid grid-cols-3 grid-rows-3" style={{ filter: `url(#duo-${id})` }}>
            {cut.posters.slice(0, 9).map((path) => (
              <img key={path} src={tmdbImage(path, posterSize)!} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
            ))}
          </span>
        )}
        <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
          <defs>
            <clipPath id={`clip-${id}`}>
              <polygon points={polygonPoints(points, w, h)} />
            </clipPath>
            {montage && <Duotone id={`duo-${id}`} tint={hex} />}
          </defs>
          <image href={src} width={w} height={h} preserveAspectRatio="none" clipPath={`url(#clip-${id})`} />
          <path
            d={cutEdgePath(points, w, h)}
            {...edge}
            {...(strokePx === undefined ? {} : { strokeWidth: strokePx, vectorEffect: "non-scaling-stroke" as const })}
          />
        </svg>
      </span>
    </span>
  );
}

/** Near-black to a dark version of the person's colour, by luminance (as the dev grid's montage). */
function Duotone({ id, tint }: { id: string; tint: string }) {
  const dark = [0.05, 0.05, 0.06];
  const light = [1, 3, 5].map((at) => (parseInt(tint.slice(at, at + 2), 16) / 255) * 0.7);
  const row = (c: number) => {
    const span = light[c] - dark[c];
    return `${0.2126 * span} ${0.7152 * span} ${0.0722 * span} 0 ${dark[c]}`;
  };
  return (
    <filter id={id} colorInterpolationFilters="sRGB">
      <feColorMatrix type="matrix" values={`${row(0)} ${row(1)} ${row(2)} 0 0 0 1 0`} />
    </filter>
  );
}
