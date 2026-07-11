from __future__ import annotations

import argparse
import xml.etree.ElementTree as ET
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_APP_SITEMAP = ROOT.parent / "info1-quiz-app" / "sitemap.xml"
OUTPUT_PATH = ROOT / "sitemap.xml"
SITE_ORIGIN = "https://mei-chan-nel.github.io/"
LASTMOD = date(2026, 7, 12).isoformat()
PORTAL_URLS = [SITE_ORIGIN, f"{SITE_ORIGIN}about.html", f"{SITE_ORIGIN}privacy.html"]


def read_urls(path: Path) -> list[str]:
    namespace = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    tree = ET.parse(path)
    urls = [node.text.strip() for node in tree.findall("s:url/s:loc", namespace) if node.text]
    if not urls:
        raise ValueError(f"No URLs found in {path}")
    for url in urls:
        if not url.startswith(f"{SITE_ORIGIN}info1-quiz-app/"):
            raise ValueError(f"App sitemap contains an out-of-scope URL: {url}")
    return urls


def main() -> int:
    parser = argparse.ArgumentParser(description="Merge the portal and app sitemaps.")
    parser.add_argument("--app-sitemap", type=Path, default=DEFAULT_APP_SITEMAP)
    args = parser.parse_args()
    app_sitemap = args.app_sitemap.resolve()
    if not app_sitemap.is_file():
        raise SystemExit(f"App sitemap not found: {app_sitemap}")

    urls = list(dict.fromkeys([*PORTAL_URLS, *read_urls(app_sitemap)]))
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        *(f"  <url><loc>{url}</loc><lastmod>{LASTMOD}</lastmod></url>" for url in urls),
        "</urlset>",
        "",
    ]
    OUTPUT_PATH.write_text("\n".join(lines), encoding="utf-8")
    print(f"portal_urls={len(PORTAL_URLS)} app_urls={len(urls) - len(PORTAL_URLS)} total={len(urls)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
