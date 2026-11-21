"use client";

import { useId, useState } from "react";
import { usePersonPalette } from "@/components/person-palette";
import { PersonPortrait } from "@/components/person-portrait";
import { cn } from "@/components/timeline/cn";
import { tmdbImage, type ImageSize } from "@/lib/images";
import { initials } from "@/lib/person-labels";
import { PERSON_COLORS } from "@/lib/person-colors";
import { CutPortraitImage } from "@/components/cut-portrait-image";
import { CARD_RADIUS_RATIO, STROKE_CSS, polygonPoints, type EdgePosition } from "@/lib/portrait-cuts";
import { duotoneMatrix, tileView, treatmentShape } from "@/lib/portrait-treatment";

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
  /** A #rrggbb colour for the edge, the flat background and the montage's tint, instead of the slot's (the landing page's `pairPortraitColors`); without it, the page's override of the slot (`PersonPaletteProvider`), if any. */
  color?: string;
  /** A CSS colour for the ring, as `PersonPortrait`'s. */
  ringColor?: string;
  /** The montage's poster size: w92 for the small hero card, larger where the portrait is large (the Quotes). */
  posterSize?: ImageSize;
  /** Round the corners (`CARD_RADIUS_RATIO`); false for a portrait that fills a square-cornered panel. */
  rounded?: boolean;
  /** Only the cut-out and its edge: no flat colour and no montage behind it, for a figure standing on a background of the caller's own (the landing hero's panels). A person with no cut is still their tear. */
  bare?: boolean;
  /** Tuning override (/dev/portraits/stroke): the cut edge's width in screen px (or a CSS length), instead of the rule (`STROKE_CSS`). */
  strokePx?: number | string;
  /** Tuning override: the ring's band (and the gap inside it) in screen px, instead of the rule (`STROKE_CSS`) each. */
  ringPx?: number;
  /** The edge's colour: the person's colour by default; "white" is a tuning override (/dev/portraits/stroke); "none" draws no edge at all (the landing hero's figures). */
  outline?: "white" | "color" | "none";
  /** Tuning override: where the edge sits against the polygon (inside by default). */
  edgePosition?: EdgePosition;
  /** Tuning override (/dev/portraits/stroke): the flat colour behind the cut, instead of the montage. */
  flat?: boolean;
  /** The share cards' portraits: the box's width / height, when it shows the head of the cut (`headCrop`, as the preview card's PNG does) or a tear's strip across the whole box (`tileView`), and not the whole photo. */
  headAspect?: number;
  /** The posters of the person's own best-known films (`montagePosters`): the montage behind their tear, when they have no cut (a cut carries its own). Without any, a tear is on the flat colour. */
  filmPosters?: readonly string[];
  /** The share cards' dimmed one (the person not speaking): greyed and darkened, as the Quotes view does. */
  grey?: boolean;
}

/**
 * A portrait cut out along the 20-vertex polygon of `portrait-cuts.json` (the frame's edges left open), over
 * a flat colour or a montage of the artist's posters, duotoned dark so the face reads. A person with no cut, or whose TMDB photo has changed
 * since it was cut, gets a tear instead (`portrait-tears.ts`), a torn strip across the face drawn the same way; a person with no photo gets the
 * plain `PersonPortrait`. The edge and the ring follow the capped rule (`STROKE_CSS`: proportional on a small card, 3.3px from about 100px up)
 * and the corners scale with the card (`CARD_RADIUS_RATIO`), all through container units, so nothing is measured. The edge sits inside the
 * cut in the person's colour (the owner's picks); `outline` and `edgePosition` override them, for the dev labs. A photo that fails to load (the cut's
 * and the tear's alike) leaves the person's colour with their initials and the plain photo over it, as `PersonPortrait` does, in the same box.
 */
export function TreatedPortrait({ personId, name, profilePath, imageSize = "w185", className, slot, color, ringColor, posterSize = "w92", rounded = true, bare = false, strokePx, ringPx, outline = "color", edgePosition = "inside", flat = false, headAspect, filmPosters, grey = false }: Props) {
  const rawId = useId();
  const palette = usePersonPalette();
  // The url that failed, not a flag, so a new photo for the same portrait gets its own chance.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const outlineColor = outline === "color";
  const src = tmdbImage(profilePath, imageSize);
  if (!src || !profilePath) {
    return <PersonPortrait name={name} profilePath={profilePath} imageSize={imageSize} className={className} ringColor={ringColor} />;
  }

  const id = `portrait-${personId}-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const hex = color ?? palette?.[slot] ?? PERSON_COLORS[((Math.trunc(slot) % PERSON_COLORS.length) + PERSON_COLORS.length) % PERSON_COLORS.length].hex;
  const whole = treatmentShape(personId, profilePath, filmPosters);
  const [w, h] = whole.size;
  // What the box shows: the whole photo, or (`headAspect`) what a share card's tile does (`tileView`): the head of a cut, a tear's strip across the tile.
  const { shape: { points, posters }, crop: view } = headAspect ? tileView(whole, headAspect) : { shape: whole, crop: { x: 0, y: 0, w, h } };
  // A photo that failed to load is the person's colour with their initials (`FailedPhoto`); a person with no posters at all (a tear, and no films with one) is on the flat colour, as the PNG draws it.
  const failed = failedSrc === src;
  const montage = !failed && !flat && !bare && posters.length > 0;

  // Container units: the outer span is the container, the inner one draws the ring and clips the picture.
  const radius = rounded ? `calc(100cqw * ${CARD_RADIUS_RATIO})` : undefined;
  const ringGap = ringPx === undefined ? STROKE_CSS : `${ringPx}px`;
  const ringOuter = ringPx === undefined ? `calc(2 * ${STROKE_CSS})` : `${2 * ringPx}px`;

  return (
    <span aria-hidden="true" data-treated-portrait data-treated-failed={failed ? "" : undefined} className={cn("relative inline-flex shrink-0 select-none", className)} style={{ containerType: "inline-size", borderRadius: radius, filter: grey ? "grayscale(1) brightness(0.72)" : undefined }}>
      <span
        data-treated-frame
        className="absolute inset-0 overflow-hidden"
        style={{
          borderRadius: radius,
          background: bare && !failed ? undefined : montage ? "#111" : hex,
          boxShadow: ringColor ? `0 0 0 ${ringGap} var(--bg), 0 0 0 ${ringOuter} ${ringColor}` : undefined,
        }}
      >
        {failed ? (
          <FailedPhoto src={src} name={name} />
        ) : (
          <>
            {montage && (
              <span className="absolute inset-0 grid grid-cols-3 grid-rows-3" style={{ filter: `url(#duo-${id})` }}>
                {posters.slice(0, 9).map((path) => (
                  <img key={path} src={tmdbImage(path, posterSize)!} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                ))}
              </span>
            )}
            <svg viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
              <defs>
                <clipPath id={`clip-${id}`}>
                  <polygon points={polygonPoints(points, w, h)} />
                </clipPath>
                {montage && <Duotone id={`duo-${id}`} tint={hex} />}
              </defs>
              <CutPortraitImage src={src} points={points} w={w} h={h} clipId={`clip-${id}`} strokeColor={outlineColor ? hex : undefined} strokePx={strokePx} edgePosition={edgePosition} edgeShape={outline === "none" ? "none" : "open"} onError={() => setFailedSrc(src)} />
            </svg>
          </>
        )}
      </span>
    </span>
  );
}

/**
 * What a portrait whose cut photo failed to load shows, on the person's colour: their initials, and over them the photo as a plain picture (a copy that loads
 * where the cut's did not), which is dropped in its turn when it fails too, as `PersonPortrait`'s. The type scales with the box (container units), as the
 * ring and the corners do, up to the 7rem the Quotes' own initials top out at.
 */
function FailedPhoto({ src, name }: { src: string; name: string }) {
  const [failedPlain, setFailedPlain] = useState<string | null>(null);
  return (
    <>
      <span data-treated-initials className="absolute inset-0 flex select-none items-center justify-center font-medium text-black/75" style={{ fontSize: "min(30cqw, 7rem)" }}>
        {initials(name)}
      </span>
      {src !== failedPlain && (
        <img
          ref={(img) => {
            if (img?.complete && img.naturalWidth === 0) setFailedPlain(src);
          }}
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailedPlain(src)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
    </>
  );
}

/** Near-black to a dark version of the person's colour, by luminance (as the dev grid's montage). */
export function Duotone({ id, tint }: { id: string; tint: string }) {
  return (
    <filter id={id} colorInterpolationFilters="sRGB">
      <feColorMatrix type="matrix" values={duotoneMatrix(tint)} />
    </filter>
  );
}
