import { describe, expect, it } from "vitest";
import { treatedTileSvg, type OgTreatment } from "@/lib/og-portrait";
import { treatmentShape } from "@/lib/portrait-treatment";

const svgOf = (uri: string) => Buffer.from(uri.replace("data:image/svg+xml;base64,", ""), "base64").toString("utf8");

/** A person with no cut, on a TMDB photo no cut was made from: their tear. */
const tear = (posters: string[]): OgTreatment => ({ shape: treatmentShape(819, "/no-cut.jpg", posters), hex: "#E5487D", posters: posters.map((p) => `data:image/jpeg;base64,${p}`) });

describe("treatedTileSvg of a tear", () => {
  it("draws the photo at the tile's width, so the strip spans the tile, over the montage of the person's films", () => {
    const svg = svgOf(treatedTileSvg(tear(["a", "b", "c"]), "data:image/jpeg;base64,photo", 320, 154.5));
    expect(svg).toContain('width="320" height="154.5"');
    // The photo (500 wide) is scaled to the tile's 320.
    expect(svg).toContain("scale(0.64)");
    expect(svg.match(/<image href="data:image\/jpeg;base64,[abc]"/g)).toHaveLength(3);
    expect(svg).toContain('<rect width="320" height="154.5" fill="#111"/>');
  });

  it("is the flat colour behind the strip for a person with no posters at all", () => {
    const svg = svgOf(treatedTileSvg(tear([]), "data:image/jpeg;base64,photo", 320, 313));
    expect(svg).toContain('<rect width="320" height="313" fill="#E5487D"/>');
    expect(svg).not.toContain('filter="url(#duo)"');
  });
});
