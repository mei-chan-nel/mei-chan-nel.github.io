"""Explicit No.002 adapter. Originals are retained; no catalog/No.001 writes."""
from pathlib import Path
from lxml import html, etree
import copy, hashlib, json, re, subprocess, unicodedata
from mock_exam_editorial import clean_screen_chrome, learner_wording, normalize_problem_typography
from mock_exam_002_editorial import revise_solution
from mock_exam_002_tables import align_tables
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'mock-exams/exams/002/1'
SPEC = [
 ('q1','第1問',20,'Q1_002_problem.html','Q1_002_answers.html','1.2.3','アイウエオカキクケコサシ','121613020232',
  [('ア',2,1),('イ',2,1),('ウエ',2,2),('オ',2,2),('カ',2,2),('キ',2,3),('ク',2,3),('ケコ',2,4),('サ',2,4),('シ',2,4)],'ウエ'),
 ('q2a','第2問A',15,'Q2A_002_problem_v2.3.1.html','Q2A_002_answers_v2.3.1.html','2.3.1','アイウエオカキク','04221101',
  [('アイ',3,1),('ウ',2,2),('エ',2,2),('オ',3,3),('カ',2,3),('キク',3,3)],''),
 ('q2b','第2問B',15,'Q2B_002_problem_v1.3.3.html','Q2B_002_answers_v1.3.3.html','1.3.3','コサシスセソタチツ','283111234',
  [('コ',1,1),('サ',2,1),('シス',3,2),('セ',2,3),('ソ',3,3),('タ',2,4),('チツ',2,4)],'サチツ'),
 ('q3','第3問',25,'Q3_002_v2.3.1.html','Q3_002_solution_v2.3.1.html','2.3.1','アイウエオカキクケコサシスセソタ','2220132021311449',
  [('アイ',2,1),('ウ',1,1),('エ',2,1),('オ',2,2),('カ',2,2),('キ',2,2),('ク',2,2),('ケ',2,2),('コ',2,3),('サ',2,3),('シ',1,3),('ス',2,3),('セ',2,3),('ソタ',1,3)],'アイウセソタ'),
 ('q4','第4問',25,'Q4_002_problem_v1.3.3.html','Q4_002_explanation_v1.3.3.html','1.3.3','アイウエオカキクケコ','3210120014',
  [('ア',2,1),('イ',2,1),('ウ',3,2),('エ',3,2),('オ',2,3),('カ',3,4),('キ',3,4),('ク',3,5),('ケコ',4,5)],''),
]
CIRCLES = '⓪①②③④⑤⑥⑦⑧⑨'
def read(name): return html.fromstring((OUT/'source'/name).read_bytes())
def cls(d, name): return d.xpath('.//*[contains(concat(" ",normalize-space(@class)," ")," '+name+' ")]')
def text(e): return ' '.join(e.text_content().split())
def clean(d):
 for e in d.xpath('//script|//iframe|//object|//embed|//base|//form|//header|//footer'): e.drop_tree()
 for e in d.iter():
  if not isinstance(e.tag,str): continue
  for key in list(e.attrib):
   if key.lower().startswith('on') or (key in ('href','src') and e.get(key,'').strip().lower().startswith('javascript:')): del e.attrib[key]
  if e.tag not in ('style','script'):
   if e.text: e.text = learner_wording(e.text)
   if e.tail: e.tail = learner_wording(e.tail)
 for name in ['toolbar','site-bar','subject','all-required']:
  for e in cls(d,name): e.drop_tree()
 return d

def one(d,path):
 nodes=d.xpath('/html/body/'+path); assert len(nodes)==1,(path,len(nodes)); return nodes[0]
def nodes(d,path):
 found=d.xpath('/html/body/'+path); assert found,path; return found

def anchor(d,path,ids): one(d,path).set('data-reading-units',' '.join(ids))
def tag(d,paths,ids):
 for path in paths:
  for e in nodes(d,path): e.set('data-reading-for',' '.join(dict.fromkeys(e.get('data-reading-for','').split()+ids)))
def uid(sid,n): return f'{sid}-{n:02}'

def range_tag(d,start,end,ids):
 a,b=one(d,start),one(d,end); assert a.getparent() is b.getparent()
 siblings=list(a.getparent());
 for e in siblings[siblings.index(a):siblings.index(b)+1]: e.set('data-reading-for',' '.join(dict.fromkeys(e.get('data-reading-for','').split()+ids)))

def bind(d,sid,fields):
 def options(letters, elements, labels=None):
  assert elements,(sid,letters)
  for i,e in enumerate(elements):
   value=str(i); e.set('data-choice-fields',' '.join(fields[c]['id'] for c in letters));e.set('data-choice-value',value)
   label=labels[i] if labels else re.sub(r'^[⓪①②③④⑤⑥⑦⑧⑨0-9]\s*','',text(e))
   for c in letters: fields[c]['choices'].append({'value':value,'text':label})
 if sid=='q1':
  ol=d.xpath('//ol');
  for letters,e in zip(['ア','イ','カ','キ','ケコ','サ','シ'],ol): options(letters,e.xpath('./li'))
  fields['カ']['choices']=[{'value':str(i),'text':s} for i,s in enumerate(['3/2倍','3倍','6倍','9/2倍'])]
  options('オ',d.xpath('//table')[0].xpath('.//tbody/tr'))
  options('ク',cls(d,'circuit-option'),['回路'+c for c in CIRCLES[:4]])
 elif sid=='q2a':
  for letters,e in zip(['アイ','ウ','エ','オ','カ','キク'],d.xpath('//ol')): options(letters,e.xpath('./li'))
 elif sid=='q2b':
  for letters,e in zip(['コ','シス','セ','ソ','タ'],d.xpath('//fieldset')):
   options(letters,cls(e,'choice'),['配置'+c for c in CIRCLES[:4]] if letters in ('コ','ソ') else None)
 elif sid=='q3':
  options('エ',cls(d.xpath('//*[@data-answer-group="エ"]')[0],'option'))
  for e in d.xpath('//fieldset[@data-answer-group]'): options(e.get('data-answer-group'),cls(e,'option'))
  options('ス',cls(d,'insert-row'),['外側の繰返しの前','外側の繰返しの中・内側の繰返しの前','未点検の各候補を調べる中','点検済みにした後・表示する前'])
 elif sid=='q4':
  for letters,key in zip(['ア','イ','ウ','エ','オ','カ','キ','ク','ケコ'],['q1a','q1b','q2a','q2b','q3a','q4a','q4b','q5a','q5b']): options(letters,cls(d.get_element_by_id(key),'option'))
 for e in d.iter():
  if not isinstance(e.tag,str):continue
  if set(e.get('class','').split()) & {'blank','inline-blank','ref-box','mark','answer-label'}:
   label=text(e)
   if label in fields:
    e.set('data-field',fields[label]['id']); e.set('data-original',label)
    if e.tag=='a': e.tag='span';e.attrib.pop('href',None)
    if any('code' in a.get('class','').split() for a in e.iterancestors()): e.set('data-display','content')
 for c,f in fields.items():
  assert d.xpath('//*[@data-field="'+f['id']+'"]'),f'Unbound {sid}/{c}'
  assert f['type']=='text' or f['choices'],f'No choices {sid}/{c}'
 # Show circled option indexes in diagrams, lists and prompts.
 for e in d.iter():
  if not isinstance(e.tag,str) or e.tag in ('style','script'):continue
  if set(e.get('class','').split()) & {'opt-index','option-index','choice-num','choice-label','num','choice-ref'}:
   if text(e) in list('0123456789'):e.text=CIRCLES[int(text(e))]
  if e.text:e.text=re.sub(r'次の([0-9])([〜～])([0-9])',lambda m:'次の'+CIRCLES[int(m[1])]+m[2]+CIRCLES[int(m[3])],e.text)
 return d


def trim_and_align_solution(d,sid):
 if sid=='q1':
  one(d,'section[1]').drop_tree()
  p=['section[1]/h2','section[1]/p[3]','section[2]/h2','section[3]/h2','section[3]/p[4]','section[4]/h2','section[5]/h2','section[6]/h2','section[6]/p[4]','section[7]/h2']
  # Select b/c via text instead of relying on paragraph counts after editorial edits.
  p[4]='section[3]/p[starts-with(normalize-space(),"c")]'
  p[8]='section[6]/p[starts-with(normalize-space(),"b")]'
  for n,path in enumerate(p,1):anchor(d,path,[uid(sid,n)])
  for e in d.xpath('//p[starts-with(normalize-space(),"これは問題で定義した入力と制御方針")]'):e.drop_tree()
 elif sid=='q2a':
  stop=one(d,'section[1]/div[2]/h2[1]')
  for e in list(stop.itersiblings(preceding=True)): e.drop_tree()
  paths=['section[1]/div[2]/h2','section[2]/div[2]/h2[1]','section[2]/div[2]/h2[2]','section[3]/div[2]/h2[1]','section[3]/div[2]/h2[2]','section[4]/div[2]/h2']
  for n,path in enumerate(paths,1):anchor(d,path,[uid(sid,n)])
  for e in d.xpath('//p[starts-with(normalize-space(),"この手順は，本文で定義したDNC Pay")]'):e.drop_tree()
 elif sid=='q2b':
  stop=one(d,'main/h2[2]')
  for e in list(stop.itersiblings(preceding=True)):e.drop_tree()
  final=one(d,'main/h2[normalize-space()="測定する力と設問のつながり"]')
  for e in list(final.itersiblings()):e.drop_tree()
  final.drop_tree()
  paths=['main/h2[1]','main/p[starts-with(normalize-space(),"車Aが初めてマス1に来るまで")]','main/h2[2]','main/h2[3]','main/h3[2]','main/h2[4]','main/h3[4]']
  for n,path in enumerate(paths,1):anchor(d,path,[uid(sid,n)])
 elif sid=='q3':
  main=one(d,'main'); old=list(main)
  for e in list(main): main.remove(e)
  def section(title,group,items):
   s=etree.SubElement(main,'section',{'class':'explanation-unit','data-reading-units':' '.join(uid(sid,n) for n in group)})
   if title:etree.SubElement(s,'h2').text=title
   for e in items:s.append(e)
   return s
  section(None,[1,2],old[5:8])
  section('問1　エ：機器設置を始める条件',[3],[old[8],old[29]])
  section(None,[4],old[9:16]+[old[30]])
  for n,i in zip(range(5,9),range(31,35)):section(None,[n],[old[i]])
  section(None,[9],old[16:23]+[old[35]])
  section(None,[10],[old[24],old[36]])
  section(None,[11],[old[37]])
  section(None,[12],[old[38],old[39]])
  section('問3　セ・ソ・タ：実行回数と点検終了時刻',[13,14],[old[23],old[25],old[26],old[27]])
 elif sid=='q4':
  first=one(d,'main/section[1]')
  for e in list(first.itersiblings(preceding=True)):e.drop_tree()
  for n in range(1,10): anchor(d,f'main/section[{n}]',[uid(sid,n)])
  sources=one(d,'main/section[10]');sources.set('class','sources')
  # Keep attribution and the limitation relevant to interpreting this dataset.
  one(d,'main/section[10]/h2').text='出典'
 return d


def reading_problem(d,sid):
 if sid=='q1':
  anchors=['section[1]/p[2]','section[2]/p','section[3]/p[4]','section[4]/p[1]','section[4]/p[3]','section[5]/p[4]','section[6]/p[1]','section[7]/p[4]','section[8]/p[1]','section[8]/p[2]']
  for n,p in enumerate(anchors,1):anchor(d,p,[uid(sid,n)])
  for n,page in [(1,1),(2,2),(3,3),(6,5),(7,6),(8,7)]:tag(d,[f'section[{page}]'],[uid(sid,n)])
  common=['section[3]/p[position()<=3]','section[3]/figure']
  tag(d,common,[uid(sid,4),uid(sid,5)])
  range_tag(d,'section[4]/p[1]','section[4]/div[2]',[uid(sid,4)])
  range_tag(d,'section[4]/p[3]','section[4]/div[3]',[uid(sid,5)])
  tag(d,['section[5]/p[position()<=3]','section[5]/table','section[5]/div[2]'],[uid(sid,7)])
  tag(d,['section[7]/p[position()<=3]','section[7]/div[1]'],[uid(sid,9)])
  range_tag(d,'section[8]/p[1]','section[8]/div[1]',[uid(sid,9)])
  range_tag(d,'section[8]/p[2]','section[8]/div[3]',[uid(sid,10)])
 elif sid=='q2a':
  box=lambda n:f'section[{n}]/div[2]/div'
  paths=[box(2),box(3)+'/p[2]',box(3)+'/p[3]',box(5)+'/p[1]',box(5)+'/p[2]',box(6)]
  for n,p in enumerate(paths,1):anchor(d,p,[uid(sid,n)])
  tag(d,['section[1]'],[uid(sid,n) for n in range(1,7)])
  tag(d,['section[2]'],[uid(sid,1)])
  tag(d,[box(3)+'/p[1]'],[uid(sid,2),uid(sid,3)])
  range_tag(d,box(3)+'/p[2]',box(3)+'/ol[1]',[uid(sid,2)])
  range_tag(d,box(3)+'/p[3]',box(3)+'/ol[2]',[uid(sid,3)])
  tag(d,['section[4]'],[uid(sid,n) for n in [4,5,6]])
  range_tag(d,box(5)+'/p[1]',box(5)+'/ol[1]',[uid(sid,4)])
  range_tag(d,box(5)+'/p[2]',box(5)+'/ol[2]',[uid(sid,5)])
  tag(d,['section[6]'],[uid(sid,6)])
 elif sid=='q2b':
  box=lambda n:f'main/section[{n}]/div'
  paths=[box(1)+'/p[4]',box(1)+'/p[5]',box(2)+'/p[1]',box(3)+'/p[2]',box(3)+'/p[3]',box(4)+'/p[3]',box(4)+'/p[4]']
  for n,p in enumerate(paths,1):anchor(d,p,[uid(sid,n)])
  tag(d,[box(1)+'/p[position()<=3]',box(1)+'/ul',box(1)+'/figure'],[uid(sid,n) for n in range(1,8)])
  range_tag(d,box(1)+'/p[4]',box(1)+'/fieldset',[uid(sid,1)])
  tag(d,[box(1)+'/p[5]'],[uid(sid,2)])
  tag(d,['main/section[2]'],[uid(sid,n) for n in [3,6,7]])
  tag(d,[box(3)+'/figure'],[uid(sid,n) for n in [4,6,7]])
  range_tag(d,box(3)+'/p[2]',box(3)+'/fieldset[1]',[uid(sid,4)])
  range_tag(d,box(3)+'/p[3]',box(3)+'/fieldset[2]',[uid(sid,5)])
  tag(d,[box(3)+'/p[position()>=4]',box(3)+'/ul',box(4)+'/p[position()<=2]',box(4)+'/figure'],[uid(sid,n) for n in [6,7]])
  range_tag(d,box(4)+'/p[3]',box(4)+'/fieldset',[uid(sid,6)])
  tag(d,[box(4)+'/p[4]'],[uid(sid,7)])
 elif sid=='q3':
  groups=[([1,2],'section[2]/div/p[3]'),([3],'section[2]/div/p[4]'),([4],'section[3]/div/p[1]')]
  groups += [([n],f'section[4]/div/fieldset[{n-3}]') for n in range(5,9)]
  groups += [([9],'section[5]/div/p[1]'),([10],'section[6]/div/fieldset[2]'),([11],'section[6]/div/fieldset[3]'),([12],'section[6]/div/p[1]'),([13,14],'section[6]/div/p[2]')]
  for group,p in groups:anchor(d,p,[uid(sid,n) for n in group])
  tag(d,['section[1]'],[uid(sid,n) for n in range(1,15)])
  tag(d,['section[2]'],[uid(sid,n) for n in [1,2,3]])
  tag(d,['section[3]','section[4]/div/figure'],[uid(sid,n) for n in range(4,9)])
  tag(d,['section[5]'],[uid(sid,n) for n in range(9,15)])
  tag(d,['section[3]/div/p[2]','section[3]/div/table','section[3]/div/div'],[uid(sid,n) for n in range(9,15)])
  for n,c in zip(range(4,9),'オカキクケ'): tag(d,[f'section[4]/div/fieldset[@data-answer-group="{c}"]'],[uid(sid,n)])
  for n,c in zip(range(9,12),'コサシ'):tag(d,[f'section[6]/div/fieldset[@data-answer-group="{c}"]'],[uid(sid,n)])
  tag(d,['section[6]/div/p[1]'],[uid(sid,12)])
  tag(d,['section[6]/div/p[position()>=2]'],[uid(sid,13),uid(sid,14)])
 elif sid=='q4':
  # All introductory definitions are needed, even for the last prediction task.
  common=['main/section[1]/div[2]/*[position()<=4]']
  for n,page in [(1,1),(2,2),(3,3),(4,4),(5,5),(6,6),(7,6),(8,7),(9,8)]:
   ids=[uid(sid,n)];tag(d,common,ids)
   key=['q1a','q1b','q2a','q2b','q3a','q4a','q4b','q5a','q5b'][n-1]
   box=d.get_element_by_id(key)
   (box if n==7 else box.getparent()[0]).set('data-reading-units',' '.join(ids))
   if n in [6,7]:
    tag(d,['main/section[6]/div[2]/*[not(self::fieldset)]'],ids);tag(d,[f'main/section[6]/div[2]/fieldset[@id="{key}"]'],ids)
   else:tag(d,[f'main/section[{page}]/div[2]'],ids)
   if n in [4,8]:tag(d,['main/section[3]/div[2]/div[contains(@class,"table-wrap")]'],ids)
   if n in [6,7]:tag(d,['main/section[5]/div[2]'],ids)
 return d


def studio_links(d):
 programs=d.xpath('//figure[@data-program]');assert len(programs)==2
 sources=[]
 for program in programs:
  lines=['  '*int(row.get('data-depth'))+row.xpath('.//span[@class="statement"]')[0].text_content() for row in program.xpath('.//div[@data-line]')]
  sources.append('\n'.join(lines))
 maximum='\n\n定義する 最大値(x, y)：\n  もし x > y ならば：\n    返す x\n  返す y'
 # Figure 3 continues after the revised Figure 2's setup calculation.
 initial='\n'.join(sources[0].splitlines()[:15]).replace('Junban = [1, 2, 3, 4, 5]','Junban = [3, 1, 2, 4, 5]')
 sources[1]=initial+'\n'+sources[1]
 drafts=[{'version':1,'title':f'No.002 第3問 完成した図{n}','source':s+maximum,'settings':{'indexBase':1,'inputs':{}}} for n,s in zip([2,3],sources)]
 result=subprocess.run(['node',str(ROOT/'scripts/mock_exam_studio_links.mjs')],input=json.dumps(drafts),text=True,capture_output=True)
 assert result.returncode==0,result.stderr
 links=json.loads(result.stdout)
 for n,p,url in zip([2,3],programs,links):
  action=etree.Element('p',{'class':'studio-program-link'})
  a=etree.SubElement(action,'a',href=url,target='_blank',rel='noopener',**{'data-studio-program':f'q3-fig{n}'})
  a.text='トレースStudioで動かす ↗'
  if n==3:etree.SubElement(action,'small').text='設営順を変更した図2の(01)〜(15)行目から実行します。'
  p.addnext(action)
 return drafts


def build():
 OUT.mkdir(exist_ok=True);(OUT/'screen').mkdir(exist_ok=True)
 exam={'schemaVersion':1,'id':'002','version':1,'title':'情報Ⅰ 実戦演習 No.002','durationSeconds':3600,'maxPoints':100,'sections':[],'fields':[],'scoring':[]}
 drafts=[]
 lab_links=json.loads(subprocess.check_output(['node',str(ROOT/'scripts/mock_exam_lab_links.mjs')],text=True))
 for sid,title,points,problem,solution,ver,letters,answers,units,numeric in SPEC:
  assert len(letters)==len(answers),(sid,len(letters),len(answers))
  fields={c:{'id':sid+'-'+c,'sectionId':sid,'label':c,'type':'text' if c in numeric else 'choice',**({'allowed':'0123456789','maxLength':1} if c in numeric else {'choices':[]})} for c in letters}
  p=bind(clean(read(problem)),sid,fields);p.find('body').set('data-section',sid)
  # Normalize only the display of the section number, preserving the original source.
  headings=p.xpath('//h1|//h2'); h=headings[0] if headings else None
  if sid=='q3':h.text=(h.text or '').replace('第３問','第3問')
  if sid=='q2a':h.text='第2問A　（配点15）'
  reading_problem(p,sid)
  if sid=='q3':
   for paragraph in p.xpath('//p'):
    match=re.match(r'^(問[0-9]+)(.*)',paragraph.text or '',re.S)
    if match:
     paragraph.text=None; paragraph.set('class','qtitle')
     label=etree.Element('b');label.text=match[1];label.tail=match[2];paragraph.insert(0,label)
  clean_screen_chrome(p)
  normalize_problem_typography(p,sid)
  s=trim_and_align_solution(clean(read(solution)),sid);s.find('body').set('data-section',sid)
  clean_screen_chrome(s)
  revise_solution(s,sid,fields,letters,answers,units)
  if sid=='q3':drafts=studio_links(s)
  for key,url in lab_links.items():
   anchors=s.xpath('//*[@data-reading-units="'+key+'"]')
   if not anchors:continue
   action=etree.Element('p',{'class':'studio-program-link'})
   a=etree.SubElement(action,'a',href=url,target='_blank',rel='noopener')
   a.text='論理回路ラボで動かす ↗' if sid=='q1' else 'フローチャートラボで動かす ↗'
   anchors[0].addnext(action)

  for kind,document in [('problem',p),('solution',s)]:
   for screen in [False,True]:
    d=copy.deepcopy(document)
    if not screen:
     for action in cls(d,'studio-program-link'):action.drop_tree()
    if screen:
     for style in d.xpath('//style'):style.text=re.sub(r'@font-face\s*\{[^}]*\}','',style.text or '',flags=re.I)
    align_tables(d)
    head=d.find('head')
    etree.SubElement(head,'meta',name='robots',content='noindex, follow')
    etree.SubElement(head,'link',rel='stylesheet',href=('../../../../' if screen else '../../../')+'booklet.css')
    etree.SubElement(head,'link',rel='stylesheet',href='../no002.css' if screen else 'no002.css')
    target=(OUT/'screen' if screen else OUT)/(sid+('-solution' if kind=='solution' else '')+'.html')
    target.write_text('<!doctype html>\n'+html.tostring(d,encoding='unicode'))
  for f in fields.values(): exam['fields'].append(f)
  for n,(cs,score,question) in enumerate(units,1):
   exam['scoring'].append({'id':uid(sid,n),'sectionId':sid,'question':question,'fields':[fields[c]['id'] for c in cs],'maxPoints':score,'rule':{'kind':'unordered' if sid=='q4' and cs=='ケコ' else 'exact','patterns':[[answers[letters.index(c)] for c in cs]]}})
  exam['sections'].append({'id':sid,'title':title,'maxPoints':points,'sourceVersion':ver,'problem':sid+'.html','solution':sid+'-solution.html','screenProblem':'screen/'+sid+'.html','screenSolution':'screen/'+sid+'-solution.html','sourceProblem':'source/'+problem,'sourceSolution':'source/'+solution,'sourceSha256':hashlib.sha256((OUT/'source'/problem).read_bytes()).hexdigest(),'solutionSha256':hashlib.sha256((OUT/'source'/solution).read_bytes()).hexdigest()})
 (OUT/'exam.json').write_text(json.dumps(exam,ensure_ascii=False,indent=2)+'\n')
 (OUT/'source/studio-drafts.json').write_text(json.dumps(drafts,ensure_ascii=False,indent=2)+'\n')
 assert sum(u['maxPoints'] for u in exam['scoring'])==100
 print(f'Imported No.002: {len(exam["fields"])} fields, {len(exam["scoring"])} units, 100 points. Catalog unchanged.')
if __name__=='__main__':build()
