"""No.001's explicit reading anchors. Only screen documents are adapted.

An anchor covers a scoring unit, or units in the same unsplittable sentence.
Shared tables and programs stay intact before their answer-specific choices.
Fail at build time if an author changes the structure without updating the map.
"""
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
            ['main/h2[3]', 'main/p[6]', 'main/h2[4]', 'main/p[10]',
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

