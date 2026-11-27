"""No.004, Q4: map the nine Old Faithful questions to their figures and solutions."""
from pathlib import Path
import re

from lxml import etree, html

from mock_exam_004_tables import append_verdict_table

OUT = Path(__file__).resolve().parents[1] / 'mock-exams/exams/004/1'
PROBLEM = 'Q4_004_problem_v3.4.6.html'
SOLUTION = 'Q4_004_explanation_v3.4.6.html'
CIRCLES = '⓪①②③'

# Label, source question container, question number, correct choice, points.
KEY = (
    ('ア', 'q1a', 1, 2, 2),
    ('イ', 'q1b', 1, 0, 2),
    ('ウ', 'q2a', 2, 3, 3),
    ('エ', 'q2b', 2, 3, 3),
    ('オ', 'qオ', 3, 2, 3),
    ('カ', 'qカ', 3, 1, 3),
    ('キ', 'qキ', 3, 2, 3),
    ('ク', 'qク', 4, 3, 3),
    ('ケ', 'qケ', 4, 2, 3),
)

CORRECT_REASONS = (
    '平均の約72分は二つの山の間にある。どちらの山に属するかで，平均を使った案内は早すぎたり遅すぎたりする。',
    '直前の間隔71分，継続時間2分9秒，直後の間隔57分が，表1の開始・終了時刻の差と一致する。',
    '下側の点は，左の散布図では右側（直前の間隔が長い），右の散布図では左側（継続時間が短い）に集まっている。',
    '予測に合わない割合は短時間群で約1.4％，長時間群で約3.1％であり，どちらも5％以下である。',
    '全体の相関には二群の位置の違いも表れる。各群内の関係を知るには群別に調べる必要がある。',
    '両群の中央値は5分以下で，長時間群には30分を超える外れ値もある。',
    '実際の二つの値の差は約28分ある。同じ予測値の前後10分に収まる二つの値の差は最大20分なので，少なくとも一方は範囲外になる。',
    '5分以内の割合は方法Cが最も大きい。10分を超える割合はA・B・Cの順に12.2％，11.2％，9.2％で，いずれも約1割である。',
    '長時間群の方法Cで予測した時刻は11時16分なので，その前後10分は11時06分から11時26分までである。',
)

STYLE = """
body { color: #171717; line-height: 1.8; }
p { margin: .8em 0; }
figure { margin: 1em auto; text-align: center; }
figure img { display: block; max-width: 100%; height: auto; margin: auto; }
figcaption, caption { text-align: center; margin: .4em 0; line-height: 1.5; }
table { margin: .65em auto; border-collapse: collapse; font-variant-numeric: tabular-nums; }
th, td { border: 1px solid #666; padding: .3em .65em; text-align: center; }
.method td { text-align: left; }
.method p { margin: 0; }
.branch { margin-right: .7em; }
.formula { margin: .7em 1em; }
.choices { list-style: none; padding: 0; margin: .7em 0 1.2em; }
.choices li { display: grid; grid-template-columns: 1.6em minmax(0,1fr); align-items: baseline; margin: .35em 0; text-align: left; }
.note, .sources { font-size: .92em; }
.explanation-unit h3 { font-size: 1em; margin: 1em 0 .3em; }
@media print {
  figure, table, .choices li { break-inside: avoid; }
  h3 { break-after: avoid; }
}
"""


def document(filename):
    doc = html.fromstring((OUT / 'source' / filename).read_bytes())
    [style] = doc.xpath('/html/head/style')
    style.text = STYLE
    return doc


def unit_id(n):
    return f'q4-{n:02}'


def tag(elements, *numbers):
    """Give focused reading its own prompt, with only applicable supporting material."""
    for element in elements:
        current = element.get('data-reading-for', '').split()
        current.extend(unit_id(n) for n in numbers)
        element.set('data-reading-for', ' '.join(dict.fromkeys(current)))


def extract_figures(doc):
    # Keep native captions and a separate, scalable vector for each graph. The
    # supplied HTML spelling of viewbox/clipPath was case-insensitive in HTML;
    # it needs its canonical capitalization when served as SVG.
    ns = '{http://www.w3.org/2000/svg}'
    src = (OUT / 'source' / PROBLEM).read_text()
    graphs = re.findall(r'<svg\b.*?</svg>', src, re.DOTALL)
    figures = doc.xpath('//figure')
    assert len(graphs) == len(figures) == 5
    asset_folder = OUT / 'assets'
    asset_folder.mkdir(exist_ok=True)
    for n, (raw, figure) in enumerate(zip(graphs, figures), 1):
        svg = etree.fromstring(raw.encode())
        if 'viewbox' in svg.attrib:
            svg.set('viewBox', svg.attrib.pop('viewbox'))
        for node in svg.findall('.//' + ns + 'clippath'):
            node.tag = ns + 'clipPath'
        metadata = svg.find(ns + 'metadata')
        if metadata is not None:
            svg.remove(metadata)
        # OS-specific Japanese sans fonts keep graph axes legible.
        for node in svg.findall('.//' + ns + 'text'):
            node.set('style', node.get('style', '').replace(
                "'Noto Sans CJK JP'", "'Noto Sans CJK JP','Yu Gothic','Hiragino Sans',sans-serif"
            ))
        filename = f'q4-fig{n}.svg'
        (asset_folder / filename).write_bytes(etree.tostring(svg, encoding='utf-8'))
        old = figure.xpath('./div[@class="plot"]')[0]
        width, height = (float(v) for v in svg.get('viewBox').split()[2:])
        image = html.Element('img', src='assets/' + filename, alt=svg.get('aria-label'),
                             width=str(round(width * 4 / 3)), height=str(round(height * 4 / 3)))
        old.getparent().replace(old, image)


def problem_assets():
    doc = document(PROBLEM)
    extract_figures(doc)
    main = doc.find('body/main')
    questions = [list(s) for s in main.findall('section')]
    _, intro = main.findall('p')
    credit = main.find('footer')
    credit.tag = 'p'
    credit.set('class', 'note')
    title = html.Element('h1')
    title.text = '第4問　次の文章を読み，後の問い（問1～4）に答えよ。（配点 25）'
    tag([title, intro], *range(1, 10))

    fields, scoring = [], []
    for n, (letter, original_id, question, correct, points) in enumerate(KEY, 1):
        field_id = 'q4-' + letter
        node = doc.get_element_by_id(original_id)
        node.set('id', 'field-group-' + str(n))
        node.set('data-reading-units', unit_id(n))
        tag([node], n)
        choices = []
        for value, row in enumerate(node.xpath('./ol/li|./div/table/tbody/tr')):
            assert row[0].text_content() == CIRCLES[value]
            if row.tag == 'li':
                label = row[1].text_content()
            else:
                label = '、'.join(f'{name}：{cell.text_content()}' for name, cell in
                                  zip(('直前の噴出間隔', '継続時間', '直後の噴出間隔'), row[1:]))
            row.set('data-choice-fields', field_id)
            row.set('data-choice-value', str(value))
            choices.append({'value': str(value), 'text': label})
        assert len(choices) == 4
        fields.append({'id': field_id, 'sectionId': 'q4', 'label': letter,
                       'type': 'choice', 'choices': choices})
        scoring.append({'id': unit_id(n), 'sectionId': 'q4', 'question': question,
                        'fields': [field_id], 'maxPoints': points,
                        'rule': {'kind': 'exact', 'patterns': [[str(correct)]]}})

    for box in doc.xpath('//span[@class="blank"]'):
        letter = box.text_content()
        assert letter in {f['label'] for f in fields}
        box.set('data-field', 'q4-' + letter)
        box.set('data-original', letter)

    # Display the two C formulas as real, wrapping lines. The manuscript's
    # six-column CSS grid imposed a 650px minimum on this two-column table.
    grid = doc.xpath('//div[@class="regression-grid"]')[0]
    cell = grid.getparent()
    parts = [node.text_content() for node in grid]
    assert len(parts) == 12
    cell.remove(grid)
    for i in (0, 6):
        etree.SubElement(cell, 'p').text = parts[i] + ' '.join(parts[i + 1:i + 6])

    q1, q2, q3, q4 = questions
    tag(q1[:2], 1, 2)
    tag(q1[2:4], 1)
    tag(q1[5:7], 2)
    tag(q1[7:8], *range(2, 10))
    tag(q2[:2], 3, 4)
    tag(q2[2:4], 3, 5)
    tag(q2[5:6], *range(4, 10))
    tag(q2[6:7], 4)
    tag(q3[:2], 5, 6, 7)
    tag(q3[2:4], 5)
    tag(q3[5:12], 6, 7)
    tag(q3[12:14], 6)
    tag(q4[:4], 8, 9)
    tag(q4[4:6], 8)
    tag(q4[7:8], 9)

    # Each page has one coherent task or a defined set of shared resources.
    pages = [
        [title, intro, *q1[:5]], q1[5:],
        q2[:5], q2[5:], q3[:5], q3[5:12], q3[12:],
        q4[:6], [*q4[6:], credit],
    ]
    body = doc.find('body')
    for nodes in pages:
        sheet = etree.SubElement(body, 'section', {'class': 'sheet'})
        for node in nodes:
            sheet.append(node)
    body.remove(main)
    for heading in doc.xpath('//body/section/h2'):
        instruction = heading.getnext()
        assert instruction.tag == 'p'
        instruction.set('class', 'exam-question')
        instruction.text = heading.text_content() + '　' + (instruction.text or '')
        heading.getparent().remove(heading)
    for scroll in doc.xpath('//div[@class="scroll"]'):
        scroll.set('class', 'table-scroll')
    return doc, fields, scoring


def solution_assets():
    doc = document(SOLUTION)
    main = doc.find('body/main')
    units = main.findall('article')
    assert len(units) == len(KEY)
    citation = main.find('h2')
    references = list(citation.itersiblings())
    # Preserve provenance and meaningful transformations of the source dataset.
    # The last paragraph discusses later study design outside the question.
    assert references[-1].text_content().startswith('別の98回での比較は')
    for child in list(main):
        main.remove(child)
    main.set('class', 'solution')
    for n, (article, key, positive) in enumerate(zip(units, KEY, CORRECT_REASONS), 1):
        letter, _, _, correct, _ = key
        assert letter in article[0].text_content() and CIRCLES[correct] in article[0].text_content()
        unit = etree.SubElement(main, 'section', {'class': 'explanation-unit',
                                                  'data-reading-units': unit_id(n)})
        # Present the derivation once; the source prepends a repeated 「考え方」 summary.
        for child in list(article)[2:]:
            if child.tag == 'h4' or child.get('class') == 'distractors':
                continue
            unit.append(child)
        reasons = {li[0].text_content(): li[1].text_content() for li in article.xpath('./ul[@class="distractors"]/li')}
        assert set(reasons) == set(CIRCLES) - {CIRCLES[correct]}
        append_verdict_table(unit, (
            (mark, '正' if i == correct else '誤', positive if i == correct else reasons[mark])
            for i, mark in enumerate(CIRCLES)
        ))

    sources = etree.SubElement(main, 'section', {'class': 'sources'})
    sources.append(citation)
    sources.append(references[0])  # Original paper, MASS dataset and source CSV.
    etree.SubElement(sources, 'p').text = (
        '各回の直後の噴出間隔には，次の行の waiting を使った。'
        '得られた298回のうち，先の200回で予測式を作り，後の98回で結果を比較した。'
        '表1の時刻は初回を9時00分として再構成した。3回目の終了時刻は説明用の値で，集計には用いていない。'
        '継続時間が区分で記録された回は，MASS収録値の2・3・4分を用いた。'
    )
    return doc


def make():
    problem, fields, scoring = problem_assets()
    return problem, solution_assets(), fields, scoring
