"""Assemble No.004 from the five independently authored sections in source/."""
import copy
import hashlib
import json
import re
from pathlib import Path

from lxml import etree, html

import mock_exam_004_q1
import mock_exam_004_q2
import mock_exam_004_q3
import mock_exam_004_q4
from mock_exam_002_tables import align_tables
from mock_exam_editorial import bold_question_numbers, clean_screen_chrome
from normalize_mock_exam_solutions import build as normalize_solutions


OUT = Path(__file__).resolve().parents[1] / "mock-exams/exams/004/1"
SECTIONS = [
    ("q1", "第1問", 20, "Q1_004_problem.htm", "Q1_004_answers.htm", "1.7.0"),
    ("q2a", "第2問A", 15, "Q2A_No004_problem.htm", "Q2A_No004_answers.htm", None),
    ("q2b", "第2問B", 15, "Q2B_004_problem_v1.2.7.html", "Q2B_004_answers_v1.2.7.html", "1.2.7"),
    ("q3", "第3問", 25, "Q3_004_problem_v3.3.2.html", "Q3_004_solution_v3.3.2.html", "3.3.2"),
    ("q4", "第4問", 25, "Q4_004_problem_v3.4.6.html", "Q4_004_explanation_v3.4.6.html", "3.4.6"),
]


def prepare(document, sid, title, kind):
    body = document.find("body")
    body.set("data-section", sid)
    clean_screen_chrome(document)
    for element in document.xpath("//script|//iframe|//object|//embed|//base|//form|//header|//footer|//nav"):
        element.drop_tree()
    for element in document.iter():
        for key, value in list(element.attrib.items()):
            if key.lower().startswith("on") or (key.endswith(("href", "src")) and value.strip().lower().startswith("javascript:")):
                del element.attrib[key]
    for style in document.xpath("//style"):
        style.text = re.sub(r"@font-face\s*\{[^}]*\}", "", style.text or "", flags=re.I)
    for e in document.xpath("//*[@data-field]"):
        previous = e.getprevious()
        if previous is None:
            parent = e.getparent()
            parent.text = (parent.text or "").rstrip(" ") + " "
        else:
            previous.tail = (previous.tail or "").rstrip(" ") + " "
        e.tail = " " + (e.tail or "").lstrip(" ")

    head = document.find("head")
    head.find("title").text = f"No.004　{title}　{'問題' if kind == 'problem' else '正答・解説'}"
    etree.SubElement(head, "meta", name="robots", content="noindex, follow")
    if kind == "problem":
        heading, = body.xpath(".//h1[1]")
        label = " ".join(heading.text_content().split())
        assert label.startswith(title), (sid, label)
        for child in list(heading):
            heading.remove(child)
        heading.set("class", "exam-section-heading")
        heading.text = None
        number = etree.SubElement(heading, "span", {"class": "exam-section-number"})
        number.text = title
        number.tail = "　" + label[len(title):].strip()
        bold_question_numbers(document)
    align_tables(document)


def write_material(document, name, kind, title, screen):
    d = copy.deepcopy(document)
    if screen and name == "q1.html":
        # The booklet starts branch b on a new page. Keep the existing
        # on-screen grouping of the two branches of question 1.
        first, second = d.findall("body/section")[:2]
        first.extend(list(second))
        second.getparent().remove(second)
    base = "../" if screen else ""
    for attr in ("src", "href"):
        for e in d.xpath(f"//*[@{attr}]"):
            if e.get(attr).startswith("assets/"):
                e.set(attr, base + e.get(attr))
    for sheet in ("../../../booklet.css", "no004.css"):
        etree.SubElement(d.find("head"), "link", rel="stylesheet", href=base + sheet)
    if not screen:
        for action in d.xpath('//*[contains(concat(" ",normalize-space(@class)," ")," studio-program-link ")]'):
            action.drop_tree()
        if kind == "solution":
            first = d.xpath('//*[@data-reading-units]')[0]
            heading = etree.Element("h1", {"class": "solution-section-heading"})
            heading.text = f"{title}　正答・解説"
            first.addprevious(heading)
    folder = OUT / "screen" if screen else OUT
    (folder / name).write_text("<!doctype html>\n" + html.tostring(d, encoding="unicode") + "\n")


def build():
    (OUT / "screen").mkdir(exist_ok=True)
    exam = {"schemaVersion": 1, "id": "004", "version": 1, "title": "情報Ⅰ 実戦演習 No.004",
            "durationSeconds": 3600, "maxPoints": 100, "sections": [], "fields": [], "scoring": []}
    for sid, title, points, problem, solution, version in SECTIONS:
        if sid in ("q2a", "q2b"):
            p, s, fields, scoring = mock_exam_004_q2.make(sid)
        else:
            module = {"q1": mock_exam_004_q1, "q3": mock_exam_004_q3, "q4": mock_exam_004_q4}[sid]
            p, s, fields, scoring = module.make()
        assert sum(u["maxPoints"] for u in scoring) == points, sid
        exam["fields"].extend(fields)
        exam["scoring"].extend(scoring)
        section = {"id": sid, "title": title, "maxPoints": points}
        if version:
            section["sourceVersion"] = version
        for kind, source, doc in (("problem", problem, p), ("solution", solution, s)):
            name = sid + ("-solution" if kind == "solution" else "") + ".html"
            prepare(doc, sid, title, kind)
            for screen in (False, True):
                write_material(doc, name, kind, title, screen)
            section[kind] = name
            section["screen" + kind.capitalize()] = "screen/" + name
            section["source" + kind.capitalize()] = "source/" + source
            checksum = hashlib.sha256((OUT / "source" / source).read_bytes()).hexdigest()
            section["sourceSha256" if kind == "problem" else "solutionSha256"] = checksum
        exam["sections"].append(section)
    manifest = OUT / "exam.json"
    manifest.write_text(json.dumps(exam, ensure_ascii=False, indent=2) + "\n")
    normalize_solutions([manifest])


if __name__ == "__main__":
    build()
