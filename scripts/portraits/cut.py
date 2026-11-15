"""
Spike: cut a TMDB portrait into "cut-paper" polygons.

Called by scripts/portraits/cut.ts (npm run portraits:cut), with the venv in scripts/portraits/.venv:
  .venv/bin/python -I cut.py <id>=<image path> [...]
Prints one JSON object to stdout: { model, results: { id: { model, size: [w, h], coverage, variants: { "12": [[x, y], ...], ... } } } }
Points are normalized to 0-1 of the image. Points on the frame's edges are snapped to exactly 0 or 1 so the renderer can leave
the edge segments unstroked (the shape bleeds off the frame at the shoulders).
"""

import json
import sys

import cv2
import numpy as np
from PIL import Image
from rembg import new_session, remove

TARGETS = (12, 20, 32)
FALLBACK = "isnet-general-use"
MIN_COVERAGE = 0.05
_fallback = None


def fallback_session():
    global _fallback
    if _fallback is None:
        _fallback = new_session(FALLBACK)
    return _fallback


def open_session():
    try:
        return "birefnet-portrait", new_session("birefnet-portrait")
    except Exception as error:  # noqa: BLE001 - spike: any failure falls back
        print(f"birefnet-portrait failed ({error}); falling back to isnet-general-use", file=sys.stderr)
        return FALLBACK, fallback_session()


def largest_contour(mask):
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    return max(contours, key=cv2.contourArea) if contours else None


def approx_to(contour, target):
    """approxPolyDP with the epsilon binary-searched so the vertex count lands as near the target as it can."""
    lo, hi = 0.05, cv2.arcLength(contour, True) / 4
    best = None
    for _ in range(40):
        eps = (lo + hi) / 2
        poly = cv2.approxPolyDP(contour, eps, True)
        if best is None or abs(len(poly) - target) < abs(len(best) - target):
            best = poly
        if len(poly) == target:
            break
        if len(poly) > target:
            lo = eps
        else:
            hi = eps
    return best.reshape(-1, 2)


def segment(image, session):
    alpha = np.array(remove(image, session=session, only_mask=True))
    return (alpha > 127).astype(np.uint8) * 255


def cut(model, session, path):
    image = Image.open(path).convert("RGB")
    w, h = image.size
    mask = segment(image, session)
    if (mask > 0).mean() < MIN_COVERAGE and model != FALLBACK:
        # birefnet-portrait returns an empty mask on some photos (e.g. a light, low-contrast black-and-white one): retry with the general model.
        print(f"  {model} found almost nothing; retrying with {FALLBACK}", file=sys.stderr)
        model, mask = FALLBACK, segment(image, fallback_session())

    # Keep only the largest blob, then grow it so the edge sits a little outside the hair.
    contour = largest_contour(mask)
    if contour is None:
        return None
    blob = np.zeros_like(mask)
    cv2.drawContours(blob, [contour], -1, 255, thickness=cv2.FILLED)
    grow = max(3, round(w * 0.016))  # ~8px at w500
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * grow + 1, 2 * grow + 1))
    blob = cv2.dilate(blob, kernel)
    contour = largest_contour(blob)

    snap = max(2, round(w * 0.01))
    variants = {}
    for target in TARGETS:
        points = []
        for x, y in approx_to(contour, target):
            x = 0.0 if x <= snap else 1.0 if x >= w - 1 - snap else x / (w - 1)
            y = 0.0 if y <= snap else 1.0 if y >= h - 1 - snap else y / (h - 1)
            points.append([round(float(x), 4), round(float(y), 4)])
        variants[str(target)] = points
    coverage = round(float((mask > 0).mean()), 3)
    return {"model": model, "size": [w, h], "coverage": coverage, "variants": variants}


def main():
    jobs = [arg.split("=", 1) for arg in sys.argv[1:]]
    model, session = open_session()
    results = {}
    for person_id, path in jobs:
        print(f"cutting {person_id}", file=sys.stderr)
        try:
            results[person_id] = cut(model, session, path)
        except Exception as error:  # noqa: BLE001 - spike: one bad photo must not lose the batch
            print(f"  {person_id} failed: {error!r}", file=sys.stderr)
            results[person_id] = {"error": repr(error)}
    json.dump({"model": model, "results": results}, sys.stdout)


if __name__ == "__main__":
    main()
