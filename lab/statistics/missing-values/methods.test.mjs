import test from 'node:test';
import assert from 'node:assert/strict';
import {METHODS,processMissing,scenario,normalize,stats} from './model.mjs';
import {missingValuesChart} from './charts.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
test('median imputation uses the numeric median and differs from mean on skewed rainfall',()=>{
 const data=[['a',0],['b',0],['c',30],['d',null]];assert.deepEqual(processMissing(data,'median').filled,[0,0,30,0]);assert.deepEqual(processMissing(data,'mean').filled,[0,0,30,10]);assert.deepEqual(processMissing([['a',2],['b',8],['c',null]],'median').filled,[2,8,5]);
});
test('previous-value imputation preserves leading gaps and uses the last observed zero',()=>{
 const data=[['a',null],['b',2],['c',null],['d',0],['e',null],['f',8],['g',null]],r=processMissing(data,'previous');assert.deepEqual(r.filled,[null,2,2,0,0,8,8]);assert.equal(r.remaining,1);assert.equal(r.imputed,3);assert.equal(r.n,6);
});
test('linear interpolation uses elapsed dates, fills internal runs and leaves both edges missing',()=>{
 const data=[['2025-01-01',null],['2025-01-02',2],['2025-01-03',null],['2025-01-04',null],['2025-01-06',10],['2025-01-07',null]],r=processMissing(data,'linear');assert.deepEqual(r.filled,[null,2,4,6,10,null]);assert.equal(r.n,4);assert.equal(r.remaining,2);assert.equal(r.imputed,2);
});
test('linear interpolation rejects observation names, impossible or unordered dates without fabricating values',()=>{
 for(const data of [[['A',2],['B',null],['C',8]],[['2025-02-30',2],['2025-03-01',null],['2025-03-02',8]],[['2025-01-03',2],['2025-01-02',null],['2025-01-01',8]]]){const r=processMissing(data,'linear');assert.equal(r.available,false);assert.ok(r.reason);assert.deepEqual(r.filled,data.map(r=>r[1]));assert.equal(r.remaining,1);}
});
test('every method preserves observations, conserves gap counts and reports statistics from the actual usable values',()=>{
 for(const s of [scenario(),scenario('high'),scenario('none'),{rows:[['2025-01-01',null],['2025-01-02',null]]}])for(const [method] of METHODS){const before=JSON.stringify(s.rows),r=processMissing(s.rows,method);assert.equal(JSON.stringify(s.rows),before);s.rows.forEach((v,i)=>{if(v[1]!==null)assert.equal(r.filled[i],v[1]);});assert.equal(r.remaining+r.imputed,r.missing);assert.equal(r.n+r.remaining,s.rows.length);assert.deepEqual({n:r.n,sum:r.sum,mean:r.mean,variance:r.variance},stats(r.filled.filter(v=>v!==null)));}
});
test('methods without any observations retain unknown values while explicit zero imputation still works',()=>{
 const data=[['2025-01-01',null],['2025-01-02',null]];for(const [method] of METHODS){const r=processMissing(data,method);if(method==='zero'){assert.deepEqual(r.filled,[0,0]);assert.equal(r.mean,0);}else{assert.deepEqual(r.filled,[null,null]);assert.equal(r.mean,null);assert.equal(r.remaining,2);}}
});
test('new method choices and legacy observations survive normalization without changing the fixed dataset',()=>{
 for(const [method] of METHODS){const s=normalize({...scenario('high'),method});assert.equal(s.method,method);assert.deepEqual(s.rows,scenario('high').rows);assert.deepEqual(s.truth,scenario('high').truth);}const old=normalize({rows:[['A',null],['B',0]],origin:'user',method:'mean',truth:[12,0]});assert.equal(old.method,'mean');assert.equal(old.truth,null);assert.equal(old.rows[0][1],null);
});
test('charts distinguish imputed zero and remaining gaps and restrict reference markers to hidden days',()=>{
 const s=scenario('high');for(const [method] of METHODS){const r=processMissing(s.rows,method),chart=missingValuesChart(s.rows,r.filled,{truth:s.truth});assert.equal((chart.match(/data-reference-value=/g)||[]).length,6);assert.equal((chart.match(/data-missing-day=/g)||[]).length,30);assert.equal((chart.match(/data-missing-imputed="true"/g)||[]).length,r.imputed);assert.doesNotMatch(chart,/NaN|Infinity|undefined/);assert.match(chart,/data-preserve-geometry/);}
 const all=[['A',null],['B',null]],chart=missingValuesChart(all,[0,0]);assert.equal((chart.match(/data-missing-imputed="true"/g)||[]).length,2);assert.match(chart,/l4,4l-4,4l-4,-4Z/);
});
