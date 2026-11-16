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

  it("shows a wide tile (a group's) the same height of the photo as a pair's, with the head in the middle and the montage on both sides, not the head cut at the eyes", () => {
    const pair = headCrop(shape, 320 / 313);
    for (const aspect of [320 / 207, 320 / 154.5]) {
      const crop = headCrop(shape, aspect);
      expect(Math.abs(crop.h - pair.h) / pair.h).toBeLessThan(0.01);
      expect(crop.w).toBeCloseTo(crop.h * aspect, 5);
      expect(crop.w).toBeGreaterThan(342);
      // The head's middle (x = 0.4 of the photo) is the crop's middle.
      expect(crop.x + crop.w / 2).toBeCloseTo(0.4 * 342, 5);
      // All of the photo is inside the crop, across.
      expect(crop.x).toBeLessThanOrEqual(0);
      expect(crop.x + crop.w).toBeGreaterThanOrEqual(342);
      // The crown is in, a little under the crop's top.
      expect(crop.y).toBeLessThan(0.1 * 513);
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
