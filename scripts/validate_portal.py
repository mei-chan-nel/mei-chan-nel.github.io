from __future__ import annotations

import json
import hashlib
import sys
import xml.etree.ElementTree as ET
from collections import Counter
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
        if tag == "img" and values.get("src"):
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
    virtual_app_root = (ROOT / "info1-quiz-app").resolve()
    try:
        app_relative = target.relative_to(virtual_app_root)
    except ValueError:
        pass
    else:
        target = APP_ROOT / app_relative
    if target.is_dir():
        target = target / "index.html"
    return target, unquote(split.fragment)


def sitemap_urls(path: Path) -> list[str]:
    namespace = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    tree = ET.parse(path)
    return [node.text.strip() for node in tree.findall("s:url/s:loc", namespace) if node.text]


def public_url(path: Path) -> str:
    relative = path.relative_to(ROOT).as_posix()
    if relative == "index.html":
        return SITE_ORIGIN
    if relative.endswith("/index.html"):
        return f"{SITE_ORIGIN}{relative.removesuffix('index.html')}"
    return f"{SITE_ORIGIN}{relative}"


def main() -> int:
    errors: list[str] = []
    warnings: list[str] = []
    video_report_path = ROOT / "docs" / "video-library-build.json"
    video_report = json.loads(video_report_path.read_text(encoding="utf-8"))
    video_page_paths = [ROOT / path for path in video_report.get("learning_pages", [])]
    lecture_index_path = ROOT / "LectureNote" / "index.html"
    lecture_field_paths = [
        ROOT / "LectureNote" / "society.html",
        ROOT / "LectureNote" / "digital.html",
        ROOT / "LectureNote" / "network.html",
        ROOT / "LectureNote" / "statistics.html",
        ROOT / "LectureNote" / "programming.html",
    ]
    lecture_page_paths = [lecture_index_path, *lecture_field_paths]
    page_paths = [
        ROOT / "index.html",
        ROOT / "study-guide.html",
        ROOT / "about.html",
        ROOT / "privacy.html",
        ROOT / "sitemap.html",
        ROOT / "books" / "index.html",
        *lecture_page_paths,
        *video_page_paths,
    ]
    parsed = {path.resolve(): parse_page(path) for path in page_paths}

    for path in page_paths:
        parser = parsed[path.resolve()]
        if not parser.title:
            errors.append(f"{path.name}: missing title")
        if not parser.description:
            errors.append(f"{path.name}: missing meta description")
        expected_canonical = public_url(path)
        if parser.canonical != expected_canonical:
            errors.append(f"{path.relative_to(ROOT)}: unexpected canonical URL: {parser.canonical}")
        if parser.h1_count != 1:
            errors.append(f"{path.name}: expected one h1, found {parser.h1_count}")
        if "sitemap.html" not in path.read_text(encoding="utf-8"):
            errors.append(f"{path.relative_to(ROOT)}: footer sitemap link is missing")
        page_text = path.read_text(encoding="utf-8")
        for marker in ('property="og:title"', 'property="og:description"', 'property="og:url"'):
            if marker not in page_text:
                errors.append(f"{path.relative_to(ROOT)}: missing {marker}")
        if path.name != "index.html" and '"@type":"BreadcrumbList"' not in page_text:
            errors.append(f"{path.relative_to(ROOT)}: BreadcrumbList structured data is missing")

    expected_nav_labels = [
        "トップページ",
        "学習アプリ",
        "問題一覧",
        "動画問題",
        "講義ノート",
        "勉強法",
        "このサイトについて",
    ]
    for path in page_paths:
        page_text = path.read_text(encoding="utf-8")
        header_start = page_text.find('<header class="site-header">')
        header_end = page_text.find("</header>", header_start)
        if header_start < 0 or header_end < 0:
            errors.append(f"{path.relative_to(ROOT)}: global site header is missing")
            continue
        header_text = page_text[header_start:header_end]
        nav_start = header_text.find('<nav class="global-nav"')
        nav_end = header_text.find("</nav>", nav_start)
        nav_text = header_text[nav_start:nav_end]
        positions = [nav_text.find(f">{label}<") for label in expected_nav_labels]
        if any(position < 0 for position in positions) or positions != sorted(positions):
            errors.append(f"{path.relative_to(ROOT)}: global navigation order is invalid")

    all_portal_html = [
        path
        for path in [*ROOT.glob("*.html"), *ROOT.glob("archive/*.html"), *ROOT.glob("books/*.html"), *ROOT.glob("LectureNote/*.html")]
        if not path.name.startswith("google")
    ]
    for path in all_portal_html:
        page_text = path.read_text(encoding="utf-8")
        if "assets/site-header.js" not in page_text:
            errors.append(f"{path.relative_to(ROOT)}: smart site-header script is missing")
        if "<strong>情報Ⅰ Study Atlas</strong>" not in page_text or "<small>高校情報Ⅰの学習サイト</small>" not in page_text:
            errors.append(f"{path.relative_to(ROOT)}: shared Study Atlas branding is missing")

    for path in lecture_field_paths:
        lecture_text = path.read_text(encoding="utf-8")
        if any(marker in lecture_text for marker in ('class="lecture-toolbar"', 'class="field-nav"', 'class="brand-copy"')):
            errors.append(f"{path.relative_to(ROOT)}: obsolete lecture-only header UI remains")
        aside_start = lecture_text.find('<aside class="section-sidebar"')
        aside_end = lecture_text.find("</aside>", aside_start)
        aside_text = lecture_text[aside_start:aside_end]
        if aside_start < 0 or 'id="lecture-course-nav"' not in aside_text or 'id="cloze-toggle"' not in aside_text:
            errors.append(f"{path.relative_to(ROOT)}: lecture navigation or cloze control is not contained in the sidebar")

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

    ad_pages = [ROOT / "index.html", ROOT / "study-guide.html", *video_page_paths]
    for path in ad_pages:
        if AD_MARKER not in path.read_text(encoding="utf-8"):
            errors.append(f"{path.relative_to(ROOT)}: learning page is missing AdSense script")
    for path in (ROOT / "about.html", ROOT / "privacy.html", ROOT / "sitemap.html", ROOT / "books" / "index.html"):
        if AD_MARKER in path.read_text(encoding="utf-8"):
            errors.append(f"{path.name}: informational page must be ad-free")

    video_data = json.loads((ROOT / "data" / "video-questions.json").read_text(encoding="utf-8"))
    video_questions = [question for section in video_data.get("sections", []) for question in section.get("questions", [])]
    if video_data.get("question_count") != 330 or len(video_questions) != 330:
        errors.append("video-questions.json: expected exactly 330 questions")
    video_numbers = [question.get("number") for question in video_questions]
    if sorted(video_numbers) != list(range(1, 331)):
        errors.append("video-questions.json: question numbers must be unique and cover 1 through 330")
    if any(not str(question.get("answer") or "").strip() for question in video_questions):
        errors.append("video-questions.json: every question must have an answer")
    if any("explanation" in question or "解説" in question for question in video_questions):
        errors.append("video-questions.json: explanation text must not be published")
    if any(not question.get("videos") for question in video_questions):
        errors.append("video-questions.json: every question must have a mapped video")
    if any(not 2 <= len(question.get("keywords") or []) <= 4 for question in video_questions):
        errors.append("video-questions.json: every question must have 2-4 audited keywords")
    keyword_frequencies = Counter(
        str(keyword) for question in video_questions for keyword in question.get("keywords", [])
    )
    singleton_keywords = sorted(keyword for keyword, count in keyword_frequencies.items() if count < 2)
    if singleton_keywords:
        errors.append(f"video-questions.json: keywords must connect multiple questions: {singleton_keywords}")
    keyword_report_path = ROOT / "docs" / "video-keyword-audit.json"
    if not keyword_report_path.is_file():
        errors.append("video-keyword-audit.json: audit report is missing")
    else:
        keyword_report = json.loads(keyword_report_path.read_text(encoding="utf-8"))
        if keyword_report.get("question_count") != 330 or keyword_report.get("old_keywords_used_as_input") is not False:
            errors.append("video-keyword-audit.json: audit provenance is invalid")
        if keyword_report.get("taxonomy_version") != 2 or keyword_report.get("unique_keyword_count") != len(keyword_frequencies):
            errors.append("video-keyword-audit.json: controlled taxonomy metadata is invalid")
        if keyword_report.get("minimum_questions_per_keyword", 0) < 2 or keyword_report.get("single_question_keyword_count") != 0:
            errors.append("video-keyword-audit.json: one-question-only keyword audit failed")
        current_hash = hashlib.sha256((ROOT / "data" / "video-questions.json").read_bytes()).hexdigest()
        if keyword_report.get("data_sha256") != current_hash:
            errors.append("video-keyword-audit.json: data hash does not match video-questions.json")
        audited = {int(entry["number"]): entry.get("keywords") for entry in keyword_report.get("entries", [])}
        current = {int(question["number"]): question.get("keywords") for question in video_questions}
        if audited != current:
            errors.append("video-keyword-audit.json: audited keywords do not match public data")
    if video_report.get("explanation_text_published") is not False:
        errors.append("video-library-build.json: explanation publication flag must be false")
    if video_report.get("page_size") != 10 or len(video_report.get("field_counts", {})) != 4:
        errors.append("video-library-build.json: expected four public fields with 10 questions per page")
    if video_report.get("youtube_direct_links_published") is not False:
        errors.append("video-library-build.json: YouTube direct links must not be published")
    if video_report.get("video_viewer_aspect_ratio") != "9:16":
        errors.append("video-library-build.json: Shorts viewer must use a 9:16 aspect ratio")
    if video_report.get("programming_code_blocks") != 100:
        errors.append("video-library-build.json: expected 100 programming code blocks")
    if any("<iframe" in path.read_text(encoding="utf-8").lower() for path in video_page_paths):
        errors.append("archive pages: video iframes must not load before user interaction")
    regular_video_pages = [
        path for path in video_page_paths if path.name not in {"index.html", "keywords.html"}
    ]
    video_html = "\n".join(path.read_text(encoding="utf-8") for path in video_page_paths)
    if "YouTubeで見る" in video_html or "video-direct-link" in video_html or "youtube.com/watch?v=" in video_html:
        errors.append("archive pages: obsolete YouTube direct links remain")
    if video_html.count('<pre class="question-code"') != 100:
        errors.append("archive pages: every programming question must contain one code block")
    expected_keywords = {
        str(keyword).strip()
        for question in video_questions
        for keyword in question.get("keywords", [])
        if str(keyword).strip()
    }
    regular_video_html = "\n".join(path.read_text(encoding="utf-8") for path in regular_video_pages)
    if regular_video_html.count('class="keyword-link"') != sum(len(question["keywords"]) for question in video_questions):
        errors.append("archive pages: every published keyword must be a link")
    if 'href="keywords.html?keyword=' not in regular_video_html:
        errors.append("archive pages: keywords do not link to the keyword filter")
    expected_keyword_links = sum(len(question["keywords"]) for question in video_questions)
    if regular_video_html.count("&question=") != expected_keyword_links:
        errors.append("archive pages: every keyword link must preserve its source question")
    keyword_page = ROOT / "archive" / "keywords.html"
    keyword_data_path = ROOT / "archive" / "filter-data.json"
    keyword_script_path = ROOT / "assets" / "video-filter.js"
    if not keyword_page.is_file() or not keyword_data_path.is_file() or not keyword_script_path.is_file():
        errors.append("Keyword filter page, data, or script is missing")
    else:
        keyword_text = keyword_page.read_text(encoding="utf-8")
        if keyword_text.count('class="facet-link"') != len(expected_keywords):
            errors.append("keywords.html: expected one link for every unique keyword")
        if keyword_text.count('class="facet-group"') != 4:
            errors.append("keywords.html: keywords must be grouped into four learning fields")
        if "data-video-filter" not in keyword_text or 'data-filter-param="keyword"' not in keyword_text:
            errors.append("keywords.html: OR filter configuration is missing")
        payload = json.loads(keyword_data_path.read_text(encoding="utf-8"))
        if payload.get("question_count") != len(video_questions) or payload.get("keyword_count") != len(expected_keywords):
            errors.append("archive/filter-data.json: question or keyword counts are invalid")
        if payload.get("match_mode") != "OR" or len(payload.get("questions", [])) != len(video_questions):
            errors.append("archive/filter-data.json: OR filter payload is invalid")
        keyword_script = keyword_script_path.read_text(encoding="utf-8")
        if "URLSearchParams" not in keyword_script:
            errors.append("video-filter.js: URL-based multi-keyword filter is missing")
        if "focusNumber" not in keyword_script or "scrollIntoView" not in keyword_script:
            errors.append("video-filter.js: source-question prioritization or result scrolling is missing")
    stylesheet = (ROOT / "assets" / "site.css").read_text(encoding="utf-8")
    if ".question-code" not in stylesheet or "white-space: pre" not in stylesheet or "overflow-x: auto" not in stylesheet:
        errors.append("site.css: non-wrapping horizontally scrollable code-block styles are missing")
    embed_script = (ROOT / "assets" / "video-embeds.js").read_text(encoding="utf-8")
    if "youtube-nocookie.com/embed/" not in embed_script:
        errors.append("video-embeds.js: privacy-enhanced YouTube embed URL is missing")
    video_filter_script = (ROOT / "assets" / "video-filter.js").read_text(encoding="utf-8")
    if "filter-hit-count" not in video_filter_script:
        errors.append("video-filter.js: visible filtered-result count is missing from the heading")

    app_questions = json.loads((APP_ROOT / "data" / "questions" / "completed_questions.json").read_text(encoding="utf-8"))
    app_question_count = len(app_questions)
    raw_tag_counts = Counter(
        str(tag).strip()
        for question in app_questions
        for tag in question.get("tags", [])
        if str(tag).strip()
    )
    public_tags = {tag for tag, count in raw_tag_counts.items() if count >= 4}
    top_text = (ROOT / "index.html").read_text(encoding="utf-8")
    if app_question_count != 1000 or "1,000" not in top_text:
        errors.append("index.html: completed 1,000-question count is not synchronized")
    if len(raw_tag_counts) != 613 or len(public_tags) != 244 or "244" not in top_text:
        errors.append("index.html: public tag count is not synchronized with the four-question display threshold")
    for obsolete_copy in ("知識を、点でなく地図にする", "問題一覧から読む", "ランダムに挑戦する"):
        if obsolete_copy in top_text:
            errors.append(f"index.html: obsolete top-page copy remains: {obsolete_copy}")
    if top_text.count('class="field-card accent-') != 6 or top_text.count('class="map-node ') != 6:
        errors.append("index.html: expected six linked field cards and six linked map nodes")
    if top_text.count('class="field-card compact-field-card ') != 4:
        errors.append("index.html: expected four linked video-question category cards")
    if top_text.count('class="field-card lecture-field-card ') != 5:
        errors.append("index.html: expected five linked lecture-note field cards")
    if 'href="./LectureNote/society.html"' not in top_text:
        errors.append("index.html: lecture-note society card must link directly to society.html")
    lecture_index_text = lecture_index_path.read_text(encoding="utf-8")
    if lecture_index_text.count('class="archive-field-card lecture-index-card"') != 5:
        errors.append("LectureNote/index.html: expected five lecture field cards")
    for lecture_href in ("./society.html", "./digital.html", "./network.html", "./statistics.html", "./programming.html"):
        if f'href="{lecture_href}"' not in lecture_index_text:
            errors.append(f"LectureNote/index.html: missing field link {lecture_href}")
    section_positions = [
        top_text.find('class="section video-library-section"'),
        top_text.find('class="section lecture-note-section"'),
        top_text.find('class="section book-showcase-section"'),
    ]
    if any(position < 0 for position in section_positions) or section_positions != sorted(section_positions):
        errors.append("index.html: video, lecture-note, and book sections are not in the required order")
    if top_text.count('class="book-showcase-card"') != 4 or top_text.count('assets/books/') != 4:
        errors.append("index.html: expected four linked book cards with local cover images")
    if top_text.count('class="book-showcase-description"') != 4:
        errors.append("index.html: every book card must contain its own description")
    if '<span class="hero-slogan">知識を、<br /><em>ひろげ、<br />つなげる</em></span>' not in top_text:
        errors.append("index.html: the three-line site slogan is missing")
    for target_term in ("情報Ⅰ", "情報1", "共通テスト", "高校生", "受験生"):
        if target_term not in top_text:
            errors.append(f"index.html: target-audience language is missing: {target_term}")
    guide_text = (ROOT / "study-guide.html").read_text(encoding="utf-8")
    for marker in (
        "学習の基本サイクル",
        "学習アプリを周回する意味",
        "動画付き問題とプログラミング",
        "講義ノートで深く学ぶ",
        "共通テストへつなげる",
        '"@type":"Article"',
    ):
        if marker not in guide_text:
            errors.append(f"study-guide.html: required substantive guide marker is missing: {marker}")
    for official_host in ("mext.go.jp", "dnc.ac.jp"):
        if official_host not in guide_text:
            errors.append(f"study-guide.html: official reference is missing: {official_host}")
    if 'class="app-cta app-cta-link"' not in top_text or "知識・計算問題の学習用アプリ" not in top_text:
        errors.append("index.html: linked learning-app CTA is missing")
    for marker in ("学習アプリが中心", "問題一覧で根拠を確かめ", "講義ノートで仕組みまで深く理解"):
        if marker not in top_text:
            errors.append(f"index.html: app-first site introduction is missing: {marker}")
    for asin in ("B0CFY4F6TB", "B0CPWBVTRT", "B0DQFKKDST", "B0CTY6G1DG"):
        if asin not in (ROOT / "books" / "index.html").read_text(encoding="utf-8"):
            errors.append(f"books/index.html: missing Amazon title link {asin}")
    books_text = (ROOT / "books" / "index.html").read_text(encoding="utf-8")
    if books_text.count('class="book-visual"') != 4 or books_text.count('class="book-description"') != 4:
        errors.append("books/index.html: expected four thumbnail-and-description book rows")
    if "background: #f3f7f6" not in stylesheet or "color: var(--ink)" not in stylesheet:
        errors.append("site.css: light code-block color scheme is missing")
    if "aspect-ratio: 9 / 16" not in stylesheet or "width: min(100%, 360px)" not in stylesheet:
        errors.append("site.css: responsive 9:16 Shorts viewer style is missing")
    if ".filter-hit-count" not in stylesheet:
        errors.append("site.css: filtered-result count badge style is missing")
    if "各ページ10問ずつ掲載しています。" in top_text:
        errors.append("index.html: obsolete video-question page-size lead remains")

    about_text = (ROOT / "about.html").read_text(encoding="utf-8")
    if "おすすめの使い方" in about_text:
        errors.append("about.html: the duplicated recommended-use section remains")
    for marker in ("サイトの目的", "掲載コンテンツ", "編集方針", "お問い合わせ"):
        if marker not in about_text:
            errors.append(f"about.html: required site-information marker is missing: {marker}")

    forbidden_public_copy = (
        "Word由来",
        "PDF由来",
        "PPT由来",
        "PowerPoint由来",
        "指導書をまとめ",
        "元資料の内容をすべて読む",
        "共通テスト用プログラミング表記",
        "HOW TO STUDY",
        "問題を掲載するまで",
    )
    public_source_paths = [
        *ROOT.glob("*.html"),
        *ROOT.glob("archive/*.html"),
        *ROOT.glob("books/*.html"),
        *ROOT.glob("LectureNote/*.html"),
        *ROOT.glob("LectureNote/*.js"),
    ]
    for path in public_source_paths:
        source_text = path.read_text(encoding="utf-8")
        for marker in forbidden_public_copy:
            if marker in source_text:
                errors.append(f"{path.relative_to(ROOT)}: forbidden public wording remains: {marker}")

    lecture_stylesheet = (ROOT / "LectureNote" / "lecture-note.css").read_text(encoding="utf-8")
    if "position: sticky" not in stylesheet or "position: sticky" not in lecture_stylesheet:
        errors.append("site headers must remain sticky in both portal stylesheets")
    for css_text, css_name in ((stylesheet, "site.css"), (lecture_stylesheet, "lecture-note.css")):
        if ".site-header.is-header-hidden" not in css_text:
            errors.append(f"{css_name}: smart header hidden state is missing")
    if ".header-is-hidden .section-sidebar" not in lecture_stylesheet:
        errors.append("lecture-note.css: sidebar does not adapt when the smart header is hidden")

    header_script = (ROOT / "assets" / "site-header.js").read_text(encoding="utf-8")
    for marker in ("requestAnimationFrame", "is-header-hidden", "focusin"):
        if marker not in header_script:
            errors.append(f"site-header.js: required smart-header behavior is missing: {marker}")
    lecture_script = (ROOT / "LectureNote" / "lecture.js").read_text(encoding="utf-8")
    for marker in ("情報社会", "デジタル", "ネットワーク", "統計", "プログラミング", "course-field-group is-current"):
        if marker not in lecture_script:
            errors.append(f"lecture.js: hierarchical course navigation marker is missing: {marker}")
    lecture_content_text = (ROOT / "LectureNote" / "lecture-content.js").read_text(encoding="utf-8")
    programming_content_text = (ROOT / "LectureNote" / "programming-content.js").read_text(encoding="utf-8")
    programming_enrichment_text = (ROOT / "LectureNote" / "programming-enrichment.js").read_text(encoding="utf-8")
    guide_enrichment_text = (ROOT / "LectureNote" / "guide-enrichment.js").read_text(encoding="utf-8")
    lecture_visual_text = lecture_content_text + programming_content_text + programming_enrichment_text + guide_enrichment_text
    if lecture_visual_text.count('<figure class="raster-figure"') < 25:
        errors.append("LectureNote: meaningful graph, animation, circuit, or spatial raster figures are missing")
    if lecture_visual_text.count('<figure class="html-figure"') < 12:
        errors.append("LectureNote: semantic HTML figures are missing")
    for required_figure in (
        "logic-gate-and.png",
        "logic-gate-or.png",
        "logic-gate-not.png",
        "half-adder-circuit.png",
        "full-adder.png",
        "multi-bit-adder.png",
        "processing-models.png",
        "email-delivery.png",
        "shared-key-encryption.gif",
        "public-key-encryption.gif",
        "hybrid-encryption.png",
        "digital-signature.png",
        "seasonal-adjustment-example.png",
        "basic-structures.png",
    ):
        if required_figure not in lecture_visual_text:
            errors.append(f"LectureNote: required explanatory figure is missing: {required_figure}")
    for required_html_figure in ("protocol-figure", "relational-workflow"):
        if required_html_figure not in lecture_visual_text or required_html_figure not in lecture_stylesheet:
            errors.append(f"LectureNote: required responsive explanatory figure is missing: {required_html_figure}")
    for obsolete_image in ("performance-errors.png", "cryptography.png", "sorting-searching.png", "database.png", "values-types.png", "public-data-workflow.png"):
        if obsolete_image in lecture_visual_text:
            errors.append(f"LectureNote: redundant raster figure remains: {obsolete_image}")
    for marker in ("figure-zoom-trigger", "figure-lightbox", "showModal", 'image.loading = "lazy"'):
        if marker not in lecture_script:
            errors.append(f"lecture.js: accessible figure enlargement behavior is missing: {marker}")
    if ".figure-lightbox" not in lecture_stylesheet or ".figure-zoom-trigger" not in lecture_stylesheet:
        errors.append("lecture-note.css: figure enlargement styles are missing")
    if "figure-zoom-hint" in lecture_script or "figure-zoom-hint" in lecture_stylesheet:
        errors.append("LectureNote: visible enlargement hint must not be shown over figures")
    if "PDU" in lecture_visual_text:
        errors.append("LectureNote: out-of-scope PDU terminology remains")
    for out_of_scope_logic in ("⊕", "¬"):
        if out_of_scope_logic in lecture_visual_text:
            errors.append(f"LectureNote: out-of-scope logic notation remains: {out_of_scope_logic}")
    for obsolete_section in ('id: "network-rsa"', 'id: "programming-recursion"', 'id: "programming-flowchart"'):
        if obsolete_section in lecture_visual_text:
            errors.append(f"LectureNote: obsolete top-level section remains: {obsolete_section}")
    if ".raster-figure img { width: 1200px" in lecture_stylesheet:
        errors.append("lecture-note.css: obsolete fixed-width mobile figures remain")

    ads_value = (ROOT / "ads.txt").read_text(encoding="utf-8").strip()
    if ads_value != "google.com, pub-6257644709224446, DIRECT, f08c47fec0942fa0":
        errors.append("ads.txt contains an unexpected publisher record")
    robots_text = (ROOT / "robots.txt").read_text(encoding="utf-8")
    if f"Sitemap: {SITE_ORIGIN}sitemap.xml" not in robots_text:
        errors.append("robots.txt does not advertise the host-root sitemap")
    if "User-agent: OAI-SearchBot" not in robots_text:
        errors.append("robots.txt does not explicitly allow ChatGPT search discovery")

    try:
        portal_urls = sitemap_urls(ROOT / "sitemap.xml")
        if len(portal_urls) != len(set(portal_urls)):
            errors.append("sitemap.xml contains duplicate URLs")
        required = {
            SITE_ORIGIN,
            f"{SITE_ORIGIN}study-guide.html",
            f"{SITE_ORIGIN}about.html",
            f"{SITE_ORIGIN}privacy.html",
            f"{SITE_ORIGIN}sitemap.html",
            f"{SITE_ORIGIN}books/",
            f"{SITE_ORIGIN}LectureNote/",
            f"{SITE_ORIGIN}LectureNote/society.html",
            f"{SITE_ORIGIN}LectureNote/digital.html",
            f"{SITE_ORIGIN}LectureNote/network.html",
            f"{SITE_ORIGIN}LectureNote/statistics.html",
            f"{SITE_ORIGIN}LectureNote/programming.html",
            f"{SITE_ORIGIN}archive/",
            f"{SITE_ORIGIN}archive/keywords.html",
            f"{SITE_ORIGIN}info1-quiz-app/questions/tags.html",
            f"{SITE_ORIGIN}info1-quiz-app/app/",
        }
        missing_required = sorted(required - set(portal_urls))
        if missing_required:
            errors.append(f"sitemap.xml is missing required URLs: {missing_required}")
        app_report = APP_ROOT / "docs" / "reports" / "question-library-build.json"
        if app_report.exists():
            report = json.loads(app_report.read_text(encoding="utf-8"))
            app_paths = [*report.get("learning_pages", []), report.get("related_app_page", "")]
            expected_urls = [*(public_url(path) for path in page_paths), *(f"{SITE_ORIGIN}info1-quiz-app/{path}" for path in app_paths)]
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
            "Open Graph and BreadcrumbList structured metadata",
            "portal and cross-repository links and fragments",
            "AdSense on the portal top and learning pages, but not informational or book-guide pages",
            "330 video-question mappings without book explanation text",
            "330 explicitly audited keyword sets independent of the original keyword column",
            "controlled 90-keyword taxonomy with no one-question-only keywords",
            "privacy-enhanced click-to-load YouTube embeds",
            "formatted question text, 100 light non-wrapping programming code blocks, and no YouTube direct links",
            "linked keywords, complete keyword index, and multi-keyword OR filtering",
            "four-field keyword grouping and source-question-first single-keyword navigation",
            "site-specific information-I study guide with app repetition, programming videos, lecture notes, and official references",
            "top-page section order, counts, linked app CTA, six app fields, four video fields, five lecture fields, and four responsive book rows",
            "consistent sticky seven-link global navigation and prohibited public-copy scan",
            "five lecture-note fields with metadata, local assets, links, and structured breadcrumbs",
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
