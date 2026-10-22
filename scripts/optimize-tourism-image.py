#!/usr/bin/env python3
"""Convert one tourism image to optimized WebP without cropping its content."""
from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageOps


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    parser.add_argument("--max-width", type=int, default=900)
    parser.add_argument("--max-height", type=int, default=1200)
    parser.add_argument("--quality", type=int, default=74)
    args = parser.parse_args()
    if not 1 <= args.quality <= 100:
        parser.error("--quality must be between 1 and 100")

    with Image.open(args.source) as opened:
        image = ImageOps.exif_transpose(opened)
        image.thumbnail((args.max_width, args.max_height), Image.Resampling.LANCZOS)
        if image.mode not in ("RGB", "RGBA"):
            image = image.convert("RGB")
        args.destination.parent.mkdir(parents=True, exist_ok=True)
        image.save(args.destination, "WEBP", quality=args.quality, method=6)
        w, h = image.size

    source_bytes = args.source.stat().st_size
    target_bytes = args.destination.stat().st_size
    ratio = target_bytes / source_bytes if source_bytes else 0
    print(f"{args.source.name}: {source_bytes:,} -> {args.destination} ({target_bytes:,} bytes; {w}x{h}; {ratio:.1%} of source)")


if __name__ == "__main__":
    main()
