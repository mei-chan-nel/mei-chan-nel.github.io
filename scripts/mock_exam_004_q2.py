"""Adapt the evacuation-map and mail-classification papers supplied for No.004."""
from pathlib import Path
from lxml import etree, html

from mock_exam_004_tables import append_verdict_table

SOURCE = Path(__file__).resolve().parents[1] / 'mock-exams/exams/004/1/source'
CIRCLES = '⓪①②③④⑤⑥⑦⑧⑨'
WIDTH = str.maketrans('０１２３４５６７８９ＡＢＫＰＱＲ', '0123456789ABKPQR')

# label, question, points, correct response. Each of these answers is independent.
PARTS = {
    'q2a': [('ア', 1, 2, '2'), ('イ', 2, 2, '3'), ('ウ', 2, 2, '0'),
            ('エ', 3, 2, '1'), ('オ', 3, 2, '2'), ('カ', 4, 2, '1'), ('キ', 4, 3, '3')],
    'q2b': [('コ', 1, 3, '2'), ('サ', 2, 2, '0'), ('シ', 2, 2, '3'),
            ('ス', 3, 4, '2'), ('セ', 4, 2, '3'), ('ソ', 4, 2, '0')],
}
NAMES = {
    'q2a': ('Q2A_No004_problem.htm', 'Q2A_No004_answers.htm'),
    'q2b': ('Q2B_004_problem_v1.2.7.html', 'Q2B_004_answers_v1.2.7.html'),
}


def read_source(name):
    document = html.fromstring((SOURCE / name).read_bytes())
    for node in document.xpath('//nav|//footer|//div[@class="running"]'):
        node.drop_tree()
    for node in document.find('body').iter():
        if node.text:
            node.text = node.text.translate(WIDTH)
        if node.tail:
            node.tail = node.tail.translate(WIDTH)
    return document


def unit_id(section, index):
    return f'{section}-{index:02}'


def reading_content(section, elements, *units):
    for node in elements:
        current = node.get('data-reading-for', '').split()
        ids = [unit_id(section, index) for index in units]
        node.set('data-reading-for', ' '.join(dict.fromkeys(current + ids)))


def reading_start(section, node, unit):
    node.set('data-reading-units', unit_id(section, unit))


def question_pages(document, sid):
    if sid == 'q2b':
        # Both sections should expose the same paper structure to the screen and PDF engines.
        document.find('.//main').drop_tag()
        for article in document.xpath('//section/article'):
            article.drop_tag()
    pages = document.xpath('//body/section')
    for page in pages:
        page.set('class', 'sheet')
    opening = pages[0][0]
    pages[0].remove(pages[0][1])
    opening.clear()
    opening.tag = 'h1'
    opening.text = f'第2問{sid[-1].upper()}　次の文章を読み，後の問い（問1～問4）に答えよ。（配点15）'
    for label in document.xpath('//b[@class="question-number"]|//strong[@class="q"]'):
        label.tag = 'span'
        label.attrib.clear()
        label.set('data-question-number', 'true')
        label.tail = '　' + (label.tail or '').lstrip()
        # Align subsequent lines to the normal prose margin.
        label.getparent().set('class', 'exam-question')
    return pages


def register_choices(field, nodes):
    for i, node in enumerate(nodes):
        if node.tag == 'tr':
            cells = node.xpath('./td')
            label = f'16時2分：{cells[1].text_content()}、16時28分：{cells[2].text_content()}'
        else:
            mark, answer = list(node)
            mark.text = CIRCLES[i]
            # Source B draws an extra circle around a plain number. Use a single glyph.
            mark.set('class', 'choice-index')
            label = answer.text_content().strip()
        node.set('data-choice-fields', field['id'])
        node.set('data-choice-value', str(i))
        field['choices'].append({'value': str(i), 'text': label})
    assert len(field['choices']) == 4, field['id']


def bind_problem_a(document, fields):
    sid = 'q2a'
    pages = question_pages(document, sid)
    prompts = document.xpath('//p[@class="q"]')
    assert len(prompts) == len(fields)
    for i, (field, prompt) in enumerate(zip(fields, prompts), 1):
        group = prompt.getnext()
        nodes = group.xpath('./tbody/tr') if group.tag == 'table' else group.xpath('./li')
        register_choices(field, nodes)
        reading_start(sid, prompt, i)
        reading_content(sid, [prompt, group], i)
    # Pair each stem and its figures with the first answer that uses them.
    reading_content(sid, list(pages[0])[:2], *range(1, 8))
    reading_content(sid, list(pages[0])[2:-2], 1)
    reading_content(sid, list(pages[1])[:3], 2, 3)
    reading_content(sid, [pages[2][0]], 4, 5)
    reading_content(sid, list(pages[2])[3:-2], 5)
    reading_content(sid, list(pages[3])[:2], 6, 7)
    reading_content(sid, list(pages[3])[2:-2], 6)
    reading_content(sid, list(pages[4])[:-2], 7)


def bind_problem_b(document, fields):
    sid = 'q2b'
    pages = question_pages(document, sid)
    groups = document.xpath('//fieldset')
    assert len(groups) == len(fields) - 1
    for field, group in zip(fields[1:], groups):
        register_choices(field, group.xpath('./div/div'))
    for unit, node in enumerate([pages[0][-2], pages[1][3], pages[1][5], pages[2][4],
                                 pages[3][5], pages[3][7]], 1):
        reading_start(sid, node, unit)
    reading_content(sid, list(pages[0])[:4], *range(1, 7))
    reading_content(sid, list(pages[0])[4:], 1)
    reading_content(sid, [pages[1][0]], 2, 3)
    reading_content(sid, list(pages[1])[1:3], 2, 3, 4)
    reading_content(sid, list(pages[1])[3:5], 2)
    reading_content(sid, list(pages[1])[5:], 3)
    reading_content(sid, list(pages[2]), 4)
    reading_content(sid, list(pages[3])[:5], 5, 6)
    reading_content(sid, list(pages[3])[5:7], 5)
    reading_content(sid, list(pages[3])[7:], 6)
    direct = pages[0].xpath('.//*[@class="blank digit"]')[0]
    direct.tail = direct.tail.replace('数字をマークせよ', '数字を答えよ')


def solution_base(source):
    body = source.find('body')
    for child in list(body):
        body.remove(child)
    return etree.SubElement(body, 'main', {'class': 'solution'})


def new_unit(main, sid, index, *paragraphs):
    unit = etree.SubElement(main, 'section', {'class': 'explanation-unit'})
    reading_start(sid, unit, index)
    for line in paragraphs:
        etree.SubElement(unit, 'p').text = line
    return unit


def choice_reasons(unit, correct, reasons):
    """Keep the verdict visible and the justification in its own left-aligned cell."""
    append_verdict_table(unit, (
        (CIRCLES[i], '正' if i == correct else '誤', reason)
        for i, reason in enumerate(reasons)
    ))


def solution_a(document):
    comparison = document.xpath('//table')[1]
    main = solution_base(document)
    unit = new_unit(main, 'q2a', 1, '西会館は開設済みで，混雑状況だけが未確認である。東体育館では開設状況も混雑状況も未確認である。この違いを地図に表せるかを考える。')
    choice_reasons(unit, 2, [
        '混雑を報告していない西会館や東体育館が地図から消えるため，所在地を確かめられない。',
        '混雑状況の報告がないだけでは，「空きあり」とは判断できない。',
        '全施設の所在地を残し，開設・混雑の2項目を分けると，各項目で報告が届いたかを示せる。',
        '開設の報告がないだけでは，「未開設」とは判断できない。',
    ])
    unit = new_unit(main, 'q2a', 2,
        '9時22分に，9時20分に確認した「混雑」の報告が届く。9時29分に届く「やや混雑」は，それよりも古い9時14分の報告だが，受信するたびに更新する画面ではこちらが表示される。',
        '9時33分に9時32分の報告が届くと，画面と，確認時刻が最も新しい報告の区分が再び一致する。異なるのは③の9時29分から9時33分の直前までである。⓪～②の時間帯には，まだ古い報告による上書きは起きていない。')
    unit = new_unit(main, 'q2a', 3, '区分の新旧は，到着順ではなく現地で確認した時刻で比べる。区分が変わらなくても，より新しい確認があれば表示時刻を更新する。')
    choice_reasons(unit, 0, [
        '9時14分の報告による上書きを防げる。9時36分には，区分は同じ「やや混雑」のまま，確認時刻を新しくできる。',
        '区分の変化を条件にすると，9時36分の報告を受けても表示時刻が9時32分のまま残る。',
        '受信時刻で新旧を決めると，9時29分に古い報告が表示を上書きする。',
        '受信時刻を表示すると，住民に伝えたい現地での確認時刻が分からない。',
    ])
    unit = new_unit(main, 'q2a', 4, '調べたいのは，ある施設の画面と現地が，調査時刻に一致していたかどうかである。場所と時刻をそろえて2種類の記録を比べる。')
    choice_reasons(unit, 1, [
        '表示とそのもとになった報告だけを比べても，調査時刻の現地を確認できない。',
        '同じ施設・同じ時刻の画面の区分と現地の区分を直接比較できる。',
        '調査後に届く報告は，調査時刻に住民が見た表示の記録にはならない。',
        '前後に届いた2件の報告からは，調査時刻の画面と現地が一致していたかは分からない。',
    ])
    unit = new_unit(main, 'q2a', 5,
        '注意が表示される施設数は，経過時間が基準以上の行の「施設数」を足す。注意が表示されず，区分が一致しない施設数は，基準未満の行の「一致しなかった施設数」を足す。',
        '例えば基準が15分なら，注意を表示するのは5＋5＝10施設で，表示せずに不一致となるのは0＋1＝1施設である。')
    unit.append(comparison)
    etree.SubElement(unit, 'p').text = '③の20分では不一致が3施設残り，条件を満たさない。条件を満たす⓪・①・②で注意を表示する施設数は順に30，18，10なので，最も少ない②の15分を選ぶ。'
    new_unit(main, 'q2a', 6,
        '16時2分は再開設の2分後である。再開設後に確認した報告はまだ届いておらず，表示は「混雑は未確認」である。閉鎖前の「空きあり」は引き継がないため，⓪・③はここで除ける。',
        '16時7分に「空きあり」となる。16時10分に届くのは閉鎖前の11時57分に確認した報告なので，更新の対象外である。16時25分に届く「やや混雑」が反映され，16時28分にもその表示が続く。したがって①が正しく，②は後の表示が合わない。')
    unit = new_unit(main, 'q2a', 7,
        '検査Ⅰでは，閉鎖前に確認したPが表示に使われている。検査Ⅱでは，再開設後に受信した順はR → Qだが，確認時刻が新しいRの区分が表示されている。両方を説明する不具合を選ぶ。')
    choice_reasons(unit, 3, [
        '検査Ⅰで最初に届いたPを除外すると「混雑は未確認」のままで，表4と合わない。',
        '最後に届いた報告で上書きすると，検査ⅡはQの「空きあり」になり，表4と合わない。',
        '更新対象を決める判定は正しいため，検査ⅠのPは対象外のままになる。',
        '閉鎖前のPも対象に入るので検査Ⅰは「空きあり」となる。対象に入った報告は確認時刻で比べるため，検査ⅡはRの「やや混雑」となる。',
    ])


def solution_b(document):
    _, thresholds, options, classified = document.xpath('//table')
    main = solution_base(document)
    new_unit(main, 'q2b', 1,
        '「当選」があるのは本文で，件名にはないため0点。件名の「無料」は2回出てくるが，同じ特徴なので加点は1回の1点である。本文のURLも2個で1点となる。合計は0＋1＋1＝2点である。')
    unit = new_unit(main, 'q2b', 2,
        '基準値を2点にすると2点以上のメールを隔離する。表2で2点・3点・4点の列を足すと，通常メールは10＋4＋0＝14通，迷惑メールは10＋18＋20＝48通である。')
    choice_reasons(unit, 0, [
        '誤隔離率は通常メール50通のうち14通で28％，検出率は迷惑メール50通のうち48通で96％である。',
        '検出率56％は表2の合計と合わない。基準値を下げると隔離対象が増えるため，検出率は変更前の76％を下回らない。',
        '全100通を分母にしている。二つの割合の分母はそれぞれ50通である。',
        '8％と76％は，基準値が変更前の3点の場合の値である。',
    ])
    unit = new_unit(main, 'q2b', 3,
        '候補ごとに，基準値以上の通常メールと迷惑メールの通数をそれぞれ50で割り，二つの条件と照らし合わせる。')
    unit.append(thresholds)
    etree.SubElement(unit, 'p').text = '1点・2点は誤隔離率が10％を超え，3点・4点は検出率が90％に届かない。二つの条件を同時に満たす候補はないので，③が正しい。'
    unit = new_unit(main, 'q2b', 4,
        '3点以上を隔離した時点で，通常メールは4通，迷惑メールは38通である。通常メールの隔離を5通以下，迷惑メールの隔離を45通以上にするには，2点のメールから通常メールをあと1通以下，迷惑メールをあと7通以上隔離する必要がある。',
        '表3で甲（通常1通・迷惑8通）だけを加えると，それぞれ5通と46通になる。「当選」がないと「無料」とURLの両方があっても2点どまりなので，3点以上には必ず「当選」がある。2点で「当選」があるのは甲だけである。したがって②の規則でちょうど3点以上と甲を隔離できる。')
    unit.append(options)
    etree.SubElement(unit, 'p').text = '⓪は甲を隔離しないため，検出率が76％にとどまる。①は乙まで隔離するため，誤隔離率が28％になる。③は甲を逃し，1点のメールや乙も隔離するため，どちらの条件も満たさない。'
    unit = new_unit(main, 'q2b', 5,
        'まず連絡先への登録を確かめる。登録済みなら受信箱へ入れ，未登録のときだけ問3の規則で振り分ける。')
    unit.append(classified)
    choice_reasons(unit, 3, [
        '表4にある通常メールと迷惑メールは各2通で，通数はそろっている。',
        '「は」と「に」は登録済みなので，どちらも受信箱に入る。',
        'URLが共通でも，ほかに異なる特徴が見つかれば区別できる可能性がある。',
        '使っている四つの特徴がすべて同じなので，2通は同じ受信箱に入る。「は」は通常メールだが，「に」は迷惑メールなので，後者の判定が誤る。',
    ])
    new_unit(main, 'q2b', 6,
        '登録済みなら，メールの内容を調べる前に受信箱へ入れる。そのため，登録済みのアドレスから届いた迷惑メールも必ず受信箱に入る。表4の「に」が該当するので，⓪が正しい。',
        '①の登録済みの通常メールは隔離されない。②・③の未登録のメールには問3の規則をそのまま使うので，問3と振り分け先が逆になることはない。')


def make(sid):
    problem, solution = [read_source(name) for name in NAMES[sid]]
    fields, scoring = [], []
    for i, (label, question, points, answer) in enumerate(PARTS[sid], 1):
        fid = f'{sid}-{label}'
        direct = sid == 'q2b' and label == 'コ'
        fields.append({'id': fid, 'label': label, 'sectionId': sid,
                       **({'type': 'text', 'allowed': '0123456789', 'maxLength': 1} if direct
                          else {'type': 'choice', 'choices': []})})
        scoring.append({'id': unit_id(sid, i), 'sectionId': sid, 'question': question,
                        'fields': [fid], 'maxPoints': points,
                        'rule': {'kind': 'exact', 'patterns': [[answer]]}})
    if sid == 'q2a':
        bind_problem_a(problem, fields)
        solution_a(solution)
    else:
        bind_problem_b(problem, fields)
        solution_b(solution)
    labels = {field['label']: field for field in fields}
    for node in problem.xpath('//*[@class="mark" or @class="blank" or @class="blank digit"]'):
        label = node.text_content()
        node.set('data-field', labels[label]['id'])
        node.set('data-original', label)
    return problem, solution, fields, scoring
