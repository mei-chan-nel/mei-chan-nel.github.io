"""Column alignment by content: labels/counts centered, explanations left aligned."""
import re

def align_tables(document):
 for table in document.xpath('//table'):
  rows=table.xpath('.//tr'); width=max((len(r.xpath('./th|./td')) for r in rows),default=0)
  for col in range(width):
   cells=[r.xpath('./td')[col] for r in rows if len(r.xpath('./td'))>col]
   values=[' '.join(c.text_content().split()) for c in cells]
   left=any(len(v)>18 or '。' in v or re.search(r'[=<>\[\]]',v) for v in values)
   for cell in cells:cell.set('data-column-align','left' if left else 'center')
  for cell in table.xpath('.//th'):cell.set('data-column-align','center')
