from __future__ import annotations

import argparse
import html
import re
from pathlib import Path
from collections.abc import Iterable


SITE_NAME = "情報Ⅰ Study Atlas"
FAVICON = '<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml" />'
TITLE_PATTERN = re.compile(r"(<title\b[^>]*>)(.*?)(</title\s*>)", re.IGNORECASE | re.DOTALL)
LINK_PATTERN = re.compile(r"<link\b[^>]*>", re.IGNORECASE | re.DOTALL)
ATTRIBUTE_PATTERN = re.compile(r"([\w:-]+)\s*=\s*([\"'])(.*?)\2", re.DOTALL)
CONTENT_ATTRIBUTE_PATTERN = re.compile(r"(\bcontent\s*=\s*)([\"'])(.*?)\2", re.IGNORECASE | re.DOTALL)
HEAD_END_PATTERN = re.compile(r"</head\s*>", re.IGNORECASE)

BRAND_TOKENS = {"情報Ⅰ Study Atlas", "Study Atlas"}
CATEGORY_NAMES = {
    "情報Ⅰ 用語解説": "用語解説",
    "用語解説": "用語解説",
    "解説動画": "解説動画",
    "講義ノート": "講義ノート",
    "問題を探す": "問題を探す",
    "問題": "問題",
    "問題冊子": "問題冊子",
    "正答・解説": "正答・解説",
    "解答・解説": "解答・解説",
    "解説": "解説",
    "Interactive Lab": "ラボ",
    "ラボ": "ラボ",
}


def normalize_title(value: str) -> str:
    parts = [part.strip() for part in re.split(r"\s*[｜|]\s*", value) if part.strip()]
    parts = [part for part in parts if part not in BRAND_TOKENS]
    parts = [
        part for part in parts
        if not re.fullmatch(r"v\d+(?:\.\d+)+(?:[-+][\w.-]+)?", part, re.IGNORECASE)
    ]
    category_index = next(
        (index for index, part in enumerate(parts) if part in CATEGORY_NAMES),
        None,
    )

    if category_index is None:
        page_name = "：".join(parts)
        if not page_name:
            return SITE_NAME
        return f"{page_name}｜{SITE_NAME}"

    page_parts = [
        part for part in parts
        if part not in CATEGORY_NAMES and part not in BRAND_TOKENS
    ]
    category = CATEGORY_NAMES[parts[category_index]]
    if category == "解説動画" and len(page_parts) > 1:
        page_parts = page_parts[-1:]
    page_name = "：".join(page_parts)
    if page_name == category or not page_name:
        return f"{category}｜{SITE_NAME}"
    return f"{page_name}｜{category}｜{SITE_NAME}"


def _icon_link(tag: str) -> bool:
    attributes = {
        name.lower(): value
        for name, _quote, value in ATTRIBUTE_PATTERN.findall(tag)
    }
    relations = attributes.get("rel", "").lower().split()
    return any(
        relation == "icon"
        or relation == "shortcut"
        or relation == "apple-touch-icon"
        or relation == "mask-icon"
        for relation in relations
    )


def normalize_document(source: str) -> str:
    title_matches = list(TITLE_PATTERN.finditer(source))
    if len(title_matches) != 1 or not HEAD_END_PATTERN.search(source):
        return source

    match = title_matches[0]
    old_title = re.sub(r"\s+", " ", html.unescape(match.group(2))).strip()
    new_title = normalize_title(old_title)
    replacement = f"{match.group(1)}{html.escape(new_title, quote=False)}{match.group(3)}"
    result = f"{source[:match.start()]}{replacement}{source[match.end():]}"

    def normalize_open_graph_title(tag_match: re.Match[str]) -> str:
        tag = tag_match.group(0)
        attributes = {
            name.lower(): value
            for name, _quote, value in ATTRIBUTE_PATTERN.findall(tag)
        }
        if attributes.get("property", "").lower() != "og:title":
            return tag
        return CONTENT_ATTRIBUTE_PATTERN.sub(
            lambda content_match: (
                f"{content_match.group(1)}{content_match.group(2)}"
                f"{html.escape(new_title, quote=False)}{content_match.group(2)}"
            ),
            tag,
            count=1,
        )

    result = re.sub(r"<meta\b[^>]*>", normalize_open_graph_title, result, flags=re.IGNORECASE | re.DOTALL)

    icon_matches = [match for match in LINK_PATTERN.finditer(result) if _icon_link(match.group(0))]
    if icon_matches:
        first = icon_matches[0]
        result = f"{result[:first.start()]}{FAVICON}{result[first.end():]}"
        for match in reversed(icon_matches[1:]):
            result = f"{result[:match.start()]}{result[match.end():]}"
    else:
        head_end = HEAD_END_PATTERN.search(result)
        if head_end:
            line_start = result.rfind("\n", 0, head_end.start()) + 1
            indent = result[line_start:head_end.start()]
            if indent.strip():
                line_start = head_end.start()
                indent = ""
            newline = "\r\n" if "\r\n" in result else "\n"
            result = f"{result[:line_start]}{indent}{FAVICON}{newline}{result[line_start:]}"
    return result


def normalize_paths(paths: Iterable[Path], *, check: bool = False) -> list[Path]:
    changed: list[Path] = []
    for path in paths:
        if not path.is_file() or path.suffix.lower() not in {".html", ".htm"}:
            continue
        if "source" in path.parts:
            continue
        original = path.read_bytes().decode("utf-8")
        normalized = normalize_document(original)
        if normalized != original:
            changed.append(path)
            if not check:
                path.write_bytes(normalized.encode("utf-8"))
    return changed


def normalize_tree(root: Path, *, check: bool = False) -> list[Path]:
    if not root.is_dir():
        raise ValueError(f"Repository directory not found: {root}")
    return normalize_paths(root.rglob("*.html"), check=check)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Normalize Study Atlas page titles and favicons."
    )
    parser.add_argument("--portal-root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--app-root", type=Path)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()

    roots = [args.portal_root.resolve()]
    if args.app_root:
        roots.append(args.app_root.resolve())
    changed = [path for root in roots for path in normalize_tree(root, check=args.check)]
    if args.check and changed:
        for path in changed:
            print(path)
        return 1
    print(f"normalized_pages={len(changed)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
