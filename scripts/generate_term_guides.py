from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass
from html import escape
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TERMS_ROOT = ROOT / "terms"
OUTPUT_PATH = ROOT / "assets" / "term-guides.js"
INDEX_PATH = TERMS_ROOT / "index.html"
DEFAULT_TAG_LIST_PATH = ROOT / "data" / "term-tag-list.json"
SITE_ORIGIN = "https://mei-chan-nel.com"
TAG_META = "study-atlas-term-tag"
FEATURE_VERSION = "2026110705"


class ExplanationParser(HTMLParser):
    """Only the article heading and explanation; never site chrome or exercises."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.stack: list[tuple[str, bool, bool, bool]] = []
        self.title: list[str] = []
        self.body: list[str] = []

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        parent = self.stack[-1] if self.stack else ("", False, False, False)
        title = parent[1] or attributes.get("id") == "term-heading"
        body = parent[2] or attributes.get("id") == "term-explanation"
        excluded = parent[3] or tag in {"script", "style", "nav", "button"} or bool(
            set(attributes.get("class", "").split()) & {"choice-list", "manual-ad-slot", "term-practice-section"}
        ) or "data-manual-ad" in attributes
        if body and tag in {"p", "h2", "h3", "h4", "li", "br", "tr", "td", "th", "section"}:
            self.body.append("\n")
        if tag not in {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}:
            self.stack.append((tag, title, body, excluded))

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        self.handle_endtag(tag)

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, -1, -1):
            if self.stack[index][0] == tag:
                del self.stack[index:]
                break

    def handle_data(self, data):
        if not self.stack or self.stack[-1][3]:
            return
        if self.stack[-1][1]:
            self.title.append(data)
        if self.stack[-1][2]:
            self.body.append(data)


def enhance_term_page(text: str) -> str:
    """Idempotent shared feature installation for existing and newly imported pages."""
    text = re.sub(r'\n\s*<!-- term-learning:start -->.*?<!-- term-learning:end -->', '', text, flags=re.S)
    controls = '''
        <!-- term-learning:start -->
        <div class="term-page-state" data-term-page-state hidden>
          <button class="term-read-status" type="button" data-term-read-status aria-pressed="false" aria-label="既読にする">未読</button>
          <button class="term-favorite" type="button" data-term-favorite aria-pressed="false" aria-label="お気に入りに登録"><span aria-hidden="true">☆</span></button>
        </div>
        <p class="term-storage-message" data-term-storage-message role="status"></p>
        <!-- term-learning:end -->'''
    text, count = re.subn(r'(<h1\b[^>]*id="term-heading"[^>]*>.*?</h1>)', lambda match: match[1] + controls, text, count=1, flags=re.S)
    if count != 1 or 'id="term-explanation"' not in text:
        raise ValueError("Term page requires term-heading and term-explanation IDs")
    text = re.sub(r'assets/term-page\.css\?v=\d+', f'assets/term-page.css?v={FEATURE_VERSION}', text)
    text = re.sub(r'\n\s*<script src="../../assets/term-(?:state|reader)\.js[^\"]*" defer></script>', '', text)
    scripts = '\n'.join(f'    <script src="../../assets/term-{name}.js?v={FEATURE_VERSION}" defer></script>' for name in ("state", "reader"))
    return re.sub(r'\s*</head>', lambda _: '\n' + scripts + '\n  </head>', text, count=1)


def build_search_data(pages):
    result = {}
    for page in pages:
        parser = ExplanationParser()
        parser.feed(page.path.read_text(encoding="utf-8"))
        title = " ".join("".join(parser.title).split())
        body = "\n".join(" ".join(line.split()) for line in "".join(parser.body).splitlines() if line.strip())
        if not title or not body:
            raise ValueError(f"{page.path}: article title/explanation missing")
        result[page.tag] = {"title": title, "body": body}
    return result


def build_question_tags(app_root: Path, pages):
    questions = json.loads((app_root / "data/questions/completed_questions.json").read_text(encoding="utf-8"))
    tags = {page.tag for page in pages}
    return {question["id"]: list(dict.fromkeys(tag for tag in question["tags"] if tag in tags))
            for question in questions if any(tag in tags for tag in question["tags"])}


class TermMetaParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.values: dict[str, str] = {}

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() != "meta":
            return
        attributes = {name.lower(): value for name, value in attrs if value is not None}
        name = attributes.get("name", "").strip()
        if name != TAG_META:
            return
        self.values[name] = attributes.get("content", "").strip()


@dataclass(frozen=True)
class TermPage:
    path: Path
    tag: str

    @property
    def slug(self) -> str:
        return self.path.parent.name


def read_term_meta(path: Path) -> str:
    parser = TermMetaParser()
    parser.feed(path.read_text(encoding="utf-8"))
    tag = parser.values.get(TAG_META, "").strip()
    if not tag:
        raise ValueError(f"{path.relative_to(ROOT)}: {TAG_META} is required")
    return tag


def scan_term_pages() -> list[TermPage]:
    pages: list[TermPage] = []
    if not TERMS_ROOT.exists():
        return pages
    for path in sorted(TERMS_ROOT.glob("*/index.html")):
        tag = read_term_meta(path)
        pages.append(TermPage(path=path, tag=tag))
    tags = [page.tag for page in pages]
    duplicates = sorted({tag for tag in tags if tags.count(tag) > 1})
    if duplicates:
        raise ValueError(f"Duplicate term tag(s): {', '.join(duplicates)}")
    return pages


def build_registry(pages: list[TermPage] | None = None) -> dict[str, dict[str, str]]:
    pages = scan_term_pages() if pages is None else pages
    return {
        page.tag: {
            "url": f"/terms/{page.slug}/",
        }
        for page in pages
    }


def read_tag_list(path: Path = DEFAULT_TAG_LIST_PATH) -> list[str]:
    if not path.is_file():
        raise ValueError(f"Authoritative tag list not found: {path}")
    if path.suffix.lower() == ".json":
        tags = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(tags, list) or not tags or any(not isinstance(tag, str) or not tag.strip() for tag in tags):
            raise ValueError("Tag list must be a nonempty JSON array of tag names")
        tags = [tag.strip() for tag in tags]
        if len(tags) != len(set(tags)):
            raise ValueError("Tag list contains duplicate tag names")
        return tags
    try:
        from openpyxl import load_workbook
    except ImportError as exc:  # pragma: no cover - depends on the local runtime
        raise ValueError("openpyxl is required to read タグ一覧.xlsx") from exc

    workbook = load_workbook(path, read_only=True, data_only=True)
    try:
        sheet = workbook["タグ一覧"] if "タグ一覧" in workbook.sheetnames else workbook.active
        rows = list(sheet.iter_rows(values_only=True))
    finally:
        workbook.close()
    if not rows:
        raise ValueError(f"Authoritative tag list is empty: {path}")

    header = [str(value).strip() if value is not None else "" for value in rows[0]]
    try:
        no_column = next(index for index, value in enumerate(header) if value in {"No.", "No"})
        tag_column = next(index for index, value in enumerate(header) if value == "タグ")
    except StopIteration as exc:
        raise ValueError(f"Tag list must have No. and タグ columns: {path}") from exc

    entries: list[tuple[int, str]] = []
    for row_number, row in enumerate(rows[1:], start=2):
        if len(row) <= max(no_column, tag_column):
            continue
        no_value = row[no_column]
        tag_value = row[tag_column]
        if no_value is None and tag_value is None:
            continue
        try:
            number = int(no_value)
        except (TypeError, ValueError) as exc:
            raise ValueError(f"Invalid tag number at row {row_number}: {no_value!r}") from exc
        tag = str(tag_value).strip() if tag_value is not None else ""
        if not tag:
            raise ValueError(f"Empty tag at row {row_number}")
        entries.append((number, tag))

    if not entries:
        raise ValueError(f"No tag entries found: {path}")
    numbers = [number for number, _ in entries]
    tags = [tag for _, tag in entries]
    if len(numbers) != len(set(numbers)):
        raise ValueError("Tag list contains duplicate No. values")
    if len(tags) != len(set(tags)):
        duplicates = sorted({tag for tag in tags if tags.count(tag) > 1})
        raise ValueError(f"Tag list contains duplicate tag(s): {', '.join(duplicates)}")
    return [tag for _, tag in sorted(entries, key=lambda entry: entry[0])]


def render(registry: dict[str, dict[str, str]]) -> str:
    payload = json.dumps(
        registry,
        ensure_ascii=False,
        sort_keys=True,
        indent=2,
    )
    return (
        "// Generated by scripts/generate_term_guides.py. Do not edit by hand.\n"
        f"window.StudyAtlasTermGuides = Object.freeze({payload});\n"
    )


def render_term_list(tags: list[str], pages: list[TermPage]) -> str:
    page_by_tag = {page.tag: page for page in pages}
    items: list[str] = []
    for tag in tags:
        page = page_by_tag.get(tag)
        if page is None:
            continue
        label = escape(tag)
        items.append(
            f'<li class="term-list-item is-linked"><a href="./{escape(page.slug)}/">{label}</a></li>'
        )
    list_html = "\n            ".join(items)
    linked_count = sum(tag in page_by_tag for tag in tags)
    return f'''<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <script src="../assets/site-analytics.js?v=2026101201" defer></script>
    <title>用語一覧｜用語解説｜情報Ⅰ Study Atlas</title>
    <meta name="description" content="情報Ⅰ Study Atlasで公開中の用語解説一覧です。情報Ⅰの用語をタグ一覧のNo.順から探せます。" />
    <meta name="theme-color" content="#102f35" />
    <meta property="og:type" content="website" />
    <meta property="og:locale" content="ja_JP" />
    <meta property="og:site_name" content="情報Ⅰ Study Atlas" />
    <meta property="og:title" content="用語一覧｜用語解説｜情報Ⅰ Study Atlas" />
    <meta property="og:description" content="情報Ⅰ Study Atlasの用語解説一覧です。詳しい解説がある用語を探せます。" />
    <meta property="og:url" content="{SITE_ORIGIN}/terms/" />
    <meta property="og:image" content="{SITE_ORIGIN}/assets/og/study-atlas-home-og.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="canonical" href="{SITE_ORIGIN}/terms/" />
    <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="../assets/site.css?v=2026083001" />
    <link rel="stylesheet" href="../assets/term-page.css?v={FEATURE_VERSION}" />
    <script src="../assets/term-state.js?v={FEATURE_VERSION}" defer></script>
    <script src="../assets/term-index.js?v={FEATURE_VERSION}" defer></script>
  </head>
  <body>
    <a class="skip-link" href="#main-content">本文へ移動</a>
    <header class="site-header">
      <div class="header-inner">
        <a class="brand" href="../" aria-label="情報Ⅰ Study Atlas トップ">
          <span class="brand-mark" aria-hidden="true">I</span>
          <span><strong>情報Ⅰ Study Atlas</strong><small>知識を、ひろげ、つなげる</small></span>
        </a>
        <nav class="global-nav" aria-label="メインナビゲーション">
          <a href="../">トップページ</a>
          <a href="../info1-quiz-app/app/">学習アプリ</a>
          <a href="../mock-exams/">実戦演習</a>
          <a href="../lab/">ラボ</a>
          <a href="../info1-quiz-app/questions/">問題を探す</a>
          <a href="./" aria-current="page">用語一覧</a>
          <a href="../program-trace/">プログラムトレース</a>
          <a href="../archive/">解説動画</a>
          <a href="../LectureNote/">講義ノート</a>
        </nav>
      </div>
    </header>

    <main id="main-content" class="subpage terms-index">
      <nav class="breadcrumb" aria-label="パンくずリスト">
        <a href="../">学習トップ</a><span aria-hidden="true">/</span><span aria-current="page">用語一覧</span>
      </nav>

      <header class="page-hero compact-hero">
        <p class="eyebrow">TERM INDEX</p>
        <h1>用語一覧</h1>
      </header>

      <section class="term-list-section" aria-label="用語一覧">
        <div class="term-section-heading">
          <p class="eyebrow">{linked_count} GUIDES</p>
        </div>
        <div class="term-controls" data-term-controls hidden>
          <fieldset>
            <legend class="visually-hidden">表示対象</legend>
            <label><input type="radio" name="term-view" value="recommended" />あなたへのおすすめ</label>
            <label><input type="radio" name="term-view" value="all" checked />用語一覧</label>
          </fieldset>
          <fieldset>
            <legend class="visually-hidden">既読・お気に入りで絞り込み</legend>
            <label><input type="radio" name="term-filter" value="all" checked />すべて</label>
            <label><input type="radio" name="term-filter" value="unread" />未読</label>
            <label><input type="radio" name="term-filter" value="read" />既読</label>
            <label><input type="radio" name="term-filter" value="favorite" />お気に入り</label>
          </fieldset>
          <label class="term-search-label" for="term-search">キーワード検索</label>
          <input id="term-search" type="search" enterkeyhint="search" placeholder="タイトル・解説本文を検索" autocomplete="off" aria-controls="term-results" aria-describedby="term-search-message" />
          <div class="term-data-message"><span id="term-search-message" role="status"></span><button type="button" data-search-retry hidden>検索データを再読み込み</button></div>
          <div class="term-data-message"><span data-recommendation-message role="status"></span><button type="button" data-recommendation-retry hidden>おすすめを再読み込み</button></div>
          <p class="term-storage-message" data-term-storage-message role="status"></p>
        </div>
        <p class="term-result-count" data-term-count role="status">{linked_count}件</p>
        <ul class="term-list" id="term-results">
            {list_html}
        </ul>
      </section>

      <script type="application/ld+json">{{"@context":"https://schema.org","@type":"CollectionPage","name":"用語一覧","description":"情報Ⅰ Study Atlasの用語解説一覧です。","url":"{SITE_ORIGIN}/terms/","inLanguage":"ja","isPartOf":{{"@type":"WebSite","name":"情報Ⅰ Study Atlas","url":"{SITE_ORIGIN}/"}}}}</script>
      <script type="application/ld+json">{{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{{"@type":"ListItem","position":1,"name":"学習トップ","item":"{SITE_ORIGIN}/"}},{{"@type":"ListItem","position":2,"name":"用語一覧","item":"{SITE_ORIGIN}/terms/"}}]}}</script>
    </main>

    <footer class="site-footer">
      <div class="footer-grid">
        <a class="brand footer-brand" href="../" aria-label="情報Ⅰ Study Atlas トップ"><span><strong>情報Ⅰ Study Atlas</strong><small>知識を、ひろげ、つなげる</small></span></a>
        <nav aria-label="フッターナビゲーション">
          <a href="../">トップページ</a>
          <a href="../info1-quiz-app/app/">学習アプリ</a>
          <a href="../mock-exams/">実戦演習</a>
          <a href="../lab/">ラボ</a>
          <a href="../info1-quiz-app/questions/">問題を探す</a>
          <a href="../terms/">用語一覧</a>
          <a href="../program-trace/">プログラムトレース</a>
          <a href="../archive/">解説動画</a>
          <a href="../LectureNote/">講義ノート</a>
          <a href="../about.html">このサイトについて</a>
          <a href="../study-guide.html">使い方</a>
          <a href="../books/">書籍案内</a>
          <a href="../privacy.html">プライバシーポリシー</a>
          <a href="../sitemap.html">サイトマップ</a>
        </nav>
      </div>
      <p class="copyright"><small>&copy; 2026 めいちゃんねる</small></p>
    </footer>
    <script src="../assets/site-header.js?v=20261101-nav-order"></script>
  </body>
</html>
'''


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate the term registry and static term index.")
    parser.add_argument("--tag-list", type=Path, default=DEFAULT_TAG_LIST_PATH)
    parser.add_argument("--update-tag-list", action="store_true", help="Save the supplied Excel tag list to the checked-in JSON snapshot.")
    parser.add_argument("--app-root", type=Path, default=ROOT.parent / "info1-quiz-app")
    parser.add_argument("--check", action="store_true", help="Fail if any generated term artifact is stale.")
    args = parser.parse_args()
    if args.check and args.update_tag_list:
        parser.error("--check cannot be combined with --update-tag-list")

    pages = scan_term_pages()
    tags = read_tag_list(args.tag_list.expanduser().resolve())
    registry = build_registry(pages)
    unknown_page_tags = sorted(set(registry) - set(tags))
    if unknown_page_tags:
        raise SystemExit(
            "Term page tag(s) are not present in the authoritative tag list: "
            + ", ".join(unknown_page_tags)
        )

    if args.update_tag_list:
        if args.tag_list.suffix.lower() != ".xlsx":
            raise SystemExit("--update-tag-list requires --tag-list with the authoritative Excel workbook.")
        DEFAULT_TAG_LIST_PATH.write_text(json.dumps(tags, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    outputs = {OUTPUT_PATH: render(registry), INDEX_PATH: render_term_list(tags, pages)}
    for name, data in (("term-search.json", build_search_data(pages)), ("term-question-tags.json", build_question_tags(args.app_root, pages))):
        outputs[ROOT / "data" / name] = json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n"
    outputs.update({page.path: enhance_term_page(page.path.read_text(encoding="utf-8")) for page in pages})
    stale = []
    for path, content in outputs.items():
        if args.check:
            if not path.is_file() or path.read_text(encoding="utf-8") != content:
                stale.append(str(path.relative_to(ROOT)))
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding="utf-8")
    if stale:
        raise SystemExit("Stale term artifacts: " + ", ".join(stale))
    linked_count = sum(tag in registry for tag in tags)
    print(
        f"Generated {OUTPUT_PATH.relative_to(ROOT)} with {len(registry)} term guide(s); "
        f"{INDEX_PATH.relative_to(ROOT)} with {linked_count} published guide(s) "
        f"from {len(tags)} tag(s)."
    )


if __name__ == "__main__":
    main()
