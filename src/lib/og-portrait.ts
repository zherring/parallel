import { cookies } from "next/headers";
import { tmdbImage } from "@/lib/images";
import { fetchImageDataUri } from "@/lib/og-image";
import { personHex } from "@/lib/person-colors";
import { cutEdgePath, polygonPoints, strokeForWidth } from "@/lib/portrait-cuts";
import { PORTRAIT_COOKIE, duotoneMatrix, treatmentShape, type TreatmentShape } from "@/lib/portrait-treatment";

/**
 * Spike (zherring/spike-portraits): the cut-paper treatment on the preview cards (the PNGs of `ImageResponse`). The renderer (Satori, then Resvg)
 * cannot clip an HTML image to a polygon, but it draws an SVG image through Resvg, which does clip paths, filters and embedded images: so a
 * treated headshot is one SVG, as a data URI, holding the montage (duotoned), the photo clipped to the cut and the edge inside it, all embedded.
 *
 * Off unless asked for, so the cards are as they were: `PORTRAIT_TREATMENT=1` turns it on (any environment), and outside production the
 * `spike-portrait` cookie does too, which `usePortraitMode` sets with `?portrait=on` (so /dev/x-preview shows it after a visit with the flag).
 */
export type OgTreatmentMode = "montage" | "color";

export async function ogPortraitTreatment(): Promise<OgTreatmentMode | null> {
  if (process.env.PORTRAIT_TREATMENT === "1") return "montage";
  if (process.env.NODE_ENV === "production") return null;
  try {
    const value = (await cookies()).get(PORTRAIT_COOKIE)?.value;
    return value === "montage" || value === "color" ? value : null;
  } catch {
    // Outside a request (a unit test): no cookie, no treatment.
    return null;
  }
}

/** What a treated headshot needs, fetched up front as the rest of the card's images are. */
export interface OgTreatment {
  shape: TreatmentShape;
  hex: string;
  /** The montage's posters as data URIs; empty for the flat colour. */
  posters: string[];
}

/** The treatment of the person in `slot` (their colour), or null when they have no photo (initials, as today). */
export async function loadOgTreatment(personId: number, profilePath: string | null, slot: number, mode: OgTreatmentMode): Promise<OgTreatment | null> {
  if (!profilePath) return null;
  const shape = treatmentShape(personId, profilePath);
  const posters =
    mode === "montage"
      ? (await Promise.all(shape.posters.slice(0, 9).map((path) => fetchImageDataUri(tmdbImage(path, "w154") ?? "")))).filter((uri): uri is string => uri !== null)
      : [];
  return { shape, hex: personHex(slot), posters };
}

const r = (n: number) => Math.round(n * 100) / 100;

/**
 * The treated headshot as an SVG data URI of `width` x `height` px: the photo (`photo`, a data URI) covers the box as the app's `slice` does, cut
 * along the polygon, with the edge inside the cut in the person's colour at the app's width rule (`strokeForWidth`), over the 3 x 3 montage or the flat colour.
 */
export function treatedHeadshotSvg(treatment: OgTreatment, photo: string, width: number, height: number): string {
  const { shape, hex, posters } = treatment;
  const [w, h] = shape.size;
  const scale = Math.max(width / w, height / h);
  const tx = (width - w * scale) / 2;
  const ty = (height - h * scale) / 2;
  // Inside: twice the visible width, clipped by the polygon, so its inner half shows. In the photo's units, which are scaled by `scale`.
  const stroke = (2 * strokeForWidth(width)) / scale;
  const cell = { w: width / 3, h: height / 3 };
  const montage = posters
    .map(
      (src, i) =>
        `<image href="${src}" x="${r((i % 3) * cell.w)}" y="${r(Math.floor(i / 3) * cell.h)}" width="${r(cell.w)}" height="${r(cell.h)}" preserveAspectRatio="xMidYMid slice"/>`,
    )
    .join("");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<defs><clipPath id="cut"><polygon points="${polygonPoints(shape.points, w, h)}"/></clipPath>` +
    `<filter id="duo" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${duotoneMatrix(hex)}"/></filter></defs>` +
    `<rect width="${width}" height="${height}" fill="${posters.length > 0 ? "#111" : hex}"/>` +
    (montage ? `<g filter="url(#duo)">${montage}</g>` : "") +
    `<g transform="translate(${r(tx)} ${r(ty)}) scale(${scale})">` +
    `<image href="${photo}" width="${w}" height="${h}" preserveAspectRatio="none" clip-path="url(#cut)"/>` +
    `<g clip-path="url(#cut)"><path d="${cutEdgePath(shape.points, w, h)}" fill="none" stroke="${hex}" stroke-width="${r(stroke)}" stroke-linejoin="miter" stroke-linecap="square"/></g>` +
    `</g></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
