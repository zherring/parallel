import { describe, expect, it } from "vitest";
import { PORTRAIT_TEARS, TEAR_SIZE } from "@/lib/portrait-tears";
import { headCrop, montagePosters, tileView, treatmentShape, type TreatmentShape } from "@/lib/portrait-treatment";

/** A cut of a 342 x 513 photo: a head in the top third (centred at x = 0.4 of the photo's width), the shoulders below it. */
const shape: TreatmentShape = {
  size: [342, 513],
  posters: [],
  points: [
    [0.3, 0.1],
    [0.5, 0.1],
    [0.52, 0.35],
    [0.9, 0.6],
    [0.9, 1],
    [0.1, 1],
    [0.1, 0.6],
    [0.28, 0.35],
  ],
};

describe("headCrop", () => {
  it("takes the photo's whole width for a tile as wide as a pair's or narrower, as it always did", () => {
    const crop = headCrop(shape, 320 / 313);
    expect(crop.x).toBe(0);
    expect(crop.w).toBeCloseTo(342, 5);
    expect(crop.h).toBeCloseTo(342 / (320 / 313), 5);
  });

  it("takes the photo's whole height, and as much width as the tile's shape asks, for a tall tile", () => {
    const crop = headCrop(shape, 0.5);
    expect(crop.h).toBe(513);
    expect(crop.w).toBeCloseTo(256.5, 5);
    expect(crop.x).toBeGreaterThanOrEqual(0);
    expect(crop.x + crop.w).toBeLessThanOrEqual(342 + 1e-9);
  });

  it("crops a wide tile (a group's) tight: the photo's whole width, as a tear's strip has it, so the face is as large as a pair's, not scaled down to fit the head", () => {
    const pair = headCrop(shape, 320 / 315);
    for (const aspect of [320 / 207, 320 / 154.5]) {
      const crop = headCrop(shape, aspect);
      expect(crop.w).toBeCloseTo(pair.w, 5);
      expect(crop.x).toBe(0);
      expect(crop.w / crop.h).toBeCloseTo(aspect, 5);
      // Shorter than a pair's: the top of the head and the shoulders are cropped off.
      expect(crop.h).toBeLessThan(pair.h);
    }
  });

  it("centres a wide tile down on the middle of the face, which is below the crown by a share of the head's width, not on the crown", () => {
    for (const aspect of [320 / 207, 320 / 154.5]) {
      const crop = headCrop(shape, aspect);
      // The head band's points (0.3 to 0.5 across, y up to 0.1 + 0.9 * 0.3) are 0.2 of the photo's width wide; the face is a little under that below the crown.
      const crown = 0.1 * 513;
      const face = crop.y + crop.h / 2;
      expect(face).toBeGreaterThan(crown);
      expect(face).toBeLessThan(crown + 0.2 * 342 * 1.5);
      expect(crop.y).toBeGreaterThanOrEqual(0);
      expect(crop.y + crop.h).toBeLessThanOrEqual(513 + 1e-9);
    }
  });

  it("leaves a pair's tile (320 x 315 or 313) as it was, the head whole from a little above the crown", () => {
    for (const height of [315, 313]) {
      const crop = headCrop(shape, 320 / height);
      expect(crop.x).toBe(0);
      expect(crop.w).toBeCloseTo(342, 5);
      expect(crop.h).toBeCloseTo(342 / (320 / height), 5);
      expect(crop.y).toBeCloseTo(0.1 * 513 - 0.04 * crop.h, 5);
    }
  });
});

/** A person with no cut: their tear (`treatmentShape`, with a TMDB photo that no cut was made from). */
const tearOf = (personId: number, posters: string[] = []) => treatmentShape(personId, "/no-cut.jpg", posters);
const extentOf = (shape: TreatmentShape) => {
  const ys = shape.points.map(([, y]) => y);
  return { top: Math.min(...ys), bottom: Math.max(...ys) };
};

describe("montagePosters", () => {
  const film = (id: number, voteCount: number, posterPath: string | null) => ({ id, voteCount, posterPath });

  it("is the posters of the most-voted films, those with a poster, the id breaking a tie, at most nine", () => {
    const films = [film(1, 5, "/a.jpg"), film(2, 90, null), film(3, 50, "/c.jpg"), film(4, 50, "/d.jpg"), film(5, 70, "/e.jpg")];
    expect(montagePosters(films)).toEqual(["/e.jpg", "/c.jpg", "/d.jpg", "/a.jpg"]);
    expect(montagePosters(films, 2)).toEqual(["/e.jpg", "/c.jpg"]);
    expect(montagePosters(Array.from({ length: 20 }, (_, i) => film(i, i, `/p${i}.jpg`)))).toHaveLength(9);
    expect(montagePosters([film(1, 1, null)])).toEqual([]);
  });

  it("does not reorder the films it is given", () => {
    const films = [film(1, 1, "/a.jpg"), film(2, 9, "/b.jpg")];
    montagePosters(films);
    expect(films.map((f) => f.id)).toEqual([1, 2]);
  });
});

describe("treatmentShape's tear", () => {
  it("is on the montage of the person's own films, which a cut or the test set does not provide", () => {
    const shape = tearOf(819, ["/x.jpg", "/y.jpg"]);
    expect(shape.tear).toBe(true);
    expect(shape.posters).toEqual(["/x.jpg", "/y.jpg"]);
  });

  it("has no posters (the flat colour) for a person with no films with a poster and no cut", () => {
    expect(tearOf(819).posters).toEqual([]);
  });

  it("is not a tear for a person with a cut made from the same photo", () => {
    expect(treatmentShape(1, "/mDLDvsx8PaZoEThkBdyaG1JxPdf.jpg").tear).toBeUndefined();
  });
});

describe("tileView of a tear", () => {
  const tiles = [320 / 313, 320 / 207, 320 / 154.5];

  it("fills the tile's width with the photo's, whatever the tile's height, so the strip runs from edge to edge", () => {
    for (const aspect of tiles) {
      const { crop } = tileView(tearOf(819), aspect);
      expect(crop.x).toBe(0);
      expect(crop.w).toBeCloseTo(TEAR_SIZE[0], 5);
      expect(crop.w / crop.h).toBeCloseTo(aspect, 5);
    }
  });

  it("keeps the strip's two sides on the photo's frame (the edge draws the torn top and bottom only) and centres it on the tile", () => {
    for (const index of PORTRAIT_TEARS.keys()) {
      for (const aspect of tiles) {
        const { shape, crop } = tileView(tearOf(index), aspect);
        const xs = shape.points.map(([x]) => x);
        expect(Math.min(...xs)).toBe(0);
        expect(Math.max(...xs)).toBe(1);
        const { top, bottom } = extentOf(shape);
        expect(crop.y + crop.h / 2).toBeCloseTo(((top + bottom) / 2) * TEAR_SIZE[1], 1);
      }
    }
  });

  it("leaves montage above and below the strip, on a short tile as on a tall one", () => {
    for (const index of PORTRAIT_TEARS.keys()) {
      for (const aspect of tiles) {
        const { shape, crop } = tileView(tearOf(index), aspect);
        const { top, bottom } = extentOf(shape);
        const share = ((bottom - top) * TEAR_SIZE[1]) / crop.h;
        expect(share).toBeLessThan(0.85);
        expect(share).toBeGreaterThan(0.3);
      }
    }
  });

  it("keeps a pair's tile as the tear is, tilt and all, where the strip already fits", () => {
    const tear = tearOf(0);
    const { shape } = tileView(tear, 320 / 313);
    expect(shape.points).toEqual(tear.points.map(([x, y]) => [x, expect.closeTo(y, 3)]));
  });

  it("is a cut's head crop for a cut, as it was", () => {
    const cut = treatmentShape(1, "/mDLDvsx8PaZoEThkBdyaG1JxPdf.jpg");
    const view = tileView(cut, 320 / 207);
    expect(view.shape).toBe(cut);
    expect(view.crop).toEqual(headCrop(cut, 320 / 207));
  });
});
