"""Record actual named answer-group headings from the licensed original PDFs."""
from pathlib import Path
import sys,json,fitz
sys.path.insert(0,str(Path(__file__).resolve().parent))
import import_past_exams as imp
out={}
for key,exam_id in imp.FILES.items():
 folder=imp.OUTROOT/exam_id/'1';doc=fitz.open(folder/'source/problem.pdf');exam=json.loads((folder/'exam.json').read_text());pages={}
 for n,page in enumerate(doc):
  lines=imp.page_data(doc,page);sid=imp.SID[max(k for k in range(5) if imp.STARTS[key][k]<=n)]
  fields={f['label']:f for f in exam['fields'] if f['sectionId']==sid};boxes=imp.find_boxes(page,lines,fields)
  for line in lines:
   if imp.norm(line['text'])!='の解答群':continue
   rect=line['bbox'];cy=(rect.y0+rect.y1)/2
   bs=sorted([b for b in boxes if abs((b['rect'].y0+b['rect'].y1)/2-cy)<9 and b['rect'].x1<rect.x0+2],key=lambda b:b['rect'].x0)
   if not bs:raise ValueError((exam_id,n+1,'Missing heading labels'))
   left=bs[0]['rect'].x0
   chars=[c for l in lines for c in l['chars'] if abs((c['bbox'][1]+c['bbox'][3])/2-cy)<9 and left-1<=c['bbox'][0]<=rect.x1]
   title=''.join(c['c'] for c in sorted(chars,key=lambda c:c['bbox'][0])).strip()
   pages.setdefault(str(n+1),[]).append({'labels':[b['label'] for b in bs],'title':title,'bbox':list(rect)})
 out[key]=pages
path=imp.REVIEW/'choice-headings.json';path.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n');print('Original PDF named headings:',sum(len(v) for p in out.values() for v in p.values()))
