"""Approved wording changes. Keep originals in source/ unchanged."""


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
