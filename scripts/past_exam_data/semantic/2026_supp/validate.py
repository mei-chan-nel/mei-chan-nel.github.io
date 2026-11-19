from pathlib import Path
from lxml import html
import json,collections,re
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[3]
definition=json.loads((ROOT/'scripts/past_exam_data/2026_supp.json').read_text())
fields={f['sectionId']+'-'+f['label']:f for f in definition['fields']}
expected_pages={'q1':list(range(1,9)),'q2a':list(range(9,16)),'q2b':list(range(16,21)),'q3':list(range(21,27)),'q4':list(range(27,37))}
result={}
for sid in expected_pages:
 text=(HERE/(sid+'.html')).read_text();doc=html.fragment_fromstring(text,create_parent='div')
 assert [int(p.get('data-source-page')) for p in doc]==expected_pages[sid]
 assert not doc.xpath('.//*[@data-reading-units or @data-reading-for]')
 assert not doc.xpath('.//details|.//img|.//script|.//style')
 assert '解答群を文字で確認する' not in text
 found=set(doc.xpath('.//*[@data-field]/@data-field'));expected={k for k in fields if k.startswith(sid+'-')}
 assert found==expected,(sid,found^expected)
 for n in doc.xpath('.//*[@data-field]'):
  assert n.tag=='span' and n.get('class')=='blank'
  assert n.get('data-original')==fields[n.get('data-field')]['label']
 codes=collections.defaultdict(set)
 for option in doc.xpath('.//*[@data-choice-fields]'):
  value=option.get('data-choice-value');assert value is not None
  for fid in option.get('data-choice-fields').split():
   assert fid in fields and fields[fid]['type']=='choice'
   assert value in {c['value'] for c in fields[fid]['choices']}
   codes[fid].add(value)
  nums=option.xpath('./span[@class="option-number"]') or option.xpath('./th/span[@class="option-number"]')
  assert len(nums)==1
  assert nums[0].text=='⓪①②③④⑤⑥⑦⑧⑨ⓐⓑⓒⓓⓔⓕ'[int(value,16)]
 for fid in expected:
  if fields[fid]['type']=='choice':assert codes[fid]=={c['value'] for c in fields[fid]['choices']},fid
 for fig in doc.xpath('.//figure'):
  assert fig.get('class')=='past-diagram'
  assert len(fig.xpath('./figcaption'))==1
  x0,y0,x1,y1=map(float,fig.get('data-pdf-clip').split());assert 0<=x0<x1<516 and 0<=y0<y1<729
 for program in doc.xpath('.//div[@class="program"]'):
  rows=program.xpath('./div[@class="code"]/div[@class="code-row"]')
  assert len(rows) in (9,13)
  assert [r.xpath('string(span[@class="ln"])') for r in rows]==[f'({i:02})' for i in range(1,len(rows)+1)]
  assert all(len(r.xpath('./span[@class="src"]'))==1 for r in rows)
 result[sid]={'pages':len(doc),'fields':len(found),'nativeTables':len(doc.xpath('.//table')),'programs':len(doc.xpath('.//div[@class="program"]')),'diagramCrops':len(doc.xpath('.//figure')),'options':len(doc.xpath('.//*[@data-choice-fields]'))}
assert not json.loads((HERE/'coverage.json').read_text())['uncoveredLines']
print(json.dumps(result,ensure_ascii=False,indent=2))
(HERE/'validation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
