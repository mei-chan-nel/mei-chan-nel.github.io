"""Source/imported text equality and PDF prose coverage (Python: lxml + PyMuPDF)."""
from pathlib import Path
from lxml import html
import re,unicodedata,json,fitz
root=Path(__file__).resolve().parents[1]/'mock-exams/exams/001/1'
pairs=[('q1','Q1_001_problem.html','Q1_001_answers.html'),('q2a','Q2A_001_problem_v2.5.0.html','Q2A_001_answers_v2.5.0.html'),('q2b','Q2B_001_problem_v1.0.5.html','Q2B_001_answers_v1.0.5.html'),('q3','Q3_001_v1.2.2.html','Q3_001_solution.htm'),('q4','Q4_001_problem_v4.5.0.html','Q4_001_explanation_v4.5.0.html')]
def norm(s):
 s=s.replace('なお，当てはまる文字がA～Dの場合には，ⓐ～ⓓをそれぞれマークすること。','').replace('空欄エには当てはまる文字をマークせよ。','空欄エには当てはまる文字を答えよ。')
 return re.sub(r'\s','',unicodedata.normalize('NFKC',s))
def body(path):
 d=html.fromstring(path.read_bytes())
 for el in d.xpath('//script|//style|//*[contains(concat(" ",@class," ")," toolbar ") or contains(concat(" ",@class," ")," site-bar ")]'):el.drop_tree()
 return d.find('body')
missing=[]
for kind,col in [('problem',1),('solution',2)]:
 pdf=fitz.open(root/(kind+'.pdf'));pdftext=norm(''.join(p.get_text() for p in pdf));pdftext=re.sub(r'情報IStudyAtlas実戦模試No\.001[—―-]\d+[—―-]','',pdftext)
 for row in pairs:
  original=body(root/'source'/row[col]);imported=body(root/(row[0]+('-solution' if kind=='solution' else '')+'.html'))
  assert norm(original.text_content())==norm(imported.text_content()),f'Text changed: {row[0]} {kind}'
  assert len(original.xpath('.//img|.//svg'))==len(imported.xpath('.//img|.//svg'))
  for el in imported.iter():
   if not isinstance(el.tag,str) or el.tag in ['metadata','title'] or any(a.tag=='metadata' or 'figure-description' in a.get('class','') or 'mobile-diagram' in a.get('class','') for a in el.iterancestors()):continue
   for text in [el.text,el.tail]:
    n=norm(text or '')
    if len(n)>=24 and n not in pdftext:missing.append((row[0],kind,n[:110]))
 print(kind,len(pdf),'pages; all A4:',all(abs(p.rect.width-595.28)<1 and abs(p.rect.height-841.89)<1 for p in pdf))
print('Source/imported body text and figure counts: PASS')
print('Long source text fragments not matched in PDF:',len(missing))
for item in missing:print(item)
if missing:raise SystemExit(1)
