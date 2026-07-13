from __future__ import annotations

import html
import json
import math
import re
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data" / "video-questions.json"
OUTPUT_DIR = ROOT / "archive"
REPORT_PATH = ROOT / "docs" / "video-library-build.json"
SITE_ORIGIN = "https://mei-chan-nel.github.io/"
PAGE_SIZE = 10
ADSENSE = """    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6257644709224446" crossorigin="anonymous"></script>"""
PUBLIC_SECTION_DEFINITIONS = [
    {
        "id": "information-society-design",
        "label": "情報社会・デザイン",
        "source_ids": ("information-society", "information-design"),
        "description": "情報社会の制度・権利・安全と、情報を分かりやすく伝えるための設計を学びます。",
    },
    {
        "id": "digital",
        "label": "デジタル",
        "source_ids": ("digital",),
        "description": "2進数、情報量、文字・画像・音声など、コンピュータ上の表現を確かめます。",
    },
    {
        "id": "network",
        "label": "ネットワーク",
        "source_ids": ("network",),
        "description": "通信の仕組み、インターネット、Web、メール、暗号などを学びます。",
    },
    {
        "id": "programming",
        "label": "プログラミング",
        "source_ids": ("programming",),
        "description": "共通テスト用プログラミング表記に完全対応。基本からシミュレーションまで扱います。",
    },
]


def e(value: object) -> str:
    return html.escape(str(value), quote=True)


def build_public_sections(source_sections: list[dict[str, object]]) -> list[dict[str, object]]:
    by_id = {str(section["id"]): section for section in source_sections}
    public_sections: list[dict[str, object]] = []
    for definition in PUBLIC_SECTION_DEFINITIONS:
        questions: list[dict[str, object]] = []
        for source_id in definition["source_ids"]:
            if source_id not in by_id:
                raise ValueError(f"Missing video-question source section: {source_id}")
            questions.extend(by_id[source_id]["questions"])
        public_sections.append(
            {
                "id": definition["id"],
                "label": definition["label"],
                "description": definition["description"],
                "questions": questions,
            }
        )
    return public_sections


def page_path(section_id: str, page_number: int) -> str:
    suffix = "" if page_number == 1 else f"-{page_number}"
    return f"archive/{section_id}{suffix}.html"


def head(title: str, description: str, canonical_path: str, *, video_script: bool = False) -> str:
    canonical = f"{SITE_ORIGIN}{canonical_path}"
    script = '\n    <script src="../assets/video-embeds.js" defer></script>' if video_script else ""
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
    <meta property="og:url" content="{canonical}" />
    <meta name="twitter:card" content="summary" />
    <link rel="canonical" href="{canonical}" />
    <link rel="icon" href="../assets/favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="../assets/site.css" />
{ADSENSE}{script}
  </head>"""


def header(current: str) -> str:
    links = [
        ("home", "../index.html", "学習トップ"),
        ("questions", "../info1-quiz-app/questions/index.html", "問題一覧"),
        ("archive", "./index.html", "動画問題"),
        ("app", "../info1-quiz-app/app/", "学習アプリ"),
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
        <a class="brand" href="../index.html" aria-label="情報Ⅰ Study Atlas トップ">
          <span class="brand-mark" aria-hidden="true">I</span>
          <span><strong>情報Ⅰ Study Atlas</strong><small>知識問題と解説</small></span>
        </a>
        <nav class="global-nav" aria-label="メインナビゲーション">{nav}</nav>
      </div>
    </header>"""


def footer() -> str:
    return """    <footer class="site-footer">
      <div class="footer-grid">
        <div><p class="footer-brand">情報Ⅰ Study Atlas</p><p class="footer-copy">知識を、ひろげ、つなげる</p></div>
        <nav aria-label="フッターナビゲーション">
          <a href="../info1-quiz-app/questions/index.html">問題一覧</a>
          <a href="./index.html">動画問題</a>
          <a href="../books/index.html">問題集</a>
          <a href="../info1-quiz-app/app/">学習アプリ</a>
          <a href="../about.html">このサイトについて</a>
          <a href="../privacy.html">プライバシーポリシー</a>
          <a href="../sitemap.html">サイトマップ</a>
        </nav>
      </div>
      <p class="copyright"><small>&copy; 2026 めいちゃんねる</small></p>
    </footer>
  </body>
</html>
"""


def pagination(section: dict[str, object], page_number: int, page_count: int) -> str:
    section_id = str(section["id"])
    previous = (
        f'<a class="page-direction" href="{Path(page_path(section_id, page_number - 1)).name}">← 前へ</a>'
        if page_number > 1
        else '<span class="page-direction disabled">← 前へ</span>'
    )
    following = (
        f'<a class="page-direction" href="{Path(page_path(section_id, page_number + 1)).name}">次へ →</a>'
        if page_number < page_count
        else '<span class="page-direction disabled">次へ →</span>'
    )
    visible_numbers = sorted({1, page_count, *range(max(1, page_number - 2), min(page_count, page_number + 2) + 1)})
    number_parts: list[str] = []
    previous_number = 0
    for number in visible_numbers:
        if previous_number and number - previous_number > 1:
            number_parts.append('<span class="page-ellipsis" aria-hidden="true">…</span>')
        if number == page_number:
            number_parts.append(f'<span aria-current="page">{number}</span>')
        else:
            number_parts.append(f'<a href="{Path(page_path(section_id, number)).name}" aria-label="{number}ページ目">{number}</a>')
        previous_number = number
    numbers = "".join(number_parts)
    return f'<nav class="pagination" aria-label="ページ送り">{previous}<div class="page-numbers">{numbers}</div>{following}</nav>'


def video_controls(number: int, videos: list[dict[str, str]]) -> str:
    controls: list[str] = []
    for index, video in enumerate(videos, start=1):
        frame_id = f"video-{number}-{index}"
        suffix = f" {index}" if len(videos) > 1 else ""
        controls.append(
            f"""<div class="video-control">
              <button class="video-trigger" type="button" data-video-id="{e(video['id'])}" data-video-title="{e(video['title'])}" aria-controls="{frame_id}" aria-expanded="false">解説動画を表示{suffix}</button>
              <div class="video-frame" id="{frame_id}" hidden></div>
            </div>"""
        )
    return "\n".join(controls)


def prose_markup(text: str) -> str:
    normalized = text.replace("\r\n", "\n").replace("\r", "\n")
    normalized = re.sub(r"(?<=[。！？])(?=\S)", "\n", normalized)
    normalized = re.sub(r"(?<!^)(?<!\n)(?=(?:ただし|なお)[、，])", "\n", normalized)
    lines = [line.strip() for line in normalized.split("\n") if line.strip()]
    return "<br />\n            ".join(e(line) for line in lines)


def question_markup(question: dict[str, object], section_id: str) -> str:
    text = str(question["question"]).replace("\r\n", "\n").replace("\r", "\n")
    if section_id != "programming":
        return f"<h2>{prose_markup(text)}</h2>"

    lines = text.split("\n")
    code_start = next(
        (
            index
            for index, line in enumerate(lines)
            if re.match(r"^\s*(?:（\d+）|\d+[．.]|プログラム[A-ZＡ-Ｚ])", line)
        ),
        len(lines),
    )
    prose_lines = lines[:code_start]
    code_lines = lines[code_start:]
    heading = prose_markup("\n".join(prose_lines))
    if not heading:
        heading = "プログラムを読み、問いに答えよ。"
    code = "\n".join(line.rstrip() for line in code_lines).strip()
    code_block = (
        f'<pre class="question-code" tabindex="0" aria-label="Q{int(question["number"]):03d}のプログラム"><code>{e(code)}</code></pre>'
        if code
        else ""
    )
    return f"<h2>{heading}</h2>{code_block}"


def question_card(question: dict[str, object], section_id: str) -> str:
    number = int(question["number"])
    keywords = question.get("keywords") or []
    tags = "".join(f"<li>{e(keyword)}</li>" for keyword in keywords)
    return f"""        <article class="video-question-card" id="q-{number}">
          <div class="video-question-meta"><span>QUESTION {number:03d}</span></div>
          {question_markup(question, section_id)}
          <details class="video-answer-panel">
            <summary>答えを見る<span class="detail-icon" aria-hidden="true"></span></summary>
            <div class="video-answer-content"><p><span>答え</span><strong>{e(question['answer'])}</strong></p></div>
          </details>
          <div class="video-question-tools">
            <div class="video-keywords"><span>キーワード</span><ul>{tags}</ul></div>
            {video_controls(number, list(question.get('videos') or []))}
          </div>
        </article>"""


def archive_index(data: dict[str, object]) -> str:
    sections = list(data["sections"])
    cards = []
    for index, section in enumerate(sections, start=1):
        count = len(section["questions"])
        cards.append(
            f"""          <a class="archive-field-card" href="{e(section['id'])}.html">
            <span>{index:02d}</span><div><h2>{e(section['label'])}</h2><p>{e(section['description'])}</p><small>{count}問・解説動画つき</small></div><b aria-hidden="true">→</b>
          </a>"""
        )
    description = "情報Ⅰの一問一答330問を、問題・答え・キーワードとYouTube解説動画で分野別に学べる無料コンテンツです。"
    structured = json.dumps(
        {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "name": "動画で学ぶ 情報Ⅰ一問一答",
            "description": description,
            "url": f"{SITE_ORIGIN}archive/",
            "isPartOf": {"@type": "WebSite", "name": "情報Ⅰ Study Atlas", "url": SITE_ORIGIN},
        },
        ensure_ascii=False,
    )
    return f"""{head('動画で学ぶ 情報Ⅰ一問一答330問 | Study Atlas', description, 'archive/')}
{header('archive')}
    <main id="main-content" class="subpage archive-page">
      <nav class="breadcrumb" aria-label="パンくずリスト"><a href="../index.html">学習トップ</a><span aria-hidden="true">/</span><span aria-current="page">動画問題</span></nav>
      <header class="page-hero compact-hero">
        <p class="eyebrow">VIDEO QUESTION ARCHIVE</p>
        <h1>動画で学ぶ<br />情報Ⅰ一問一答</h1>
        <p>問題を考え、答えを確かめ、必要なときだけ解説動画を開く。情報社会・デザインからプログラミングまで、330問を4分野に整理しました。</p>
        <dl class="archive-stats"><div><dt>問題</dt><dd>330問</dd></div><div><dt>分野</dt><dd>4分野</dd></div><div><dt>掲載</dt><dd>1ページ10問</dd></div></dl>
      </header>
      <section class="archive-intro" aria-labelledby="archive-fields-heading">
        <div><p class="eyebrow">SELECT A FIELD</p><h2 id="archive-fields-heading">分野から選ぶ</h2></div>
        <div class="archive-field-grid">{''.join(cards)}</div>
      </section>
      <aside class="content-note archive-policy"><h2>掲載内容について</h2><p>各問には問題文・答え・キーワード・対応するYouTube動画を掲載しています。書籍に収録した解説本文は掲載していません。動画は「解説動画を表示」を押したときだけ読み込まれます。</p></aside>
      <section class="next-action"><div><p class="eyebrow">MORE QUESTIONS</p><h2>4択問題にも挑戦する</h2><p>完成済みの1,000問を、6分野の問題一覧または知識問題出題アプリで学べます。</p></div><a class="button button-primary" href="../info1-quiz-app/questions/index.html">問題一覧を開く</a></section>
    </main>
    <script type="application/ld+json">{structured}</script>
{footer()}"""


def section_page(section: dict[str, object], page_number: int) -> str:
    questions = list(section["questions"])
    page_count = math.ceil(len(questions) / PAGE_SIZE)
    start = (page_number - 1) * PAGE_SIZE
    page_questions = questions[start : start + PAGE_SIZE]
    first_number = page_questions[0]["number"]
    last_number = page_questions[-1]["number"]
    page_label = f" {page_number}ページ目" if page_number > 1 else ""
    title = f"{section['label']}の一問一答 Q{first_number}〜Q{last_number}{page_label} | 情報Ⅰ"
    description = f"情報Ⅰ「{section['label']}」の一問一答Q{first_number}〜Q{last_number}。答え・キーワード・YouTube解説動画で学べます。解説本文は掲載していません。"
    cards = "\n".join(question_card(question, str(section["id"])) for question in page_questions)
    nav = pagination(section, page_number, page_count)
    path = page_path(str(section["id"]), page_number)
    structured = json.dumps(
        {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "name": title,
            "description": description,
            "url": f"{SITE_ORIGIN}{path}",
            "isPartOf": {"@type": "WebSite", "name": "情報Ⅰ Study Atlas", "url": SITE_ORIGIN},
        },
        ensure_ascii=False,
    )
    return f"""{head(title, description, path, video_script=True)}
{header('archive')}
    <main id="main-content" class="subpage archive-page">
      <nav class="breadcrumb" aria-label="パンくずリスト"><a href="../index.html">学習トップ</a><span aria-hidden="true">/</span><a href="./index.html">動画問題</a><span aria-hidden="true">/</span><span aria-current="page">{e(section['label'])}</span></nav>
      <header class="field-hero archive-field-hero">
        <div><p class="eyebrow">VIDEO QUESTIONS · {page_number:02d}/{page_count:02d}</p><h1>{e(section['label'])}</h1><p>Q{first_number}〜Q{last_number}。まず自分で答えを考え、必要なところだけ解説動画で確かめてください。</p></div>
        <dl><div><dt>このページ</dt><dd>{len(page_questions)}問</dd></div><div><dt>分野全体</dt><dd>{len(questions)}問</dd></div></dl>
      </header>
      {nav}
      <section class="video-question-list" aria-label="{e(section['label'])}の問題">{cards}</section>
      {nav}
      <aside class="content-note archive-policy"><h2>解説本文について</h2><p>このページでは、問題・答え・キーワードと対応動画だけを掲載しています。書籍に収録した解説本文は掲載していません。</p></aside>
    </main>
    <script type="application/ld+json">{structured}</script>
{footer()}"""


def main() -> int:
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    source_sections = list(data.get("sections") or [])
    questions = [question for section in source_sections for question in section.get("questions", [])]
    if data.get("question_count") != 330 or len(questions) != 330:
        raise SystemExit("Expected exactly 330 imported video questions")
    if any("explanation" in question or "解説" in question for question in questions):
        raise SystemExit("Explanation text must not be present in public video-question data")
    if any(not question.get("videos") for question in questions):
        raise SystemExit("Every video question must have at least one mapped video")
    sections = build_public_sections(source_sections)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_root = OUTPUT_DIR.resolve()
    if output_root != (ROOT / "archive").resolve():
        raise SystemExit(f"Unexpected output directory: {output_root}")
    for old_page in OUTPUT_DIR.glob("*.html"):
        old_page.unlink()

    generated_pages = ["archive/index.html"]
    public_data = {**data, "sections": sections}
    (OUTPUT_DIR / "index.html").write_text(archive_index(public_data), encoding="utf-8")
    field_counts: dict[str, int] = {}
    for section in sections:
        count = len(section["questions"])
        field_counts[str(section["id"])] = count
        for page_number in range(1, math.ceil(count / PAGE_SIZE) + 1):
            relative = page_path(str(section["id"]), page_number)
            (ROOT / relative).write_text(section_page(section, page_number), encoding="utf-8")
            generated_pages.append(relative)

    report = {
        "generated_on": date.today().isoformat(),
        "generator": "scripts/generate_video_pages.py",
        "source": "data/video-questions.json",
        "question_count": len(questions),
        "video_count": sum(len(question["videos"]) for question in questions),
        "page_size": PAGE_SIZE,
        "field_counts": field_counts,
        "learning_pages": generated_pages,
        "explanation_text_published": False,
        "keyword_audit": "docs/video-keyword-audit.json",
        "youtube_direct_links_published": False,
        "programming_code_blocks": sum(
            len(section["questions"]) for section in sections if section["id"] == "programming"
        ),
    }
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"questions={len(questions)} pages={len(generated_pages)} videos={report['video_count']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
