import test from 'node:test';
import assert from 'node:assert/strict';
import {weatherRows} from '../foundations/weather-data.mjs';
import {normalize} from './model.mjs';
import {lesson,weatherGroups,suitability,rainAxisExample,RECOMMENDED} from './lessons.mjs';
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
test('Celsius observations are never rendered as ratio bars or pie shares',()=>{
 assert.equal(suitability('trend','bar').level,'unavailable');assert.equal(suitability('trend','pie').level,'unavailable');assert.match(suitability('trend','bar').text,/0℃/);assert.match(suitability('trend','pie').text,/全体を分け合う量ではありません/);assert.match(lesson(rows,'trend').quiz.reason,/℃ − .*℃/);
});
test('alternative valid charts receive a purpose-specific comparison rather than a false incorrect verdict',()=>{
 assert.equal(suitability('compare','pie').level,'limited');assert.equal(suitability('share','bar').level,'limited');assert.match(suitability('compare','line').text,/時間|日付/);assert.equal(suitability('relation','line').level,'limited');
});
test('the axis ratio experiment uses positive rainfall amounts with meaningful zero',()=>{
 const r=rainAxisExample(rows);assert.equal(r.items[0].value,31);assert.equal(r.items[1].value,25.5);assert.ok(r.limit<r.items[1].value);assert.equal(r.ratio,31/25.5);assert.equal(rainAxisExample([['a',0],['b',0]]),null);assert.equal(rainAxisExample([['a',2],['b',2]]),null);
});
test('answers and choices persist for unchanged data but reset after edits',()=>{
 let s=normalize({rows,origin:'sample'});s=normalize({...s,tasks:['trend','trend','compare'],choices:['line','line','bar'],answers:['11.7','',''],shown:[true,false,false]});assert.equal(s.tasks[0],'trend');assert.equal(s.answers[0],'11.7');const edited=rows.map(r=>[...r]);edited[0][2]=20;const next=normalize({...s,rows:edited});assert.deepEqual(next.tasks,['compare','compare','share']);assert.deepEqual(next.answers,['','','']);assert.deepEqual(next.shown,[false,false,false]);
});
test('constant and small custom datasets have unambiguous numeric choices',()=>{
 const data=[['2025-01-01',0,10,0],['2025-01-02',0,10,0]];for(const task of Object.keys(RECOMMENDED)){const l=lesson(data,task);assert.ok(l.quiz.options.some(o=>o[0]===l.quiz.correct));assert.equal(new Set(l.quiz.options.map(o=>o[0])).size,3);}
});
