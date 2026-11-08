"""Independent No.003 arithmetic, simulation and editorial checks; no live writes."""
from collections import Counter
from pathlib import Path
from lxml import html
import json

ROOT=Path(__file__).resolve().parents[1]/'mock-exams/exams/003/1'
exam=json.loads((ROOT/'exam.json').read_text())
assert len(exam['fields'])==53 and len(exam['scoring'])==48
assert sum(u['maxPoints'] for u in exam['scoring'])==100
# Q1: waiting data does not include the already-saved first packet.
assert 500+500<=1024<500+500+200
assert 4*(500+40)+(200+40)==2400
lights=(0xA6>>4)|(0x9B>>4)
count=lights.bit_count()
brightness=min(max(0xA6&15,0x9B&15),250//(count*10))
assert f'{lights:X}{brightness:X}'=='B8'
# Q2B: simulate people arriving/being served, independently of printed tables.
arrivals=[0,3,2,0,3,1,2,0]
def queue(arrivals, threshold=None):
    waiting=[];size=0;extra=0
    for arrival in arrivals:
        staff=1+int(threshold is not None and size>=threshold)
        extra+=staff-1
        size=max(0,size+arrival-staff);waiting.append(size)
    return waiting,extra
assert queue(arrivals)==([0,2,3,2,4,4,5,4],0)
assert queue(arrivals,3)==([0,2,3,1,3,2,3,1],3)
bins=[372,2645,3554,2337,897,170,22,2,1]
assert sum(bins)==10000
assert [sum(bins[:n]) for n in [2,3,4,5]]==[3017,6571,8908,9805]
assert sum(bins[2:])==6983
assert 10000-(134+21+1)==9844 and 10000-(794+106+12+1)==9087
assert 9844>=9500>9087 and 4.94<20
# Q3: seat by seat, sort candidates by the three stated priorities.
original=[[1,1,2,2,3],[1,2,1,3,2],[4,1,2,1,3],[1,4,3,1,2]]
assert [Counter(v for row in original for v in row)[k] for k in range(1,5)]==[8,6,4,2]
def pairs(seats):
    return sum(seats[r][c]==seats[r][c-1] for r in range(4) for c in range(1,5))+sum(seats[r][c]==seats[r-1][c] for r in range(1,4) for c in range(5))
def greedy(counts):
    counts=counts[:];seats=[[0]*5 for _ in range(4)];executions=0
    for r in range(4):
        for c in range(5):
            candidates=[k for k in range(4) if counts[k]]
            executions+=len(candidates)
            def rank(k):
                adjacent=int(c>0 and seats[r][c-1]==k+1)+int(r>0 and seats[r-1][c]==k+1)
                return adjacent,-counts[k],k
            chosen=min(candidates,key=rank);seats[r][c]=chosen+1;counts[chosen]-=1
    assert counts==[0]*4
    return seats,executions
seats,executions=greedy([8,6,4,2])
assert seats==[[1,2,1,2,1],[2,1,3,1,2],[1,3,1,2,3],[4,1,2,3,4]]
assert pairs(seats)==0 and executions==74 and seats[3][2]==2
counterexample,_=greedy([8,5,4,3]);assert pairs(counterexample)==1
counterexample[-1][-2:]=reversed(counterexample[-1][-2:]);assert pairs(counterexample)==0
# Q4: comparison signs, equal-menu weights, missing-day average and ratio reversal.
assert 6.959<8.766 and 13.770<22.478 and 19.3<23.2
assert 8.3>3.5 and -8.3+11.8>0
assert 29.2>16.6 and 29.2/70.5<16.6/35.1
assert (134*23.4+21.8)/135<23.4
for section in exam['sections']:
    for key in ['screenProblem','screenSolution']:
        d=html.fromstring((ROOT/section[key]).read_bytes())
        assert not d.xpath('//script|//header|//footer')
        assert not any('@font-face' in (s.text or '') for s in d.xpath('//style'))
        if key=='screenSolution':
            heads=[e.text_content().strip() for e in d.xpath('//h1|//h2|//h3')]
            assert not any(h in ['正答・配点','正答と配点','検証について','測定する力','設計・出典について'] for h in heads)
assert 'CC BY 4.0' in (ROOT/'screen/q4-solution.html').read_text()
print('PASS No.003: packet storage/retransmission, B8, queue update/histogram targets, seating/74 executions/counterexample, ratio comparisons, omissions/attribution')
