from __future__ import annotations

import argparse
import json
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_APP_ROOT = ROOT.parent / "info1-quiz-app"
OUTPUT_PATH = ROOT / "sitemap.xml"
SITE_ORIGIN = "https://mei-chan-nel.github.io/"
LASTMOD = date(2026, 7, 12).isoformat()
PORTAL_URLS = [SITE_ORIGIN, f"{SITE_ORIGIN}about.html", f"{SITE_ORIGIN}privacy.html"]


def read_app_urls(app_root: Path) -> list[str]:
    report_path = app_root / "docs" / "reports" / "question-library-build.json"
    if not report_path.is_file():
        raise ValueError(f"Question-library build report not found: {report_path}")
    report = json.loads(report_path.read_text(encoding="utf-8"))
    paths = [*report.get("learning_pages", []), report.get("related_app_page", "")]
    if not paths or any(not isinstance(path, str) or not path for path in paths):
        raise ValueError(f"Invalid public page list in {report_path}")
    for relative in paths:
        target = app_root / relative
        if target.is_dir():
            target = target / "index.html"
        if not target.is_file():
            raise ValueError(f"Public app path does not exist: {relative}")
    return [f"{SITE_ORIGIN}info1-quiz-app/{relative}" for relative in paths]


def main() -> int:
    parser = argparse.ArgumentParser(description="Merge the portal and app sitemaps.")
    parser.add_argument("--app-root", type=Path, default=DEFAULT_APP_ROOT)
    args = parser.parse_args()
    app_root = args.app_root.resolve()
    if not app_root.is_dir():
        raise SystemExit(f"App repository not found: {app_root}")

    urls = list(dict.fromkeys([*PORTAL_URLS, *read_app_urls(app_root)]))
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
