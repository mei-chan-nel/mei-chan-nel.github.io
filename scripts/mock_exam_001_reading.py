"""No.001's explicit reading anchors. Only screen documents are adapted.

An anchor covers a scoring unit, or units in the same unsplittable sentence.
Shared tables and programs stay intact before their answer-specific choices.
Fail at build time if an author changes the structure without updating the map.
"""
def trim_solution(document, section_id):
    """Approved editorial omissions, shared by screen, PDF and validation."""
    if section_id == 'q2a':
        for heading in document.xpath('//h1[normalize-space()="測定設計と本番との対応"]'):
            sheet = heading.xpath('ancestor::section')[0]
            sheet.getparent().remove(sheet)
    elif section_id == 'q2b':
        for heading in document.xpath('//h2[normalize-space()="測定能力と前後のつながり"]'):
            for node in list(heading.itersiblings()):
                node.getparent().remove(node)
            heading.getparent().remove(heading)
    elif section_id == 'q3':
        for report in document.xpath('//section[contains(concat(" ",normalize-space(@class)," ")," validation ")]'):
            report.getparent().remove(report)
    omit_starts = {
        'q1': ['氏名などを出さないことや', '表3は未公表の案であり'],
        'q2a': ['正答③は問題で定めた処理のまとまりを評価するもの。'],
        'q2b': ['この設問では、PやRが届いていることと', '問1は具体的な計算問題なので'],
        'q4': ['資料の案内や報道は予定・報道内容として扱い'],
    }
    for paragraph in list(document.xpath('//p')):
        text = ''.join(paragraph.itertext()).strip()
        if any(text.startswith(s) for s in omit_starts.get(section_id, [])):
            paragraph.getparent().remove(paragraph)


def mark_problem_fragments(document, section_id, scoring):
    """Select each question and its necessary shared context without duplication.

    Browser extraction reuses the already cached screen document. Original
    ancestors and styles stay intact; no additional request or full exam render.
    """
    b = '/html/body/'
    def sheet(n): return f'section[{n}]'
    def a(n): return f'section[{n}]/div[2]/div'
    def xor(n): return f'main/section[{n}]/div'
    def prog(n): return f'section[{n}]/div'
    def data(n): return f'main/section[{n}]/div[2]'
    if section_id == 'q1':
        spec = [[sheet(1)], [sheet(2)], [sheet(3)], [sheet(4)],
                [sheet(5), sheet(6)+'/p[1]', sheet(6)+'/ol'],
                [sheet(5), sheet(6)+'/p[position()>=2]', sheet(6)+'/table'],
                [sheet(7)],
                [sheet(7)+'/p[position()<=3]', sheet(7)+'/div[2]', sheet(7)+'/table', sheet(8)]]
    elif section_id == 'q2a':
        spec = [[f'section[{n}]/div[2]'] for n in range(1, 6)]
        spec += [[a(5)+'/p[position()<=5]', a(5)+'/div', a(5)+'/table', a(6)]]
    elif section_id == 'q2b':
        common = [xor(1)+'/p[3]', xor(1)+'/p[4]', xor(1)+'/table[1]',
                  xor(2)+'/p[2]', xor(2)+'/figure', xor(2)+'/p[3]']
        spec = [[xor(1)], [xor(1)],
                common+[xor(2)+'/p[1]', xor(2)+'/p[4]', xor(2)+'/fieldset[1]'],
                common+[xor(2)+'/p[1]', xor(2)+'/p[4]', xor(2)+'/p[5]', xor(2)+'/fieldset[2]'],
                common+[xor(3)+'/p[1]', xor(3)+'/fieldset[1]'],
                common+[xor(3)+'/p[position()>=2]', xor(3)+'/fieldset[2]'],
                common+[xor(3)+'/p[2]', xor(4)]]
    elif section_id == 'q3':
        numeric = [prog(1), prog(2)+'/div/p[position()<=3]', prog(2)+'/div/figure']
        choice = [prog(1), prog(2)+'/div/p[position()!=3]', prog(2)+'/div/figure', prog(2)+'/div/div']
        common2 = [prog(1)+'/p', prog(1)+'/div[2]', prog(3), prog(4)+'/figure']
        common3 = [prog(5), prog(6)+'/div']
        spec = [numeric, numeric, choice]
        spec += [common2+[prog(4)+f'/fieldset[{n}]'] for n in range(1, 6)]
        spec += [common3+[prog(6)+'/fieldset[1]'],
                 common3+[prog(6)+'/p[1]'], common3+[prog(6)+'/fieldset[2]']]
        spec += [common3+[prog(6)+'/p[position()>=3]']]*3
    else:
        common = [data(1)+'/p[position()<=3]']
        table1 = [data(2)+'/div[contains(@class,"table1")]']
        spec = [[data(1)], common+[data(2)],
                common+table1+[data(2)+'/p[1]', data(3)+'/p', data(3)+'/figure', data(3)+'/fieldset[1]'],
                common+table1+[data(2)+'/p[1]', data(3)+'/p[1]', data(3)+'/figure', data(3)+'/fieldset[2]'],
                common+table1+[data(4)], common+[data(5)],
                common+table1+[data(6)],
                common+table1+[data(6)+'/p[1]', data(6)+'/div', data(7)+'/div[1]', data(7)+'/p[1]', data(7)+'/fieldset'],
                common+table1+[data(2)+'/p[1]', data(5)+'/p[1]', data(5)+'/figure', data(5)+'/div[2]', data(6)+'/p[1]', data(6)+'/div', data(7)+'/p[2]', data(7)+'/div[2]', data(8)]]
    units = [u for u in scoring if u['sectionId'] == section_id]
    assert len(units) == len(spec)
    for unit, paths in zip(units, spec):
        selected = []
        for path in paths:
            found = document.xpath(b+path)
            assert found, (section_id, unit['id'], path)
            selected.extend(found)
        for node in selected:
            tokens = node.get('data-reading-for', '').split()
            if unit['id'] not in tokens:
                node.set('data-reading-for', ' '.join(tokens+[unit['id']]))
        fields = {e.get('data-field') for node in selected for e in node.iter()}
        assert set(unit['fields']) <= fields, (unit['id'], fields)


def prepare_reading(document, section_id, kind, scoring):
    problem = kind == 'problem'
    prefix = '/html/body'
    mappings = {
        'q1': (
            ['section[1]/p[2]', 'section[2]/p', 'section[3]/p[1]',
             'section[4]/p[1]', 'section[5]/p[1]', 'section[6]/p[2]',
             'section[7]/p[1]', 'section[8]/p[1]'],
            ['section[2]/h2', 'section[2]/p[3]'] +
            [f'section[{i}]/h2' for i in range(3, 9)],
            [[i] for i in range(1, 9)],
        ),
        'q2a': (
            [f'section[{i}]/div[2]/div' for i in range(1, 7)],
            ['section[1]/div[2]/h2[1]', 'section[1]/div[2]/h2[2]',
             'section[2]/div[2]/h2', 'section[3]/div[2]/h2[1]',
             'section[3]/div[2]/h2[2]', 'section[4]/div[2]/h2'],
            [[i] for i in range(1, 7)],
        ),
        'q2b': (
            ['main/section[1]/div/p[6]', 'main/section[1]/div/fieldset',
             'main/section[2]/div/p[1]', 'main/section[2]/div/p[5]',
             'main/section[3]/div/p[1]', 'main/section[3]/div/p[3]',
             'main/section[4]/div/p[1]'],
            ['main/h2[3]', 'main/p[starts-with(normalize-space(.),"サ：")]',
             'main/h2[4]', 'main/p[starts-with(normalize-space(.),"ス：")]',
             'main/h2[5]', 'main/h2[6]', 'main/h2[7]'],
            [[i] for i in range(1, 8)],
        ),
        'q3': (
            ['section[2]/div/div/p[3]', 'section[2]/div/div/p[4]',
             'section[3]/div/div[1]'] +
            [f'section[4]/div/fieldset[{i}]' for i in range(2, 6)] +
            ['section[5]/div/div[1]', 'section[6]/div/p[1]',
             'section[6]/div/fieldset[2]', 'section[6]/div/p[3]'],
            ['main/h2[2]', 'main/p[4]', 'main/h2[3]'] +
            [f'main/section[{i}]' for i in range(2, 6)] +
            ['main/h2[4]', 'main/section[7]', 'main/section[8]', 'main/p[13]'],
            [[1, 2], [3], [4], [5], [6], [7], [8], [9], [10], [11], [12, 13, 14]],
        ),
        'q4': (
            ['main/section[1]/div[2]/h2[2]', 'main/section[2]/div[2]/h2',
             'main/section[3]/div[2]/p[1]', 'main/section[3]/div[2]/fieldset[2]',
             'main/section[4]/div[2]/h2', 'main/section[5]/div[2]/h2',
             'main/section[6]/div[2]/h2', 'main/section[7]/div[2]/*[1]',
             'main/section[8]/div[2]/p[1]'],
            [f'main/section[{i}]' for i in range(1, 10)],
            [[i] for i in range(1, 10)],
        ),
    }
    paths_p, paths_s, groups = mappings[section_id]
    for path, group in zip(paths_p if problem else paths_s, groups):
        found = document.xpath(prefix + '/' + path)
        assert len(found) == 1, (section_id, kind, path, len(found))
        found[0].set('data-reading-units', ' '.join(f'{section_id}-{n:02}' for n in group))

    if not problem:
        if section_id == 'q1':
            document.xpath('/html/body/section[1]')[0].getparent().remove(
                document.xpath('/html/body/section[1]')[0])
        else:
            # Remove only the opening answer list, retain all explanations.
            stop_path = {
                'q2a': prefix + '/section[1]/div[2]/h2[1]',
                'q2b': prefix + '/main/h2[2]',
                'q3': prefix + '/main/h2[2]',
                'q4': prefix + '/main/section[1]',
            }[section_id]
            stop = document.xpath(stop_path)[0]
            for node in list(stop.itersiblings(preceding=True)):
                node.getparent().remove(node)
        if section_id == 'q3':
            # Keep the execution-count explanation next to its question, after
            # the three choice audits, rather than ahead of them in the PDF.
            numeric = document.xpath('//*[@data-reading-units="q3-12 q3-13 q3-14"]')[0]
            trace = numeric.getnext()
            last_audit = document.xpath('//*[@data-reading-units="q3-11"]')[0]
            last_audit.addnext(numeric)
            numeric.addnext(trace)

    anchors = document.xpath('//*[@data-reading-units]')
    actual = [unit for node in anchors for unit in node.get('data-reading-units').split()]
    expected = [u['id'] for u in scoring if u['sectionId'] == section_id]
    assert actual == expected, (section_id, kind, actual, expected)

