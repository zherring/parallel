/**
 * How far apart two colours look, as CIEDE2000 (Sharma, Wu and Dalal's implementation notes): 0 is the same colour, about 2 is the least a trained eye
 * can tell apart, and the palette's neighbours are 20 and more. What keeps a person's colour away from the orange of Kevin Bacon mode
 * (`clashesWithTogether`, person-colors.ts).
 */

type Lab = readonly [l: number, a: number, b: number];

const linear = (channel: number): number => {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

/** A "#rrggbb" colour in CIELAB (D65). */
export function hexToLab(hex: string): Lab {
  const [r, g, b] = [1, 3, 5].map((i) => linear(Number.parseInt(hex.slice(i, i + 2), 16)));
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

const RAD = Math.PI / 180;
const hueOf = (a: number, b: number): number => {
  const degrees = Math.atan2(b, a) / RAD;
  return degrees < 0 ? degrees + 360 : degrees;
};

/** CIEDE2000 between two CIELAB colours. */
export function deltaE2000(first: Lab, second: Lab): number {
  const [l1, a1, b1] = first;
  const [l2, a2, b2] = second;
  const meanChroma = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2;
  const g = 0.5 * (1 - Math.sqrt(meanChroma ** 7 / (meanChroma ** 7 + 25 ** 7)));
  const a1p = (1 + g) * a1;
  const a2p = (1 + g) * a2;
  const c1p = Math.hypot(a1p, b1);
  const c2p = Math.hypot(a2p, b2);
  const h1p = hueOf(a1p, b1);
  const h2p = hueOf(a2p, b2);

  const dL = l2 - l1;
  const dC = c2p - c1p;
  let dh = h2p - h1p;
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  const dH = 2 * Math.sqrt(c1p * c2p) * Math.sin((dh * RAD) / 2);

  const meanL = (l1 + l2) / 2;
  const meanC = (c1p + c2p) / 2;
  let meanH = h1p + h2p;
  if (Math.abs(h1p - h2p) > 180) meanH += meanH < 360 ? 360 : -360;
  meanH /= 2;
  const t =
    1 -
    0.17 * Math.cos((meanH - 30) * RAD) +
    0.24 * Math.cos(2 * meanH * RAD) +
    0.32 * Math.cos((3 * meanH + 6) * RAD) -
    0.2 * Math.cos((4 * meanH - 63) * RAD);
  const sl = 1 + (0.015 * (meanL - 50) ** 2) / Math.sqrt(20 + (meanL - 50) ** 2);
  const sc = 1 + 0.045 * meanC;
  const sh = 1 + 0.015 * meanC * t;
  const rc = 2 * Math.sqrt(meanC ** 7 / (meanC ** 7 + 25 ** 7));
  const rt = -Math.sin(2 * 30 * Math.exp(-(((meanH - 275) / 25) ** 2)) * RAD) * rc;
  return Math.sqrt((dL / sl) ** 2 + (dC / sc) ** 2 + (dH / sh) ** 2 + rt * (dC / sc) * (dH / sh));
}

/** The distance between two "#rrggbb" colours. */
export function colorDistance(a: string, b: string): number {
  return deltaE2000(hexToLab(a), hexToLab(b));
}
