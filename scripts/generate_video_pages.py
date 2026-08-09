from __future__ import annotations

import html
import json
import re
from collections import Counter
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data" / "video-questions.json"
EXPLANATIONS_PATH = ROOT / "data" / "video-explanations.json"
CURRICULUM_PATH = ROOT / "data" / "video-curriculum.json"
OUTPUT_DIR = ROOT / "archive"
REPORT_PATH = ROOT / "docs" / "video-library-build.json"
SITE_ORIGIN = "https://mei-chan-nel.com/"
OG_IMAGE_URL = f"{SITE_ORIGIN}assets/og/study-atlas-home-og.png"
OG_IMAGE_ALT = "情報Ⅰ Study Atlasの学習マップと「知識を、ひろげ、つなげる」のメッセージ"
OG_IMAGE_WIDTH = 1734
OG_IMAGE_HEIGHT = 907
ADSENSE_CLIENT = "ca-pub-6257644709224446"
ADSENSE_SCRIPT = f'''    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client={ADSENSE_CLIENT}" crossorigin="anonymous"></script>'''
MANUAL_ADS_SCRIPT = '''    <script src="../assets/manual-ads.js?v=2026080901" defer></script>'''
EXPECTED_COURSE = [231, 233, 235, 236, 241, 242, 248, 252, 255, 260, 263, 265, 270, 272, 276, 278, 281, 282, 285, 292, 301, 310, 315, 318, 324, 325, 330]
EXPECTED_FIELD_GENRES = {
    "information-society": [
        "information-society-morals",
        "information-society-intellectual-property",
    ],
    "information-design": [
        "information-design-communication",
        "information-design-web",
        "information-design-organization",
    ],
    "digital": [
        "digital-calculation",
        "digital-logic-circuits",
        "digital-data",
        "digital-computers",
    ],
    "network": [
        "network-fundamentals",
        "network-protocols",
        "network-security",
        "network-information-systems",
        "network-databases",
        "network-safety",
    ],
    "programming": [
        "programming-variables-arrays",
        "programming-branches",
        "programming-loops",
        "programming-search-sort",
        "programming-functions",
        "programming-simulation",
    ],
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


def e(value: object) -> str:
    return html.escape(str(value), quote=True)


def structured_data(value: dict[str, object]) -> str:
    return f'<script type="application/ld+json">{json.dumps(value, ensure_ascii=False, separators=(",", ":"))}</script>'


def clean_html(value: str) -> str:
    """Keep generated pages stable and free of whitespace-only lines."""
    return re.sub(r"[ \t]+\n", "\n", value).rstrip() + "\n"


def breadcrumb_data(items: list[tuple[str, str]]) -> dict[str, object]:
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": index, "name": label, "item": url}
            for index, (label, url) in enumerate(items, start=1)
        ],
    }


def head(title: str, description: str, canonical_path: str, *, ads: bool = False, video_script: bool = False) -> str:
    canonical = f"{SITE_ORIGIN}{canonical_path}"
    ad_scripts = f"\n{ADSENSE_SCRIPT}\n{MANUAL_ADS_SCRIPT}" if ads else ""
    video_embed_script = '\n    <script src="../assets/video-embeds.js" defer></script>' if video_script else ""
    return f"""<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{e(title)}</title>
    <meta name="description" content="{e(description)}" />
    <meta name="theme-color" content="#102f35" />
    <meta property="og:type" content="website" />
    <meta property="og:locale" content="ja_JP" />
    <meta property="og:site_name" content="情報Ⅰ Study Atlas" />
    <meta property="og:title" content="{e(title)}" />
    <meta property="og:description" content="{e(description)}" />
    <meta property="og:url" content="{e(canonical)}" />
    <meta property="og:image" content="{OG_IMAGE_URL}" />
    <meta property="og:image:secure_url" content="{OG_IMAGE_URL}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="{OG_IMAGE_WIDTH}" />
    <meta property="og:image:height" content="{OG_IMAGE_HEIGHT}" />
    <meta property="og:image:alt" content="{OG_IMAGE_ALT}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:image" content="{OG_IMAGE_URL}" />
    <meta name="twitter:image:alt" content="{OG_IMAGE_ALT}" />
    <link rel="canonical" href="{e(canonical)}" />
    <link rel="icon" href="../assets/favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="../assets/site.css?v=2026080901" />{ad_scripts}{video_embed_script}
  </head>"""


def header(current: str) -> str:
    links = [
        ("home", "../", "トップページ"),
        ("app", "../info1-quiz-app/app/", "学習アプリ"),
        ("questions", "../info1-quiz-app/questions/", "問題を探す"),
        ("archive", "./", "解説動画"),
        ("lecture", "../LectureNote/", "講義ノート"),
        ("study", "../study-guide.html", "使い方"),
        ("about", "../about.html", "このサイトについて"),
    ]
    nav = "".join(
        f'<a href="{href}"{(" aria-current=\"page\"" if key == current else "")}>{label}</a>'
        for key, href, label in links
    )
    return f"""  <body>
    <a class="skip-link" href="#main-content">本文へ移動</a>
    <header class="site-header">
      <div class="header-inner">
        <a class="brand" href="../">
          <span class="brand-mark" aria-hidden="true">I</span>
          <span><strong>情報Ⅰ Study Atlas</strong><small>知識を、ひろげ、つなげる</small></span>
        </a>
        <nav class="global-nav" aria-label="メインナビゲーション">{nav}</nav>
      </div>
    </header>"""


def footer() -> str:
    return """    <footer class="site-footer">
      <div class="footer-grid">
        <div><p class="footer-brand">情報Ⅰ Study Atlas</p><p class="footer-copy">知識を、ひろげ、つなげる</p></div>
        <nav aria-label="フッターナビゲーション">
          <a href="../">トップページ</a>
          <a href="../info1-quiz-app/app/">学習アプリ</a>
          <a href="../info1-quiz-app/questions/">問題を探す</a>
          <a href="./">解説動画</a>
          <a href="../LectureNote/">講義ノート</a>
          <a href="../study-guide.html">使い方</a>
          <a href="../books/">書籍案内</a>
          <a href="../about.html">このサイトについて</a>
          <a href="../privacy.html">プライバシーポリシー</a>
          <a href="../sitemap.html">サイトマップ</a>
        </nav>
      </div>
      <p class="copyright"><small>&copy; 2026 めいちゃんねる</small></p>
    </footer>
    <script src="../assets/site-header.js?v=2026080801"></script>
  </body>
</html>
"""


def breadcrumb(items: list[tuple[str, str | None]]) -> str:
    parts = []
    for label, href in items:
        if href:
            parts.append(f'<a href="{e(href)}">{e(label)}</a>')
        else:
            parts.append(f'<span aria-current="page">{e(label)}</span>')
    return '<nav class="breadcrumb" aria-label="パンくずリスト">' + '<span aria-hidden="true">/</span>'.join(parts) + "</nav>"


def prose_markup(text: str) -> str:
    normalized = str(text).replace("\r\n", "\n").replace("\r", "\n")
    normalized = re.sub(r"(?<=[。！？])(?=\S)", "\n", normalized)
    normalized = re.sub(r"(?<!^)(?<!\n)(?=(?:ただし|なお)[、，])", "\n", normalized)
    lines = [line.strip() for line in normalized.split("\n") if line.strip()]
    return "<br />\n            ".join(e(line) for line in lines)


def question_parts(question: dict[str, object], section_id: str) -> tuple[str, str]:
    text = str(question["question"]).replace("\r\n", "\n").replace("\r", "\n")
    if not section_id.startswith("programming"):
        return text, ""
    lines = text.split("\n")
    code_start = next(
        (
            index
            for index, line in enumerate(lines)
            if re.match(r"^\s*(?:（\d+）|\d+[．.]|プログラム[A-ZＡ-Ｚ])", line)
        ),
        len(lines),
    )
    heading = "\n".join(lines[:code_start]).strip() or "プログラムを読み、問いに答えよ。"
    code = "\n".join(line.rstrip() for line in lines[code_start:]).strip()
    return heading, code


def question_markup(question: dict[str, object], section_id: str) -> str:
    heading, code = question_parts(question, section_id)
    code_block = (
        f'<pre class="question-code" tabindex="0" aria-label="Q{int(question["number"]):03d}のプログラム"><code>{e(code)}</code></pre>'
        if code
        else ""
    )
    return f"<h2>{prose_markup(heading)}</h2>{code_block}"


def video_controls(number: int, videos: list[dict[str, str]]) -> str:
    controls = []
    for index, video in enumerate(videos, start=1):
        frame_id = f"video-{number}-{index}"
        suffix = f" {index}" if len(videos) > 1 else ""
        controls.append(
            f'''<div class="video-control">
              <button class="video-trigger" type="button" data-video-id="{e(video['id'])}" data-video-title="{e(video['title'])}" aria-controls="{frame_id}" aria-expanded="false">解説動画を表示{suffix}</button>
              <div class="video-frame" id="{frame_id}" hidden></div>
            </div>'''
        )
    return "\n".join(controls)


def question_card(question: dict[str, object], section_id: str, meta: str) -> str:
    number = int(question["number"])
    explanation = prose_markup(str(question["explanation"]))
    return f'''        <article class="video-question-card" id="q-{number}">
          <div class="video-question-meta"><span>{e(meta)}</span></div>
          {question_markup(question, section_id)}
          <details class="video-answer-panel">
            <summary>答えと解説を見る<span class="detail-icon" aria-hidden="true"></span></summary>
            <div class="video-answer-content">
              <p class="video-answer-row"><span>答え</span><strong>{e(question['answer'])}</strong></p>
              <p class="video-explanation-row"><span>解説</span><span class="video-explanation-text">{explanation}</span></p>
            </div>
          </details>
          <div class="video-question-tools">{video_controls(number, list(question.get('videos') or []))}</div>
        </article>'''


def round_positive_fraction(numerator: int, denominator: int) -> int:
    """Match JavaScript Math.round for the positive fractions used by the placement rule."""
    return (2 * numerator + denominator) // (2 * denominator)


def video_ad_positions(question_count: int) -> list[int]:
    if question_count <= 5:
        return []
    if question_count <= 10:
        return [5]
    if question_count <= 15:
        return [5, 10]
    positions = [
        round_positive_fraction(question_count, 4),
        round_positive_fraction(question_count, 2),
        round_positive_fraction(3 * question_count, 4),
    ]
    return sorted({position for position in positions if 0 < position < question_count})


def manual_article_ad(after_question: int) -> str:
    return (
        '        <div class="manual-ad-slot manual-ad-slot--article" '
        f'data-manual-ad="article" data-ad-after-question="{after_question}" hidden></div>'
    )


def render_video_cards(questions: list[dict[str, object]], section_id: str, meta_builder) -> str:
    ad_positions = set(video_ad_positions(len(questions)))
    parts: list[str] = []
    for index, question in enumerate(questions, start=1):
        parts.append(question_card(question, section_id, meta_builder(index, question)))
        if index in ad_positions:
            parts.append(manual_article_ad(index))
    return "\n".join(parts)


def page_href(identifier: str) -> str:
    return f"{identifier}.html"


def genre_nav(genre: dict[str, object], genres: list[dict[str, object]], position: str) -> str:
    same_field = [item for item in genres if item["field_id"] == genre["field_id"]]
    same_field_links = "".join(
        f'<a href="{page_href(str(item["id"]))}"{(" aria-current=\"page\"" if item["id"] == genre["id"] else "")}>{e(item["label"])}</a>'
        for item in same_field
    )
    heading_id = f"genre-navigation-{position}-heading"
    heading_label = "テーマ" if position == "top" else "分野"
    course_link = ""
    if genre["field_id"] == "programming" and position == "top":
        course_link = '<p class="video-genre-course-link"><a href="programming-shortest-course.html">最短学習</a></p>'
    return f'''<section class="video-genre-navigation" aria-labelledby="{heading_id}">
        <h2 id="{heading_id}">{heading_label}</h2>
        <div class="video-genre-links">{same_field_links}</div>
        {course_link}
        <p class="video-genre-back-link"><a href="./">一覧へ</a></p>
      </section>'''


def course_nav(genres: list[dict[str, object]]) -> str:
    programming_genres = [genre for genre in genres if genre["field_id"] == "programming"]
    genre_links = "".join(
        f'<a href="{page_href(str(genre["id"]))}">{e(genre["label"])}</a>'
        for genre in programming_genres
    )
    return f'''<section class="video-genre-navigation" aria-labelledby="course-navigation-heading">
        <h2 id="course-navigation-heading">テーマ</h2>
        <div class="video-genre-links">{genre_links}</div>
        <p class="video-genre-course-link"><a href="programming-shortest-course.html" aria-current="page">最短学習</a></p>
        <p class="video-genre-back-link"><a href="./">一覧へ</a></p>
      </section>'''


def archive_index(fields: list[dict[str, object]], course: dict[str, object]) -> str:
    field_sections = []
    for index, field in enumerate(fields, start=1):
        cards = []
        for genre_index, genre in enumerate(field["genres"], start=1):
            cards.append(
                f'''          <a class="archive-field-card" href="{page_href(str(genre['id']))}">
            <span>{genre_index:02d}</span><div><h3>{e(genre['label'])}</h3><p>{e(genre['description'])}</p><small>{len(genre['questions'])}問・解説動画つき</small></div><b aria-hidden="true">→</b>
          </a>'''
            )
        course_card = ""
        if field["id"] == "programming":
            course_card = f'''<a class="archive-course-card" href="{page_href(str(course['id']))}"><div><p class="eyebrow">SEPARATE COURSE</p><h3>{e(course['label'])}</h3><p>{e(course['description'])}</p><small>{len(course['questions'])}問・指定順で学習</small></div><span class="card-arrow" aria-hidden="true">→</span></a>'''
        field_sections.append(
            f'''      <section class="archive-field-section" id="{e(field['id'])}" aria-labelledby="{e(field['id'])}-heading">
        <div class="section-heading"><div><p class="eyebrow">FIELD {index:02d}</p><h2 id="{e(field['id'])}-heading">{e(field['label'])}</h2></div><p>{e(field['description'])}</p></div>
        <div class="archive-field-grid">{''.join(cards)}</div>
        {course_card}
      </section>'''
        )
    title = "情報Ⅰ Study Atlas｜解説動画一覧"
    description = "情報Ⅰの一問一答330問を、情報社会・情報デザイン・デジタル・ネットワーク・プログラミングの5分野と21ジャンルで学べる解説動画一覧です。"
    schema = structured_data({
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": title,
        "description": description,
        "url": f"{SITE_ORIGIN}archive/",
        "isPartOf": {"@type": "WebSite", "name": "情報Ⅰ Study Atlas", "url": SITE_ORIGIN},
    }) + structured_data(breadcrumb_data([("学習トップ", SITE_ORIGIN), ("解説動画", f"{SITE_ORIGIN}archive/")]))
    return f'''{head(title, description, "archive/")}
{header("archive")}
    <main id="main-content" class="subpage archive-page">
      <nav class="breadcrumb" aria-label="パンくずリスト"><a href="../">学習トップ</a><span aria-hidden="true">/</span><span aria-current="page">解説動画</span></nav>
      <header class="page-hero compact-hero">
        <p class="eyebrow">VIDEO QUESTION ARCHIVE</p>
        <h1>解説動画で学ぶ<br />情報Ⅰ一問一答</h1>
        <p>分野を選び、ジャンルを選び、問題を考える。答えを確かめたあと、必要なときだけ解説動画を開けます。</p>
        <dl class="archive-stats"><div><dt>問題</dt><dd>330問</dd></div><div><dt>分野</dt><dd>5分野</dd></div><div><dt>ジャンル</dt><dd>21ジャンル</dd></div></dl>
      </header>
      <section class="archive-intro" aria-labelledby="archive-fields-heading">
        <div><p class="eyebrow">SELECT A FIELD</p><h2 id="archive-fields-heading">分野から選ぶ</h2></div>
        {''.join(field_sections)}
      </section>
    </main>
    {schema}
{footer()}'''


def genre_page(genre: dict[str, object], genres: list[dict[str, object]]) -> str:
    questions = list(genre["questions"])
    path = f"archive/{genre['id']}.html"
    title = f"情報Ⅰ Study Atlas｜解説動画｜{genre['field_label']}｜{genre['label']}"
    description = f"情報Ⅰ「{genre['field_label']}・{genre['label']}」の一問一答{len(questions)}問。答えを確認し、必要な問題だけ解説動画で学べます。"
    cards = render_video_cards(
        questions,
        str(genre["id"]),
        lambda index, _question: f"{genre['field_label']} · {genre['label']} · QUESTION {index:03d}",
    )
    schema = structured_data({
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": title,
        "description": description,
        "url": f"{SITE_ORIGIN}{path}",
        "inLanguage": "ja",
        "about": ["情報Ⅰ", "大学入学共通テスト", str(genre["field_label"]), str(genre["label"])],
        "numberOfItems": len(questions),
        "isPartOf": {"@type": "WebSite", "name": "情報Ⅰ Study Atlas", "url": SITE_ORIGIN},
    }) + structured_data(breadcrumb_data([
        ("学習トップ", SITE_ORIGIN), ("解説動画", f"{SITE_ORIGIN}archive/"),
        (str(genre["field_label"]), f"{SITE_ORIGIN}archive/#{genre['field_id']}"),
        (str(genre["label"]), f"{SITE_ORIGIN}{path}"),
    ]))
    return f'''{head(title, description, path, ads=True, video_script=True)}
{header("archive")}
    <main id="main-content" class="subpage archive-page">
      {breadcrumb([("学習トップ", "../"), ("解説動画", "./"), (str(genre["field_label"]), f"./#{genre['field_id']}"), (str(genre["label"]), None)])}
      <h1 class="visually-hidden">{e(genre['label'])}</h1>
      {genre_nav(genre, genres, "top")}
      <section class="video-question-list" aria-label="{e(genre['label'])}の問題">{cards}</section>
      {genre_nav(genre, genres, "bottom")}
      <aside class="content-note archive-policy"><h2>学び方</h2><p>まず問題を自分で考え、答えを確認します。詳しく知りたい問題だけ「解説動画を表示」を押してください。</p></aside>
    </main>
    {schema}
{footer()}'''


def course_page(course: dict[str, object], genres: list[dict[str, object]]) -> str:
    questions = list(course["questions"])
    path = f"archive/{course['id']}.html"
    title = f"情報Ⅰ Study Atlas｜解説動画｜{course['label']}"
    description = f"プログラミングの解説動画を指定順の{len(questions)}問で学ぶ最短コースです。"
    cards = render_video_cards(
        questions,
        str(course["id"]),
        lambda index, question: f"COURSE {index:02d}/{len(questions):02d} · Q{int(question['number']):03d}",
    )
    schema = structured_data({
        "@context": "https://schema.org",
        "@type": "Course",
        "name": title,
        "description": description,
        "url": f"{SITE_ORIGIN}{path}",
        "provider": {"@type": "Organization", "name": "情報Ⅰ Study Atlas", "url": SITE_ORIGIN},
        "numberOfItems": len(questions),
    }) + structured_data(breadcrumb_data([
        ("学習トップ", SITE_ORIGIN), ("解説動画", f"{SITE_ORIGIN}archive/"),
        ("プログラミング", f"{SITE_ORIGIN}archive/#programming"), (str(course["label"]), f"{SITE_ORIGIN}{path}"),
    ]))
    return f'''{head(title, description, path, ads=True, video_script=True)}
{header("archive")}
    <main id="main-content" class="subpage archive-page">
      {breadcrumb([("学習トップ", "../"), ("解説動画", "./"), ("プログラミング", "./#programming"), (str(course["label"]), None)])}
      <h1 class="visually-hidden">{e(course['label'])}</h1>
      {course_nav(genres)}
      <section class="video-question-list" aria-label="{e(course['label'])}の問題">{cards}</section>
      <aside class="content-note archive-policy"><h2>コースについて</h2><p>このページは通常のジャンル別一覧とは別に、プログラミングを指定順で進めるための27問を掲載しています。</p></aside>
    </main>
    {schema}
{footer()}'''


def load_curriculum(data: dict[str, object], explanations: dict[str, str]) -> tuple[list[dict[str, object]], dict[str, object]]:
    source_questions = [question for section in data.get("sections", []) for question in section.get("questions", [])]
    if len(source_questions) != 330 or sorted(int(q["number"]) for q in source_questions) != list(range(1, 331)):
        raise ValueError("video-questions.json must contain exactly Q1-Q330")
    by_number = {int(question["number"]): question for question in source_questions}
    if any(not question.get("videos") for question in source_questions):
        raise ValueError("Every video question must have at least one mapped video")
    expected_explanation_keys = {str(number) for number in range(1, 331)}
    if set(explanations) != expected_explanation_keys or any(not str(explanations[key]).strip() for key in expected_explanation_keys):
        raise ValueError("video-explanations.json must contain one non-empty explanation for Q1-Q330")
    by_number = {
        number: {**question, "explanation": explanations[str(number)]}
        for number, question in by_number.items()
    }
    curriculum = json.loads(CURRICULUM_PATH.read_text(encoding="utf-8"))
    fields = curriculum.get("fields") or []
    field_ids = [field.get("id") for field in fields]
    if field_ids != list(EXPECTED_FIELD_GENRES):
        raise ValueError(f"Curriculum field IDs/order are incorrect: {field_ids}")
    genres: list[dict[str, object]] = []
    used: list[int] = []
    for field in fields:
        field_id = str(field["id"])
        field_genres = field.get("genres", [])
        genre_ids = [genre.get("id") for genre in field_genres]
        if genre_ids != EXPECTED_FIELD_GENRES[field_id]:
            raise ValueError(f"Curriculum genre IDs/order are incorrect for {field_id}: {genre_ids}")
        for genre in field_genres:
            numbers = [int(number) for number in genre.get("numbers", [])]
            genre_id = str(genre["id"])
            if numbers != EXPECTED_GENRE_NUMBERS[genre_id]:
                raise ValueError(f"Curriculum numbers are incorrect for {genre_id}: {numbers}")
            used.extend(numbers)
            genres.append({**field, **genre, "field_id": field["id"], "field_label": field["label"], "questions": [by_number[number] for number in numbers]})
    if sorted(used) != list(range(1, 331)):
        raise ValueError("Genre curriculum must cover Q1-Q330 exactly once")
    courses = curriculum.get("courses") or []
    if len(courses) != 1 or courses[0].get("id") != "programming-shortest-course" or courses[0].get("numbers") != EXPECTED_COURSE:
        raise ValueError("Shortest course must match the specified 27-question order")
    course = {**courses[0], "questions": [by_number[number] for number in EXPECTED_COURSE]}
    return genres, course


def main() -> int:
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    if data.get("question_count") != 330:
        raise ValueError("Expected exactly 330 imported video questions")
    explanation_data = json.loads(EXPLANATIONS_PATH.read_text(encoding="utf-8"))
    explanations = explanation_data.get("questions") or {}
    genres, course = load_curriculum(data, explanations)
    fields = []
    for field in json.loads(CURRICULUM_PATH.read_text(encoding="utf-8"))["fields"]:
        fields.append({
            **field,
            "genres": [genre for genre in genres if genre["field_id"] == field["id"]],
        })
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    if OUTPUT_DIR.resolve() != (ROOT / "archive").resolve():
        raise RuntimeError(f"Unexpected output directory: {OUTPUT_DIR.resolve()}")
    for old_page in OUTPUT_DIR.glob("*.html"):
        old_page.unlink()
    for obsolete_data in (OUTPUT_DIR / "filter-data.json",):
        obsolete_data.unlink(missing_ok=True)
    (OUTPUT_DIR / "index.html").write_text(clean_html(archive_index(fields, course)), encoding="utf-8")
    generated_pages = ["archive/index.html"]
    for genre in genres:
        path = f"archive/{genre['id']}.html"
        (ROOT / path).write_text(clean_html(genre_page(genre, genres)), encoding="utf-8")
        generated_pages.append(path)
    course_path = f"archive/{course['id']}.html"
    (ROOT / course_path).write_text(clean_html(course_page(course, genres)), encoding="utf-8")
    generated_pages.append(course_path)
    field_counts = {str(field["id"]): sum(len(genre["questions"]) for genre in field["genres"]) for field in fields}
    genre_counts = {str(genre["id"]): len(genre["questions"]) for genre in genres}
    report = {
        "generated_on": date.today().isoformat(),
        "generator": "scripts/generate_video_pages.py",
        "source": "data/video-questions.json",
        "curriculum_source": "data/video-curriculum.json",
        "question_count": 330,
        "video_count": sum(len(question["videos"]) for section in data["sections"] for question in section["questions"]),
        "field_counts": field_counts,
        "genre_counts": genre_counts,
        "genre_pages": [f"archive/{genre['id']}.html" for genre in genres],
        "course_pages": [course_path],
        "learning_pages": generated_pages,
        "course_question_numbers": EXPECTED_COURSE,
        "explanation_source": "data/video-explanations.json",
        "explanation_count": 330,
        "explanation_text_published": True,
        "explanation_reference_exceptions": [],
        "video_keyword_feature": False,
        "youtube_direct_links_published": False,
        "video_viewer_aspect_ratio": "9:16",
        "programming_code_blocks": sum(1 for genre in genres if genre["field_id"] == "programming" for question in genre["questions"] if question_parts(question, str(genre["id"]))[1]),
    }
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"questions=330 genres={len(genres)} course_questions={len(course['questions'])} pages={len(generated_pages)} videos={report['video_count']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
