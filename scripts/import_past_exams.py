"""Explicit, reviewed past-exam import. Originals stay intact; no publication."""
from pathlib import Path
import copy,json,re,hashlib,shutil,unicodedata,html as escape
import fitz
from lxml import html,etree
from fontTools import agl
from past_exam_semantic import load_pages, bind_reading
ROOT=Path(__file__).resolve().parents[1]
REVIEW=ROOT/'scripts/past_exam_data'
OUTROOT=ROOT/'mock-exams/exams'
FILES={'2025_main':'2025Honshi','2025_supp':'2025Tuishi','2026_main':'2026Honshi','2026_supp':'2026Tuishi'}
STARTS={'2025_main':[0,8,14,18,24],'2025_supp':[0,8,14,18,24],'2026_main':[0,8,14,20,26],'2026_supp':[0,8,15,20,26]}
SID=['q1','q2a','q2b','q3','q4'];TITLES=['第1問','第2問A','第2問B','第3問','第4問']
CIRCLES='⓪①②③④⑤⑥⑦⑧⑨ⓐⓑⓒⓓⓔⓕ'
GLYPHS=json.loads((REVIEW/'pdf-glyph-map.json').read_text())
FALLBACKS=json.loads((REVIEW/'pdf-glyph-svg-fallbacks.json').read_text())
GAIJI=json.loads((REVIEW/'pdf-gaiji-map.json').read_text()) if (REVIEW/'pdf-gaiji-map.json').exists() else {}
def norm(s):return re.sub(r'\s','',unicodedata.normalize('NFKC',s))
def dump(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
def source_hash(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def encoding_maps(doc,page):
 out={}
 for font in page.get_fonts():
  if font[2]!='Type1':continue
  obj=doc.xref_object(font[0]);m=re.search(r'/Encoding\s+(\d+)\s+0\s+R',obj)
  if not m:continue
  obj=doc.xref_object(int(m[1]));m=re.search(r'/Differences\s*\[([^\]]+)\]',obj,re.S)
  if not m:continue
  enc={};code=0
  for token in re.findall(r'\d+|/[^\s\[\]]+',m[1]):
   if token.startswith('/'):
    glyph=token[1:];value=agl.toUnicode(glyph)
    if value:enc[str(code)]=value
    code+=1
   else:code=int(token)
  name=font[3].split('+')[-1];out[name]=enc|GLYPHS.get(name,{})
 return out

def page_data(doc,page):
 enc=encoding_maps(doc,page);lines=[]
 for b in page.get_text('rawdict')['blocks']:
  for line in b.get('lines',[]):
   chars=[]
   for span in line['spans']:
    font=span['font']
    for char in span['chars']:
     c=copy.deepcopy(char);code=str(ord(c['c']));c.update(size=span['size'],font=font)
     c['original']=c['c'];c['c']=enc.get(font,{}).get(code,GAIJI.get(font,{}).get(code,c['c']))
     if code in FALLBACKS.get(font,{}):c['fallback']=FALLBACKS[font][code]['svg'];c['c']=''
     if any(ord(x)<32 for x in c['c']):raise ValueError(('Undecoded control',page.number,font,code))
     chars.append(c)
   text=''.join(c['c'] for c in chars)
   if not text.strip() and not any(c.get('fallback') for c in chars):continue
   rect=fitz.Rect(line['bbox'])
   # Remove only running source metadata; retain all question/figure content.
   if rect.y0<70:continue
   if rect.y0>650 and ('―' in text or '（' in text or re.fullmatch(r'[\d０-９\s—－―（）()ｰ-]+',text)):continue
   lines.append({'bbox':rect,'chars':chars,'text':text})
 return sorted(lines,key=lambda l:(round(l['bbox'].y0/3),l['bbox'].x0))

def find_boxes(page,lines,fields):
 boxes=[]
 for dr in page.get_drawings():
  r=fitz.Rect(dr['rect'])
  if not (6<=r.width<=80 and 8<=r.height<=28):continue
  if not any(item[0]=='re' for item in dr['items']):continue
  found=[]
  for line in lines:
   for c in line['chars']:
    cr=fitz.Rect(c['bbox']);center=(cr.tl+cr.br)/2
    if c['c'] in fields and r.contains(center):found.append(c)
  if not found:continue
  # Distinct digit boxes and shared selection boxes are both supported.
  for c in found:
   cr=fitz.Rect(c['bbox']);box=fitz.Rect(r)
   if len(found)>1:box=fitz.Rect(cr.x0-2,r.y0,cr.x1+2,r.y1)
   if not any(b['label']==c['c'] and abs(b['rect'].x0-box.x0)<1 and abs(b['rect'].y0-box.y0)<1 for b in boxes):boxes.append({'rect':box,'label':c['c'],'char':c})
 return boxes

def field_node(label,fields):
 f=fields[label];e=etree.Element('span',{'class':'blank','data-field':f['id'],'data-original':label,'data-input-type':f['type']})
 e.text=label;return e

def append_text(el,text):
 if len(el):el[-1].tail=(el[-1].tail or '')+text
 else:el.text=(el.text or '')+text

def line_html(line,boxes,fields):
 p=etree.Element('p',{'class':'past-line'});p.set('data-source-y',str(round(line['bbox'].y0,2)));p.set('data-source-x',str(round(line['bbox'].x0,2)))
 used=set()
 for c in line['chars']:
  matching=next((i for i,b in enumerate(boxes) if b['label']==c['c'] and b['rect'].contains((fitz.Rect(c['bbox']).tl+fitz.Rect(c['bbox']).br)/2)),None)
  if matching is not None and matching not in used:
   append_text(p,' ');p.append(field_node(c['c'],fields));p[-1].tail=' ';used.add(matching)
  elif c.get('fallback'):
   e=etree.SubElement(p,'span',{'class':'pdf-glyph','aria-hidden':'true'});e.append(html.fromstring(c['fallback']))
  else:append_text(p,c['c'])
 t=norm(line['text'])
 if re.match(r'^問\d',t):p.set('class','past-line exam-question')
 if re.match(r'^第[1-4]問',t):p.set('class','past-line exam-section-heading')
 return p

def group_pieces(pieces,units,fields):
 # Prefer real occurrences over introductory ranges/choice-group labels.
 positions={}
 for c,f in fields.items():
  candidates=[]
  for i,p in enumerate(pieces):
   if p.xpath('.//*[@data-field="'+f['id']+'"]'):
    t=''.join(p.itertext());bad=bool(re.search(r'(空欄|解答群|次の文章|最も適当|うちから|当てはまる.*マーク)',t));candidates.append((bad,i))
  if not candidates:raise ValueError(('No bound box',f['id']))
  positions[c]=min(candidates)[1]
 groups=[]
 for unit in units:
  start=min(positions[c] for c in unit['labels'])
  field_ids={fields[c]['id'] for c in unit['labels']}
  choice_positions=[i for i,p in enumerate(pieces) if any(field_ids.intersection(e.get('data-choice-fields','').split()) for e in p.iter())]
  end=max([start]+choice_positions)
  group={'start':start,'end':end,'units':[unit]}
  # A program/choice group may serve several consecutive scoring units. Keep
  # all of that shared problem before the corresponding explanations.
  while groups and groups[-1]['end']>=group['start']:
   old=groups.pop();group={'start':min(old['start'],group['start']),'end':max(old['end'],group['end']),'units':old['units']+group['units']}
  groups.append(group)
 for j,g in enumerate(groups):
  if j==0:g['start']=0
  elif g['units'][0]['question'] != groups[j-1]['units'][-1]['question']:
   low=groups[j-1]['end']+1
   for i in range(g['start'],low-1,-1):
    if 'exam-question' in pieces[i].get('class',''):g['start']=i;break

 return groups

def document(body,title):
 d=html.fromstring('<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title></title><link rel="stylesheet" href="../../../booklet.css"><link rel="stylesheet" href="past-exam.css"></head><body></body></html>');d.find('head/title').text=title;d.find('body').extend(body);return d

def write_material(d,path,screen):
 d=copy.deepcopy(d)
 if screen:
  for link in d.xpath('//link[@href]'):link.set('href','../'+link.get('href'))
  for image in d.xpath('//img[@src]'):
   if not re.match(r'^(?:data:|https?://)',image.get('src')):image.set('src','../'+image.get('src'))
 path.write_text('<!doctype html>\n'+html.tostring(d,encoding='unicode'))

def main(selected=None):
 for key,exam_id in FILES.items():
  if selected and key not in selected and exam_id not in selected:continue
  reviewed=json.loads((REVIEW/(key+'.json')).read_text());sections=reviewed['sections'];sections={s['id']:s for s in sections} if isinstance(sections,list) else sections
  rawfields=reviewed.get('fields') or [f for sec in sections.values() for f in sec['fields']]
  units=reviewed.get('units') or [dict(u,sectionId=sid) for sid,s in sections.items() for u in s['units']]
  for u in units:
   u['sectionId']=u.get('sectionId',u['sourceUnitId'].split('-')[0]);u['question']=int(re.search(r'\d+',str(u['question']))[0])
  folder=OUTROOT/exam_id/'1';(folder/'source').mkdir(parents=True,exist_ok=True);(folder/'screen').mkdir(exist_ok=True);(folder/'assets').mkdir(exist_ok=True)
  for pattern in ['page-*.svg', 'diagram-p*.png']:
   for old in (folder/'assets').glob(pattern):old.unlink()
  source=folder/'source/problem.pdf'
  if not source.is_file():raise FileNotFoundError(f'Place the licensed original at {source}')
  shutil.copyfile(source,folder/'problem.pdf')
  shutil.copyfile(REVIEW/(key+'.json'),folder/'source/reviewed-definition.json')
  shutil.copyfile(REVIEW/(key+'-review.md'),folder/'source/review.md')
  title=exam_id[:4]+'年度 '+('本試験' if 'Honshi' in exam_id else '追・再試験')
  fields=[]
  for raw in rawfields:
   f=copy.deepcopy(raw);f['id']=f['sectionId']+'-'+f['label'];
   if f['type']=='text':f['maxLength']=1;f['allowed']=''.join(f.get('allowed','0123456789')).upper()
   else:
    for choice in f['choices']:choice['value']=choice['value'].upper()
   fields.append(f)
  exam={'schemaVersion':1,'id':exam_id,'version':1,'kind':'past','year':int(exam_id[:4]),'session':'main' if 'Honshi' in exam_id else 'supp','shortTitle':title,'title':'共通テスト 情報Ⅰ '+title,'durationSeconds':3600,'maxPoints':100,'sections':[],'fields':fields,'scoring':[]}
  for u in units:
   kind=u['kind'];assert kind in ['exact','unordered','unordered-partial'],kind
   rule={'kind':kind,'patterns':[[str(a).upper() for a in u['answers']]]}
   if kind=='unordered-partial':rule['pointsByMatches']=u.get('pointsByMatches',[0,2,4])
   exam['scoring'].append({'id':u['sourceUnitId'],'sectionId':u['sectionId'],'question':u['question'],'fields':[u['sectionId']+'-'+c for c in u['labels']],'maxPoints':u['maxPoints'],'rule':rule})
  doc=fitz.open(source);audit=[]
  for index,sid in enumerate(SID):
   fs={f['label']:f for f in fields if f['sectionId']==sid};us=[u for u in units if u['sectionId']==sid]
   start=STARTS[key][index];stop=STARTS[key][index+1] if index+1<5 else len(doc)
   pages,pieces=load_pages(doc,key,sid,fs,folder,page_data,find_boxes)
   groups=group_pieces(pieces,us,fs)
   problem=bind_reading(pages,pieces,groups);solution=[]
   sol=html.fromstring((REVIEW/f'{key}-{sid}.html').read_text(encoding='utf-8'))
   sol_by_id={e.get('data-reading-units'):e for e in sol.xpath('//*[@data-reading-units]')}
   for g in groups:
    ids=[u['sourceUnitId'] for u in g['units']]
    s=etree.Element('section',{'class':'explanation-unit','data-reading-units':' '.join(ids),'data-solution-heading':'1'})
    for uid in ids:
     old=copy.deepcopy(sol_by_id[uid]);old.attrib.pop('data-reading-units',None);s.append(old)
    solution.append(s)
   audit.extend({'section':sid,'page':int(p.get('data-source-page')),'nativeTables':len(p.xpath('.//table')),'nativePrograms':len(p.xpath('.//*[contains(concat(" ",normalize-space(@class)," ")," code ")]')),'diagrams':len(p.xpath('.//figure[@data-pdf-clip]'))} for p in pages)
   pdoc=document(problem,exam['title']+' '+TITLES[index]);pdoc.find('body').set('data-section',sid)
   sdoc=document([etree.Element('main',{'class':'solution'})],exam['title']+' '+TITLES[index]+' 解説');sdoc.find('body').set('data-section',sid);sdoc.find('body/main').extend(solution)
   sh=etree.Element('h1',{'class':'solution-section-title'});sh.text=exam['shortTitle']+'　'+TITLES[index]+'　解説';sdoc.find('body/main').insert(0,sh)
   srcsol=folder/'source'/f'{sid}-reviewed-solution.html';srcsol.write_bytes((REVIEW/f'{key}-{sid}.html').read_bytes())
   for screen in [False,True]:
    write_material(pdoc,(folder/'screen' if screen else folder)/(sid+'.html'),screen)
    write_material(sdoc,(folder/'screen' if screen else folder)/(sid+'-solution.html'),screen)
   exam['sections'].append({'id':sid,'title':TITLES[index],'maxPoints':[20,15,15,25,25][index],'problem':sid+'.html','screenProblem':'screen/'+sid+'.html','solution':sid+'-solution.html','screenSolution':'screen/'+sid+'-solution.html','sourceProblem':'source/problem.pdf','sourceSolution':f'source/{sid}-reviewed-solution.html','sourceSha256':source_hash(source),'solutionSha256':source_hash(srcsol)})
  dump(folder/'exam.json',exam);dump(folder/'source/render-audit.json',audit)
  qa={'schemaVersion':1,'answers':{u['sectionId']+'-'+c:str(a).upper() for u in units for c,a in zip(u['labels'],u['answers'])},'expectedTotal':100,'expectedSections':dict(zip(SID,[20,15,15,25,25])),'expectedQuestions':{u['sectionId']+'-'+c:u['question'] for u in units for c in u['labels']},'cases':[]}
  for u in units:
   if u['kind']=='unordered':qa['cases'].append({'name':u['sourceUnitId']+' reverse','answers':{u['sectionId']+'-'+c:str(a).upper() for c,a in zip(u['labels'],reversed(u['answers']))},'expectedTotal':u['maxPoints']})
   if u['kind']=='unordered-partial':qa['cases'].append({'name':u['sourceUnitId']+' duplicate','answers':{u['sectionId']+'-'+c:str(u['answers'][0]).upper() for c in u['labels']},'expectedTotal':u.get('pointsByMatches',[0,2,4])[1]})
  dump(folder/'source/qa.json',qa)
  shutil.copyfile(ROOT/'mock-exams/past-exam.css',folder/'past-exam.css')
  print(exam_id,len(fields),len(units),'100pts',len(doc),'original PDF pages')
if __name__=='__main__':
 import argparse
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('exams',nargs='*');args=parser.parse_args()
 if any(name not in set(FILES)|set(FILES.values()) for name in args.exams):parser.error('Unknown past-exam identifier')
 main(args.exams)
