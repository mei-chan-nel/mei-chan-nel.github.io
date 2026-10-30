"""Approved wording changes. Keep originals in source/ unchanged."""

def normalize_problem_typography(document, section_id):
    """Change presentation only; preserve text and all answer/reading bindings."""
    import re
    from lxml import etree

    def combine(heading, paragraph):
        for name, value in paragraph.attrib.items():
            if name.startswith('data-reading-'):
                values = (heading.get(name, '') + ' ' + value).split()
                heading.set(name, ' '.join(dict.fromkeys(values)))
        heading.text = (heading.text or '') + '　' + (paragraph.text or '')
        for child in list(paragraph):
            heading.append(child)
        heading.tail = paragraph.tail
        paragraph.getparent().remove(paragraph)

    headings = document.xpath('//h1|//h2')
    first = next((e for e in headings if re.match(r'^第[1-4]問', e.text_content())), None)
    if first is not None:
        if section_id == 'q4' and first.getnext() is not None and first.getnext().tag == 'p':
            combine(first, first.getnext())
        match = re.fullmatch(r'(第[1-4]問[AB]?)(.*)', first.text_content())
        if match and not first.xpath('.//*[@class="exam-section-number"]'):
            first.set('class', 'exam-section-heading')
            for child in list(first): first.remove(child)
            first.text = None
            label = etree.SubElement(first, 'span', {'class': 'exam-section-number'})
            label.text, label.tail = match.groups()
    if section_id == 'q4':
        for heading in document.xpath('//h2'):
            if not re.fullmatch(r'問[1-5]', heading.text_content().strip()): continue
            paragraph = heading.getnext()
            if paragraph is None or paragraph.tag != 'p': continue
            # Keep the question number on the same baseline as its prompt.
            heading.tag = 'p'
            heading.set('class', 'exam-question')
            combine(heading, paragraph)


def clean_screen_chrome(document):
    """Run after source-specific XPath bindings have been applied."""
    classes = {'pagehead', 'page-head', 'page-foot', 'page-footer', 'footer',
               'running', 'running-head', 'running-header', 'sheet-header',
               'sheet-footer', 'pagenum', 'page-number', 'version'}
    for element in list(document.iter()):
        if not isinstance(element.tag, str):
            continue
        if classes.intersection(element.get('class', '').split()) and element.getparent() is not None:
            assert not element.xpath('.//*[@data-field or @data-reading-units]')
            element.drop_tree()


def learner_wording(text):
    return (text
            .replace('なお，当てはまる文字がA～Dの場合には，ⓐ～ⓓをそれぞれマークすること。', '')
            .replace('には当てはまる文字をマークせよ。', 'には当てはまる文字を答えよ。')
            .replace('ⓒ（C）', 'C')
            .replace('文字を直接マークする欄', '文字を直接答える欄')
            .replace('エは種類Cに対応するⓒをマークし，', 'エは種類Cを答え，')
            .replace('エはⓒをマークする。', 'エの答えはCである。')
            .replace('正答・解説・検証', '正答・解説'))
