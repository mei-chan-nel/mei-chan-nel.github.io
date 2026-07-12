from __future__ import annotations

import json
import sys
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parents[1]
APP_ROOT = ROOT.parent / "info1-quiz-app"
REPORT_PATH = ROOT / "docs" / "portal-validation.json"
AD_MARKER = "pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"
SITE_ORIGIN = "https://mei-chan-nel.github.io/"


class PageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.in_title = False
        self.title_parts: list[str] = []
        self.description = ""
        self.canonical = ""
        self.h1_count = 0
        self.links: list[str] = []
        self.assets: list[str] = []
        self.ids: set[str] = set()

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if tag == "title":
            self.in_title = True
        if tag == "meta" and values.get("name") == "description":
            self.description = values.get("content") or ""
        if tag == "link" and values.get("rel") == "canonical":
            self.canonical = values.get("href") or ""
        if tag == "link" and values.get("href"):
            self.assets.append(values["href"])
        if tag == "script" and values.get("src"):
            self.assets.append(values["src"])
        if tag == "a" and values.get("href"):
            self.links.append(values["href"])
        if tag == "h1":
            self.h1_count += 1
        if values.get("id"):
            self.ids.add(values["id"])

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self.in_title = False

    def handle_data(self, data: str) -> None:
        if self.in_title:
            self.title_parts.append(data)

    @property
    def title(self) -> str:
        return "".join(self.title_parts).strip()


def parse_page(path: Path) -> PageParser:
    parser = PageParser()
    parser.feed(path.read_text(encoding="utf-8"))
    return parser


def local_target(source: Path, href: str) -> tuple[Path, str] | None:
    split = urlsplit(href)
    if split.scheme or split.netloc or href.startswith(("mailto:", "tel:", "javascript:")):
        return None
    raw_path = unquote(split.path)
    if raw_path.startswith("/info1-quiz-app/"):
        target = APP_ROOT / raw_path.removeprefix("/info1-quiz-app/")
    elif raw_path.startswith("/"):
        target = ROOT / raw_path.lstrip("/")
    elif raw_path.startswith("info1-quiz-app/") or raw_path.startswith("./info1-quiz-app/"):
        relative = raw_path.removeprefix("./").removeprefix("info1-quiz-app/")
        target = APP_ROOT / relative
    elif raw_path:
        target = source.parent / raw_path
    else:
        target = source
    target = target.resolve()
    if target.is_dir():
        target = target / "index.html"
    return target, unquote(split.fragment)


def sitemap_urls(path: Path) -> list[str]:
    namespace = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    tree = ET.parse(path)
    return [node.text.strip() for node in tree.findall("s:url/s:loc", namespace) if node.text]


def main() -> int:
    errors: list[str] = []
    warnings: list[str] = []
    page_paths = [ROOT / "index.html", ROOT / "about.html", ROOT / "privacy.html"]
    parsed = {path.resolve(): parse_page(path) for path in page_paths}
    expected_canonicals = {
        "index.html": SITE_ORIGIN,
        "about.html": f"{SITE_ORIGIN}about.html",
        "privacy.html": f"{SITE_ORIGIN}privacy.html",
    }

    for path in page_paths:
        parser = parsed[path.resolve()]
        if not parser.title:
            errors.append(f"{path.name}: missing title")
        if not parser.description:
            errors.append(f"{path.name}: missing meta description")
        if parser.canonical != expected_canonicals[path.name]:
            errors.append(f"{path.name}: unexpected canonical URL: {parser.canonical}")
        if parser.h1_count != 1:
            errors.append(f"{path.name}: expected one h1, found {parser.h1_count}")

    for source, parser in parsed.items():
        for href in parser.links + parser.assets:
            target_data = local_target(source, href)
            if target_data is None:
                continue
            target, fragment = target_data
            if not target.exists():
                errors.append(f"{source.name}: broken local target {href}")
                continue
            if fragment and target.suffix.lower() == ".html":
                target_parser = parsed.get(target.resolve()) or parse_page(target)
                if fragment not in target_parser.ids:
                    errors.append(f"{source.name}: missing fragment target {href}")

    if AD_MARKER not in (ROOT / "index.html").read_text(encoding="utf-8"):
        errors.append("index.html: AdSense script is missing")
    for path in (ROOT / "about.html", ROOT / "privacy.html"):
        if AD_MARKER in path.read_text(encoding="utf-8"):
            errors.append(f"{path.name}: informational page must be ad-free")

    ads_value = (ROOT / "ads.txt").read_text(encoding="utf-8").strip()
    if ads_value != "google.com, pub-6257644709224446, DIRECT, f08c47fec0942fa0":
        errors.append("ads.txt contains an unexpected publisher record")
    if f"Sitemap: {SITE_ORIGIN}sitemap.xml" not in (ROOT / "robots.txt").read_text(encoding="utf-8"):
        errors.append("robots.txt does not advertise the host-root sitemap")

    try:
        portal_urls = sitemap_urls(ROOT / "sitemap.xml")
        if len(portal_urls) != len(set(portal_urls)):
            errors.append("sitemap.xml contains duplicate URLs")
        required = {SITE_ORIGIN, f"{SITE_ORIGIN}about.html", f"{SITE_ORIGIN}privacy.html", f"{SITE_ORIGIN}info1-quiz-app/app/"}
        missing_required = sorted(required - set(portal_urls))
        if missing_required:
            errors.append(f"sitemap.xml is missing required URLs: {missing_required}")
        app_report = APP_ROOT / "docs" / "reports" / "question-library-build.json"
        if app_report.exists():
            report = json.loads(app_report.read_text(encoding="utf-8"))
            app_paths = [*report.get("learning_pages", []), report.get("related_app_page", "")]
            expected_urls = [SITE_ORIGIN, f"{SITE_ORIGIN}about.html", f"{SITE_ORIGIN}privacy.html", *(f"{SITE_ORIGIN}info1-quiz-app/{path}" for path in app_paths)]
            if portal_urls != list(dict.fromkeys(expected_urls)):
                errors.append("sitemap.xml is not synchronized with the question-library build report")
            for obsolete_app_page in (APP_ROOT / "app" / "about.html", APP_ROOT / "app" / "privacy.html"):
                if obsolete_app_page.exists():
                    errors.append(f"Obsolete app information page still exists: {obsolete_app_page.name}")
            app_index_text = (APP_ROOT / "app" / "index.html").read_text(encoding="utf-8")
            for expected_href in (SITE_ORIGIN, f"{SITE_ORIGIN}about.html", f"{SITE_ORIGIN}privacy.html"):
                if f'href="{expected_href}"' not in app_index_text:
                    errors.append(f"App footer is missing portal link: {expected_href}")
        else:
            warnings.append("App build report not found beside the portal; cross-repository sitemap comparison skipped")
    except (ET.ParseError, OSError) as exc:
        errors.append(f"Invalid sitemap.xml: {exc}")
        portal_urls = []

    report = {
        "status": "pass" if not errors else "fail",
        "html_pages_checked": len(page_paths),
        "sitemap_urls": len(portal_urls),
        "errors": errors,
        "warnings": warnings,
        "checks": [
            "titles, descriptions, canonical URLs, and one h1 per portal page",
            "portal and cross-repository links and fragments",
            "AdSense only on the content-rich portal top",
            "host-root ads.txt and robots.txt",
            "sitemap synchronization with the info1-quiz-app build report",
        ],
    }
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for warning in warnings:
        print(f"WARNING: {warning}")
    for error in errors:
        print(f"ERROR: {error}", file=sys.stderr)
    print(f"status={report['status']} pages={len(page_paths)} sitemap_urls={len(portal_urls)}")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
