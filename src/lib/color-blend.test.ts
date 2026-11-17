import { describe, expect, it } from "vitest";
import { blendColor, colorMix, hexToRgb, overlapColor, rgbToHex } from "./color-blend";

const blendHex = (mode: Parameters<typeof blendColor>[0], cb: string, cs: string) => rgbToHex(blendColor(mode, hexToRgb(cb), hexToRgb(cs)));

describe("blend modes (W3C formulas)", () => {
  it("multiply, screen and overlay on known hexes", () => {
    expect(blendHex("multiply", "#FF0000", "#00FF00")).toBe("#000000");
    expect(blendHex("multiply", "#808080", "#808080")).toBe("#404040");
    expect(blendHex("screen", "#FF0000", "#0000FF")).toBe("#FF00FF");
    expect(blendHex("screen", "#808080", "#808080")).toBe("#C0C0C0");
    // Overlay is hard-light with the layers swapped: a dark backdrop multiplies, a light one screens.
    expect(blendHex("overlay", "#404040", "#808080")).toBe("#404040");
    expect(blendHex("overlay", "#C0C0C0", "#808080")).toBe("#C0C0C0");
    expect(blendHex("overlay", "#E63B2E", "#2E5EAA")).toBe(rgbToHex([
      1 - 2 * (1 - 0xe6 / 255) * (1 - 0x2e / 255),
      2 * (0x3b / 255) * (0x5e / 255),
      2 * (0x2e / 255) * (0xaa / 255),
    ]));
  });

  it("difference, darken and lighten", () => {
    expect(blendHex("difference", "#E63B2E", "#E63B2E")).toBe("#000000");
    expect(blendHex("darken", "#F2C230", "#2E5EAA")).toBe("#2E5E30");
    expect(blendHex("lighten", "#F2C230", "#2E5EAA")).toBe("#F2C2AA");
  });

  it("luminosity keeps the backdrop's hue and takes the source's luminance", () => {
    expect(blendHex("luminosity", "#FF0000", "#FFFFFF")).toBe("#FFFFFF");
    expect(blendHex("color", "#808080", "#808080")).toBe("#808080");
  });
});

describe("overlapColor", () => {
  it("opaque circles show B(c1, c2), whatever the background", () => {
    expect(overlapColor("multiply", ["#808080", "#808080"], 1, "#14181C")).toBe("#404040");
    expect(overlapColor("normal", ["#E63B2E", "#2E5EAA"], 1, "#14181C")).toBe("#2E5EAA");
  });

  it("half-opaque normal circles over white", () => {
    // Group: red at .5, then blue at .5 over it → alpha .75; over white the overlap is (.25 red + .5 blue + .25 white).
    expect(overlapColor("normal", ["#FF0000", "#0000FF"], 0.5, "#FFFFFF")).toBe(rgbToHex([0.5, 0.25, 0.75]));
  });

  it("plus-lighter adds", () => {
    expect(overlapColor("plus-lighter", ["#FF0000", "#00FF00"], 1, "#000000")).toBe("#FFFF00");
  });
});

describe("colorMix", () => {
  it("srgb averages the channels", () => {
    expect(colorMix("srgb", "#FF0000", "#0000FF")).toBe("#800080");
  });

  it("perceptual spaces keep a grey a grey and the endpoints exact", () => {
    for (const space of ["oklab", "oklch", "lab"] as const) {
      expect(colorMix(space, "#000000", "#000000")).toBe("#000000");
      expect(colorMix(space, "#FFFFFF", "#FFFFFF")).toBe("#FFFFFF");
      expect(colorMix(space, "#E63B2E", "#2E5EAA", 0)).toBe("#E63B2E");
    }
    // The oklab midpoint of black and white is perceptual mid grey (L 0.5), darker in sRGB than #808080.
    expect(colorMix("oklab", "#000000", "#FFFFFF")).toBe("#636363");
  });
});
