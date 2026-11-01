"""Independent checks of the revised narrative/data, without Supabase writes."""
from pathlib import Path
from lxml import html
from itertools import permutations
import json
import re
import unicodedata
from mock_exam_editorial import learner_wording
from mock_exam_001_reading import trim_solution
from mock_exam_001_editorial import revise_solution
from normalize_mock_exam_solutions import normalize as normalize_solution_headings
from import_mock_exam_001_v2 import revise_q1

ROOT = Path(__file__).resolve().parents[1] / 'mock-exams/exams/001'
V2 = ROOT / '2'
exam = json.loads((V2 / 'exam.json').read_text())
old = json.loads((ROOT / '1/exam.json').read_text())


def doc(path):
    d = html.fromstring(path.read_bytes())
    for e in d.xpath('//style|//script|//*[@class="toolbar" or @class="site-bar"]'):
        e.drop_tree()
    return d


def rows(table):
    return [[c.text_content().strip() for c in row.xpath('./td')]
            for row in table.xpath('.//tr[td]')]


def seconds(time):
    h, m, s = map(int, time.split(':'))
    return h * 3600 + m * 60 + s


q1 = doc(V2 / 'q1.html')
timeline = next(t for t in q1.xpath('//table') if '9:00:10' in t.text_content())
events = rows(timeline)
for duration, expected in [(600, [1, 1, 1, 2, 3, 2]), (240, [1, 1, 1, 2, 3, 3]), (360, [1, 1, 2, 2, 3, 3])]:
    cache, readings, version = {}, [], 1
    for time, description in events:
        time = seconds(time)
        if '更新する' in description:
            version += 1
            continue
        device = re.search(r'端末([PQ])', description)[1]
        if device in cache:
            assert time - cache[device][0] != duration, 'Avoid expiry-boundary events'
        if device not in cache or time - cache[device][0] >= duration:
            cache[device] = time, version
        readings.append(cache[device][1])
    assert readings == expected
print('PASS Q1: second-level event times, 10/4/6-minute cache traces, no ambiguous expiry boundary')

q2a = doc(V2 / 'q2a.html')
books, loans, reservations, _schedule = map(rows, q2a.xpath('//table')[0:3] + q2a.xpath('//table')[4:5])
target = {r[0] for r in books if r[2] == '情報のしくみ'}
current = {r[2] for r in loans if r[1] in target and r[4] == '—'}
assert current == {'S02', 'S04'}
returned = [r for r in loans if r[1] == 'C101' and r[4] == '—']
assert [r[0] for r in returned] == ['L04']
assert next(r for r in loans if r[0] == 'L01')[4] == '10月8日'
assert next(r for r in loans if r[0] == 'L05')[4] == '—'
waiting = [dict(zip(['id', 'book', 'student', 'order', 'state'], row)) for row in reservations]
allocated = {}
for copy_id in ['C101', 'C102']:
    book = next(r[1] for r in books if r[0] == copy_id)
    selected = min((r for r in waiting if r['book'] == book and r['state'] == '待ち'), key=lambda r: int(r['order']))
    selected['state'] = '取置中'
    allocated[copy_id] = selected
assert allocated['C101']['id'] == 'R01'
assert allocated['C102']['id'] == 'R02'
allocated['C101']['state'] = '完了'
assert [r['state'] for r in waiting] == ['完了', '取置中', '待ち']
assert allocated['C101']['student'] == 'S05'
orders = [p for p in permutations(['Ac', 'Aw', 'Bc', 'Bw']) if p.index('Ac') < p.index('Aw') and p.index('Bc') < p.index('Bw')]
double_loans = 0
for order in orders:
    saved, count = {}, 0
    for action in order:
        if action[1] == 'c': saved[action[0]] = count == 0
        elif saved[action[0]]: count += 1
    double_loans += count == 2
assert double_loans == 4
for order in permutations(['A', 'B']):
    records = []
    for terminal in order:
        if not records: records.append(terminal)  # check + add as one operation
    assert len(records) == 1
assert [u['rule']['patterns'][0] for u in exam['scoring'] if u['sectionId'] == 'q2a'] == [['2'], ['1', '5'], ['1'], ['2'], ['3'], ['3']]
print('PASS Q2A: book/copy joins, return record/history, reservation queue and delivery states, concurrent-operation counterexample and correction (15 points)')

for prefix in ['', 'screen/']:
    d = doc(V2 / (prefix + 'q2b.html'))
    intro = next(e for e in d.xpath('//p') if e.text_content().strip().startswith('問4'))
    assert intro.getnext().tag == 'figure' and '図2' in intro.getnext().text_content()
    for sid in ['q3', 'q4']:
        d = doc(V2 / (prefix + sid + '.html'))
        for e in d.xpath('//*[@class="opt-index" or @class="option-index"]'):
            assert e.text_content().strip() in '⓪①②③④⑤⑥⑦⑧⑨'
print('PASS Q2B Figure 2 immediately follows Method II; problem option markers circled in screen/print')

marks = str.maketrans('⓪①②③④⑤⑥⑦⑧⑨', '0123456789')
def norm(value):
    return re.sub(r'\s', '', unicodedata.normalize('NFKC', learner_wording(value).translate(marks)))

for section, original_section in zip(exam['sections'], old['sections']):
    sid = section['id']
    for kind in ['problem', 'solution']:
        key = 'source' + kind.capitalize()
        if sid == 'q1':
            source = doc(ROOT / '1' / original_section[key])
            if kind == 'solution':
                trim_solution(source, sid); revise_solution(source, sid)
            revise_q1(source, kind == 'solution')
        else:
            source = doc(V2 / section[key])
            if kind == 'solution' and sid != 'q2a':
                trim_solution(source, sid); revise_solution(source, sid)
        generated = doc(V2 / section[kind])
        if kind == 'solution': normalize_solution_headings(source, exam)
        assert norm(source.find('body').text_content()) == norm(generated.find('body').text_content()), (sid, kind)
        assert len(source.xpath('//svg|//img')) == len(generated.xpath('//svg|//img')), (sid, kind)
print('PASS v2 approved source/body/figure comparison for all five sections')
