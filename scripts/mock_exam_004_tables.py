"""Choice-by-choice explanations in the No.004 booklet and reader."""
from lxml import etree


def append_verdict_table(unit, entries):
    table = etree.SubElement(unit, "table", {"class": "choice-reasons"})
    head = etree.SubElement(etree.SubElement(table, "thead"), "tr")
    for title in ("選択肢", "正誤", "判断の根拠"):
        etree.SubElement(head, "th", scope="col").text = title
    rows = etree.SubElement(table, "tbody")
    for marks, verdict, reason in entries:
        row = etree.SubElement(rows, "tr")
        for value in (marks, verdict, reason):
            etree.SubElement(row, "td").text = value
        row[-1].set("data-column-align", "left")
