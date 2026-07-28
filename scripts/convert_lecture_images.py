from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageChops


ROOT = Path(__file__).resolve().parents[1]
ASSETS = (
    "assets/lecture-v2/network/digital-signature.png",
    "assets/lecture-v2/network/email-delivery.png",
    "assets/lecture-v2/network/hybrid-encryption.png",
    "assets/lecture-v2/network/network-types.png",
    "assets/lecture-v2/network/processing-models.png",
    "assets/lecture-v2/programming/basic-structures.png",
    "assets/lecture-v2/statistics/descriptive-distribution.png",
    "assets/lecture-v2/statistics/normal-distribution.png",
    "assets/lecture-v2/statistics/regression-residual.png",
    "assets/lecture-v2/statistics/scatter-correlation.png",
    "assets/lecture-v2/statistics/seasonal-adjustment-example.png",
    "assets/lecture-v2/statistics/seasonal-adjustment.png",
    "assets/lecture-v2/statistics/time-series.png",
)
REPORT_PATH = ROOT / "docs" / "lecture-image-conversion.json"


def convert_image(relative_path: str, apply: bool) -> dict[str, object]:
    png_path = ROOT / relative_path
    webp_path = png_path.with_suffix(".webp")
    if not png_path.is_file():
        raise FileNotFoundError(png_path)

    with Image.open(png_path) as source:
        source.load()
        width, height = source.size
        mode = source.mode
        if apply:
            source.save(webp_path, "WEBP", lossless=True, method=6, exact=True)

        if not webp_path.is_file():
            raise FileNotFoundError(f"Missing WebP conversion: {webp_path}")
        with Image.open(webp_path) as converted:
            converted.load()
            if converted.size != source.size:
                raise ValueError(f"Dimension mismatch: {relative_path}")
            source_rgba = source.convert("RGBA")
            converted_rgba = converted.convert("RGBA")
            if ImageChops.difference(source_rgba, converted_rgba).getbbox() is not None:
                raise ValueError(f"Pixel mismatch in lossless conversion: {relative_path}")

    png_bytes = png_path.stat().st_size
    webp_bytes = webp_path.stat().st_size
    return {
        "png": relative_path,
        "webp": webp_path.relative_to(ROOT).as_posix(),
        "width": width,
        "height": height,
        "mode": mode,
        "png_bytes": png_bytes,
        "webp_bytes": webp_bytes,
        "saved_bytes": png_bytes - webp_bytes,
        "saved_percent": round((png_bytes - webp_bytes) / png_bytes * 100, 2),
        "pixel_identical": True,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Create and verify lossless WebP lecture figures.")
    parser.add_argument("--apply", action="store_true", help="Write WebP files before verification")
    args = parser.parse_args()

    images = [convert_image(path, args.apply) for path in ASSETS]
    png_bytes = sum(int(image["png_bytes"]) for image in images)
    webp_bytes = sum(int(image["webp_bytes"]) for image in images)
    report = {
        "conversion": "lossless WebP, Pillow method=6, exact alpha",
        "image_count": len(images),
        "png_bytes": png_bytes,
        "webp_bytes": webp_bytes,
        "saved_bytes": png_bytes - webp_bytes,
        "saved_percent": round((png_bytes - webp_bytes) / png_bytes * 100, 2),
        "visual_review": "Pixel-identical decode verified automatically; final browser review remains recommended.",
        "images": images,
    }
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        f"images={len(images)} png_bytes={png_bytes} webp_bytes={webp_bytes} "
        f"saved_bytes={png_bytes - webp_bytes} saved_percent={report['saved_percent']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
