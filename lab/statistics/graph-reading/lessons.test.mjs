import test from 'node:test';
import assert from 'node:assert/strict';
import {weatherRows} from '../foundations/weather-data.mjs';
import {normalize} from './model.mjs';
import {lesson,weatherGroups,suitability,rainAxisExample,RECOMMENDED,supportedKinds} from './lessons.mjs';
const rows=weatherRows();
test('weather groups partition every observation exactly once and reordering preserves counts',()=>{
 const groups=weatherGroups(rows);assert.equal(groups.reduce((n,g)=>n+g.value,0),61);assert.equal(groups[0].value,13);
 for(let order=0;order<3;order++)assert.deepEqual(weatherGroups(rows,order).slice().sort((a,b)=>a.id.localeCompare(b.id)),groups.slice().sort((a,b)=>a.id.localeCompare(b.id)));
});
test('changing the question changes the representation of the underlying observations',()=>{
 const compare=lesson(rows,'compare'),trend=lesson(rows,'trend'),share=lesson(rows,'share'),distribution=lesson(rows,'distribution'),relation=lesson(rows,'relation');
 assert.equal(compare.items.length,3);assert.equal(trend.items.length,61);assert.equal(distribution.items.reduce((n,r)=>n+r.value,0),61);assert.deepEqual(compare.items,share.items);assert.equal(relation.rows.length,61);assert.equal(trend.unit,'日平均気温（℃）');assert.equal(compare.unit,'日数（日）');assert.equal(share.quiz.correct,(share.items[2].value/61*100).toFixed(1).replace(/\.0$/,''));
});
test('each question has an explicit recommended representation and a computed answer',()=>{
 for(const task of Object.keys(RECOMMENDED)){const l=lesson(rows,task);assert.equal(l.recommended,RECOMMENDED[task]);assert.equal(suitability(task,l.recommended).level,'recommended');assert.ok(l.quiz.options.some(o=>o[0]===l.quiz.correct));assert.equal(new Set(l.quiz.options.map(o=>o[0])).size,l.quiz.options.length);assert.ok(l.reason.length>20);}
});
test('temperature bars and histograms can be compared, while temperature pie shares stay unavailable',()=>{
 assert.equal(suitability('trend','bar').level,'limited');assert.equal(suitability('trend','histogram').level,'limited');assert.equal(suitability('trend','pie').level,'unavailable');assert.match(suitability('trend','bar').text,/20℃.*10℃.*2倍/);assert.match(suitability('trend','histogram').text,/日付の順序/);assert.deepEqual(supportedKinds('trend'),['line','bar','histogram']);assert.deepEqual(supportedKinds('compare'),['bar','line','pie']);assert.deepEqual(supportedKinds('relation'),['scatter','line']);
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
 const old={rows,origin:'user',lessonVersion:2,rowsKey:JSON.stringify(rows),tasks:['trend','compare','share'],choices:['bar','line','pie'],answers:['a','b','c']};const s=normalize(old);assert.deepEqual(s.rows,rows);assert.equal(s.origin,'user');assert.equal(s.lessonVersion,3);assert.deepEqual(s.choices,['line','bar','scatter']);assert.equal(s.tasks,undefined);
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
 const chart=pairedTimeChart(rows,{focusDay:rows[0][0]});assert.equal((chart.match(/<polyline /g)||[]).length,2);assert.match(chart,/data-time-series="sun"/);assert.match(chart,/data-time-series="temp"/);assert.match(chart,/日付（上段・下段共通）/);assert.match(chart,/data-preserve-geometry/);for(const points of chart.matchAll(/points="([^"]+)"/g)){const xs=points[1].split(' ').map(p=>Number(p.split(',')[0]));assert.equal(xs.length,61);assert.ok(xs.every((x,i)=>!i||x>=xs[i-1]));}
});
test('all graph choices can be saved even when the current subject cannot render them',()=>{
 const s=normalize({rows,origin:'sample'});for(const kind of ['bar','line','pie','histogram','scatter'])assert.deepEqual(normalize({...s,choices:[kind,kind,kind]}).choices,[kind,kind,kind]);
});
