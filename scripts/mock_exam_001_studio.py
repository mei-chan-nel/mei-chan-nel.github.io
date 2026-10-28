"""Link completed programs, extracting code directly from their explanations."""
from pathlib import Path
from lxml import etree
import json
import subprocess


def add_studio_links(document):
    programs = document.xpath('//*[contains(concat(" ", @class, " "), " code ")]')
    assert len(programs) == 2
    sources = []
    for program in programs:
        lines = []
        for row in program.xpath('./div[@data-depth]'):
            statement = row.xpath('.//span[@class="statement"]')
            assert len(statement) == 1
            lines.append('  ' * int(row.get('data-depth')) + statement[0].text_content())
        sources.append('\n'.join(lines))
    # Figure 4 continues from Figure 2's final state, with the same arrays and
    # one-based indexes. Keep the external input operation visible in Studio.
    initial = sources[0].splitlines()[:5]
    initial[2] = 'Zaiko = [1, 0, 0]'
    initial[3] = 'Jotai = [1, 1, 0, 1, 0, 0, 0, 1]'
    sources[1] = '# 図2終了時の状態。取消し番号は1，4の順に入力する。\n' + '\n'.join(initial) + '\n\n' + sources[1]
    drafts = [dict(version=1, title=f'No.001 第3問 完成した図{figure}', source=source,
                   settings=dict(indexBase=1, inputs={} if figure == 2 else {'i': dict(kind='number', integer=True, min=1, max=8, minLength=1, maxLength=100, elementKind='number', rows=2, columns=3)}))
              for figure, source in zip([2, 4], sources)]
    helper = Path(__file__).with_name('mock_exam_studio_links.mjs')
    links = json.loads(subprocess.run(['node', str(helper)], input=json.dumps(drafts), text=True, capture_output=True, check=True).stdout)
    for index, (program, link) in enumerate(zip(programs, links)):
        action = etree.Element('p', {'class': 'studio-program-link'})
        a = etree.SubElement(action, 'a', href=link, target='_blank', rel='noopener', **{'data-studio-program': f'q3-fig{2 if index == 0 else 4}'})
        a.text = 'トレースStudioで動かす ↗'
        a.set('title', '新しいタブで開きます')
        if index == 1:
            etree.SubElement(action, 'small').text = '図2終了時から。取消し番号は1，4の順に入力します。'
        program.getparent().addnext(action)
