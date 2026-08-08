from __future__ import annotations

import argparse
import json
import re
import sys
import xml.etree.ElementTree as ET
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parents[1]
APP_ROOT = ROOT.parent / "info1-quiz-app"
REPORT_PATH = ROOT / "docs" / "reports" / "portal-validation.json"
SITE_ORIGIN = "https://mei-chan-nel.com/"
EXPECTED_FIELD_GENRES = {
    "information-society": ["information-society-morals", "information-society-intellectual-property"],
    "information-design": ["information-design-communication", "information-design-web", "information-design-organization"],
    "digital": ["digital-calculation", "digital-logic-circuits", "digital-data", "digital-computers"],
    "network": ["network-fundamentals", "network-protocols", "network-security", "network-information-systems", "network-databases", "network-safety"],
    "programming": ["programming-variables-arrays", "programming-branches", "programming-loops", "programming-search-sort", "programming-functions", "programming-simulation"],
}
EXPECTED_GENRE_NUMBERS = {
    "information-society-morals": list(range(1, 8)),
    "information-society-intellectual-property": list(range(8, 33)),
    "information-design-communication": list(range(33, 42)),
    "information-design-web": list(range(42, 51)),
    "information-design-organization": list(range(51, 66)),
    "digital-calculation": list(range(66, 90)) + list(range(123, 126)),
    "digital-logic-circuits": list(range(90, 96)),
    "digital-data": list(range(96, 105)),
    "digital-computers": list(range(105, 123)),
    "network-fundamentals": list(range(126, 161)),
    "network-protocols": list(range(161, 176)),
    "network-security": list(range(176, 184)),
    "network-information-systems": list(range(184, 195)),
    "network-databases": list(range(195, 209)),
    "network-safety": list(range(209, 231)),
    "programming-variables-arrays": list(range(231, 252)),
    "programming-branches": list(range(252, 270)),
    "programming-loops": list(range(270, 310)),
    "programming-search-sort": list(range(310, 318)),
    "programming-functions": list(range(318, 323)),
    "programming-simulation": list(range(323, 331)),
}


class PageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.title = ""
        self._in_title = False
        self.h1_count = 0
        self.canonical = ""
        self.og_url = ""
        self.description = ""
        self.links: list[str] = []
        self.json_ld: list[str] = []
        self._json_ld_depth = 0
        self._json_ld_parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if tag == "title":
            self._in_title = True
        elif tag == "h1":
            self.h1_count += 1
        elif tag == "meta" and values.get("name") == "description":
            self.description = values.get("content") or ""
        elif tag == "meta" and values.get("property") == "og:url":
            self.og_url = values.get("content") or ""
        elif tag == "link" and values.get("rel") == "canonical":
            self.canonical = values.get("href") or ""
        elif tag == "a" and values.get("href"):
            self.links.append(values["href"] or "")
        elif tag == "script" and (values.get("type") or "").lower() == "application/ld+json":
            self._json_ld_depth = 1
            self._json_ld_parts = []
        elif self._json_ld_depth:
            self._json_ld_depth += 1

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self._in_title = False
        if self._json_ld_depth:
            self._json_ld_depth -= 1
            if self._json_ld_depth == 0:
                self.json_ld.append("".join(self._json_ld_parts).strip())

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self.title += data
        if self._json_ld_depth:
            self._json_ld_parts.append(data)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate the Study Atlas portal and generated video curriculum.")
    parser.add_argument("--app-root", type=Path, default=APP_ROOT)
    return parser.parse_args()


def public_url(relative: str) -> str:
    if relative == "index.html":
        return SITE_ORIGIN
    if relative.endswith("/index.html"):
        return f"{SITE_ORIGIN}{relative.removesuffix('index.html')}"
    return f"{SITE_ORIGIN}{relative}"


def app_public_url(relative: str) -> str:
    if relative == "index.html":
        relative = ""
    elif relative.endswith("/index.html"):
        relative = relative.removesuffix("index.html")
    return f"{SITE_ORIGIN}info1-quiz-app/{relative}"


def flatten_video_questions(data: dict) -> dict[int, dict]:
    flattened: dict[int, dict] = {}
    for section in data.get("sections", []):
        for question in section.get("questions", []):
            number = int(question.get("number", 0))
            if number in flattened:
                raise ValueError(f"duplicate video question number: {number}")
            flattened[number] = question
    return flattened


def local_target(source: Path, href: str, app_root: Path) -> Path | None:
    parts = urlsplit(href)
    if parts.scheme or parts.netloc or href.startswith(("mailto:", "tel:", "javascript:")):
        return None
    path_parts = parts.path.split("/")
    if "info1-quiz-app" in path_parts:
        app_index = path_parts.index("info1-quiz-app")
        target = app_root / "/".join(path_parts[app_index + 1:])
    elif parts.path.startswith("/info1-quiz-app/"):
        target = app_root / parts.path.removeprefix("/info1-quiz-app/")
    elif parts.path.startswith("/"):
        target = ROOT / parts.path.lstrip("/")
    else:
        target = source.parent / parts.path
    target = target.resolve()
    if target.is_dir():
        target /= "index.html"
    return target


def check_metadata(path: Path, text: str, errors: list[str]) -> PageParser:
    parser = PageParser()
    parser.feed(text)
    relative = path.relative_to(ROOT).as_posix()
    if not parser.title or not parser.description or parser.h1_count != 1:
        errors.append(f"{relative}: title, description, and exactly one h1 are required")
    expected = public_url(relative)
    if parser.canonical != expected or parser.og_url != expected:
        errors.append(f"{relative}: canonical/og:url must be {expected}")
    if urlsplit(parser.canonical).query or urlsplit(parser.canonical).fragment:
        errors.append(f"{relative}: canonical must not include query or fragment")
    if not parser.json_ld:
        errors.append(f"{relative}: JSON-LD is missing")
    has_breadcrumb = False
    for block in parser.json_ld:
        try:
            value = json.loads(block)
        except json.JSONDecodeError as exc:
            errors.append(f"{relative}: invalid JSON-LD: {exc}")
            continue
        values = value if isinstance(value, list) else [value]
        for item in values:
            if isinstance(item, dict) and item.get("@type") == "BreadcrumbList":
                has_breadcrumb = True
    if not has_breadcrumb:
        errors.append(f"{relative}: BreadcrumbList JSON-LD is missing")
    return parser


def main() -> int:
    global APP_ROOT
    args = parse_args()
    APP_ROOT = args.app_root.expanduser().resolve()
    errors: list[str] = []
    warnings: list[str] = []

    curriculum_path = ROOT / "data" / "video-curriculum.json"
    video_data_path = ROOT / "data" / "video-questions.json"
    try:
        curriculum = json.loads(curriculum_path.read_text(encoding="utf-8"))
        video_data = json.loads(video_data_path.read_text(encoding="utf-8"))
        video_questions = flatten_video_questions(video_data)
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        errors.append(f"video data could not be loaded: {exc}")
        curriculum = {}
        video_data = {}
        video_questions = {}

    if len(video_questions) != 330 or set(video_questions) != set(range(1, 331)):
        errors.append("video data must contain Q1-Q330 exactly once")
    if video_data.get("content_policy") != "問題・答え・対応動画のみ。解説本文は収録しない。":
        errors.append("video data content policy must exclude keyword fields and explanation text")
    if any("keywords" in question for question in video_questions.values()):
        errors.append("video data still contains obsolete keyword fields")

    fields = curriculum.get("fields", []) if isinstance(curriculum, dict) else []
    genres = [genre for field in fields for genre in field.get("genres", [])]
    field_counts = {field.get("id"): sum(len(genre.get("numbers", [])) for genre in field.get("genres", [])) for field in fields}
    field_ids = [field.get("id") for field in fields]
    if field_ids != list(EXPECTED_FIELD_GENRES):
        errors.append(f"video curriculum field IDs/order are incorrect: {field_ids}")
    for field in fields:
        field_id = field.get("id")
        if field_id not in EXPECTED_FIELD_GENRES:
            continue
        genre_ids = [genre.get("id") for genre in field.get("genres", [])]
        if genre_ids != EXPECTED_FIELD_GENRES[field_id]:
            errors.append(f"video curriculum genre IDs/order are incorrect for {field_id}: {genre_ids}")
    for genre in genres:
        genre_id = genre.get("id")
        expected_numbers = EXPECTED_GENRE_NUMBERS.get(genre_id)
        if expected_numbers is None or genre.get("numbers") != expected_numbers:
            errors.append(f"video curriculum numbers are incorrect for {genre_id}: {genre.get('numbers')}")
    if len(fields) != 5 or field_counts != {"information-society": 32, "information-design": 33, "digital": 60, "network": 105, "programming": 100}:
        errors.append(f"video curriculum field counts are incorrect: {field_counts}")
    if len(genres) != 21 or len({genre.get("id") for genre in genres}) != 21:
        errors.append("video curriculum must contain 21 unique genres")
    normal_numbers = [number for genre in genres for number in genre.get("numbers", [])]
    if sorted(normal_numbers) != list(range(1, 331)) or len(normal_numbers) != len(set(normal_numbers)):
        errors.append("normal video genres must cover Q1-Q330 exactly once")
    expected_course = [231, 233, 235, 236, 241, 242, 248, 252, 255, 260, 263, 265, 270, 272, 276, 278, 281, 282, 285, 292, 301, 310, 315, 318, 324, 325, 330]
    courses = curriculum.get("courses", []) if isinstance(curriculum, dict) else []
    course_numbers = courses[0].get("numbers", []) if courses else []
    if course_numbers != expected_course or len(set(course_numbers)) != 27 or any(number not in video_questions for number in course_numbers):
        errors.append("programming shortest course numbers/order are incorrect")

    archive_dir = ROOT / "archive"
    archive_html = sorted(path.name for path in archive_dir.glob("*.html"))
    expected_archive_html = sorted(["index.html", "programming-shortest-course.html", *(f"{genre['id']}.html" for genre in genres)])
    if archive_html != expected_archive_html:
        errors.append(f"archive HTML set is incorrect: {archive_html}")
    if (archive_dir / "keywords.html").exists() or (ROOT / "assets" / "video-filter.js").exists() or (ROOT / "scripts" / "rebuild_video_keywords.py").exists() or (ROOT / "docs" / "video-keyword-audit.json").exists():
        errors.append("obsolete video keyword files remain")
    if (ROOT / "docs" / "portal-validation.json").exists():
        errors.append("obsolete docs/portal-validation.json remains; use docs/reports/portal-validation.json")
    genre_counts = {genre["id"]: len(genre.get("numbers", [])) for genre in genres}
    rendered_normal: list[int] = []
    for genre in genres:
        path = archive_dir / f"{genre['id']}.html"
        text = path.read_text(encoding="utf-8") if path.is_file() else ""
        ids = [int(value) for value in re.findall(r'<article class="video-question-card" id="q-(\d+)"', text)]
        if ids != genre.get("numbers", []):
            errors.append(f"archive/{genre['id']}.html: question order/count does not match curriculum")
        html_ids = re.findall(r'(?:^|\s)id="([^"]+)"', text)
        if len(html_ids) != len(set(html_ids)):
            errors.append(f"archive/{genre['id']}.html: duplicate HTML IDs remain")
        rendered_normal.extend(ids)
        if "video-genre-back-link" not in text:
            errors.append(f"archive/{genre['id']}.html: the standalone 一覧へ link is missing")
        if any(marker in text for marker in ("video-question-jump", "問題番号", "ジャンルを移動", "一覧へ戻る", "page-direction", "前後のジャンル", "archive-field-hero")):
            errors.append(f"archive/{genre['id']}.html: obsolete video navigation or hero markup remains")
        if "video-keywords" in text or "keyword-link" in text or "keywords.html" in text:
            errors.append(f"archive/{genre['id']}.html: obsolete keyword markup remains")
    if sorted(rendered_normal) != list(range(1, 331)) or len(rendered_normal) != len(set(rendered_normal)):
        errors.append("rendered normal video pages do not cover Q1-Q330 exactly once")
    course_text = (archive_dir / "programming-shortest-course.html").read_text(encoding="utf-8") if (archive_dir / "programming-shortest-course.html").is_file() else ""
    course_rendered = [int(value) for value in re.findall(r'<article class="video-question-card" id="q-(\d+)"', course_text)]
    if course_rendered != expected_course:
        errors.append("programming-shortest-course.html: rendered order does not match the 27-question course")
    course_html_ids = re.findall(r'(?:^|\s)id="([^"]+)"', course_text)
    if len(course_html_ids) != len(set(course_html_ids)):
        errors.append("programming-shortest-course.html: duplicate HTML IDs remain")
    if "video-genre-back-link" not in course_text or any(marker in course_text for marker in ("video-question-jump", "問題番号", "一覧へ戻る", "page-direction", "前後のジャンル", "archive-field-hero")):
        errors.append("programming-shortest-course.html: obsolete video navigation or hero markup remains")

    report_path = ROOT / "docs" / "video-library-build.json"
    report = json.loads(report_path.read_text(encoding="utf-8")) if report_path.is_file() else {}
    for key, expected in (("question_count", 330), ("field_counts", field_counts), ("genre_counts", genre_counts), ("genre_pages", [f"archive/{genre['id']}.html" for genre in genres]), ("course_pages", ["archive/programming-shortest-course.html"]), ("video_keyword_feature", False), ("explanation_text_published", False)):
        if report.get(key) != expected:
            errors.append(f"video-library-build.json: {key} is out of sync")
    if report.get("course_question_numbers") != expected_course:
        errors.append("video-library-build.json: course_question_numbers are out of sync")

    page_paths = sorted(path for path in ROOT.rglob("*.html") if not path.name.startswith("google"))
    parsers: dict[Path, PageParser] = {}
    for path in page_paths:
        try:
            parsers[path.resolve()] = check_metadata(path, path.read_text(encoding="utf-8"), errors)
        except OSError as exc:
            errors.append(f"{path.relative_to(ROOT)}: cannot read: {exc}")
    for source, parser in parsers.items():
        for href in parser.links:
            target = local_target(source, href, APP_ROOT)
            if target is not None and not target.exists():
                errors.append(f"{source.relative_to(ROOT)}: broken local link {href}")

    top_text = (ROOT / "index.html").read_text(encoding="utf-8")
    main_match = re.search(r'<main id="main-content">(.*?)</main>', top_text, flags=re.DOTALL)
    main_text = main_match.group(1) if main_match else ""
    class_positions = [main_text.find(marker) for marker in ('class="hero"', 'class="section section-app"', 'class="section home-actions-section"', 'class="section home-misc-section"')]
    if any(position < 0 for position in class_positions) or class_positions != sorted(class_positions):
        errors.append("index.html: required top-page section order is missing")
    hero_map_match = re.search(r'<div class="hero-map"[^>]*>.*?</div>\s*</div>', top_text, flags=re.DOTALL)
    if "hero-stats" in top_text or "data-home-app-summary" not in top_text or (hero_map_match and "<a" in hero_map_match.group(0)):
        errors.append("index.html: counts/history hook/map requirements are not satisfied")
    for href in ("./info1-quiz-app/app/", "./info1-quiz-app/questions/", "./archive/", "./LectureNote/", "./study-guide.html", "./books/"):
        if f'href="{href}"' not in top_text:
            errors.append(f"index.html: primary link is missing: {href}")
    archive_index_text = (ROOT / "archive" / "index.html").read_text(encoding="utf-8")
    if '<a class="archive-course-card"' not in archive_index_text or '<aside class="archive-course-card"' in archive_index_text:
        errors.append("archive/index.html: shortest course must be one linked card")
    if "掲載内容について" in archive_index_text or "問題を探してアプリで挑戦" in archive_index_text:
        errors.append("archive/index.html: removed supporting cards remain")
    books_index_text = (ROOT / "books" / "index.html").read_text(encoding="utf-8")
    if "このページについて" in books_index_text or "無料コンテンツから始める" in books_index_text:
        errors.append("books/index.html: removed supporting sections remain")
    home_learning = (ROOT / "assets" / "home-learning.js").read_text(encoding="utf-8")
    if "info1LearningRecord:v1" not in home_learning or "summarizeQuestionRecord" not in home_learning or "これまで延べ${attempts}問に解答" not in home_learning or "StudyAtlasLecture" in home_learning:
        errors.append("home-learning.js: safe question-history summary is missing or lecture state leaked")
    site_css = (ROOT / "assets" / "site.css").read_text(encoding="utf-8")
    for marker in (".home-action-grid", ".home-misc-grid", ".video-genre-back-link"):
        if marker not in site_css:
            errors.append(f"site.css: required reorganized layout style is missing: {marker}")
    for marker in (".archive-genre-section", ".archive-genre-links", ".archive-genre-link", ".page-numbers", ".page-ellipsis", ".pagination-top", ".field-grid", ".field-card", ".topic-list", ".key-advice"):
        if marker in site_css:
            errors.append(f"site.css: obsolete reorganized-page style remains: {marker}")
    for marker in ("video-keywords", "keyword-link", "video-filter"):
        if marker in site_css:
            errors.append(f"site.css: obsolete video keyword style remains: {marker}")
    lecture_index = (ROOT / "LectureNote" / "index.html").read_text(encoding="utf-8")
    if "archive-stats" in lecture_index:
        errors.append("LectureNote/index.html: redundant numeric summary remains")

    sitemap_path = ROOT / "sitemap.xml"
    sitemap_urls: list[str] = []
    if sitemap_path.is_file():
        try:
            sitemap_urls = [node.text.strip() for node in ET.parse(sitemap_path).getroot().findall(".//{*}loc") if node.text and node.text.strip()]
        except ET.ParseError as exc:
            errors.append(f"sitemap.xml: invalid XML: {exc}")
    else:
        errors.append("sitemap.xml is missing")
    if len(sitemap_urls) != len(set(sitemap_urls)):
        errors.append("sitemap.xml contains duplicate URLs")
    expected_portal_paths = [
        "index.html", "study-guide.html", "about.html", "privacy.html", "sitemap.html", "books/index.html",
        "LectureNote/index.html", "LectureNote/society.html", "LectureNote/digital.html", "LectureNote/network.html",
        "LectureNote/statistics.html", "LectureNote/programming.html", *report.get("learning_pages", []),
    ]
    expected_app_paths: list[str] = []
    app_report_path = APP_ROOT / "docs" / "reports" / "question-library-build.json"
    if app_report_path.is_file():
        app_report = json.loads(app_report_path.read_text(encoding="utf-8"))
        expected_app_paths = [*app_report.get("learning_pages", []), app_report.get("related_app_page", "")]
    expected_sitemap = [public_url(path) for path in dict.fromkeys(expected_portal_paths)] + [app_public_url(path) for path in dict.fromkeys(expected_app_paths)]
    if sitemap_urls != expected_sitemap:
        errors.append("sitemap.xml is not synchronized with the current portal/app build reports")
    if any("archive/keywords.html" in url or "questions/tags.html" in url for url in sitemap_urls):
        errors.append("sitemap.xml contains an obsolete keyword or legacy question URL")

    forbidden_files = ("archive/keywords.html", "archive/information-society-design.html", "archive/digital.html", "archive/network.html", "archive/programming.html")
    scanned_files = [path for path in ROOT.rglob("*") if path.is_file() and path.suffix.lower() in {".html", ".js", ".json", ".md", ".py", ".xml"} and path.name not in {"validate_portal.py"} and path.relative_to(ROOT).as_posix() != "docs/reports/portal-validation.json"]
    for path in scanned_files:
        text = path.read_text(encoding="utf-8", errors="ignore")
        for token in forbidden_files:
            if token in text:
                errors.append(f"obsolete URL remains in {path.relative_to(ROOT)}: {token}")
    if not (ROOT / "robots.txt").is_file() or f"Sitemap: {SITE_ORIGIN}sitemap.xml" not in (ROOT / "robots.txt").read_text(encoding="utf-8"):
        errors.append("robots.txt does not advertise sitemap.xml")

    report_out = {
        "status": "pass" if not errors else "fail",
        "html_pages_checked": len(page_paths),
        "archive_html": len(archive_html),
        "normal_video_questions": len(rendered_normal),
        "shortest_course_questions": len(course_rendered),
        "field_counts": field_counts,
        "genre_counts": genre_counts,
        "sitemap_urls": len(sitemap_urls),
        "errors": errors,
        "warnings": warnings,
        "checks": [
            "330 video questions, five fields, 21 genres, and exact shortest course",
            "video pages use click-to-load embeds without keyword UI or redundant navigation",
            "portal metadata, breadcrumbs, local links, and sitemap synchronization",
            "simplified top-page order and safe learning-history summary",
            "LectureNote index no longer exposes redundant numeric summary",
        ],
    }
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps(report_out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for warning in warnings:
        print(f"WARNING: {warning}")
    for error in errors:
        print(f"ERROR: {error}", file=sys.stderr)
    print(f"status={report_out['status']} pages={len(page_paths)} archive={len(archive_html)} sitemap={len(sitemap_urls)}")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
