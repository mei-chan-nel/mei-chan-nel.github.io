"""Build No.001 integer version 2, preserving all files/history of version 1.

Unchanged sections use v1's reviewed documents; revised source snapshots are
retained here. Q2A is newly authored, with explicit bindings instead of XPath.
"""
from pathlib import Path
from normalize_mock_exam_solutions import build as normalize_solutions
from lxml import html, etree
import copy
import hashlib
import json
import re
import shutil
from mock_exam_editorial import normalize_problem_typography
from normalize_site_metadata import normalize_tree

ROOT = Path(__file__).resolve().parents[1] / 'mock-exams/exams/001'
OLD, OUT = ROOT / '1', ROOT / '2'

TIMES = {'9:00': '9:00:10', '9:04': '9:04:20', '9:05': '9:05:00',
         '9:06': '9:06:30', '9:08': '9:08:10', '9:10': '9:10:00',
         '9:12': '9:12:40', '9:16': '9:16:50'}


def revise_q1(document, solution):
    def revise(text):
        text = re.sub(r'9:(?:00|04|05|06|08|10|12|16)(?![:\d])', lambda m: TIMES[m[0]], text)
        if solution:
            for before, after in [
                ('取得から4分なので', '取得から4分10秒なので'),
                ('取得から6分なので', '取得から6分20秒なので'),
                ('取得から12分なので', '取得から12分30秒なので'),
                ('取得から8分なので', '取得から8分40秒なので'),
                ('取得から8分しか', '取得から8分40秒しか'),
                ('取得から12分が経過', '取得から12分30秒が経過'),
                ('4分が経過したため', '4分10秒が経過したため'),
                ('2分しか経っていない', '2分10秒しか経っていない'),
                ('ちょうど6分が経過', '6分20秒が経過'),
            ]:
                text = text.replace(before, after)
        return text
    for node in document.iter():
        if not isinstance(node.tag, str) or node.tag in ('style', 'script'):
            continue
        if node.text: node.text = revise(node.text)
        if node.tail: node.tail = revise(node.tail)


def revise_q2b(document):
    pages = document.xpath('//main/section')
    assert len(pages) == 4
    previous, last = pages[2:]
    start = next(p for p in previous.xpath('./div/p') if p.text_content().strip().startswith('問4'))
    figure = last.xpath('./div/figure')[0]
    new_page = etree.Element('section', {'class': 'page', 'data-reading-for': 'q2b-06'})
    content = etree.SubElement(new_page, 'div', {'class': 'page-body'})
    # Move the introduction and part a into their own page, so adding Figure 2
    # does not squeeze the earlier question or separate the definition/diagram.
    for node in [start] + list(start.itersiblings()):
        if node.tag == 'div' and 'memo' in node.get('class', ''):
            continue
        content.append(node)
    content.insert(1, figure)
    start.set('data-reading-for', 'q2b-06 q2b-07')
    figure.set('data-reading-for', 'q2b-06 q2b-07')
    previous.set('data-reading-for', 'q2b-05')
    last.addprevious(new_page)
    intro = last.xpath('./div/p')[0]
    intro.text = 'b　Sさんは，復元用のブロックも届かない場合を考えた。図2の方式Ⅱについて，次の問いに答えよ。'
    for child in list(intro): intro.remove(child)
    # Part b still gets the shared definition/diagram in focused mobile reading.
    last.set('data-reading-for', 'q2b-07')


def circled_marks(document):
    for mark in document.xpath('//*[contains(concat(" ", @class, " "), " opt-index ") or contains(concat(" ", @class, " "), " option-index ")]'):
        value = mark.text_content().strip()
        if re.fullmatch('[0-9]', value):
            mark.text = '⓪①②③④⑤⑥⑦⑧⑨'[int(value)]


def write(document, file):
    file.write_text('<!doctype html>\n' + html.tostring(document, encoding='unicode'), encoding='utf8')


def document(file):
    return html.fromstring(file.read_bytes())


def build():
    OUT.mkdir(exist_ok=True)
    (OUT / 'source').mkdir(exist_ok=True)
    (OUT / 'screen').mkdir(exist_ok=True)
    exam = json.loads((OLD / 'exam.json').read_text())
    exam['version'] = 2
    for section in exam['sections']:
        sid = section['id']
        for kind in ('problem', 'solution'):
            source_key = 'source' + kind.capitalize()
            old_source = OLD / section[source_key]
            if sid == 'q2a':
                source = OUT / 'source' / ('Q2A_001_problem_v3.0.0.html' if kind == 'problem' else 'Q2A_001_answers_v3.0.0.html')
                d = document(source)
                etree.SubElement(d.find('head'), 'meta', name='robots', content='noindex, follow')
                etree.SubElement(d.find('head'), 'link', rel='stylesheet', href='../../../booklet.css')
                write(d, OUT / section[kind])
                screen = copy.deepcopy(d)
                for link in screen.xpath('//link[@rel="stylesheet"]'):
                    link.set('href', '../../../../booklet.css' if 'booklet.css' in link.get('href') else '../q2a.css')
                write(screen, OUT / section['screen' + kind.capitalize()])
                section['sourceVersion'] = '3.0.0'
            else:
                source = OUT / section[source_key]
                raw = document(old_source)
                if sid == 'q1': revise_q1(raw, kind == 'solution')
                if sid == 'q2b' and kind == 'problem': revise_q2b(raw)
                if sid in ('q1', 'q2b'):
                    write(raw, source)
                else:
                    shutil.copyfile(old_source, source)
                for file_key in (kind, 'screen' + kind.capitalize()):
                    d = document(OLD / section[file_key])
                    if sid == 'q1': revise_q1(d, kind == 'solution')
                    if sid == 'q2b' and kind == 'problem': revise_q2b(d)
                    circled_marks(d)
                    write(d, OUT / section[file_key])
                if sid == 'q1': section['sourceVersion'] = '1.4.1'
                if sid == 'q2b': section['sourceVersion'] = '1.0.6'
            section[source_key] = 'source/' + source.name
            section['sourceSha256' if kind == 'problem' else 'solutionSha256'] = hashlib.sha256(source.read_bytes()).hexdigest()

    # Rebuild the changed choice text from the new authored question, not old labels.
    q2a = document(OUT / 'q2a.html')
    for field in exam['fields']:
        if field['sectionId'] != 'q2a': continue
        choices = {}
        for node in q2a.xpath('//*[@data-choice-fields]'):
            if field['id'] not in node.get('data-choice-fields').split(): continue
            label = ' '.join(node.text_content().split())
            label = re.sub(r'^[⓪①②③④⑤⑥⑦⑧⑨]\s*', '', label)
            choices[node.get('data-choice-value')] = label
        field['choices'] = [{'value': value, 'text': label} for value, label in choices.items()]

    shutil.copyfile(OUT / 'source/q2a.css', OUT / 'q2a.css')
    for section in exam['sections']:
        for key in ('problem', 'screenProblem'):
            path = OUT / section[key]
            d = document(path)
            normalize_problem_typography(d, section['id'])
            write(d, path)
    (OUT / 'exam.json').write_text(json.dumps(exam, ensure_ascii=False, indent=2) + '\n')
    normalize_tree(OUT)
    normalize_solutions([OUT / "exam.json"])
    # Keep independently reviewed v2 answers/cases separate from generation.
    # Do not overwrite them from the old exam or from scoring patterns.
    assert (OUT / 'source/qa.json').is_file(), 'Add the reviewed v2 QA data'
    print('Built No.001 v2: revised Q2A, seconds in Q1, Q2B Figure 2; version 1 untouched.')


if __name__ == '__main__':
    build()
