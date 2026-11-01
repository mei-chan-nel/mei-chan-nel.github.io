"""No.001 source adapter. Run with Python + lxml; runtime has no Python dependency.
Other exams supply their own adapter; engine uses only the documented data-* contract.
"""
from pathlib import Path
from lxml import html, etree
import json, hashlib, re
from mock_exam_001_reading import prepare_reading, trim_solution, mark_problem_fragments
from mock_exam_editorial import learner_wording, clean_screen_chrome
from mock_exam_001_editorial import revise_solution
from mock_exam_001_studio import add_studio_links
from normalize_site_metadata import normalize_tree
from mock_exam_editorial import bold_question_numbers
ROOT=Path(__file__).resolve().parents[1]/'mock-exams'
OUT=ROOT/'exams/001/1'
SPEC=[
 ('q1','第1問',20,'Q1_001_problem.html','Q1_001_answers.html','1.4.0','アイウエオカキクケコ', ['0','3','5','C','2','2','1','2','2','3'],[(['ア'],2),(['イ'],2),(['ウ','エ'],3),(['オ'],3),(['カ','キ'],3),(['ク'],2),(['ケ'],2),(['コ'],3)]),
 ('q2a','第2問A',15,'Q2A_001_problem_v2.5.0.html','Q2A_001_answers_v2.5.0.html','2.5.0','アイウエオカキ',['2','1','5','1','2','3','3'],[(['ア'],2),(['イ','ウ'],3),(['エ'],2),(['オ'],3),(['カ'],2),(['キ'],3)]),
 ('q2b','第2問B',15,'Q2B_001_problem_v1.0.5.html','Q2B_001_answers_v1.0.5.html','1.0.5','コサシスセソタチ',['1','6','3','1','3','6','1','1'],[(['コ'],1),(['サ'],2),(['シ'],2),(['ス'],2),(['セ'],2),(['ソ','タ'],3),(['チ'],3)]),
 ('q3','第3問',25,'Q3_001_v1.2.2.html','Q3_001_solution.htm','1.2.2','アイウエオカキクケコサシスセ',['1','0','1','2','0','1','0','2','1','1','0','3','1','0'],[([c],p) for c,p in zip('アイウエオカキクケコサシスセ',[2,1,2,1,2,3,2,2,2,2,2,2,1,1])]),
 ('q4','第4問',25,'Q4_001_problem_v4.5.0.html','Q4_001_explanation_v4.5.0.html','4.5.0','アイウエオカキクケコ',['2','1','2','0','3','2','2','1','0','3'],[(['ア'],2),(['イ'],3),(['ウ'],2),(['エ','オ'],4),(['カ'],3),(['キ'],3),(['ク'],3),(['ケ'],2),(['コ'],3)])]
def cls(d,c):return d.xpath('.//*[contains(concat(" ",normalize-space(@class)," ")," '+c+' ")]')
def txt(e):return re.sub(r'\s+',' ',e.text_content()).strip()
def clean(d):
 for e in d.xpath('//script|//iframe|//object|//embed|//base|//form'):e.drop_tree()
 for e in list(d.iter()):
  for a in list(e.attrib):
   if a.lower().startswith('on') or (a in ['href','src'] and e.get(a,'').lower().startswith('javascript:')):del e.attrib[a]
 # Approved screen/input wording (original files are retained unchanged).
 for e in d.iter():
  if e.text:e.text=learner_wording(e.text)
  if e.tail:e.tail=learner_wording(e.tail)
 for c in ['toolbar','site-bar']:
  for e in cls(d,c):e.drop_tree()
 return d
exam={'schemaVersion':1,'id':'001','version':1,'title':'情報Ⅰ 実戦演習 No.001','durationSeconds':3600,'maxPoints':100,'sections':[],'fields':[],'scoring':[]}
for sid,title,points,problem,solution,ver,letters,answers,units in SPEC:
 d=clean(html.fromstring((OUT/'source'/problem).read_bytes()))
 fields={c:{'id':sid+'-'+c,'sectionId':sid,'label':c,'type':'choice','choices':[]} for c in letters}
 def options(cs,els,labels=None):
  for i,e in enumerate(els):
   e.set('data-choice-fields',' '.join(fields[c]['id'] for c in cs));e.set('data-choice-value',str(i))
   label=labels[i] if labels else txt(e)
   label=re.sub(r'^[⓪①②③④⑤⑥⑦⑧⑨0-9]\s*','',label)
   for c in cs:fields[c]['choices'].append({'value':str(i),'text':label})
 if sid=='q1':
  ol=d.xpath('//ol');options('ア',ol[0].xpath('./li'));options('イ',ol[1].xpath('./li'));options('カキ',ol[2].xpath('./li'))
  tables=d.xpath('//table')
  options('オ',tables[1].xpath('.//thead/tr/th')[1:],[f'符号の割当て {i}' for i in range(4)])
  # Each candidate column, including its values, is selectable.
  for row in tables[1].xpath('.//tbody/tr'):
   for i,e in enumerate(row.xpath('./td')[1:]):e.set('data-choice-fields','q1-オ');e.set('data-choice-value',str(i))
  options('ク',tables[3].xpath('.//tbody/tr'))
  options('コ',cls(d,'suppression'),[f'公表する表 {i}' for i in range(4)])
  for c,allowed in [('ウ','0123456789'),('エ','ABCD'),('ケ','0123456789')]:fields[c].update(type='text',allowed=allowed,maxLength=1)
 elif sid=='q2a':
  ol=d.xpath('//ol');
  for cs,e in zip(['ア','イウ','オ','カ','キ'],ol):options(cs,e.xpath('./li'))
  options('エ',d.xpath('//table')[3].xpath('.//tbody/tr'))
 elif sid=='q2b':
  for cs,e in zip(['コサ','シ','ス','セ','タ','チ'],d.xpath('//fieldset')):options(cs,cls(e,'choice'))
  fields['ソ'].update(type='text',allowed='0123456789',maxLength=1)
 elif sid=='q3':
  for e in d.xpath('//fieldset[@data-group]'):options(e.get('data-group'),cls(e,'option'))
  options('コ',cls(d,'insert-row'),['繰返しcの外','繰返しcの中・jの外','繰返しjの中','条件成立時'])
  for c in 'アイシスセ':fields[c].update(type='text',allowed='0123456789',maxLength=1)
 elif sid=='q4':
  for cs,key in zip(['ア','イ','ウ','エオ','カ','キ','ク','ケ','コ'],['q1a','q2a','q2b','q2c','q3a','q4a','q5a','q5b','q5c']):
   box=d.get_element_by_id(key);rows=box.xpath('.//tbody/tr'); options(cs,rows if rows else cls(box,'option'))
  for e in d.xpath('//*[@data-internal-symbol]'):
   e.set('data-field','q4-ク');e.set('data-part',e.get('data-internal-index'));e.set('data-original',e.get('data-internal-symbol'))
  for i,parts in enumerate([['R','0〜23時台'],['T','13〜23時台'],['T','0〜23時台'],['R','13〜23時台']]):fields['ク']['choices'][i]['parts']=parts
 for e in d.iter():
  if not isinstance(e.tag,str):continue
  classes=set(e.get('class','').split())
  if classes.intersection(['blank','inline-blank','ref-box','mark','answer-label']):
   label=txt(e)
   if label in fields:
    e.set('data-field',fields[label]['id']);e.set('data-original',label)
    if any('code' in a.get('class','').split() for a in e.iterancestors()):e.set('data-display','content')
  if e.get('data-field'):
   e.tag='span';e.attrib.pop('href',None)
 for c,f in fields.items():
  assert d.xpath('//*[@data-field="'+f['id']+'"]'),f'Unbound field {sid} {c}'
  assert f['type']=='text' or f['choices'],f'Missing choices {sid} {c}'
  exam['fields'].append(f)
 question_numbers={'q1':[1,1,2,2,3,3,4,4],'q2a':[1,2,3,3,4,4],'q2b':[1,1,2,2,3,4,4],'q3':[1,1,1,2,2,2,2,2,3,3,3,3,3,3],'q4':[1,2,2,2,3,4,5,5,5]}
 for n,(cs,p) in enumerate(units):
  exam['scoring'].append({'id':f'{sid}-{n+1:02}','sectionId':sid,'question':question_numbers[sid][n],'fields':[fields[c]['id'] for c in cs],'maxPoints':p,'rule':{'kind':'unordered' if (sid,cs) in [('q2a',['イ','ウ']),('q4',['エ','オ'])] else 'exact','patterns':[[answers[letters.index(c)] for c in cs]]}})
 d.find('body').set('data-section',sid)
 bold_question_numbers(d)
 head=d.find('head');etree.SubElement(head,'meta',name='robots',content='noindex, follow');link=etree.SubElement(head,'link',rel='stylesheet',href='../../../booklet.css')
 (OUT/f'{sid}.html').write_text('<!doctype html>\n'+html.tostring(d,encoding='unicode'),encoding='utf8')
 sol=clean(html.fromstring((OUT/'source'/solution).read_bytes()));trim_solution(sol,sid);revise_solution(sol,sid);etree.SubElement(sol.find('head'),'meta',name='robots',content='noindex, follow');etree.SubElement(sol.find('head'),'link',rel='stylesheet',href='../../../booklet.css')
 (OUT/f'{sid}-solution.html').write_text('<!doctype html>\n'+html.tostring(sol,encoding='unicode'),encoding='utf8')
 exam['sections'].append({'id':sid,'title':title,'maxPoints':points,'sourceVersion':ver,'problem':f'{sid}.html','solution':f'{sid}-solution.html','sourceProblem':'source/'+problem,'sourceSolution':'source/'+solution,'sourceSha256':hashlib.sha256((OUT/'source'/problem).read_bytes()).hexdigest(),'solutionSha256':hashlib.sha256((OUT/'source'/solution).read_bytes()).hexdigest()})
assert sum(u['maxPoints'] for u in exam['scoring'])==100
# Screen-only documents omit embedded print fonts for fast switching and readable UI.
(OUT/'screen').mkdir(exist_ok=True)
for section in exam['sections']:
 for kind in ['problem','solution']:
  filename=section[kind]
  document=html.fromstring((OUT/filename).read_bytes())
  for style in document.xpath('//style'):
   style.text=re.sub(r'@font-face\s*\{[^}]*\}','',style.text or '',flags=re.I)
  for link in document.xpath('//link[@rel="stylesheet"]'):
   if 'booklet.css' in link.get('href',''):link.set('href','../../../../booklet.css')
  prepare_reading(document, section['id'], kind, exam['scoring'])
  if kind=='problem':mark_problem_fragments(document, section['id'], exam['scoring'])
  clean_screen_chrome(document)
  if section['id']=='q3' and kind=='solution':add_studio_links(document)
  (OUT/'screen'/filename).write_text('<!doctype html>\n'+html.tostring(document,encoding='unicode'),encoding='utf8')
  section['screenProblem' if kind=='problem' else 'screenSolution']='screen/'+filename
(OUT/'exam.json').write_text(json.dumps(exam,ensure_ascii=False,indent=2)+'\n')
normalize_tree(OUT)
# Regenerating this exam must never overwrite the catalog or another version.
# Registration is a separate step: node scripts/register_mock_exam.mjs <manifest>.
print(f'Imported {len(exam["fields"])} fields, {len(exam["scoring"])} scoring units, 100 points.')
