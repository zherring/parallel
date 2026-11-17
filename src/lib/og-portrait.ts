import { tmdbImage } from "@/lib/images";
import { fetchImageDataUri } from "@/lib/og-image";
import { personHex } from "@/lib/person-colors";
import { cutEdgePath, polygonPoints, strokeForWidth } from "@/lib/portrait-cuts";
import { duotoneMatrix, tileView, treatmentShape, type PhotoCrop, type TreatmentShape } from "@/lib/portrait-treatment";

/**
 * The cut-paper treatment on the preview cards (the PNGs of `ImageResponse`). The renderer (Satori, then Resvg) cannot clip an HTML image to a polygon, but
 * it draws an SVG image through Resvg, which does clip paths, filters and embedded images: so a treated headshot is one SVG, as a data URI, holding the
 * montage (duotoned), the photo clipped to the cut and the edge inside it, all embedded.
 *
 * The X embed pages (`/embed/p/...`, `/embed/q/...`) draw the same cards as HTML, so that their first frame is the picture the PNG showed.
 */

/** What a treated headshot needs, fetched up front as the rest of the card's images are. */
export interface OgTreatment {
  shape: TreatmentShape;
  hex: string;
  /** The montage's posters as data URIs; empty for a person with none (the flat colour). */
  posters: string[];
}

/**
 * The treatment of the person in `slot` (their colour: `hexes`'s (`portraitPersonHexes`), else the palette's), or null when they have no photo
 * (initials). `filmPosters` (`montagePosters` of their films) is the montage behind their tear, when they have no cut.
 */
export async function loadOgTreatment(
  personId: number,
  profilePath: string | null,
  slot: number,
  hexes?: readonly string[] | null,
  filmPosters: readonly string[] = [],
): Promise<OgTreatment | null> {
  if (!profilePath) return null;
  const shape = treatmentShape(personId, profilePath, filmPosters);
  const posters = (await Promise.all(shape.posters.slice(0, 9).map((path) => fetchImageDataUri(tmdbImage(path, "w154") ?? "")))).filter((uri): uri is string => uri !== null);
  return { shape, hex: personHex(slot, hexes), posters };
}

const r = (n: number) => Math.round(n * 100) / 100;

/** As the Quotes view dims the one not speaking (`grayscale(1) brightness(0.72)`): luminance, at 0.72. */
const GREY_ROW = `${0.2126 * 0.72} ${0.7152 * 0.72} ${0.0722 * 0.72} 0 0`;
const GREY_MATRIX = `${GREY_ROW} ${GREY_ROW} ${GREY_ROW} 0 0 0 1 0`;

/**
 * A share card's tile (`treatedTile`): the treated headshot as `treatedHeadshotSvg` draws it, of what the tile shows of the person (`tileView`): the head of a
 * cut, or a tear's strip across the whole tile.
 */
export function treatedTileSvg(treatment: OgTreatment, photo: string, width: number, height: number, options: { grey?: boolean } = {}): string {
  const { shape, crop } = tileView(treatment.shape, width / height);
  return treatedHeadshotSvg({ ...treatment, shape }, photo, width, height, { crop, grey: options.grey });
}

/**
 * The treated headshot as an SVG data URI of `width` x `height` px: the photo (`photo`, a data URI) covers the box as the app's `slice` does, cut
 * along the polygon, with the edge inside the cut in the person's colour at the app's width rule (`strokeForWidth`), over the 3 x 3 montage or the flat colour.
 *
 * For the tiles layout: with `crop`, that box of the photo (`headCrop`) covers the box instead, the montage as it is; with `grey`, all of it is
 * greyed and dimmed as the Quotes view does to the one not speaking.
 */
export function treatedHeadshotSvg(
  treatment: OgTreatment,
  photo: string,
  width: number,
  height: number,
  options: { crop?: PhotoCrop; grey?: boolean } = {},
): string {
  const { shape, hex, posters } = treatment;
  const [w, h] = shape.size;
  const { crop, grey = false } = options;
  const scale = crop ? width / crop.w : Math.max(width / w, height / h);
  const tx = crop ? -crop.x * scale : (width - w * scale) / 2;
  const ty = crop ? -crop.y * scale : (height - h * scale) / 2;
  // Inside: twice the visible width, clipped by the polygon, so its inner half shows. In the photo's units, which are scaled by `scale`.
  const stroke = (2 * strokeForWidth(width)) / scale;
  const cell = { w: width / 3, h: height / 3 };
  const montage = posters
    .map(
      (src, i) =>
        `<image href="${src}" x="${r((i % 3) * cell.w)}" y="${r(Math.floor(i / 3) * cell.h)}" width="${r(cell.w)}" height="${r(cell.h)}" preserveAspectRatio="xMidYMid slice"/>`,
    )
    .join("");
  const greyFilter = grey
    ? `<filter id="grey" x="0" y="0" width="${width}" height="${height}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${GREY_MATRIX}"/></filter>`
    : "";
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<defs><clipPath id="cut"><polygon points="${polygonPoints(shape.points, w, h)}"/></clipPath>` +
    `<filter id="duo" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${duotoneMatrix(hex)}"/></filter>${greyFilter}</defs>` +
    (grey ? `<g filter="url(#grey)">` : "") +
    `<rect width="${width}" height="${height}" fill="${posters.length > 0 ? "#111" : hex}"/>` +
    (montage ? `<g filter="url(#duo)">${montage}</g>` : "") +
    `<g transform="translate(${r(tx)} ${r(ty)}) scale(${scale})">` +
    `<image href="${photo}" width="${w}" height="${h}" preserveAspectRatio="none" clip-path="url(#cut)"/>` +
    `<g clip-path="url(#cut)"><path d="${cutEdgePath(shape.points, w, h)}" fill="none" stroke="${hex}" stroke-width="${r(stroke)}" stroke-linejoin="miter" stroke-linecap="square"/></g>` +
    `</g>` +
    (grey ? `</g>` : "") +
    `</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
