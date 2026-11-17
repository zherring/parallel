/**
 * Spike (zherring/spike-portraits): the colour maths behind /dev/portraits/blend, so the page can label each overlap with the hex the browser
 * draws. Blend modes follow the W3C Compositing and Blending Level 1 formulas (separable and non-separable B(Cb, Cs), then source-over with
 * blending); plus-lighter is the Porter-Duff "plus-lighter" operator. `colorMix` follows CSS Color 5 `color-mix()` at 50% in srgb, oklab,
 * oklch (shorter hue) and lab (CIE Lab, D50), clipped to sRGB for the hex.
 */

export type Rgb = readonly [number, number, number];

export const BLEND_MODES = [
  "normal",
  "multiply",
  "screen",
  "overlay",
  "darken",
  "lighten",
  "color-dodge",
  "color-burn",
  "hard-light",
  "soft-light",
  "difference",
  "exclusion",
  "hue",
  "saturation",
  "color",
  "luminosity",
  "plus-lighter",
] as const;
export type BlendMode = (typeof BLEND_MODES)[number];

export const MIX_SPACES = ["srgb", "oklab", "oklch", "lab"] as const;
export type MixSpace = (typeof MIX_SPACES)[number];

/** "#RRGGBB" (or "#RGB") to channels in 0..1. */
export function hexToRgb(hex: string): Rgb {
  let h = hex.replace(/^#/, "");
  if (h.length === 3) h = h.replace(/./g, (c) => c + c);
  const n = parseInt(h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Channels in 0..1 to "#RRGGBB", clipped and rounded. */
export function rgbToHex(rgb: Rgb): string {
  return "#" + rgb.map((c) => Math.round(clamp01(c) * 255).toString(16).padStart(2, "0")).join("").toUpperCase();
}

// Separable blend functions, one channel: cb is the backdrop, cs the source.
function separable(mode: BlendMode, cb: number, cs: number): number {
  switch (mode) {
    case "multiply":
      return cb * cs;
    case "screen":
      return cb + cs - cb * cs;
    case "overlay":
      return separable("hard-light", cs, cb);
    case "darken":
      return Math.min(cb, cs);
    case "lighten":
      return Math.max(cb, cs);
    case "color-dodge":
      if (cb === 0) return 0;
      if (cs === 1) return 1;
      return Math.min(1, cb / (1 - cs));
    case "color-burn":
      if (cb === 1) return 1;
      if (cs === 0) return 0;
      return 1 - Math.min(1, (1 - cb) / cs);
    case "hard-light":
      return cs <= 0.5 ? cb * 2 * cs : separable("screen", cb, 2 * cs - 1);
    case "soft-light": {
      if (cs <= 0.5) return cb - (1 - 2 * cs) * cb * (1 - cb);
      const d = cb <= 0.25 ? ((16 * cb - 12) * cb + 4) * cb : Math.sqrt(cb);
      return cb + (2 * cs - 1) * (d - cb);
    }
    case "difference":
      return Math.abs(cb - cs);
    case "exclusion":
      return cb + cs - 2 * cb * cs;
    default:
      return cs;
  }
}

// Non-separable helpers (W3C §9.3.1).
const lum = ([r, g, b]: Rgb) => 0.3 * r + 0.59 * g + 0.11 * b;

function clipColor(c: Rgb): Rgb {
  const l = lum(c);
  const n = Math.min(...c);
  const x = Math.max(...c);
  let out = [...c] as [number, number, number];
  if (n < 0) out = out.map((v) => l + ((v - l) * l) / (l - n)) as [number, number, number];
  if (x > 1) out = out.map((v) => l + ((v - l) * (1 - l)) / (x - l)) as [number, number, number];
  return out;
}

function setLum(c: Rgb, l: number): Rgb {
  const d = l - lum(c);
  return clipColor([c[0] + d, c[1] + d, c[2] + d]);
}

const sat = (c: Rgb) => Math.max(...c) - Math.min(...c);

function setSat(c: Rgb, s: number): Rgb {
  const order = [0, 1, 2].sort((a, b) => c[a] - c[b]);
  const [iMin, iMid, iMax] = order;
  const out: [number, number, number] = [0, 0, 0];
  if (c[iMax] > c[iMin]) {
    out[iMid] = ((c[iMid] - c[iMin]) * s) / (c[iMax] - c[iMin]);
    out[iMax] = s;
  }
  return out;
}

/** B(Cb, Cs): the blended colour, before compositing. */
export function blendColor(mode: BlendMode, cb: Rgb, cs: Rgb): Rgb {
  switch (mode) {
    case "hue":
      return setLum(setSat(cs, sat(cb)), lum(cb));
    case "saturation":
      return setLum(setSat(cb, sat(cs)), lum(cb));
    case "color":
      return setLum(cs, lum(cb));
    case "luminosity":
      return setLum(cb, lum(cs));
    default:
      return [separable(mode, cb[0], cs[0]), separable(mode, cb[1], cs[1]), separable(mode, cb[2], cs[2])];
  }
}

/** A colour with its alpha, straight (not premultiplied). */
export interface Layer {
  rgb: Rgb;
  alpha: number;
}

/**
 * The source drawn over the backdrop with `mode`: Cs' = (1 − αb)·Cs + αb·B(Cb, Cs), then source-over, αo = αs + αb(1 − αs),
 * co = αs·Cs' + (1 − αs)·αb·Cb. plus-lighter adds the premultiplied colours and alphas, each capped at 1.
 */
export function composite(mode: BlendMode, source: Layer, backdrop: Layer): Layer {
  const { rgb: cs, alpha: as } = source;
  const { rgb: cb, alpha: ab } = backdrop;
  if (mode === "plus-lighter") {
    const ao = Math.min(1, as + ab);
    const co = [0, 1, 2].map((i) => Math.min(1, cs[i] * as + cb[i] * ab)) as [number, number, number];
    return { rgb: ao === 0 ? [0, 0, 0] : (co.map((c) => Math.min(1, c / ao)) as unknown as Rgb), alpha: ao };
  }
  const b = blendColor(mode, cb, cs);
  const ao = as + ab * (1 - as);
  if (ao === 0) return { rgb: [0, 0, 0], alpha: 0 };
  const rgb = [0, 1, 2].map((i) => {
    const csPrime = (1 - ab) * cs[i] + ab * b[i];
    return (as * csPrime + (1 - as) * ab * cb[i]) / ao;
  }) as unknown as Rgb;
  return { rgb, alpha: ao };
}

/**
 * What the page shows where every one of `colors` overlaps: each circle (at `opacity`) blended with `mode` over the ones before it inside an
 * isolated group (so the first circle blends with nothing), then the group drawn over the opaque page background `bg`.
 */
export function overlapColor(mode: BlendMode, colors: readonly string[], opacity: number, bg: string): string {
  let acc: Layer = { rgb: [0, 0, 0], alpha: 0 };
  for (const hex of colors) acc = composite(mode, { rgb: hexToRgb(hex), alpha: opacity }, acc);
  return rgbToHex(composite("normal", acc, { rgb: hexToRgb(bg), alpha: 1 }).rgb);
}

// sRGB ⇄ linear.
const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const fromLinear = (c: number) => (Math.abs(c) <= 0.0031308 ? 12.92 * c : Math.sign(c) * (1.055 * Math.abs(c) ** (1 / 2.4) - 0.055));

type Vec3 = [number, number, number];
const mul = (m: readonly Vec3[], v: Vec3): Vec3 => m.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]) as Vec3;

function srgbToOklab(rgb: Rgb): Vec3 {
  const lin = rgb.map(toLinear) as Vec3;
  const lms = mul(
    [
      [0.4122214708, 0.5363325363, 0.0514459929],
      [0.2119034982, 0.6806995451, 0.1073969566],
      [0.0883024619, 0.2817188376, 0.6299787005],
    ],
    lin,
  ).map(Math.cbrt) as Vec3;
  return mul(
    [
      [0.2104542553, 0.793617785, -0.0040720468],
      [1.9779984951, -2.428592205, 0.4505937099],
      [0.0259040371, 0.7827717662, -0.808675766],
    ],
    lms,
  );
}

function oklabToSrgb(lab: Vec3): Rgb {
  const lms = mul(
    [
      [1, 0.3963377774, 0.2158037573],
      [1, -0.1055613458, -0.0638541728],
      [1, -0.0894841775, -1.291485548],
    ],
    lab,
  ).map((v) => v ** 3) as Vec3;
  const lin = mul(
    [
      [4.0767416621, -3.3077115913, 0.2309699292],
      [-1.2684380046, 2.6097574011, -0.3413193965],
      [-0.0041960863, -0.7034186147, 1.707614701],
    ],
    lms,
  );
  return lin.map(fromLinear) as unknown as Rgb;
}

// sRGB (D65) → XYZ D50 (Bradford), and back, as CSS Color 4 does; then CIE Lab.
const SRGB_TO_XYZ50: Vec3[] = [
  [0.436065742824811, 0.3851514688337912, 0.14307845442264197],
  [0.22249319175623702, 0.7168870538238823, 0.06061979053616537],
  [0.013923904500943465, 0.09708128566574634, 0.7140993584005155],
];
const XYZ50_TO_SRGB: Vec3[] = [
  [3.1341359569958707, -1.6173863321612538, -0.4906619460083532],
  [-0.978795502912089, 1.916254567259524, 0.03344273116131949],
  [0.07195537988411677, -0.2289768264158322, 1.405386058324125],
];
const D50: Vec3 = [0.3457 / 0.3585, 1, (1 - 0.3457 - 0.3585) / 0.3585];
const EPS = 216 / 24389;
const KAPPA = 24389 / 27;

function srgbToLab(rgb: Rgb): Vec3 {
  const xyz = mul(SRGB_TO_XYZ50, rgb.map(toLinear) as Vec3).map((v, i) => v / D50[i]);
  const f = xyz.map((v) => (v > EPS ? Math.cbrt(v) : (KAPPA * v + 16) / 116));
  return [116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])];
}

function labToSrgb([l, a, b]: Vec3): Rgb {
  const f1 = (l + 16) / 116;
  const f0 = a / 500 + f1;
  const f2 = f1 - b / 200;
  const xyz: Vec3 = [
    f0 ** 3 > EPS ? f0 ** 3 : (116 * f0 - 16) / KAPPA,
    l > KAPPA * EPS ? f1 ** 3 : l / KAPPA,
    f2 ** 3 > EPS ? f2 ** 3 : (116 * f2 - 16) / KAPPA,
  ];
  return mul(XYZ50_TO_SRGB, xyz.map((v, i) => v * D50[i]) as Vec3).map(fromLinear) as unknown as Rgb;
}

/**
 * `color-mix(in <space>, a, b <t>)` as a hex, `t` being b's share (0.5 by default): out-of-gamut results clipped to sRGB; oklch takes the
 * shorter hue arc.
 */
export function colorMix(space: MixSpace, a: string, b: string, t = 0.5): string {
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  const lerp = (x: number, y: number) => x + (y - x) * t;
  const mid = (x: Vec3, y: Vec3): Vec3 => [lerp(x[0], y[0]), lerp(x[1], y[1]), lerp(x[2], y[2])];
  switch (space) {
    case "srgb":
      return rgbToHex(mid(ra as Vec3, rb as Vec3));
    case "oklab":
      return rgbToHex(oklabToSrgb(mid(srgbToOklab(ra), srgbToOklab(rb))));
    case "lab":
      return rgbToHex(labToSrgb(mid(srgbToLab(ra), srgbToLab(rb))));
    case "oklch": {
      const polar = (lab: Vec3) => [lab[0], Math.hypot(lab[1], lab[2]), ((Math.atan2(lab[2], lab[1]) * 180) / Math.PI + 360) % 360] as const;
      const [l1, c1, h1] = polar(srgbToOklab(ra));
      const [l2, c2, h2] = polar(srgbToOklab(rb));
      let dh = h2 - h1;
      if (dh > 180) dh -= 360;
      else if (dh < -180) dh += 360;
      const h = ((h1 + dh * t) * Math.PI) / 180;
      const c = lerp(c1, c2);
      return rgbToHex(oklabToSrgb([lerp(l1, l2), c * Math.cos(h), c * Math.sin(h)]));
    }
  }
}
