from __future__ import annotations

import json
import math
import re
import sys
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
APP_ROOT = ROOT.parent / "info1-quiz-app"
REPORT_PATH = ROOT / "docs" / "reports" / "manual-ads-validation.json"
ADSENSE_LOADER = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6257644709224446"
MANUAL_LOADER = "manual-ads.js?v=2026080901"
LECTURE_FIELDS = ("society", "digital", "network", "statistics", "programming")


def video_positions(question_count: int) -> list[int]:
    if question_count <= 5:
        return []
    if question_count <= 10:
        return [5]
    if question_count <= 15:
        return [5, 10]
    return [
        math.floor(question_count / 4 + 0.5),
        math.floor(question_count / 2 + 0.5),
        math.floor(3 * question_count / 4 + 0.5),
    ]


def lecture_positions(section_count: int) -> list[int]:
    return list(range(3, section_count, 3))


def count_tokens_in_order(text: str, content_pattern: str, position_attribute: str) -> tuple[int, list[int]]:
    token_pattern = re.compile(
        rf"(?:{content_pattern})|(?:{re.escape(position_attribute)}=\"(\d+)\")"
    )
    content_count = 0
    positions: list[int] = []
    for match in token_pattern.finditer(text):
        if match.group(1) is None:
            content_count += 1
        else:
            declared_position = int(match.group(1))
            positions.append(declared_position)
            if declared_position != content_count:
                positions.append(-content_count)
    return content_count, positions


def require_target_loaders(path: Path, text: str, errors: list[str]) -> None:
    label = path.relative_to(path.parents[1]).as_posix()
    if text.count(ADSENSE_LOADER) != 1:
        errors.append(f"{label}: AdSense common loader must appear exactly once")
    if text.count(MANUAL_LOADER) != 1:
        errors.append(f"{label}: manual initializer must appear exactly once")
    if '<ins class="adsbygoogle"' in text or re.search(r'data-ad-slot="\d+"', text):
        errors.append(f"{label}: static HTML must not contain a fabricated or pre-initialized ad unit")


def main() -> int:
    errors: list[str] = []
    page_table: list[dict[str, object]] = []

    boundary_expectations = {
        1: [], 5: [], 6: [5], 10: [5], 11: [5, 10], 15: [5, 10],
        16: [4, 8, 12], 17: [4, 9, 13], 18: [5, 9, 14],
        21: [5, 11, 16], 25: [6, 13, 19], 27: [7, 14, 20],
        35: [9, 18, 26], 40: [10, 20, 30],
    }
    for question_count, expected in boundary_expectations.items():
        actual = video_positions(question_count)
        if actual != expected:
            errors.append(f"video boundary N={question_count}: expected {expected}, found {actual}")

    target_paths: set[Path] = set()

    video_paths = sorted(path for path in (ROOT / "archive").glob("*.html") if path.name != "index.html")
    if len(video_paths) != 22:
        errors.append(f"archive/: expected 22 individual video pages, found {len(video_paths)}")
    for path in video_paths:
        text = path.read_text(encoding="utf-8")
        target_paths.add(path.resolve())
        require_target_loaders(path, text, errors)
        count, actual_positions = count_tokens_in_order(
            text,
            r'<article class="video-question-card"',
            "data-ad-after-question",
        )
        expected_positions = video_positions(count)
        if actual_positions != expected_positions:
            errors.append(f"archive/{path.name}: expected ads after {expected_positions}, found {actual_positions}")
        if expected_positions and expected_positions[-1] >= count:
            errors.append(f"archive/{path.name}: an ad would appear after the final question")
        page_table.append({
            "path": f"archive/{path.name}",
            "format": "in-article",
            "content_count": count,
            "ad_count": len(actual_positions),
            "positions_after": actual_positions,
        })

    for field in LECTURE_FIELDS:
        path = ROOT / "LectureNote" / f"{field}.html"
        text = path.read_text(encoding="utf-8")
        target_paths.add(path.resolve())
        require_target_loaders(path, text, errors)
        count, actual_positions = count_tokens_in_order(
            text,
            r'<section class="lecture-section"',
            "data-ad-after-section",
        )
        expected_positions = lecture_positions(count)
        if actual_positions != expected_positions:
            errors.append(f"LectureNote/{field}.html: expected ads after {expected_positions}, found {actual_positions}")
        if len(actual_positions) != (count - 1) // 3:
            errors.append(f"LectureNote/{field}.html: ad count must equal floor((S-1)/3)")
        page_table.append({
            "path": f"LectureNote/{field}.html",
            "format": "in-article",
            "content_count": count,
            "ad_count": len(actual_positions),
            "positions_after": actual_positions,
        })

    app_path = APP_ROOT / "app" / "index.html"
    app_text = app_path.read_text(encoding="utf-8")
    target_paths.add(app_path.resolve())
    require_target_loaders(app_path, app_text, errors)
    if app_text.count('data-manual-ad="display"') != 1:
        errors.append("app/index.html: expected exactly one display wrapper")
    try:
        if not (app_text.index("</main>") < app_text.index('data-ad-placement="after-app-main"') < app_text.index("<footer")):
            errors.append("app/index.html: display wrapper must be after main and before footer")
    except ValueError:
        errors.append("app/index.html: required main/ad/footer placement markers are missing")
    page_table.append({
        "path": "info1-quiz-app/app/index.html",
        "format": "responsive-display",
        "content_count": None,
        "ad_count": app_text.count('data-manual-ad="display"'),
        "positions_after": ["app main"],
    })

    questions_path = APP_ROOT / "questions" / "index.html"
    questions_text = questions_path.read_text(encoding="utf-8")
    target_paths.add(questions_path.resolve())
    require_target_loaders(questions_path, questions_text, errors)
    if questions_text.count('data-manual-ad="display"') != 1:
        errors.append("questions/index.html: expected exactly one display wrapper")
    try:
        controls_position = questions_text.index("data-tag-challenge-controls")
        ad_position = questions_text.index('data-ad-placement="after-tag-challenge-controls"')
        result_noscript_position = questions_text.index(
            '<noscript><p class="filter-message"',
            ad_position,
        )
        question_list_position = questions_text.index('class="filter-result-list"')
        if not (
            controls_position
            < ad_position
            < result_noscript_position
            < question_list_position
        ):
            errors.append("questions/index.html: display wrapper must be after random controls and before the question list")
    except ValueError:
        errors.append("questions/index.html: required controls/ad/list placement markers are missing")
    page_table.append({
        "path": "info1-quiz-app/questions/index.html",
        "format": "responsive-display",
        "content_count": len(re.findall(r'data-filter-question\b', questions_text)),
        "ad_count": questions_text.count('data-manual-ad="display"'),
        "positions_after": ["random-question controls"],
    })

    for repository_root in (ROOT, APP_ROOT):
        for path in repository_root.rglob("*.html"):
            if path.resolve() in target_paths:
                continue
            text = path.read_text(encoding="utf-8", errors="ignore")
            forbidden = [
                token for token in (ADSENSE_LOADER, MANUAL_LOADER, 'data-manual-ad=', '<ins class="adsbygoogle"')
                if token in text
            ]
            if forbidden:
                errors.append(f"{path.relative_to(repository_root).as_posix()}: targetless page contains AdSense markers {forbidden}")

    manual_js_path = ROOT / "assets" / "manual-ads.js"
    manual_js = manual_js_path.read_text(encoding="utf-8")
    slot_configuration: dict[str, str | None] = {}
    for kind in ("display", "article"):
        match = re.search(rf'\b{kind}:\s*"([^"]+)"', manual_js)
        slot_configuration[kind] = match.group(1) if match else None
        if match is None:
            errors.append(f"assets/manual-ads.js: {kind} slot configuration is missing")

    placeholder_configuration = {
        "display": "REPLACE_WITH_DISPLAY_AD_SLOT",
        "article": "REPLACE_WITH_IN_ARTICLE_AD_SLOT",
    }
    placeholders = slot_configuration == placeholder_configuration
    configured = all(
        isinstance(value, str) and re.fullmatch(r"\d+", value)
        for value in slot_configuration.values()
    )
    if not placeholders and not configured:
        errors.append(
            "assets/manual-ads.js: display and article slots must both be placeholders "
            "or both be numeric AdSense slot IDs"
        )

    for marker in (
        'const SLOT_PATTERN = /^\\d+$/',
        'data-ad-status',
        'dataset.adInitialized',
        'DOMContentLoaded',
    ):
        if marker not in manual_js:
            errors.append(f"assets/manual-ads.js: required safety/configuration marker is missing: {marker}")
    unsupported_delivery_heuristics = (
        "setInterval",
        "setTimeout",
        "getBoundingClientRect",
        "offsetHeight",
    )
    if manual_js.count(".push({})") != 1 or any(
        marker in manual_js for marker in unsupported_delivery_heuristics
    ):
        errors.append(
            "assets/manual-ads.js: units must initialize once without a refresh loop, "
            "timer, or height-based delivery heuristic"
        )

    for css_path in (ROOT / "assets" / "site.css", ROOT / "LectureNote" / "lecture-note.css"):
        css = css_path.read_text(encoding="utf-8")
        for marker in (".manual-ad-slot[hidden]", 'ins.adsbygoogle[data-ad-status="unfilled"]', "margin: 40px auto"):
            if marker not in css:
                errors.append(f"{css_path.relative_to(ROOT)}: required manual-ad style is missing: {marker}")

    report = {
        "status": "pass" if not errors else "fail",
        "validated_on": date.today().isoformat(),
        "publisher_id": "ca-pub-6257644709224446",
        "slot_configuration": slot_configuration,
        "target_pages": len(page_table),
        "boundary_tests": boundary_expectations,
        "pages": page_table,
        "errors": errors,
    }
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for error in errors:
        print(f"ERROR: {error}", file=sys.stderr)
    print(f"status={report['status']} target_pages={len(page_table)} errors={len(errors)}")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
