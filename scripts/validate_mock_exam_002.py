"""No.002 reviewed math/data checks. No network or statistics writes."""
from pathlib import Path
from lxml import html
from itertools import product
import json, math

ROOT=Path(__file__).resolve().parents[1]/'mock-exams/exams/002/1'
exam=json.loads((ROOT/'exam.json').read_text())
qa=json.loads((ROOT/'source/qa.json').read_text())
assert exam['id']=='002' and exam['version']==1
assert len(exam['fields'])==55 and len(exam['scoring'])==46
assert sum(u['maxPoints'] for u in exam['scoring'])==100
# Q1: time sampling, quantization order and the compulsory stop condition.
assert 1000/0.0625/1000==16
quantize=lambda value: math.floor(value+0.5)
assert [quantize(x*2) for x in (237.2,237.4)]==[474,475]
assert [quantize(x)*2 for x in (237.2,237.4)]==[474,474]
assert 3*24/16==4.5
for a,b,c in product([0,1],repeat=3):
 expected=(not a) and (b or c)
 assert ((1-a)*(b+c-b*c))==expected
# Q2B: simultaneous update (never overwrite old cells while reading them).
def advance(p):return [p[i]*p[(i+1)%8]+p[(i-1)%8]*(1-p[i]) for i in range(8)]
def waiting(p):return sum(p[i]*p[(i+1)%8] for i in range(8))
p=[0,1,1,0,0,1,0,1];a=1
for n in range(1,9):
 if not p[(a+1)%8]:a=(a+1)%8
 p=advance(p)
 if n<8:assert a!=0
assert a==0
p=[1,1,0,1,1,0,0,0];trace=[];D=0
while waiting(p):
 w=waiting(p);trace.append(w);D+=w;p=advance(p)
assert trace==[2,1,1] and len(trace)==3 and D==4
rank=[]
for code in ['00011101','01100110','00110110','01001110']:
 p=list(map(int,code));n=1
 while waiting(p):p=advance(p);n+=1
 rank.append(n)
assert rank==[3,2,4,4]
# Q3: independently simulate minute-by-minute task occupancy, not the
# closed-form maximum recurrence used in the printed completed program.
durations=[[12,6,5,4,6],[10,0,24,0,0],[7,10,5,7,6]]
def prepare(order):
 cursor=[0,0,0];active=[None,None,None];done=[set(),{r for r in range(5) if durations[1][r]==0},set()];finish={}
 for time in range(200):
  for team in range(3):
   if active[team] and active[team][1]==time:
    done[team].add(active[team][0]);active[team]=None
  for team in range(3):
   while active[team] is None and cursor[team]<5:
    room=order[cursor[team]]
    if team==1 and durations[team][room]==0:done[team].add(room);cursor[team]+=1;continue
    if team==1 and room not in done[0]:break
    active[team]=(room,time+durations[team][room]);cursor[team]+=1
  for room in range(5):
   if room not in finish and all(room in d for d in done):finish[room]=time
  if len(finish)==5:return [finish[i] for i in range(5)]
 raise AssertionError('setup did not finish')
first=prepare([0,1,2,3,4]);second=prepare([2,0,1,3,4])
assert first==[22,18,47,29,35] and second==[39,23,29,29,35]
time=0
for end in first:time=max(time,end)+5
assert time==62
order=sorted(range(5),key=lambda i:(second[i],i));assert order==[1,2,3,4,0]
time=0
for room in order:time=max(time,second[room])+5
assert time==49
# Q4: compare counts vs rates, standardize with the stated common weights,
# residuals and the 120-student cross-tabulation.
assert 49>24 and 49/303<24/92
weights=[142,188,65];assert sum(weights)==395
assert round(sum(n*x for n,x in zip(weights,[-.84,-.19,-.17]))/395,2)==-.42
assert round(sum(n*x for n,x in zip(weights,[-1.16,-.74,0]))/395,2)==-.77
assert 13-10==19-16 and 13-(1.11*10-1.65)>19-(1.11*16-1.65)
assert 92+1+19+8==120 and 19+8==27 and 1+8==9
# Learner-facing documents retain all source files but omit editorial appendices.
for section in exam['sections']:
 for key in ['solution','screenSolution']:
  d=html.fromstring((ROOT/section[key]).read_bytes())
  headings=[''.join(e.itertext()).strip() for e in d.xpath('//h1|//h2|//h3')]
  assert not any(h in ['正答・配点','正答と配点','検証','測定する力と設問のつながり','代入の実行回数'] for h in headings),(section['id'],headings)
assert 'CC BY 4.0' in (ROOT/'screen/q4-solution.html').read_text()
print('PASS No.002: sampling/quantization, circuit truth table, simultaneous traffic updates, minute simulation 62→49, weighted comparison, prediction errors, omissions and attribution')
