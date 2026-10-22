#!/usr/bin/env python3
"""Find likely Wikimedia Commons images and license metadata for tourism spots."""
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

API = "https://commons.wikimedia.org/w/api.php"
USER_AGENT = "ShahrJoTourismResearch/1.0 (https://github.com/javad136999/shahrjo)"


def fetch_json(params: dict[str, str]) -> dict:
    request = Request(f"{API}?{urlencode(params)}", headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=30) as response:
        return json.load(response)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="JSON array with id, name, city, and query fields")
    parser.add_argument("output", type=Path)
    parser.add_argument("--limit", type=int, default=8)
    args = parser.parse_args()
    targets = json.loads(args.input.read_text(encoding="utf-8"))
    output = []

    for index, target in enumerate(targets):
        params = {
            "action": "query",
            "format": "json",
            "generator": "search",
            "gsrsearch": target["query"],
            "gsrnamespace": "6",
            "gsrlimit": str(args.limit),
            "prop": "imageinfo",
            "iiprop": "url|size|extmetadata",
            "iiurlwidth": "1280",
        }
        try:
            data = fetch_json(params)
            pages = data.get("query", {}).get("pages", {}).values()
            candidates = []
            for page in pages:
                info = (page.get("imageinfo") or [{}])[0]
                meta = info.get("extmetadata", {})
                def value(key: str) -> str:
                    return str(meta.get(key, {}).get("value", "")).strip()
                candidates.append({
                    "title": page.get("title", ""),
                    "descriptionUrl": info.get("descriptionurl", ""),
                    "thumbUrl": info.get("thumburl", ""),
                    "originalUrl": info.get("url", ""),
                    "width": info.get("width"),
                    "height": info.get("height"),
                    "license": value("LicenseShortName"),
                    "licenseUrl": value("LicenseUrl"),
                    "artistHtml": value("Artist"),
                    "credit": value("Credit"),
                    "imageDescriptionHtml": value("ImageDescription"),
                })
            output.append({"id": target["id"], "name": target["name"], "city": target["city"], "query": target["query"], "candidates": candidates})
        except Exception as exc:  # keep all queries' outcomes, even if one request fails
            output.append({"id": target["id"], "name": target["name"], "city": target["city"], "query": target["query"], "error": str(exc), "candidates": []})
        if index + 1 < len(targets):
            time.sleep(0.15)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(output)} target results to {args.output}")
    for item in output:
        print(f"{item['id']}: {len(item.get('candidates', []))} candidates" + (f"; ERROR {item['error']}" if item.get("error") else ""))


if __name__ == "__main__":
    main()
