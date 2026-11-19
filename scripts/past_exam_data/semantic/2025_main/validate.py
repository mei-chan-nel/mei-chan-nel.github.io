from pathlib import Path
import json,sys,unicodedata,re
from lxml import html
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[3]
sys.path.insert(0,str(ROOT/'scripts'));import import_past_exams as I
import fitz
meta=json.loads((ROOT/'scripts/past_exam_data/2025_main.json').read_text());doc=fitz.open(ROOT/'mock-exams/exams/2025Honshi/1/source/problem.pdf')
found=set();expected={f['id'] for f in meta['fields']};choicefields=set();pages=[];counts={'tables':0,'programs':0,'choices':0,'figures':0}
for sid in ['q1','q2a','q2b','q3','q4']:
 d=html.fragment_fromstring((HERE/(sid+'.html')).read_text(),create_parent='div')
 assert not d.xpath('.//*[@data-reading-units or @data-reading-for]')
 assert not d.xpath('.//details|.//img|.//svg|.//*[contains(@class,"past-line")]')
 fields={f['label']:f for f in meta['fields'] if f['sectionId']==sid}
 for b in d.xpath('.//*[@data-field]'):
  assert b.tag=='span' and b.get('class')=='blank' and b.get('data-field') in expected
  assert b.text==b.get('data-original');found.add(b.get('data-field'))
 for p in d.xpath('./section'):
  assert p.get('class')=='page';pages.append(int(p.get('data-source-page')))
 for g in d.xpath('.//fieldset[@class="choices"]'):
  assert len(g.xpath('./legend'))==1 and len(g.xpath('./div[@class="choice-grid"]'))==1;counts['choices']+=1
 for option in d.xpath('.//*[@data-choice-fields]'):
  assert option.get('class')=='option';value=option.get('data-choice-value');actual=I.norm(option.xpath('string(./span[@class="option-text"])'))
  for fid in option.get('data-choice-fields').split():
   choicefields.add(fid);f=next(f for f in meta['fields'] if f['id']==fid);c=next(c for c in f['choices'] if c['value']==value)
   assert actual==I.norm(c['text']),(fid,value,actual,c['text'])
  assert option.xpath('string(./span[@class="option-number"])')=='⓪①②③④⑤⑥⑦⑧⑨'[int(value)]
 for fig in d.xpath('.//figure[@class="past-diagram"]'):
  counts['figures']+=1;pn=int(fig.get('data-pdf-page'));r=fitz.Rect(list(map(float,fig.get('data-pdf-clip').split())))
  assert len(fig.xpath('./figcaption'))==1 and not fig.xpath('./img')
  for line in I.page_data(doc,doc[pn-1]):
   if line['text'].startswith('図') and r.intersects(line['bbox']):raise AssertionError(('caption inside diagram crop',pn,line['text']))
  assert not [b for b in I.find_boxes(doc[pn-1],I.page_data(doc,doc[pn-1]),fields) if r.contains(b['rect'].tl+(b['rect'].br-b['rect'].tl)*.5)]
 for program in d.xpath('.//div[@class="program"]'):
  counts['programs']+=1;rows=program.xpath('./div[@class="code"]/div[contains(@class,"code-row")]');assert len(rows) in [7,11]
  for i,row in enumerate(rows,1):assert row.xpath('string(./span[@class="ln"])')==f'({i:02})' and row.get('data-depth') is not None
 counts['tables']+=len(d.xpath('.//table'))
assert found==expected,(expected-found,found-expected)
assert choicefields=={f['id'] for f in meta['fields'] if f['type']=='choice'}
assert pages==list(range(1,33))
print('Validated51fields,32pages,all33choicefields; counts:',counts)
