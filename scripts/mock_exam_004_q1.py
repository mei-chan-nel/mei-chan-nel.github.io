"""Adapt the submitted No.004 Q1 sheets, keeping their figures and paper breaks."""
from pathlib import Path

from lxml import etree, html

from mock_exam_004_tables import append_verdict_table

SOURCE = Path(__file__).resolve().parents[1] / "mock-exams/exams/004/1/source"
CIRCLED = "⓪①②③④⑤⑥⑦⑧⑨"
# The two digits ウ・エ form one ordered answer (12 seconds).
KEY = [
    ("ア", "2", 2, 1), ("イ", "5", 2, 1), ("ウエ", "12", 2, 2),
    ("オ", "3", 2, 2), ("カ", "5", 1, 2), ("キ", "1", 2, 3),
    ("ク", "1", 3, 3), ("ケ", "0", 2, 4), ("コ", "1", 2, 4), ("サ", "1", 2, 4),
]


def unit_id(n):
    return f"q1-{n:02d}"


def text(node):
    return " ".join(node.text_content().split())


def assign_context(nodes, *units):
    for node in nodes:
        node.set("data-reading-for", " ".join(unit_id(n) for n in units))


def bind_choices(container, field):
    if container.tag == "table":
        headings = [text(cell) for cell in container.xpath("./thead/tr/th")[1:]]
        items = container.xpath("./tbody/tr")
        labels = ["、".join(f"{heading}：{text(cell)}" for heading, cell in zip(headings, row[1:]))
                  for row in items]
    else:
        items = container.xpath("./li")
        labels = [text(item[1]) for item in items]
    for i, (item, label) in enumerate(zip(items, labels)):
        mark, = item.xpath('.//span[@class="num"]')
        assert mark.text == str(i)
        mark.text = CIRCLED[i]
        mark.set("class", "option-index")
        item.set("data-choice-fields", field["id"])
        item.set("data-choice-value", str(i))
        field["choices"].append({"value": str(i), "text": label})


def make_problem(fields):
    d = html.fromstring((SOURCE / "Q1_004_problem.htm").read_bytes())
    body = d.find("body")
    pages = d.xpath("//main/section")
    for old in list(body):
        body.remove(old)
    for page in pages:
        body.append(page)
        for footer in page.xpath("./footer"):
            footer.drop_tree()
    # The common PDF builder supplies the subject heading once, for Q1 only.
    for e in pages[0].xpath("./h1|./p[@class='center']"):
        e.drop_tree()
    heading = pages[0][0]
    heading.tag = "h1"
    heading.text = "第1問　次の問い（問1～4）に答えよ。（配点　20）"
    for child in list(heading):
        heading.remove(child)
    for e in d.xpath("//h2"):
        content = e.text_content()
        e.clear()
        e.tag = "p"
        e.set("class", "exam-question")
        e.text = content

    # Each direct-input digit is a separate narrow field, including repeated references.
    for wrapper in d.xpath('//span[@class="box" or @class="digits"]'):
        for inner in list(wrapper):
            label = text(inner)
            inner.tag = "span"
            inner.set("class", "numeric-blank" if fields[label]["type"] == "text" else "blank")
            inner.set("data-field", fields[label]["id"])
            inner.set("data-original", label)
        wrapper.drop_tag()
    for node in d.xpath("//p//span[@data-field]"):
        if node.tail:
            node.tail = node.tail.replace("にそれぞれマークせよ。", "にそれぞれ答えよ。").replace("に当てはまる数字をマークせよ。", "に当てはまる数字を答えよ。")
    groups = [(0, "ol", "ア"), (1, "table", "イ"), (3, "table[last()]", "オ"),
              (4, "table[last()]", "キ"), (5, "table[last()]", "ク"),
              (6, "ol", "ケ"), (7, "ol[1]", "コ"), (7, "ol[2]", "サ")]
    for index, selector, label in groups:
        element, = pages[index].xpath("./" + selector)
        bind_choices(element, fields[label])

    # Align each answer with its own introduction, including when two units share a sheet.
    ranges = [
        (0, 1, 4), (1, 0, 3), (2, 0, 6), (3, 0, 5), (3, 5, 6),
        (4, 0, 7), (5, 0, 7), (6, 0, 6), (7, 0, 4), (7, 4, 8),
    ]
    for n, (page, start, end) in enumerate(ranges, 1):
        blocks = list(pages[page])[start:end]
        blocks[0].set("data-reading-units", unit_id(n))
        assign_context(blocks, n)
    assign_context([heading], 1)
    assign_context(list(pages[2])[:3], 3, 4, 5)
    assign_context(list(pages[3])[:3], 4, 5)
    assign_context(list(pages[4])[:3], 6, 7)
    assign_context(list(pages[6])[:4], 8, 9, 10)
    assign_context(list(pages[7])[:2], 9, 10)

    # Both branches of 問1 fit together on the first A4 page with the subject
    # heading. Keep the remaining question starts on their own sheets.
    pages[0].extend(list(pages[1]))
    body.remove(pages[1])

    # Keep the source's two illustrated app screens legible and the marker on
    # the same baseline as its option. The circle is part of the numeral.
    style = etree.SubElement(d.find("head"), "style")
    style.text = """
ol.choices .option-index { flex:none; align-self:baseline!important;
  height:auto!important; line-height:inherit!important; margin:0!important; }
@media screen and (max-width:600px) {
  ol.choices.compact { grid-template-columns:repeat(2,minmax(0,1fr)); }
}
"""
    return d


def make_solution():
    d = html.fromstring((SOURCE / "Q1_004_answers.htm").read_bytes())
    sheets = d.xpath("//main/section")
    main = d.find(".//main")
    body = d.find("body")
    for old in list(body):
        body.remove(old)
    main.clear()
    main.set("class", "solution")
    body.append(main)
    # Keep the original explanatory tables alongside the reasoning that uses them.
    ranges = [(1, [1]), (1, [3]), (2, [1]), (2, [2]), (2, [4]), (3, [1, 2, 3]),
              (3, [4, 5, 6, 7, 8]), (4, [1]), (4, [2, 3]), (4, [4, 5])]
    blocks = [list(sheet) for sheet in sheets]
    units = []
    for n, (sheet, indexes) in enumerate(ranges, 1):
        unit = etree.SubElement(main, "section", {"class": "explanation-unit",
                                                   "data-reading-units": unit_id(n)})
        units.append(unit)
        for index in indexes:
            node = blocks[sheet][index]
            if node.get("class") == "stem":
                b, = node.xpath("./b")
                node.text = b.tail.strip()
                node.remove(b)
                del node.attrib["class"]
            unit.append(node)
    append_verdict_table(units[0], [
        ("⓪", "誤", "読み込む向きが逆である。実行するプログラムはSSDから主記憶装置へ読み込む。"),
        ("①・③", "誤", "プログラムを読み込む先は主記憶装置であり，命令を実行するのはCPUである。SSDも主記憶装置も命令を実行しない。"),
        ("②", "正", "読み込み先が主記憶装置で，命令を実行する装置がCPUである。"),
    ])
    append_verdict_table(units[1], [
        ("⓪", "誤", "A社の公開鍵で暗号化すると，復号に必要なのはA社の秘密鍵である。受信者のB社はその鍵を持たない。"),
        ("①・④", "誤", "公開鍵と秘密鍵の持ち主が異なるため，復号に使える鍵の組になっていない。"),
        ("②・③・⑥・⑦", "誤", "共通鍵を受信者だけに渡すための暗号化には，受信者の公開鍵を使う。秘密鍵を使うという条件が誤りである。"),
        ("⑤", "正", "B社の公開鍵と秘密鍵は対になっており，B社だけが共通鍵を取り出せる。"),
    ])
    append_verdict_table(units[3], [
        ("⓪", "誤", "P・Rは必要な条件を満たすが，合計は8 × 12 ＋ 16 × 5＝176 Mビットで，最小ではない。"),
        ("①", "誤", "場面ⅡをQにすると毎秒30枚となり，毎秒60枚以上の条件を満たさない。"),
        ("②", "誤", "場面ⅠをRにすると横640画素となり，横1280画素以上の条件を満たさない。"),
        ("③", "正", "Q・Rは各場面の条件を満たし，合計が136 Mビットで最小になる。"),
    ])
    append_verdict_table(units[9], [
        ("⓪", "誤", "元のケーブルで試行Ⅲに成功しているため，ケーブルに異常があるという判断は誤りである。"),
        ("①", "正", "試行Ⅱ・Ⅲを比較すると，H側の元の端子には異常がある。J側の元の端子については，単独で良否を判定できる試行がない。"),
        ("②", "誤", "試行Ⅰの失敗はH側の元の端子の異常だけでも説明できるため，J側の元の端子まで異常とは断定できない。"),
        ("③", "誤", "試行ⅡとⅢで変えたのはH側の端子だけなので，H側の元の端子には異常があると断定できる。"),
    ])
    return d


def make():
    fields = {}
    scoring = []
    for n, (labels, answers, points, question) in enumerate(KEY, 1):
        for letter in labels:
            field = {"id": f"q1-{letter}", "sectionId": "q1", "label": letter}
            if letter in "ウエカ":
                field.update(type="text", allowed="0123456789", maxLength=1)
            else:
                field.update(type="choice", choices=[])
            fields[letter] = field
        scoring.append({"id": unit_id(n), "sectionId": "q1", "question": question,
                        "fields": [fields[letter]["id"] for letter in labels], "maxPoints": points,
                        "rule": {"kind": "exact", "patterns": [list(answers)]}})
    return make_problem(fields), make_solution(), list(fields.values()), scoring
