"""Adapt the sports-day scoring exercise from No.004's submitted HTML."""
import json
from pathlib import Path
import subprocess

from lxml import etree, html

from mock_exam_004_tables import append_verdict_table


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'mock-exams/exams/004/1/source'
LETTERS = 'アイウエオカキクケコサシ'
CIRCLES = '⓪①②③'
# Independently checked against the rankings and completed programs in the booklet.
ANSWERS = '161131121003'
POINTS = (2, 2, 2, 2, 3, 2, 2, 2, 2, 2, 2, 2)


def text(node):
    return ' '.join(node.text_content().split())


def unit(letter):
    return f'q3-{LETTERS.index(letter) + 1:02}'


def fragments(nodes, letters):
    for node in nodes:
        ids = node.get('data-reading-for', '').split() + [unit(letter) for letter in letters]
        node.set('data-reading-for', ' '.join(dict.fromkeys(ids)))


def bind_choices(letter, rows, labels):
    assert len(rows) == len(labels) == 4
    choices = []
    for i, (node, label) in enumerate(zip(rows, labels)):
        node.set('data-choice-fields', 'q3-' + letter)
        node.set('data-choice-value', str(i))
        choices.append({'value': str(i), 'text': label})
    return choices


def problem_material(doc):
    head = doc.xpath('//h1/strong')[0]
    head.text = '第3問'
    pages = [list(box) for box in doc.xpath('//div[@class="page-body"]')]
    first, second, third, fourth, fifth = pages
    for footer in doc.xpath('//footer'):
        footer.drop_tree()

    # Two short prompts can be separated without duplicating the shared result table.
    a, i = first[-1].xpath('./span')
    a.tail = '組である。'
    next_prompt = html.Element('p')
    next_prompt.text = 'この学級の全４競技の総合得点は'
    next_prompt.append(i)
    first[-1].addnext(next_prompt)
    i.tail = '点である。'
    first[4][-1].tail = first[4][-1].tail.replace('マークせよ', '答えよ')

    # The printed diagram contains the insertion arrows for シ and the formula for サ.
    # Give シ its own prompt after the preceding formula's choices.
    old = fifth[2]
    sa, shi = old.xpath('./span')
    sa.tail, remainder = sa.tail.split('また，')
    last_prompt = html.Element('p')
    last_prompt.text = remainder
    last_prompt.append(shi)
    fifth[-1].addnext(last_prompt)

    choices = {}
    for fieldset in doc.xpath('//fieldset'):
        letter = text(fieldset.xpath('./legend/span')[0])
        rows = fieldset.xpath('.//div[@class="option"]')
        choices[letter] = bind_choices(letter, rows, [text(row[-1]) for row in rows])
    rows = third[1].xpath('.//div[@class="option"]')
    choices['カ'] = bind_choices('カ', rows, [text(row[-1]) for row in rows])
    insertion_labels = {
        'キ': ('(01)行目の前', '(02)行目の後・(03)行目の前', '(03)行目の繰り返しの中', '(03)行目の繰り返しを終えた後・(05)行目の前'),
        'シ': ('(03)行目の後・(04)行目の前', '(05)行目の後・(06)行目の前', '(08)行目の後・(09)行目の前', '全学級の処理後・(10)行目の前'),
    }
    for letter, diagram in zip('キシ', doc.xpath('//figure[contains(@class,"insertable")]')):
        choices[letter] = bind_choices(letter, diagram.xpath('.//div[@class="insert-row"]'), insertion_labels[letter])

    for box in doc.xpath('//span[contains(concat(" ",@class," ")," blank ")]'):
        letter = text(box)
        assert letter in LETTERS
        box.set('data-field', 'q3-' + letter)
        box.set('data-original', letter)
        if box.xpath('ancestor::figure'):
            box.set('data-display', 'content')

    # Each new prompt or answer group owns its anchor. Earlier tables, programs
    # and scores remain available when reading an individual unit in isolation.
    groups = [first[-1], next_prompt, *second[5:], third[0], third[8],
              *fourth[3:6], fifth[2], last_prompt]
    assert len(groups) == len(LETTERS)
    for letter, anchor in zip(LETTERS, groups):
        anchor.set('data-reading-units', unit(letter))
        fragments([anchor], letter)
    fragments(first[:7], LETTERS)
    fragments([first[-1]], 'イ')
    fragments(second[:5], 'ウエオカキクケコ')
    for letter, fieldset in zip('ウエオ', second[5:]):
        fragments([fieldset], letter)
    fragments(third[:2], 'カ')
    fragments(third[2:8], 'キクケコサシ')
    fragments(third[8:] + fourth[:3], 'キクケコ')
    for letter, fieldset in zip('クケコ', fourth[3:6]):
        fragments([fieldset], letter)
    fragments(fourth[6:] + fifth[:5], 'サシ')
    fragments(fifth[5:], 'サ')
    fields = []
    scoring = []
    for i, letter in enumerate(LETTERS):
        field = {'id': 'q3-' + letter, 'sectionId': 'q3', 'label': letter}
        if letter in 'アイ':
            field.update(type='text', allowed='0123456789', maxLength=1)
        else:
            field.update(type='choice', choices=choices[letter])
        fields.append(field)
        scoring.append({'id': unit(letter), 'sectionId': 'q3',
                        'question': 1 if letter in 'アイ' else 2 if letter in 'ウエオカ' else 3,
                        'fields': [field['id']], 'maxPoints': POINTS[i],
                        'rule': {'kind': 'exact', 'patterns': [[ANSWERS[i]]]}})
    return fields, scoring


def studio_links(programs):
    initial = 'maisu = 4\nHaiten = [5, 3, 1, 0]\nJun = [0, 0, 0, 0]\nGoukei = [0, 0, 0, 0]'
    lookup = 'Namae = ["100m走", "綱引き", "玉入れ", "学級対抗リレー"]\nBairitsu = [1, 2, 1, 3]'
    settings = {'kind': 'number', 'integer': True, 'min': 1, 'max': 4, 'minLength': 1,
                'maxLength': 100, 'elementKind': 'number', 'rows': 2, 'columns': 3}
    figures = [1, 3, 5]
    drafts = []
    for num, program in zip(figures, programs):
        inputs = {}
        if num == 5:
            lines = ['Goukei = [15, 19, 21, 8]', 'Relay = [3, 1, 5, 0]']
        else:
            lines = [initial]
            if num == 3:
                lines.append(lookup)
        for row in program.xpath('.//div[@class="code-row"]'):
            statement = text(row.xpath('.//span[@class="statement"]')[0])
            depth = len(row.xpath('.//span[contains(@class,"scope-mark")]'))
            indent = '  ' * depth
            if statement == 'Jun[r] = 【整数を入力】':
                # Studio accepts external input into a variable, then stores it in the array.
                inputs['gakkyu'] = settings
                lines.append(indent + 'gakkyu = 【外部からの入力】')
                statement = 'Jun[r] = gakkyu'
            elif statement == 'kyogi = 【文字列を入力】':
                inputs['kyogi'] = dict(settings, kind='text')
                statement = 'kyogi = 【外部からの入力】'
            lines.append(indent + statement)
        drafts.append({'version': 1, 'title': f'No.004 第3問 完成した図{num}',
                       'source': '\n'.join(lines), 'settings': {'indexBase': 1, 'inputs': inputs}})
    urls = json.loads(subprocess.check_output(
        ['node', str(ROOT/'scripts/mock_exam_studio_links.mjs')], input=json.dumps(drafts), text=True))
    for num, program, url in zip(figures, programs, urls):
        action = html.Element('p', {'class': 'studio-program-link'})
        link = etree.SubElement(action, 'a', href=url, target='_blank', rel='noopener',
                                **{'data-studio-program': f'q3-fig{num}'})
        link.text = 'トレースStudioで動かす ↗'
        if num in [1, 3]:
            etree.SubElement(action, 'small').text = (
                '表２の順に，' + ('競技名と' if num == 3 else '') +
                '１～４位の学級番号を入力します。')
        program.addnext(action)
    return drafts


def solution_material(doc):
    body = doc.find('body')
    for style in body.xpath('./style'):
        doc.find('head').append(style)
    main = body.xpath('./main')[0]
    source = list(main)
    wrong_options = main.xpath('./section/ul')
    assert len(wrong_options) == 10
    programs = main.xpath('./figure')
    for e in source:
        main.remove(e)
    explanations = {
        'ア': '表１で３点が与えられる順位は２位である。表２の綱引きの行で２位の学級を読むと，１組である。',
        'イ': '１組は綱引きと学級対抗リレーが２位，100m走と玉入れが４位である。２位は３点，４位は０点なので，全４競技の合計は３＋３＋０＋０＝６点である。',
        'ウ': '結果票の１位から４位まで，順位 r に対応する位置に学級番号を記録する。例えば綱引きの３位を入力した直後には，Jun[3] に４組の学級番号４が入る。',
        'エ': '順位 r の学級番号は Jun[r] に保存してある。綱引きの３位なら Jun[3] は４なので，k が４になり，次の行で４組の合計に加算できる。',
        'オ': '学級番号 k の合計は Goukei[k]，順位 r に応じた点は Haiten[r] である。綱引きの３位なら，４組のこれまでの合計に Haiten[3] の１点を足す。',
        'カ': '(03)行目の入力と(06)行目の加算は，１枚につき各順位１回ずつ，４枚でそれぞれ４×４＝16回行う。４位でも０点の加算は実行する。(08)行目は結果票をすべて処理した後，４学級について１回ずつ表示する。',
        'キ': 'どの結果票も，競技名を表３の先頭から探す。したがって j = 1 は結果票ごとの繰り返しの中で，競技名を入力した後，検索を始める前に置く。',
        'ク': '比較する二つの値は，今調べている競技名 Namae[j] と，結果票から入力した kyogi である。一致しない間だけ j を１増やせば，一致した位置で止まる。',
        'ケ': '表３では，同じ添字の Namae と Bairitsu が同じ競技を表す。例えば受付順２番目のリレーは表３の４番目で見つかるので，倍率は Bairitsu[4] の３である。',
        'コ': '今回の順位点 Haiten[r] に倍率 b を掛け，これまでの学級別合計 Goukei[k] に足す。例えば２組の合計は，表２の順に５×２＋１×３＋５×１＋１×１＝19点となる。',
        'サ': '今の合計には，すでに旧倍率 mae を掛けたリレーの得点が含まれる。新倍率 b に直すには，学級 k の順位点 Relay[k] に倍率の差（b − mae）を掛けて足す。例えば２組は，３倍の19点から１倍にすると19＋１×（１−３）＝17点になる。',
        'シ': '一つの案では，全学級に同じ旧倍率 mae を使う。４組まで更新し終えたところで mae = b とすれば，次の案の計算を始めるときに，mae と Goukei に反映されている倍率が一致する。',
    }
    for i, letter in enumerate(LETTERS):
        section = etree.SubElement(main, 'section', {'class': 'explanation-unit', 'data-reading-units': unit(letter)})
        etree.SubElement(section, 'p').text = explanations[letter]
        if i >= 2:
            reasons = {text(li)[0]: text(li).split('：', 1)[1] for li in wrong_options[i-2]}
            correct = CIRCLES[int(ANSWERS[i])]
            reasons[correct] = {
                'ウ': '順位を添字にして，その順位の学級番号を格納する。', 'エ': '順位から，今回加点する学級番号を取り出せる。',
                'オ': '学級の合計に，その競技の順位点を加算する。', 'カ': '入力と加算は各16回，最後の表示は４回である。',
                'キ': '結果票を１枚読み込むたび，競技名を調べる前に先頭に戻る。', 'ク': '競技名が一致しない間だけ次の要素へ進む。',
                'ケ': '競技名が見つかった位置の倍率を取り出す。', 'コ': '今回の順位点だけに倍率を掛け，学級別の合計に足す。',
                'サ': '同じ学級の旧倍率分を取り除き，新倍率分を加えられる。', 'シ': 'すべての学級を更新してから，次の案の旧倍率を設定する。',
            }[letter]
            assert set(reasons) == set(CIRCLES)
            append_verdict_table(section, (
                (mark, '正' if mark == correct else '誤', reasons[mark]) for mark in CIRCLES
            ))
        if letter in 'カコシ':
            section.append(programs['カコシ'.index(letter)])
        if letter == 'シ':
            section.append(source[18])
            section.append(source[19])
    return studio_links(programs)


def make():
    problem = html.fromstring((SOURCE/'Q3_004_problem_v3.3.2.html').read_bytes())
    solution = html.fromstring((SOURCE/'Q3_004_solution_v3.3.2.html').read_bytes())
    fields, scoring = problem_material(problem)
    solution_material(solution)
    return problem, solution, fields, scoring
