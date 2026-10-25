import test from 'node:test';
import assert from 'node:assert/strict';
import {weatherRows} from '../foundations/weather-data.mjs';
import {normalize,enterView} from './model.mjs';
import {lesson,weatherGroups,suitability,rainAxisExample,RECOMMENDED,supportedKinds} from './lessons.mjs';
const rows=weatherRows();
test('weather groups partition every observation exactly once and reordering preserves counts',()=>{
 const groups=weatherGroups(rows);assert.equal(groups.reduce((n,g)=>n+g.value,0),61);assert.deepEqual(groups.map(g=>g.value),[48,6,7]);assert.deepEqual(weatherGroups([['a',0],['b',.5],['c',1],['d',9.5],['e',10]]).map(g=>g.value),[2,2,1]);
 for(let order=0;order<3;order++)assert.deepEqual(weatherGroups(rows,order).slice().sort((a,b)=>a.id.localeCompare(b.id)),groups.slice().sort((a,b)=>a.id.localeCompare(b.id)));
});
test('changing the question changes the representation of the underlying observations',()=>{
 const compare=lesson(rows,'compare'),trend=lesson(rows,'trend'),share=lesson(rows,'share'),distribution=lesson(rows,'distribution'),relation=lesson(rows,'relation');
 assert.equal(compare.items.length,3);assert.equal(trend.items.length,61);assert.equal(distribution.items.reduce((n,r)=>n+r.value,0),61);assert.deepEqual(compare.items,share.items);assert.equal(relation.rows.length,61);assert.equal(trend.unit,'日平均気温（℃）');assert.equal(compare.unit,'日数（日）');assert.equal(share.quiz.correct,(share.items[0].value/61*100).toFixed(1).replace(/\.0$/,''));
});
test('each question has an explicit recommended representation and a computed answer',()=>{
 for(const task of Object.keys(RECOMMENDED)){const l=lesson(rows,task);assert.equal(l.recommended,RECOMMENDED[task]);assert.equal(suitability(task,l.recommended).level,'recommended');assert.ok(l.quiz.options.some(o=>o[0]===l.quiz.correct));assert.equal(new Set(l.quiz.options.map(o=>o[0])).size,l.quiz.options.length);assert.ok(l.reason.length>20);}
});
test('temperature bars and histograms can be compared, while temperature pie shares stay unavailable',()=>{
 assert.equal(suitability('trend','bar').level,'limited');assert.equal(suitability('trend','histogram').level,'limited');assert.equal(suitability('trend','pie').level,'unavailable');assert.match(suitability('trend','bar').text,/変化が見えにくく.*0℃/);assert.match(suitability('trend','histogram').text,/日付の順序/);assert.deepEqual(supportedKinds('trend'),['line','bar','histogram']);assert.deepEqual(supportedKinds('compare'),['bar','line','pie','histogram']);assert.deepEqual(supportedKinds('relation'),['scatter','line','bar']);
});
test('alternative valid charts receive a purpose-specific comparison rather than a false incorrect verdict',()=>{
 assert.equal(suitability('compare','pie').level,'limited');assert.equal(suitability('share','bar').level,'limited');assert.match(suitability('compare','line').text,/時間|日付/);assert.equal(suitability('relation','line').level,'limited');
});
test('the axis ratio experiment uses positive rainfall amounts with meaningful zero',()=>{
 const r=rainAxisExample(rows);assert.equal(r.items[0].value,31);assert.equal(r.items[1].value,25.5);assert.ok(r.limit<r.items[1].value);assert.equal(r.ratio,31/25.5);assert.equal(rainAxisExample([['a',0],['b',0]]),null);assert.equal(rainAxisExample([['a',2],['b',2]]),null);
});
test('subject choices persist for unchanged observations and reset after row edits',()=>{
 let s=normalize({rows,origin:'sample'});s=normalize({...s,choices:['bar','pie','line'],answers:['11.7','',''],rainQuestion:'share'});assert.deepEqual(s.choices,['bar','pie','line']);assert.equal(s.answers[0],'11.7');assert.equal(s.rainQuestion,'share');const edited=rows.map(r=>[...r]);edited[0][2]=20;const next=normalize({...s,rows:edited});assert.deepEqual(next.choices,['line','bar','scatter']);assert.deepEqual(next.answers,['','','']);assert.equal(next.rainQuestion,'compare');
});
test('the previous question-based state migrates without losing observed or imported data',()=>{
 const old={rows,origin:'user',lessonVersion:2,rowsKey:JSON.stringify(rows),tasks:['trend','compare','share'],choices:['bar','line','pie'],answers:['a','b','c']};const s=normalize(old);assert.deepEqual(s.rows,rows);assert.equal(s.origin,'user');assert.equal(s.lessonVersion,4);assert.deepEqual(s.choices,['line','bar','scatter']);assert.equal(s.tasks,undefined);
});
test('constant and small custom datasets have unambiguous numeric choices',()=>{
 const data=[['2025-01-01',0,10,0],['2025-01-02',0,10,0]];for(const task of Object.keys(RECOMMENDED)){const l=lesson(data,task);assert.ok(l.quiz.options.some(o=>o[0]===l.quiz.correct));assert.equal(new Set(l.quiz.options.map(o=>o[0])).size,3);}
});

import {categoryChart} from '../foundations/charts.mjs';
test('temperature bars spanning zero have nonnegative rectangle dimensions',()=>{
 const chart=categoryChart([{label:'A',value:-5},{label:'B',value:5}],{min:-6,baseline:0,unit:'℃'});assert.doesNotMatch(chart,/NaN|Infinity/);for(const m of chart.matchAll(/height="([^"]+)"/g))assert.ok(Number(m[1])>=0);
});

import {pairedTimeChart} from './charts.mjs';
test('the alternative line chart is two real time series with a common date axis',()=>{
 const chart=pairedTimeChart(rows,{focusDay:rows[0][0]});assert.equal((chart.match(/<polyline /g)||[]).length,2);assert.match(chart,/data-time-series="sun"/);assert.match(chart,/data-time-series="temp"/);assert.match(chart,/右目盛り/);assert.match(chart,/data-preserve-geometry/);for(const points of chart.matchAll(/points="([^"]+)"/g)){const xs=points[1].split(' ').map(p=>Number(p.split(',')[0]));assert.equal(xs.length,61);assert.ok(xs.every((x,i)=>!i||x>=xs[i-1]));}
});
test('all graph choices can be saved even when the current subject cannot render them',()=>{
 const s=normalize({rows,origin:'sample'});for(const kind of ['bar','line','pie','histogram','scatter'])assert.deepEqual(normalize({...s,choices:[kind,kind,kind]}).choices,[kind,kind,kind]);
});

test('opening a subject selects its recommendation while retaining observations and other settings',()=>{
 const s=normalize({...normalize({rows,origin:'user'}),choices:['bar','line','line'],rainQuestion:'share',pairLayout:'stack'});
 for(const [i,expected] of ['line','pie','scatter'].entries()){const next=enterView(s,i);assert.equal(next.choices[i],expected);assert.deepEqual(next.rows,rows);assert.equal(next.origin,'user');assert.equal(next.pairLayout,'stack');}
 assert.equal(enterView({...s,rainQuestion:'compare'},1).choices[1],'bar');
});
test('paired series retain shape and line distinctions with separate scales, and bars render both quantities',()=>{
 const overlay=pairedTimeChart(rows);assert.match(overlay,/data-series-shape="circle"/);assert.match(overlay,/data-series-shape="square"/);assert.match(overlay,/stroke-dasharray="6 4"/);assert.match(overlay,/data-axis-side="right"/);
 for(const layout of ['overlay','stack'])for(const data of [rows,[['2025-01-01',0,-5,0],['2025-01-02',2,5,10]]]){
  const chart=pairedTimeChart(data,{kind:'bar',layout});assert.equal((chart.match(/data-series-bar=/g)||[]).length,data.length*2);assert.match(chart,/url\(#graph-temp-hatch\)/);assert.doesNotMatch(chart,/NaN|Infinity|undefined/);for(const m of chart.matchAll(/(?:width|height)="([^"]+)"/g))assert.ok(Number(m[1])>=0);
 }
 const stack=pairedTimeChart(rows,{layout:'stack'});assert.match(stack,/日付（上下共通）/);assert.equal((stack.match(/data-axis-side="left"/g)||[]).length,2);
});
test('rainfall classification ignores sunshine and uses nonoverlapping rainfall cutoffs',()=>{
 const other=rows.map(r=>[r[0],r[1],r[2],24-r[3]]);assert.deepEqual(weatherGroups(rows),weatherGroups(other));assert.equal(suitability('relation','bar').level,'limited');assert.equal(suitability('compare','histogram').level,'limited');
});
