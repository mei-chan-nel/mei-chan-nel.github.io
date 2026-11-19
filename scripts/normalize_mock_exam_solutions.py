"""Shared headings and answer-field presentation; scoring stays unchanged."""
from pathlib import Path
from lxml import html, etree
import json,re
ROOT=Path(__file__).resolve().parents[1]/'mock-exams/exams'
CIRCLES='⓪①②③④⑤⑥⑦⑧⑨'
def text(e):return ' '.join(''.join(e.itertext()).split())
def clear(e):
 for child in list(e):e.remove(child)
 e.text=None

def align_explanation_columns(document):
 for table in document.xpath('//table'):
  rows = table.xpath('./tr|./thead/tr|./tbody/tr|./tfoot/tr')
  columns = set()
  for row in rows:
   index = 0
   for cell in row.xpath('./th|./td'):
    if re.search(r'根拠|理由', text(cell)) and (cell.tag == 'th' or row == rows[0]):
     columns.add(index)
    index += int(cell.get('colspan', '1'))
  for row in rows:
   index = 0
   for cell in row.xpath('./th|./td'):
    width = int(cell.get('colspan', '1'))
    if any(col in range(index, index + width) for col in columns):
     cell.set('data-explanation-prose', '')
    index += width

def normalize(document,exam):
 units={u['id']:u for u in exam['scoring']};fields={f['id']:f for f in exam['fields']}
 for anchor in list(document.xpath('//*[@data-reading-units]')):
  if anchor.get('data-solution-heading')=='1':continue
  us=[units[i] for i in anchor.get('data-reading-units').split()]
  labels='・'.join(fields[f]['label'] for u in us for f in u['fields'])
  title=f'問{us[0]["question"]}　{labels}'
  header=etree.Element('h2',{'class':'solution-unit-heading'})
  header.text=title
  if anchor.tag in ('section','div'):
   anchor.insert(0,header);anchor.set('data-solution-heading','1')
   old=header.getnext()
  else:
   for k in list(anchor.attrib):
    if k.startswith('data-reading-'):header.set(k,anchor.attrib.pop(k))
   header.set('data-solution-heading','1');anchor.addprevious(header);old=anchor
  answer=etree.Element('p',{'class':'solution-unit-answer'})
  summaries=[]
  for u in us:
   patterns=[]
   for pattern in u['rule']['patterns']:
    patterns.append('・'.join(fields[f]['label']+'：'+(CIRCLES[int(v)] if fields[f]['type']=='choice' and v.isdigit() and int(v)<10 else v) for f,v in zip(u['fields'],pattern)))
   note='順不同・完答で' if u['rule']['kind']=='unordered' else '完答で' if len(u['fields'])>1 else ''
   summaries.append(' または '.join(patterns)+f'（{note}{u["maxPoints"]}点）')
  etree.SubElement(answer,'strong').text='正答　'+' ／ '.join(summaries)
  header.addnext(answer)
  if old is not None and old.tag in ('h2','h3'):
   value=text(old)
   if re.match(r'^問\d',value):
    value=re.sub(r'^問\d+\s*[a-cａ-ｃ]?\s*[：:　]?\s*','',value)
    if re.fullmatch(r'[ア-ン・\s]+',value) or re.match(r'^[ア-ン・\s]+[：:]\s*[⓪①②③④⑤⑥⑦⑧⑨0-9A-F]',value):old.drop_tree()
    else:
     value=re.sub(r'^[ア-ン・\s]+[：:]\s*','',value)
     old.tag='p';clear(old);old.set('class','solution-topic');old.text=value
  elif old is not None and old.tag=='p' and (not text(old) or re.match(r'^[a-c]?\s*[ア-ン]：',text(old)) and len(text(old))<60):old.drop_tree()
 # Remove only terse duplicate answers; explanations containing answers remain.
 for p in list(document.xpath('//p')):
  value=text(p)
  if p.get('class')=='solution-answer' or (re.match(r'^[a-c]?\s*[ア-ン]：',value) and len(value)<45):p.drop_tree()
 return document

def build(manifests=None):
 for manifest in manifests if manifests is not None else ROOT.glob('*/*/exam.json'):
  exam=json.loads(manifest.read_text())
  for section in exam['sections']:
   for key in ['problem','screenProblem','solution','screenSolution']:
    path=manifest.parent/section[key];d=html.fromstring(path.read_bytes())
    if key in ['solution','screenSolution']:
     normalize(d,exam)
     align_explanation_columns(d)
    fields={f['id']:f for f in exam['fields']}
    for node in d.xpath('//*[@data-field]'):
     node.set('data-input-type',fields[node.get('data-field')]['type'])
    path.write_text('<!doctype html>\n'+html.tostring(d,encoding='unicode'))
if __name__=='__main__':build()
